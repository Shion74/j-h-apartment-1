const { pool } = require('./lib/database')

async function debugRoom1Status() {
  try {
    console.log('🔍 Debugging Room 1 billing status...')

    // Check Mark Dennis Perez details
    const tenantResult = await pool.query(`
      SELECT * FROM tenants 
      WHERE name ILIKE '%Mark Dennis%'
    `)
    
    if (tenantResult.rows.length > 0) {
      const tenant = tenantResult.rows[0]
      console.log('\n👤 Mark Dennis Perez Details:')
      console.log(`   ID: ${tenant.id}`)
      console.log(`   Room ID: ${tenant.room_id}`)
      console.log(`   Rent Start: ${tenant.rent_start}`)
      console.log(`   Status: ${tenant.status}`)
      console.log(`   Contract Status: ${tenant.contract_status}`)
    }

    // Check active bills for Mark Dennis
    const activeBillsResult = await pool.query(`
      SELECT * FROM bills 
      WHERE tenant_id IN (SELECT id FROM tenants WHERE name ILIKE '%Mark Dennis%')
      ORDER BY rent_from DESC
    `)
    
    console.log(`\n📋 Active Bills for Mark Dennis: ${activeBillsResult.rows.length}`)
    activeBillsResult.rows.forEach(bill => {
      console.log(`   Bill ID: ${bill.id} | ${bill.rent_from} to ${bill.rent_to} | Status: ${bill.status}`)
    })

    // Check bill history for Mark Dennis
    const historyBillsResult = await pool.query(`
      SELECT * FROM bill_history 
      WHERE tenant_name ILIKE '%Mark Dennis%'
      ORDER BY rent_from DESC
    `)
    
    console.log(`\n📚 Bill History for Mark Dennis: ${historyBillsResult.rows.length}`)
    historyBillsResult.rows.forEach(bill => {
      console.log(`   Original Bill ID: ${bill.original_bill_id} | ${bill.rent_from} to ${bill.rent_to} | Status: ${bill.status}`)
    })

    // Check what the pending-rooms API would calculate
    console.log('\n🧮 Simulating pending-rooms API calculation...')
    const simulationResult = await pool.query(`
      SELECT 
        t.id as tenant_id,
        t.name as tenant_name,
        t.rent_start,
        r.room_number,
        -- Check if tenant has active bills
        EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) as has_active_bills,
        -- Calculate next period start (API logic)
        CASE 
          WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN 
            TO_CHAR(t.rent_start, 'YYYY-MM-DD')
          ELSE 
            (SELECT TO_CHAR(rent_to + INTERVAL '1 day', 'YYYY-MM-DD')
             FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1)
        END as next_period_start,
        -- Calculate next period end (API logic)
        CASE 
          WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN 
            TO_CHAR(t.rent_start + INTERVAL '1 month' - INTERVAL '1 day', 'YYYY-MM-DD')
          ELSE 
            (SELECT TO_CHAR((rent_to + INTERVAL '1 day') + INTERVAL '1 month' - INTERVAL '1 day', 'YYYY-MM-DD')
             FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1)
        END as next_period_end,
        -- Check billing status logic
        CASE 
          WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) AND 
               CURRENT_DATE > (t.rent_start + INTERVAL '1 month' - INTERVAL '1 day')::date 
          THEN 'needs_billing'
          WHEN EXISTS (SELECT 1 FROM bills b WHERE b.tenant_id = t.id AND b.rent_from = t.rent_start::date)
          THEN 'already_billed'
          ELSE 'up_to_date'
        END as calculated_status
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      WHERE t.name ILIKE '%Mark Dennis%'
    `)

    if (simulationResult.rows.length > 0) {
      const result = simulationResult.rows[0]
      console.log(`   Tenant: ${result.tenant_name} (Room ${result.room_number})`)
      console.log(`   Rent Start: ${result.rent_start}`)
      console.log(`   Has Active Bills: ${result.has_active_bills}`)
      console.log(`   Next Period Start: ${result.next_period_start}`)
      console.log(`   Next Period End: ${result.next_period_end}`)
      console.log(`   Calculated Status: ${result.calculated_status}`)
    }

    // Check if there's already a bill for the calculated period
    if (simulationResult.rows.length > 0) {
      const result = simulationResult.rows[0]
      const existingBillResult = await pool.query(`
        SELECT * FROM bills 
        WHERE tenant_id = $1 AND rent_from = $2
      `, [result.tenant_id, result.next_period_start])
      
      console.log(`\n🔍 Bill exists for period ${result.next_period_start}? ${existingBillResult.rows.length > 0}`)
      if (existingBillResult.rows.length > 0) {
        const existingBill = existingBillResult.rows[0]
        console.log(`   Existing Bill ID: ${existingBill.id}`)
        console.log(`   Status: ${existingBill.status}`)
        console.log(`   Created: ${existingBill.bill_date}`)
      }
    }

    console.log('\n📊 Analysis:')
    if (activeBillsResult.rows.length === 0) {
      console.log('❓ No active bills found - system thinks this is first billing cycle')
    }
    if (historyBillsResult.rows.length > 0) {
      console.log('📚 Bills exist in history but API doesn\'t consider them')
    }

  } catch (error) {
    console.error('❌ Error debugging Room 1 status:', error)
    throw error
  }
}

// Run the debug
debugRoom1Status()
  .then(() => {
    console.log('\n✅ Debug completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Debug failed:', error)
    process.exit(1)
  }) 