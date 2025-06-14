import { pool } from '../lib/database.js'
import emailService from './emailService.js'

// Get contracts expiring within specified days
const getExpiringContracts = async (days = 30) => {
  try {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + days)
    
    const [contracts] = await pool.execute(`
      SELECT t.*, r.room_number, r.monthly_rent, b.name as branch_name, b.address as branch_address
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id  
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.contract_end_date <= ? 
        AND t.contract_status = 'active'
        AND (t.contract_expiry_notified = FALSE OR t.contract_expiry_notified IS NULL)
      ORDER BY t.contract_end_date ASC
    `, [expiryDate.toISOString().split('T')[0]])
    
    return contracts
  } catch (error) {
    console.error('Error getting expiring contracts:', error)
    throw error
  }
}

// Get contract statistics
const getContractStatistics = async () => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_contracts,
        COUNT(CASE WHEN contract_status = 'active' THEN 1 END) as active_contracts,
        COUNT(CASE WHEN contract_status = 'expired' THEN 1 END) as expired_contracts,
        COUNT(CASE WHEN contract_status = 'terminated' THEN 1 END) as terminated_contracts,
        COUNT(CASE WHEN contract_end_date <= CURDATE() + INTERVAL 30 DAY AND contract_status = 'active' THEN 1 END) as expiring_soon
      FROM tenants
      WHERE contract_status IN ('active', 'expired', 'terminated')
    `)
    
    return stats[0]
  } catch (error) {
    console.error('Error getting contract statistics:', error)
    throw error
  }
}

// Mark contract as expired
const markContractAsExpired = async (tenantId) => {
  try {
    await pool.execute(
      'UPDATE tenants SET contract_status = ? WHERE id = ?',
      ['expired', tenantId]
    )
    
    // Also update room status to vacant
    await pool.execute(`
      UPDATE rooms r
      INNER JOIN tenants t ON r.id = t.room_id
      SET r.status = 'vacant'
      WHERE t.id = ? AND t.contract_status = 'expired'
    `, [tenantId])
    
    return true
  } catch (error) {
    console.error('Error marking contract as expired:', error)
    throw error
  }
}

// Renew contract
const renewContract = async (tenantId, durationMonths = 6) => {
  try {
    const connection = await pool.getConnection()
    await connection.beginTransaction()
    
    try {
      // Get current tenant info
      const [tenants] = await connection.execute(
        'SELECT * FROM tenants WHERE id = ?',
        [tenantId]
      )
      
      if (tenants.length === 0) {
        throw new Error('Tenant not found')
      }
      
      const tenant = tenants[0]
      const newStartDate = new Date(tenant.contract_end_date)
      const newEndDate = new Date(newStartDate)
      newEndDate.setMonth(newEndDate.getMonth() + durationMonths)
      
      // Update tenant contract
      await connection.execute(`
        UPDATE tenants SET 
        contract_start_date = ?,
        contract_end_date = ?,
        contract_duration_months = ?,
        contract_status = 'renewed',
        contract_expiry_notified = FALSE
        WHERE id = ?
      `, [
        newStartDate.toISOString().split('T')[0],
        newEndDate.toISOString().split('T')[0],
        durationMonths,
        tenantId
      ])
      
      await connection.commit()
      
      return {
        success: true,
        newStartDate: newStartDate.toISOString().split('T')[0],
        newEndDate: newEndDate.toISOString().split('T')[0]
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('Error renewing contract:', error)
    throw error
  }
}

// Manual check for expiring contracts (replaces cron job)
const checkExpiringContracts = async () => {
  try {
    console.log('🔍 Checking for expiring contracts...')
    
    const expiringContracts = await getExpiringContracts(30)
    const results = {
      processed: 0,
      notifications_sent: 0,
      errors: 0,
      details: []
    }
    
    for (const tenant of expiringContracts) {
      try {
        const contractEndDate = new Date(tenant.contract_end_date)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((contractEndDate - today) / (1000 * 60 * 60 * 24))
        
        if (daysUntilExpiry <= 0) {
          // Contract expired - mark as expired
          await markContractAsExpired(tenant.id)
          results.details.push({
            tenant_id: tenant.id,
            name: tenant.name,
            room: tenant.room_number,
            action: 'marked_expired',
            days_overdue: Math.abs(daysUntilExpiry)
          })
        } else {
          // Send expiry notification
          if (tenant.email) {
            const roomInfo = {
              room_number: tenant.room_number,
              monthly_rent: tenant.monthly_rent,
              branch_name: tenant.branch_name
            }
            
            await emailService.sendContractExpiryNotification(tenant, roomInfo)
            results.notifications_sent++
            
            results.details.push({
              tenant_id: tenant.id,
              name: tenant.name,
              room: tenant.room_number,
              email: tenant.email,
              action: 'notification_sent',
              days_until_expiry: daysUntilExpiry
            })
          }
        }
        
        // Mark as notified
        await pool.execute(
          'UPDATE tenants SET contract_expiry_notified = TRUE WHERE id = ?',
          [tenant.id]
        )
        
        results.processed++
      } catch (error) {
        console.error(`Error processing tenant ${tenant.id}:`, error)
        results.errors++
        results.details.push({
          tenant_id: tenant.id,
          name: tenant.name || 'Unknown',
          action: 'error',
          error: error.message
        })
      }
    }
    
    console.log(`✅ Contract check completed: ${results.processed} processed, ${results.notifications_sent} notifications sent, ${results.errors} errors`)
    return results
  } catch (error) {
    console.error('Error in contract expiry check:', error)
    throw error
  }
}

export default {
  getExpiringContracts,
  getContractStatistics,
  markContractAsExpired,
  renewContract,
  checkExpiringContracts
} 