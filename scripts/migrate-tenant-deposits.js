const { pool } = require('../lib/database')

async function migrateTenantDeposits() {
  console.log('🔄 Starting tenant deposits migration...')
  
  try {
    // Begin transaction
    await pool.query('BEGIN')
    
    // Check for existing tenants with deposit data
    const existingTenantsResult = await pool.query(`
      SELECT 
        id, name, 
        advance_payment, security_deposit,
        advance_payment_status, security_deposit_status,
        advance_payment_used, security_deposit_used,
        created_at
      FROM tenants 
      WHERE advance_payment IS NOT NULL 
         OR security_deposit IS NOT NULL 
         OR advance_payment_status IS NOT NULL 
         OR security_deposit_status IS NOT NULL
    `)
    
    const tenants = existingTenantsResult.rows
    
    if (tenants.length === 0) {
      console.log('ℹ️  No tenants with deposit data found in tenant table')
      await pool.query('ROLLBACK')
      return
    }
    
    console.log(`📋 Found ${tenants.length} tenant(s) with deposit data to migrate`)
    
    let migratedAdvance = 0
    let migratedSecurity = 0
    let migratedTransactions = 0
    
    for (const tenant of tenants) {
      console.log(`\n👤 Processing tenant: ${tenant.name} (ID: ${tenant.id})`)
      
      // Check if advance deposit already exists
      const existingAdvanceResult = await pool.query(`
        SELECT id FROM tenant_deposits 
        WHERE tenant_id = $1 AND deposit_type = 'advance'
      `, [tenant.id])
      
      if (existingAdvanceResult.rows.length === 0 && 
          (tenant.advance_payment || tenant.advance_payment_status)) {
        
        const advanceAmount = tenant.advance_payment || 3500.00
        const advanceUsed = tenant.advance_payment_used || 0
        const advanceStatus = tenant.advance_payment_status || 'unpaid'
        const remainingBalance = advanceStatus === 'paid' ? (advanceAmount - advanceUsed) : 0
        
        await pool.query(`
          INSERT INTO tenant_deposits (tenant_id, deposit_type, initial_amount, remaining_balance, status, notes)
          VALUES ($1, 'advance', $2, $3, $4, $5)
        `, [
          tenant.id, 
          advanceAmount, 
          remainingBalance,
          advanceStatus === 'paid' ? 'active' : 'unpaid',
          'Migrated from tenant table'
        ])
        
        console.log(`   ✅ Migrated advance deposit: ₱${advanceAmount} (Status: ${advanceStatus})`)
        migratedAdvance++
        
        // Create transaction record for used amount
        if (advanceUsed > 0) {
          await pool.query(`
            INSERT INTO deposit_transactions (tenant_id, transaction_type, action, amount, description, created_by, transaction_date)
            VALUES ($1, 'advance_payment', 'use', $2, $3, 'Migration', $4)
          `, [
            tenant.id,
            advanceUsed,
            'Historical deposit usage (migrated from tenant table)',
            tenant.created_at || new Date()
          ])
          console.log(`   💰 Created transaction record for used advance: ₱${advanceUsed}`)
          migratedTransactions++
        }
      } else if (existingAdvanceResult.rows.length > 0) {
        console.log(`   ⚠️  Advance deposit already exists in tenant_deposits table`)
      }
      
      // Check if security deposit already exists
      const existingSecurityResult = await pool.query(`
        SELECT id FROM tenant_deposits 
        WHERE tenant_id = $1 AND deposit_type = 'security'
      `, [tenant.id])
      
      if (existingSecurityResult.rows.length === 0 && 
          (tenant.security_deposit || tenant.security_deposit_status)) {
        
        const securityAmount = tenant.security_deposit || 3500.00
        const securityUsed = tenant.security_deposit_used || 0
        const securityStatus = tenant.security_deposit_status || 'unpaid'
        const remainingBalance = securityStatus === 'paid' ? (securityAmount - securityUsed) : 0
        
        await pool.query(`
          INSERT INTO tenant_deposits (tenant_id, deposit_type, initial_amount, remaining_balance, status, notes)
          VALUES ($1, 'security', $2, $3, $4, $5)
        `, [
          tenant.id, 
          securityAmount, 
          remainingBalance,
          securityStatus === 'paid' ? 'active' : 'unpaid',
          'Migrated from tenant table'
        ])
        
        console.log(`   ✅ Migrated security deposit: ₱${securityAmount} (Status: ${securityStatus})`)
        migratedSecurity++
        
        // Create transaction record for used amount
        if (securityUsed > 0) {
          await pool.query(`
            INSERT INTO deposit_transactions (tenant_id, transaction_type, action, amount, description, created_by, transaction_date)
            VALUES ($1, 'security_deposit', 'use', $2, $3, 'Migration', $4)
          `, [
            tenant.id,
            securityUsed,
            'Historical deposit usage (migrated from tenant table)',
            tenant.created_at || new Date()
          ])
          console.log(`   💰 Created transaction record for used security: ₱${securityUsed}`)
          migratedTransactions++
        }
      } else if (existingSecurityResult.rows.length > 0) {
        console.log(`   ⚠️  Security deposit already exists in tenant_deposits table`)
      }
    }
    
    // Commit transaction
    await pool.query('COMMIT')
    
    console.log('\n✅ Migration completed successfully!')
    console.log(`📊 Summary:`)
    console.log(`   • ${migratedAdvance} advance deposits migrated`)
    console.log(`   • ${migratedSecurity} security deposits migrated`)
    console.log(`   • ${migratedTransactions} deposit transactions created`)
    
    if (migratedAdvance > 0 || migratedSecurity > 0) {
      console.log('\n💡 Note: The old deposit columns in the tenants table are still there for backwards compatibility.')
      console.log('   You can remove them later if desired by running the SQL migration file.')
    }
    
  } catch (error) {
    await pool.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    // Don't close the pool connection here as it might be used elsewhere
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateTenantDeposits()
    .then(() => {
      console.log('✅ Migration script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error)
      process.exit(1)
    })
}

module.exports = { migrateTenantDeposits } 