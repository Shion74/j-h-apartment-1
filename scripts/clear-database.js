#!/usr/bin/env node

/**
 * Database Cleanup Script
 * 
 * WARNING: This script will permanently delete ALL tenant and billing data!
 * This includes:
 * - All active tenants
 * - All archived tenants (tenant_history)
 * - All active bills
 * - All archived bills (bill_history)
 * - All payments and transactions
 * - All deposits and refunds
 * 
 * Use with extreme caution!
 */

const { pool } = require('../lib/database')

async function clearDatabase() {
  console.log('🚨 WARNING: This will permanently delete ALL tenant and billing data!')
  console.log('⏳ Starting database cleanup in 5 seconds...')
  
  // Wait 5 seconds to give user a chance to cancel
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  try {
    console.log('🔄 Starting transaction...')
    await pool.query('BEGIN')

    // 1. Clear all bills and related data
    console.log('📄 Clearing bill-related data...')
    
    // Clear payments first (has foreign key to bills)
    const paymentsResult = await pool.query('DELETE FROM payments')
    console.log(`   ✅ Deleted ${paymentsResult.rowCount} payments`)
    
    // Clear active bills
    const billsResult = await pool.query('DELETE FROM bills')
    console.log(`   ✅ Deleted ${billsResult.rowCount} active bills`)
    
    // Clear bill history
    const billHistoryResult = await pool.query('DELETE FROM bill_history')
    console.log(`   ✅ Deleted ${billHistoryResult.rowCount} archived bills`)

    // 2. Clear deposit and transaction data
    console.log('💰 Clearing deposit and transaction data...')
    
    // Clear deposit transactions
    const depositTransactionsResult = await pool.query('DELETE FROM deposit_transactions')
    console.log(`   ✅ Deleted ${depositTransactionsResult.rowCount} deposit transactions`)
    
    // Clear tenant deposits
    const tenantDepositsResult = await pool.query('DELETE FROM tenant_deposits')
    console.log(`   ✅ Deleted ${tenantDepositsResult.rowCount} tenant deposits`)
    
    // Clear refunds
    const refundsResult = await pool.query('DELETE FROM refunds')
    console.log(`   ✅ Deleted ${refundsResult.rowCount} refunds`)

    // 3. Clear contract data
    console.log('📋 Clearing contract data...')
    
    const contractsResult = await pool.query('DELETE FROM contracts')
    console.log(`   ✅ Deleted ${contractsResult.rowCount} contracts`)

    // 4. Clear email notifications
    console.log('📧 Clearing email notifications...')
    
    const emailNotificationsResult = await pool.query('DELETE FROM email_notifications')
    console.log(`   ✅ Deleted ${emailNotificationsResult.rowCount} email notifications`)

    // 5. Clear tenant data
    console.log('👥 Clearing tenant data...')
    
    // Clear active tenants
    const tenantsResult = await pool.query('DELETE FROM tenants')
    console.log(`   ✅ Deleted ${tenantsResult.rowCount} active tenants`)
    
    // Clear tenant history
    const tenantHistoryResult = await pool.query('DELETE FROM tenant_history')
    console.log(`   ✅ Deleted ${tenantHistoryResult.rowCount} archived tenants`)

    // 6. Reset room statuses
    console.log('🏠 Resetting room statuses...')
    
    const roomsResult = await pool.query(`
      UPDATE rooms 
      SET status = 'vacant', tenant_id = NULL 
      WHERE status != 'vacant' OR tenant_id IS NOT NULL
    `)
    console.log(`   ✅ Reset ${roomsResult.rowCount} rooms to vacant status`)

    // 7. Reset any auto-increment sequences (if using them)
    console.log('🔄 Resetting sequences...')
    
    // Note: PostgreSQL uses sequences, MySQL uses AUTO_INCREMENT
    // This will reset the ID counters to start from 1 again
    try {
      await pool.query('ALTER SEQUENCE tenants_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE bills_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE payments_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE tenant_deposits_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE contracts_id_seq RESTART WITH 1')
      console.log('   ✅ Reset ID sequences')
    } catch (seqError) {
      console.log('   ⚠️  Could not reset sequences (they may not exist or use different names)')
    }

    // Commit the transaction
    await pool.query('COMMIT')
    
    console.log('')
    console.log('✅ Database cleanup completed successfully!')
    console.log('')
    console.log('📊 Summary:')
    console.log(`   • ${tenantsResult.rowCount} active tenants deleted`)
    console.log(`   • ${tenantHistoryResult.rowCount} archived tenants deleted`)
    console.log(`   • ${billsResult.rowCount} active bills deleted`)
    console.log(`   • ${billHistoryResult.rowCount} archived bills deleted`)
    console.log(`   • ${paymentsResult.rowCount} payments deleted`)
    console.log(`   • ${depositTransactionsResult.rowCount} deposit transactions deleted`)
    console.log(`   • ${tenantDepositsResult.rowCount} tenant deposits deleted`)
    console.log(`   • ${refundsResult.rowCount} refunds deleted`)
    console.log(`   • ${contractsResult.rowCount} contracts deleted`)
    console.log(`   • ${emailNotificationsResult.rowCount} email notifications deleted`)
    console.log(`   • ${roomsResult.rowCount} rooms reset to vacant`)
    console.log('')
    console.log('🏠 All rooms are now available for new tenants!')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    
    try {
      await pool.query('ROLLBACK')
      console.log('🔄 Transaction rolled back - no changes made')
    } catch (rollbackError) {
      console.error('❌ Error rolling back transaction:', rollbackError)
    }
    
    throw error
  } finally {
    await pool.end()
  }
}

// Run the cleanup
if (require.main === module) {
  clearDatabase()
    .then(() => {
      console.log('✅ Cleanup script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error)
      process.exit(1)
    })
}

module.exports = { clearDatabase } 