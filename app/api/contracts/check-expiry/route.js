import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'
import emailService from '../../../../services/emailService.js'

export async function POST(request) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    console.log('🔍 Starting contract expiry check...')

    // Get expiring contracts (30 days warning)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const expiringContractsResult = await pool.query(`
      SELECT t.*, r.room_number, b.name as branch_name
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.contract_end_date <= $1
        AND t.contract_status = 'active'
        AND (t.contract_expiry_notified = FALSE OR t.contract_expiry_notified IS NULL)
    const expiringContracts = expiringContractsResult.rows
    `, [thirtyDaysFromNow.toISOString().split('T')[0]])

    console.log(`📋 Found ${expiringContracts.length} expiring contracts`)

    const results = {
      notificationsTo30Days: [],
      notificationsTo7Days: [],
      expiredContracts: [],
      errors: []
    }

    for (const tenant of expiringContracts) {
      try {
        const contractEndDate = new Date(tenant.contract_end_date)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((contractEndDate - today) / (1000 * 60 * 60 * 24))

        let notificationType = ''
        let emailSent = false

        if (daysUntilExpiry <= 0) {
          // Contract expired
          await pool.query(
            'UPDATE tenants SET contract_status = ? WHERE id = ?',
            ['expired', tenant.id]
          )
          results.expiredContracts.push({
            tenantId: tenant.id,
            name: tenant.name,
            daysOverdue: Math.abs(daysUntilExpiry)
          })
          notificationType = 'expired'
        } else if (daysUntilExpiry <= 7) {
          // 7 days warning
          notificationType = '7_days'
          results.notificationsTo7Days.push({
            tenantId: tenant.id,
            name: tenant.name,
            daysLeft: daysUntilExpiry
          })
        } else if (daysUntilExpiry <= 30) {
          // 30 days warning  
          notificationType = '30_days'
          results.notificationsTo30Days.push({
            tenantId: tenant.id,
            name: tenant.name,
            daysLeft: daysUntilExpiry
          })
        }

        // Send email notification if tenant has email
        if (tenant.email && notificationType) {
          try {
            await emailService.sendContractExpiryNotification(tenant, daysUntilExpiry)
            emailSent = true
            
            // Log email notification
            await pool.query(`
              INSERT INTO email_notifications 
              (tenant_id, email_type, email_subject, recipient_email, status) 
              VALUES ($4, $5, $6, $7, $4) RETURNING id
            `, [
              tenant.id,
              `contract_expiry_${notificationType}`,
              `Contract ${notificationType === 'expired' ? 'Expired' : 'Expiring Soon'}`,
              tenant.email,
              'sent'
            ])
          } catch (emailError) {
            console.error(`❌ Failed to send email to ${tenant.name}:`, emailError)
            results.errors.push({
              tenantId: tenant.id,
              name: tenant.name,
              error: 'Email sending failed'
            })
          }
        }

        // Mark tenant as notified
        await pool.query(
          'UPDATE tenants SET contract_expiry_notified = TRUE WHERE id = ?',
          [tenant.id]
        )

        console.log(`✅ Processed tenant ${tenant.name}: ${daysUntilExpiry} days, email sent: ${emailSent}`)

      } catch (error) {
        console.error(`❌ Error processing tenant ${tenant.id}:`, error)
        results.errors.push({
          tenantId: tenant.id,
          name: tenant.name || 'Unknown',
          error: error.message
        })
      }
    }

    const summary = {
      total_processed: expiringContracts.length,
      notifications_30_days: results.notificationsTo30Days.length,
      notifications_7_days: results.notificationsTo7Days.length,
      expired_contracts: results.expiredContracts.length,
      errors: results.errors.length
    }

    console.log('📊 Contract expiry check completed:', summary)

    return NextResponse.json({
      success: true,
      message: 'Contract expiry check completed',
      summary,
      details: results
    })

  } catch (error) {
    console.error('❌ Contract expiry check failed:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
} 