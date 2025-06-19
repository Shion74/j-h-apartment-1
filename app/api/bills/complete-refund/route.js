import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'

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

    const { bill_id } = await request.json()

    if (!bill_id) {
      return NextResponse.json(
        { success: false, message: 'Bill ID is required' },
        { status: 400 }
      )
    }

    // Get the refund bill details with tenant and deposit information
    const billResult = await pool.query(`
      SELECT 
        b.*,
        t.name as tenant_name,
        t.email as tenant_email,
        t.mobile as tenant_mobile,
        t.rent_start,
        t.contract_start_date,
        t.contract_end_date,
        t.contract_duration_months,
        t.initial_electric_reading,
        t.created_at,
        r.room_number,
        br.name as branch_name,
        -- Get deposit information from tenant_deposits table
        (SELECT COALESCE(SUM(initial_amount), 0) 
         FROM tenant_deposits 
         WHERE tenant_id = t.id AND deposit_type = 'advance') as advance_payment,
        (SELECT COALESCE(SUM(remaining_balance), 0) 
         FROM tenant_deposits 
         WHERE tenant_id = t.id AND deposit_type = 'advance') as advance_remaining,
        (SELECT COALESCE(SUM(initial_amount - remaining_balance), 0) 
         FROM tenant_deposits 
         WHERE tenant_id = t.id AND deposit_type = 'advance') as advance_used_for_bills,
        (SELECT COALESCE(SUM(initial_amount), 0) 
         FROM tenant_deposits 
         WHERE tenant_id = t.id AND deposit_type = 'security') as security_deposit,
        (SELECT COALESCE(SUM(remaining_balance), 0) 
         FROM tenant_deposits 
         WHERE tenant_id = t.id AND deposit_type = 'security') as security_remaining,
        (SELECT COALESCE(SUM(initial_amount - remaining_balance), 0) 
         FROM tenant_deposits 
         WHERE tenant_id = t.id AND deposit_type = 'security') as security_used_for_bills
      FROM bills b
      LEFT JOIN tenants t ON b.tenant_id = t.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN branches br ON r.branch_id = br.id
      WHERE b.id = $1 AND b.status = 'unpaid' AND b.is_refund_bill = true
    `, [bill_id])

    if (billResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Refund bill not found or already processed' },
        { status: 404 }
      )
    }

    const bill = billResult.rows[0]

    // Start transaction
    await pool.query('BEGIN')

    try {
      // Mark refund bill as paid
      await pool.query(`
        UPDATE bills 
        SET status = 'paid',
            payment_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = $1
      `, [bill_id])

      // Get the actual payment date from the most recent payment (if any)
      const actualPaymentDateResult = await pool.query(`
        SELECT COALESCE(actual_payment_date, payment_date) as actual_payment_date
        FROM payments 
        WHERE bill_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [bill_id])
      
      const actualPaymentDate = actualPaymentDateResult.rows[0]?.actual_payment_date || new Date().toISOString().split('T')[0]

      // Archive the bill with proper rent_amount handling
      await pool.query(`
        INSERT INTO bill_history (
          original_bill_id, original_tenant_id, room_id, bill_date,
          rent_from, rent_to, rent_amount, electric_previous_reading,
          electric_present_reading, electric_consumption, electric_rate_per_kwh, electric_amount,
          water_amount, extra_fee_amount, extra_fee_description,
          total_amount, status, prepared_by, is_final_bill, is_refund_bill,
          refund_reason, payment_date, actual_payment_date, total_paid, remaining_balance,
          tenant_name, room_number, branch_name, archived_by, archive_reason,
          deposit_applied, original_bill_amount, payment_method, electric_reading_date,
          due_date
        )
        SELECT 
          b.id, b.tenant_id, b.room_id, b.bill_date,
          b.rent_from, b.rent_to, b.rent_amount, b.electric_previous_reading,
          b.electric_present_reading, b.electric_consumption, b.electric_rate_per_kwh, b.electric_amount,
          b.water_amount, b.extra_fee_amount, b.extra_fee_description,
          b.total_amount, 'refund', $1, b.is_final_bill, true,
          $2, CURRENT_DATE, $4, b.total_amount, 0,
          t.name, r.room_number, br.name, $1, 'refund_completed',
          b.deposit_applied, b.original_bill_amount, 'refund', b.electric_reading_date,
          b.due_date
        FROM bills b
        LEFT JOIN tenants t ON b.tenant_id = t.id
        LEFT JOIN rooms r ON b.room_id = r.id
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE b.id = $3
      `, [prepared_by, refund_reason, bill_id, actualPaymentDate])

      // Archive any payments to payment_history before deleting the bill
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
          p.payment_method, COALESCE(p.payment_type, 'refund'),
          p.notes, p.processed_by, p.created_at, p.updated_at
        FROM payments p
        JOIN bills ON p.bill_id = bills.id
        WHERE p.bill_id = $2
      `, [bill.tenant_name, bill_id])

      // Delete payments and the original bill
      await pool.query('DELETE FROM payments WHERE bill_id = $1', [bill_id])
      await pool.query('DELETE FROM bills WHERE id = $1', [bill_id])

      // Archive the tenant
      await pool.query(`
        INSERT INTO tenant_history (
          original_tenant_id, name, mobile, email, room_id, room_number,
          branch_name, rent_start, rent_end, contract_start_date, contract_end_date, 
          contract_duration_months, contract_completed, initial_electric_reading,
          final_electric_reading, move_out_date, reason_for_leaving,
          deleted_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, CURRENT_DATE, $9, $10,
          $11, true, $12,
          0, CURRENT_DATE, 'refund_completed',
          'System'
        )
      `, [
        bill.tenant_id, bill.tenant_name, bill.tenant_mobile, bill.tenant_email, 
        bill.room_id, bill.room_number,
        bill.branch_name, bill.rent_start, bill.contract_start_date, bill.contract_end_date,
        bill.contract_duration_months, bill.initial_electric_reading
      ])

      // Update deposit records to refunded status
      await pool.query(`
        UPDATE tenant_deposits 
        SET status = 'refunded',
            remaining_balance = 0,
            updated_at = NOW(),
            notes = CONCAT(COALESCE(notes, ''), ' | Refunded on move-out via bill #', $2::text)
        WHERE tenant_id = $1
      `, [bill.tenant_id, bill_id])

      // Remove tenant from active tenants table
      await pool.query('DELETE FROM tenants WHERE id = $1', [bill.tenant_id])

      // Make room available
      await pool.query(`
        UPDATE rooms 
        SET status = 'vacant', 
            tenant_id = NULL,
            updated_at = NOW()
        WHERE id = $1
      `, [bill.room_id])

      // Commit transaction
      await pool.query('COMMIT')

      // Send departure email to tenant
      if (bill.tenant_email) {
        try {
          const emailService = (await import('../../../../services/emailService.js')).default
          
          const departureInfo = {
            tenant_name: bill.tenant_name,
            room_number: bill.room_number,
            branch_name: bill.branch_name,
            rent_start: bill.rent_start,
            rent_end: new Date().toISOString().split('T')[0],
            contract_completed: true,
            security_deposit_refund: Math.abs(bill.total_amount), // The refund amount
            reason_for_leaving: 'refund_completed',
            total_bills_paid: 0,
            total_bills_unpaid: 0
          }
          
          await emailService.sendDepartureEmail(bill.tenant_email, departureInfo)
          console.log(`✅ Departure email sent to ${bill.tenant_name} (${bill.tenant_email})`)
        } catch (emailError) {
          console.error('Failed to send departure email:', emailError)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Refund completed and tenant archived successfully',
        refund_amount: Math.abs(bill.total_amount),
        tenant_name: bill.tenant_name,
        tenant_archived: true,
        room_made_available: true,
        room_number: bill.room_number,
        branch_name: bill.branch_name
      })

    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Complete refund error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
} 