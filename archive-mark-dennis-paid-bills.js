const { pool } = require('./lib/database')

async function archiveMarkDennisPaidBills() {
  try {
    console.log('🔧 Archiving Mark Dennis Perez remaining paid bills...')

    // Get Mark Dennis's active paid bills
    const paidBillsResult = await pool.query(`
      SELECT b.*, r.room_number, br.name as branch_name
      FROM bills b
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN branches br ON r.branch_id = br.id
      WHERE b.tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%Mark Dennis%' LIMIT 1)
      AND b.status = 'paid'
      ORDER BY b.rent_from
    `)
    
    console.log(`Found ${paidBillsResult.rows.length} paid bills to archive`)
    
    if (paidBillsResult.rows.length > 0) {
      await pool.query('BEGIN')
      
      for (const bill of paidBillsResult.rows) {
        console.log(`\n📦 Archiving Bill ID: ${bill.id}`)
        console.log(`   Period: ${bill.rent_from} to ${bill.rent_to}`)
        console.log(`   Amount: ₱${bill.total_amount} | Status: ${bill.status}`)
        
        // Get total payments for this bill
        const paymentsResult = await pool.query(`
          SELECT COALESCE(SUM(amount), 0) as total_paid
          FROM payments 
          WHERE bill_id = $1
        `, [bill.id])
        
        const totalPaid = parseFloat(paymentsResult.rows[0].total_paid)
        
        // Check if this bill already exists in bill_history
        const existingHistoryResult = await pool.query(`
          SELECT id FROM bill_history WHERE original_bill_id = $1
        `, [bill.id])
        
        if (existingHistoryResult.rows.length === 0) {
          // Archive bill to bill_history
          await pool.query(`
            INSERT INTO bill_history (
              original_bill_id, original_tenant_id, tenant_name, room_id, room_number, branch_name,
              rent_from, rent_to, rent_amount, electric_previous_reading, electric_present_reading,
              electric_consumption, electric_rate_per_kwh, electric_amount, electric_reading_date, electric_previous_date,
              water_amount, extra_fee_amount, extra_fee_description, total_amount, amount_paid,
              remaining_balance, bill_date, due_date, status, is_final_bill, penalty_applied,
              penalty_fee_amount, prepared_by, notes, archived_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
            )
          `, [
            bill.id, bill.tenant_id, 'Mark Dennis Perez', bill.room_id, bill.room_number || '1', bill.branch_name || 'J & H apartment',
            bill.rent_from, bill.rent_to, bill.rent_amount, bill.electric_previous_reading || 0,
            bill.electric_present_reading || 0, bill.electric_consumption || 0, bill.electric_rate_per_kwh || 11.00, bill.electric_amount || 0,
            bill.electric_reading_date, bill.electric_previous_date, bill.water_amount || 200,
            bill.extra_fee_amount || 0, bill.extra_fee_description || '', bill.total_amount, totalPaid,
            (bill.total_amount - totalPaid), bill.bill_date, bill.due_date, bill.status,
            bill.is_final_bill || false, bill.penalty_applied || false, bill.penalty_fee_amount || 0, 
            bill.prepared_by || 'Admin', `Archived paid bill to continue billing cycle. Total paid: ₱${totalPaid}`, new Date()
          ])
          
          console.log(`   ✅ Archived to bill_history`)
        } else {
          console.log(`   ⚠️ Already exists in bill_history, skipping archive`)
        }
        
        // Delete payments for this bill
        await pool.query('DELETE FROM payments WHERE bill_id = $1', [bill.id])
        console.log(`   ✅ Deleted payments`)
        
        // Delete the bill
        await pool.query('DELETE FROM bills WHERE id = $1', [bill.id])
        console.log(`   ✅ Deleted active bill`)
      }
      
      await pool.query('COMMIT')
      console.log(`\n✅ Successfully archived ${paidBillsResult.rows.length} paid bills`)
    } else {
      console.log('No paid bills found to archive')
    }

    // Set Mark Dennis's rent_start to the next billing period
    console.log('\n🔧 Setting rent_start for next billing cycle...')
    
    // Get the last billing period from bill_history
    const lastPeriodResult = await pool.query(`
      SELECT rent_to 
      FROM bill_history 
      WHERE tenant_name ILIKE '%Mark Dennis%'
      ORDER BY rent_to DESC 
      LIMIT 1
    `)
    
    if (lastPeriodResult.rows.length > 0) {
      const lastRentTo = new Date(lastPeriodResult.rows[0].rent_to)
      const nextRentStart = new Date(lastRentTo.getTime() + (24 * 60 * 60 * 1000)) // Add 1 day
      const nextRentStartStr = nextRentStart.toISOString().split('T')[0]
      
      console.log(`📅 Last billing period ended: ${lastRentTo.toISOString().split('T')[0]}`)
      console.log(`📅 Setting rent_start to: ${nextRentStartStr}`)
      
      // Update Mark Dennis's rent_start
      await pool.query(`
        UPDATE tenants 
        SET rent_start = $1 
        WHERE name ILIKE '%Mark Dennis%'
      `, [nextRentStartStr])
      
      console.log(`✅ Updated rent_start to continue from next cycle`)
    }

    // Final verification
    const remainingBillsResult = await pool.query(`
      SELECT COUNT(*) as count FROM bills b
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE r.room_number = '1'
    `)
    
    const billHistoryCountResult = await pool.query(`
      SELECT COUNT(*) as count FROM bill_history 
      WHERE tenant_name ILIKE '%Mark Dennis%'
    `)
    
    console.log(`\n📊 Final Status:`)
    console.log(`   - Remaining active bills for Room 1: ${remainingBillsResult.rows[0].count}`)
    console.log(`   - Mark Dennis bills in history: ${billHistoryCountResult.rows[0].count}`)
    
    console.log('\n✅ Room 1 billing reset! Ready for new billing cycle.')

  } catch (error) {
    await pool.query('ROLLBACK')
    console.error('❌ Error archiving paid bills:', error)
    throw error
  }
}

// Run the fix
archiveMarkDennisPaidBills()
  .then(() => {
    console.log('✅ Billing archive completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Billing archive failed:', error)
    process.exit(1)
  }) 