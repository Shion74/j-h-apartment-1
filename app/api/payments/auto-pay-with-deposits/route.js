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

    const { 
      bill_id, 
      tenant_id, 
      use_advance_payment = true, 
      use_security_deposit = true,
      payment_notes = 'Automatic payment using deposits'
    } = await request.json()

    if (!bill_id || !tenant_id) {
      return NextResponse.json(
        { success: false, message: 'Bill ID and Tenant ID are required' },
        { status: 400 }
      )
    }

    // Start transaction
    await pool.query('BEGIN')

    try {
      // Get bill details
      const billResult = await pool.query(`
        SELECT b.*, t.name as tenant_name, t.email as tenant_email,
               t.advance_payment, t.security_deposit,
               t.advance_used_for_bills, t.security_used_for_bills
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        WHERE b.id = $1 AND b.tenant_id = $2
      `, [bill_id, tenant_id])

      if (billResult.rows.length === 0) {
        await pool.query('ROLLBACK')
        return NextResponse.json(
          { success: false, message: 'Bill not found' },
          { status: 404 }
        )
      }

      const bill = billResult.rows[0]
      const billAmount = parseFloat(bill.total_amount)
      
      // Calculate available deposits
      const advanceTotal = parseFloat(bill.advance_payment || 0)
      const advanceUsed = parseFloat(bill.advance_used_for_bills || 0)
      const advanceAvailable = Math.max(0, advanceTotal - advanceUsed)
      
      const securityTotal = parseFloat(bill.security_deposit || 0)
      const securityUsed = parseFloat(bill.security_used_for_bills || 0)
      const securityAvailable = Math.max(0, securityTotal - securityUsed)
      
      console.log('Deposit Analysis:', {
        billAmount,
        advanceAvailable,
        securityAvailable,
        totalAvailable: advanceAvailable + securityAvailable
      })

      // Calculate payment amounts
      let advancePaymentAmount = 0
      let securityPaymentAmount = 0
      let remainingBillAmount = billAmount

      // Use advance payment first (if enabled)
      if (use_advance_payment && advanceAvailable > 0) {
        advancePaymentAmount = Math.min(advanceAvailable, remainingBillAmount)
        remainingBillAmount -= advancePaymentAmount
      }

      // Use security deposit for remaining amount (if enabled)
      if (use_security_deposit && securityAvailable > 0 && remainingBillAmount > 0) {
        securityPaymentAmount = Math.min(securityAvailable, remainingBillAmount)
        remainingBillAmount -= securityPaymentAmount
      }

      const totalPaymentAmount = advancePaymentAmount + securityPaymentAmount
      const isFullyPaid = remainingBillAmount <= 0.01 // Account for floating point precision

      console.log('Payment Calculation:', {
        advancePaymentAmount,
        securityPaymentAmount,
        totalPaymentAmount,
        remainingBillAmount,
        isFullyPaid
      })

      if (totalPaymentAmount <= 0) {
        await pool.query('ROLLBACK')
        return NextResponse.json(
          { success: false, message: 'No deposits available for payment' },
          { status: 400 }
        )
      }

      // Create payment record
      const paymentResult = await pool.query(`
        INSERT INTO payments (
          bill_id, tenant_id, payment_amount, payment_method, payment_type,
          actual_payment_date, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `, [
        bill_id, tenant_id, totalPaymentAmount, 'deposit', 'auto_deposit',
        new Date().toISOString().split('T')[0], payment_notes
      ])

      const paymentId = paymentResult.rows[0].id

      // Update tenant deposit usage
      if (advancePaymentAmount > 0) {
        await pool.query(`
          UPDATE tenants 
          SET advance_used_for_bills = COALESCE(advance_used_for_bills, 0) + $1
          WHERE id = $2
        `, [advancePaymentAmount, tenant_id])
      }

      if (securityPaymentAmount > 0) {
        await pool.query(`
          UPDATE tenants 
          SET security_used_for_bills = COALESCE(security_used_for_bills, 0) + $1
          WHERE id = $2
        `, [securityPaymentAmount, tenant_id])
      }

      // Update bill status
      let newBillStatus = 'partial'
      let totalPaid = parseFloat(bill.total_paid || 0) + totalPaymentAmount

      if (isFullyPaid) {
        newBillStatus = 'paid'
        totalPaid = billAmount // Ensure exact amount
      }

      await pool.query(`
        UPDATE bills 
        SET status = $1, 
            total_paid = $2,
            remaining_balance = GREATEST(0, total_amount - $2),
            updated_at = NOW()
        WHERE id = $3
      `, [newBillStatus, totalPaid, bill_id])

      // If fully paid and it's a final bill, handle tenant move-out
      let tenantMovedOut = false
      let billArchived = false
      
      if (isFullyPaid) {
        if (bill.is_final_bill) {
          // Archive bill to bill_history
          await pool.query(`
            INSERT INTO bill_history (
              original_bill_id, original_tenant_id, tenant_name, room_id, room_number,
              rent_from, rent_to, rent_amount, electric_previous_reading, electric_present_reading,
              electric_consumption, electric_rate_per_kwh, electric_amount, electric_reading_date, electric_previous_date,
              water_amount, extra_fee_amount, extra_fee_description, total_amount,
              bill_date, due_date, status, prepared_by, is_final_bill,
              total_paid, remaining_balance, penalty_fee_amount, penalty_applied,
              move_out_reason, move_out_notes, payment_method, created_at, updated_at, archived_at
            )
            SELECT 
              id, tenant_id, $1, room_id, 
              (SELECT room_number FROM rooms WHERE id = bills.room_id),
              rent_from, rent_to, rent_amount, electric_previous_reading, electric_present_reading,
              electric_consumption, electric_rate_per_kwh, electric_amount, electric_reading_date, electric_previous_date,
              water_amount, extra_fee_amount, extra_fee_description, total_amount,
              bill_date, due_date, status, prepared_by, is_final_bill,
              total_paid, remaining_balance, penalty_fee_amount, penalty_applied,
              move_out_reason, move_out_notes, 'advance_payment', created_at, updated_at, NOW()
            FROM bills WHERE id = $2
          `, [bill.tenant_name, bill_id])

          // Move tenant to tenant_history
          await pool.query(`
            INSERT INTO tenant_history (
              original_tenant_id, name, mobile, email, address, room_id, room_number,
              rent_start, contract_start_date, contract_end_date, contract_duration_months,
              initial_electric_reading, contract_status, advance_payment, security_deposit,
              advance_payment_status, security_deposit_status, advance_used_for_bills,
              security_used_for_bills, reason_for_leaving, move_out_date, final_bill_amount,
              deposit_refund_amount, created_at, moved_out_at
            )
            SELECT 
              t.id, t.name, t.mobile, t.email, t.address, t.room_id,
              (SELECT room_number FROM rooms WHERE id = t.room_id),
              t.rent_start, t.contract_start_date, t.contract_end_date, t.contract_duration_months,
              t.initial_electric_reading, 'completed', t.advance_payment, t.security_deposit,
              t.advance_payment_status, t.security_deposit_status, t.advance_used_for_bills,
              t.security_used_for_bills, $1, NOW(), $2,
              (t.advance_payment - COALESCE(t.advance_used_for_bills, 0)) + 
              (t.security_deposit - COALESCE(t.security_used_for_bills, 0)),
              t.created_at, NOW()
            FROM tenants t WHERE t.id = $3
          `, [bill.move_out_reason || 'contract_completed', billAmount, tenant_id])

          // Archive payments to payment_history
          await pool.query(`
            INSERT INTO payment_history (
              original_payment_id, original_bill_id, tenant_name, room_number, branch_name,
              amount, payment_date, actual_payment_date, payment_method, payment_type,
              notes, processed_by, created_at, updated_at
            )
            SELECT 
              p.id, p.bill_id, $1, 
              (SELECT room_number FROM rooms WHERE id = bills.room_id),
              (SELECT br.name FROM branches br JOIN rooms r ON br.id = r.branch_id WHERE r.id = bills.room_id),
              p.amount, p.payment_date, 
              COALESCE(p.actual_payment_date, p.payment_date),
              p.payment_method, COALESCE(p.payment_type, 'auto_deposit'),
              p.notes, p.processed_by, p.created_at, p.updated_at
            FROM payments p
            JOIN bills ON p.bill_id = bills.id
            WHERE p.bill_id = $2
          `, [bill.tenant_name, bill_id])

          // Delete from active tables
          await pool.query('DELETE FROM payments WHERE bill_id = $1', [bill_id])
          await pool.query('DELETE FROM bills WHERE id = $1', [bill_id])
          await pool.query('DELETE FROM tenants WHERE id = $1', [tenant_id])

          // Make room available
          if (bill.room_id) {
            await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['vacant', bill.room_id])
          }

          tenantMovedOut = true
          billArchived = true
        } else {
          // Regular bill - just archive it
          await pool.query(`
            INSERT INTO bill_history (
              original_bill_id, original_tenant_id, tenant_name, room_id, room_number,
              rent_from, rent_to, rent_amount, electric_previous_reading, electric_present_reading,
              electric_consumption, electric_rate_per_kwh, electric_amount, electric_reading_date, electric_previous_date,
              water_amount, extra_fee_amount, extra_fee_description, total_amount,
              bill_date, due_date, status, prepared_by, is_final_bill,
              total_paid, remaining_balance, penalty_fee_amount, penalty_applied,
              payment_method, created_at, updated_at, archived_at
            )
            SELECT 
              id, tenant_id, $1, room_id,
              (SELECT room_number FROM rooms WHERE id = bills.room_id),
              rent_from, rent_to, rent_amount, electric_previous_reading, electric_present_reading,
              electric_consumption, electric_rate_per_kwh, electric_amount, electric_reading_date, electric_previous_date,
              water_amount, extra_fee_amount, extra_fee_description, total_amount,
              bill_date, due_date, status, prepared_by, is_final_bill,
              total_paid, remaining_balance, penalty_fee_amount, penalty_applied,
              'advance_payment', created_at, updated_at, NOW()
            FROM bills WHERE id = $2
          `, [bill.tenant_name, bill_id])

          // Archive payments to payment_history for regular bills too
          await pool.query(`
            INSERT INTO payment_history (
              original_payment_id, original_bill_id, tenant_name, room_number, branch_name,
              amount, payment_date, actual_payment_date, payment_method, payment_type,
              notes, processed_by, created_at, updated_at
            )
            SELECT 
              p.id, p.bill_id, $1, 
              (SELECT room_number FROM rooms WHERE id = bills.room_id),
              (SELECT br.name FROM branches br JOIN rooms r ON br.id = r.branch_id WHERE r.id = bills.room_id),
              p.amount, p.payment_date, 
              COALESCE(p.actual_payment_date, p.payment_date),
              p.payment_method, COALESCE(p.payment_type, 'auto_deposit'),
              p.notes, p.processed_by, p.created_at, p.updated_at
            FROM payments p
            JOIN bills ON p.bill_id = bills.id
            WHERE p.bill_id = $2
          `, [bill.tenant_name, bill_id])

          await pool.query('DELETE FROM payments WHERE bill_id = $1', [bill_id])
          await pool.query('DELETE FROM bills WHERE id = $1', [bill_id])
          billArchived = true
        }
      }

      // Calculate refund amount
      const finalAdvanceUsed = advanceUsed + advancePaymentAmount
      const finalSecurityUsed = securityUsed + securityPaymentAmount
      const refundAmount = (advanceTotal - finalAdvanceUsed) + (securityTotal - finalSecurityUsed)

      // Commit transaction
      await pool.query('COMMIT')

      // Send receipt email if tenant has email
      let emailSent = false
      if (bill.tenant_email && isFullyPaid) {
        try {
          await emailService.sendPaymentReceipt({
            tenant_name: bill.tenant_name,
            email: bill.tenant_email,
            payment_amount: totalPaymentAmount,
            payment_method: 'Deposit Auto-Payment',
            bill_period: `${bill.rent_from} to ${bill.rent_to}`,
            payment_date: new Date().toISOString().split('T')[0],
            is_final_bill: bill.is_final_bill,
            refund_amount: refundAmount > 0 ? refundAmount : null
          })
          emailSent = true
        } catch (emailError) {
          console.error('Failed to send receipt email:', emailError)
        }
      }

      return NextResponse.json({
        success: true,
        payment_id: paymentId,
        fully_paid: isFullyPaid,
        payment_amount: totalPaymentAmount,
        advance_payment_used: advancePaymentAmount,
        security_payment_used: securityPaymentAmount,
        remaining_balance: Math.max(0, remainingBillAmount),
        refund_amount: refundAmount,
        tenant_moved_out: tenantMovedOut,
        bill_archived: billArchived,
        email_sent: emailSent,
        message: isFullyPaid 
          ? 'Bill paid successfully using deposits' 
          : 'Partial payment made using available deposits'
      })

    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Auto-payment error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 