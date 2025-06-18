import { verify } from 'jsonwebtoken'
import { pool } from '../../../../lib/database'

export async function POST(req) {
  let requestBody = null
  
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const decoded = verify(token, process.env.JWT_SECRET)

    // Read the request body only once
    requestBody = await req.json()
    const { bill_id, tenant_id, termination_reason } = requestBody

    if (!bill_id || !tenant_id) {
      return Response.json({ message: 'Bill ID and Tenant ID are required' }, { status: 400 })
    }

    // Start transaction
    await pool.query('BEGIN')

    try {
      // Get bill details
      const billResult = await pool.query(
        'SELECT * FROM bills WHERE id = $1 AND tenant_id = $2',
        [bill_id, tenant_id]
      )
      const billRows = billResult.rows

      if (billRows.length === 0) {
        throw new Error('Bill not found')
      }

      const bill = billRows[0]
      const billAmount = parseFloat(bill.total_amount)

      // Get advance deposit balance only (security deposit is forfeited for early termination)
      const depositResult = await pool.query(`
        SELECT 
          SUM(CASE WHEN deposit_type = 'advance' THEN remaining_balance ELSE 0 END) as advance_balance
        FROM tenant_deposits 
        WHERE tenant_id = $1 AND remaining_balance > 0
      `, [tenant_id])
      const depositRows = depositResult.rows

      const deposits = depositRows[0] || { advance_balance: 0 }
      let advanceBalance = parseFloat(deposits.advance_balance) || 0

      console.log('Available advance deposit:', advanceBalance, 'Bill amount:', billAmount)

      let advanceUsed = 0
      let advanceRefund = 0
      let outstandingBalance = 0
      let tenantMovedOut = false

      if (advanceBalance >= billAmount) {
        // Advance deposit covers the full bill
        advanceUsed = billAmount
        advanceRefund = advanceBalance - billAmount
        tenantMovedOut = true
      } else {
        // Advance deposit doesn't cover the full bill
        advanceUsed = advanceBalance
        outstandingBalance = billAmount - advanceBalance
        tenantMovedOut = false // Tenant stays until outstanding balance is paid
      }

      console.log('Payment calculation:', {
        advanceUsed,
        advanceRefund,
        outstandingBalance,
        tenantMovedOut
      })

      // Update advance deposit balance
      if (advanceUsed > 0) {
        await pool.query(`
          UPDATE tenant_deposits 
          SET remaining_balance = remaining_balance - $1
          WHERE tenant_id = $2 AND deposit_type = 'advance' AND remaining_balance > 0
        `, [advanceUsed, tenant_id])
      }

      // Create payment record for the amount covered by advance deposit
      if (advanceUsed > 0) {
        await pool.query(`
          INSERT INTO payments (
            bill_id, amount, payment_date, payment_method, 
            actual_payment_date, notes, processed_by
          ) VALUES ($1, $2, CURRENT_DATE, 'deposit', CURRENT_DATE, $3, $4)
        `, [
          bill_id, 
          advanceUsed, 
          `Paid using advance deposit: ₱${advanceUsed}`,
          decoded.id || decoded.userId || 1
        ])
      }

      // Update bill status
      let billStatus = 'paid'
      if (outstandingBalance > 0) {
        billStatus = 'partial'
      }

      await pool.query(`
        UPDATE bills 
        SET status = $1, total_paid = $2, remaining_balance = $3
        WHERE id = $4
      `, [billStatus, advanceUsed, outstandingBalance, bill_id])

      let newBillId = null

      // For outstanding balance, just keep the original bill as 'partial' - no need to create new bill
      if (outstandingBalance > 0) {
        // Send email for outstanding balance notification
        const tenantEmailResult = await pool.query(
          'SELECT email FROM tenants WHERE id = $1',
          [tenant_id]
        )
        const tenantEmail = tenantEmailResult.rows

        if (tenantEmail[0]?.email) {
          console.log(`Should send outstanding balance notification to: ${tenantEmail[0].email}`)
        }
        
        // The original bill already reflects the outstanding balance in remaining_balance column
        console.log(`Outstanding balance of ₱${outstandingBalance.toFixed(2)} remains on original bill ID: ${bill_id}`)
      }

      // If tenant is fully moved out (no outstanding balance)
      if (tenantMovedOut) {
        // Get full tenant details for history record
        const tenantForHistoryResult = await pool.query(`
          SELECT 
            t.*,
            r.room_number,
            b.name as branch_name
          FROM tenants t
          LEFT JOIN rooms r ON t.room_id = r.id
          LEFT JOIN branches b ON r.branch_id = b.id
          WHERE t.id = $1
        `, [tenant_id])
        
        if (tenantForHistoryResult.rows.length > 0) {
          const tenant = tenantForHistoryResult.rows[0]
          
          // Get all bills for this tenant to preserve in history
          const tenantBillsResult = await pool.query(`
            SELECT 
              b.*,
              r.room_number,
              br.name as branch_name,
              COALESCE(SUM(p.amount), 0) as amount_paid
            FROM bills b
            LEFT JOIN rooms r ON b.room_id = r.id
            LEFT JOIN branches br ON r.branch_id = br.id
            LEFT JOIN payments p ON b.id = p.bill_id
            WHERE b.tenant_id = $1
            GROUP BY b.id, r.room_number, br.name
            ORDER BY b.rent_from
          `, [tenant_id])
          
          // Archive all bills to bill_history
          for (const billRecord of tenantBillsResult.rows) {
            await pool.query(`
              INSERT INTO bill_history (
                original_bill_id, original_tenant_id, tenant_name, room_id, room_number, branch_name,
                rent_from, rent_to, rent_amount, electric_previous_reading, electric_present_reading,
                electric_consumption, electric_rate_per_kwh, electric_amount, electric_reading_date, electric_previous_date,
                water_amount, extra_fee_amount, extra_fee_description, total_amount,
                bill_date, due_date, status, is_final_bill, penalty_applied,
                penalty_fee_amount, prepared_by, notes, total_paid, remaining_balance,
                payment_date, payment_method, created_at, updated_at, archived_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
                $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, NOW()
              )
            `, [
              billRecord.id, // original_bill_id
              tenant_id, // original_tenant_id
              tenant.name, // tenant_name
              billRecord.room_id,
              billRecord.room_number || 'Unknown',
              billRecord.branch_name || 'J & H Apartment',
              billRecord.rent_from,
              billRecord.rent_to,
              billRecord.rent_amount,
              billRecord.electric_previous_reading || 0,
              billRecord.electric_present_reading || 0,
              billRecord.electric_consumption || 0,
              billRecord.electric_rate_per_kwh || 11.00, // electric_rate_per_kwh
              billRecord.electric_amount || 0,
              billRecord.electric_reading_date,
              billRecord.electric_previous_date,
              billRecord.water_amount || 200,
              billRecord.extra_fee_amount || 0,
              billRecord.extra_fee_description,
              billRecord.total_amount,
              billRecord.bill_date,
              billRecord.due_date,
              billRecord.status,
              billRecord.is_final_bill || false,
              billRecord.penalty_applied || false,
              billRecord.penalty_fee_amount || 0,
              billRecord.prepared_by || 'Admin',
              `Bill archived during manual move-out process`,
              parseFloat(billRecord.amount_paid) || 0, // total_paid
              parseFloat(billRecord.remaining_balance) || 0, // remaining_balance
              new Date().toISOString(), // payment_date (current date since it's being paid now)
              'cash', // payment_method (default for manual move-out)
              billRecord.created_at,
              billRecord.updated_at
            ])
          }
          
          // Get bill summary for tenant_history
          const billSummaryResult = await pool.query(`
            SELECT 
              COUNT(*) as total_bills,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as total_paid,
              COALESCE(SUM(CASE WHEN status != 'paid' THEN total_amount ELSE 0 END), 0) as total_unpaid
            FROM bills 
            WHERE tenant_id = $1
          `, [tenant_id])
          
          const billSummary = billSummaryResult.rows[0]
          
          // Check if contract was completed
          const contractCompleted = new Date() >= new Date(tenant.contract_end_date)
          
          // Insert into tenant_history
          await pool.query(`
            INSERT INTO tenant_history (
              original_tenant_id, name, mobile, email, address, room_id, room_number, branch_name,
              rent_start, rent_end, contract_start_date, contract_end_date, contract_duration_months,
              contract_completed, initial_electric_reading, final_electric_reading,
              advance_payment, security_deposit, advance_payment_status, security_deposit_status,
              reason_for_leaving, notes, total_bills_paid, total_bills_unpaid, deleted_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
            )
          `, [
            tenant.id, // original_tenant_id
            tenant.name,
            tenant.mobile,
            tenant.email,
            tenant.address,
            tenant.room_id,
            tenant.room_number || 'Unknown',
            tenant.branch_name || 'J & H Apartment',
            tenant.rent_start,
            new Date().toISOString().split('T')[0], // rent_end (today)
            tenant.contract_start_date || tenant.rent_start,
            tenant.contract_end_date,
            tenant.contract_duration_months || 6,
            contractCompleted, // contract_completed
            tenant.initial_electric_reading || 0,
            final_electric_reading || 0, // final_electric_reading
            tenant.advance_payment || 3500,
            tenant.security_deposit || 3500,
            tenant.advance_payment_status || 'paid',
            tenant.security_deposit_status || 'paid',
            reason_for_leaving || (contractCompleted ? 'completed' : 'early_termination'), // reason_for_leaving
            `Move-out processed. ${notes || ''}`, // notes
            parseFloat(billSummary.total_paid) || 0, // total_bills_paid
            parseFloat(billSummary.total_unpaid) || 0, // total_bills_unpaid
            new Date().toISOString() // deleted_at
          ])
          
          // Archive all payments to payment_history before deleting bills
          await pool.query(`
            INSERT INTO payment_history (
              original_payment_id, original_bill_id, tenant_name, room_number, branch_name,
              amount, payment_date, actual_payment_date, payment_method, payment_type,
              notes, processed_by, created_at, updated_at
            )
            SELECT 
              p.id, p.bill_id, $1, 
              (SELECT room_number FROM rooms WHERE id = b.room_id),
              (SELECT br.name FROM branches br JOIN rooms r ON br.id = r.branch_id WHERE r.id = b.room_id),
              p.amount, p.payment_date, 
              COALESCE(p.actual_payment_date, p.payment_date),
              p.payment_method, COALESCE(p.payment_type, 'regular'),
              p.notes, p.processed_by, p.created_at, p.updated_at
            FROM payments p
            JOIN bills b ON p.bill_id = b.id
            WHERE b.tenant_id = $2
          `, [tenant.name, tenant_id])

          // Delete payments and bills from active tables (now preserved in history)
          await pool.query(`DELETE FROM payments WHERE bill_id IN (SELECT id FROM bills WHERE tenant_id = $1)`, [tenant_id])
          await pool.query(`DELETE FROM bills WHERE tenant_id = $1`, [tenant_id])
          
          // Delete tenant from tenants table
          await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenant_id])
          
          // Update room status to vacant
          await pool.query(`
            UPDATE rooms 
            SET tenant_id = NULL, status = 'vacant'
            WHERE tenant_id = $1 OR id = $2
          `, [tenant_id, tenant.room_id])
          
          console.log(`Tenant ${tenant.name} moved to history and room made available`)
        }
      }

      // Process advance refund if any
      if (advanceRefund > 0) {
        // Create refund record
        await pool.query(`
          INSERT INTO refunds (
            tenant_id, refund_amount, refund_type, refund_date, 
            notes, processed_by, status
          ) VALUES ($1, $2, 'advance', CURRENT_DATE, $3, $4, 'pending')
        `, [
          tenant_id, 
          advanceRefund,
          `Advance deposit refund after move out`,
          decoded.id || decoded.userId || 1
        ])

        console.log(`Created advance refund record: ₱${advanceRefund}`)
      }

      // Security deposit is always forfeited for early termination
      await pool.query(`
        UPDATE tenant_deposits 
        SET remaining_balance = 0, 
            notes = CONCAT(COALESCE(notes, ''), ' - Forfeited due to early termination')
        WHERE tenant_id = $1 AND deposit_type = 'security'
      `, [tenant_id])

      // Send receipt email if bill is fully paid
      if (billStatus === 'paid') {
        const tenantEmailResult2 = await pool.query(
          'SELECT email FROM tenants WHERE id = $1',
          [tenant_id]
        )
        const tenantEmail = tenantEmailResult2.rows

        if (tenantEmail[0]?.email) {
          console.log(`Should send move out completion receipt to: ${tenantEmail[0].email}`)
        }
      }

      await pool.query('COMMIT')

      return Response.json({
        success: true,
        message: 'Move out completed successfully',
        advance_used: advanceUsed,
        advance_refund: advanceRefund,
        outstanding_balance: outstandingBalance,
        tenant_moved_out: tenantMovedOut,
        new_bill_id: newBillId,
        bill_status: billStatus
      })

    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Complete move out error:', error)
    return Response.json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    }, { status: 500 })
  }
} 