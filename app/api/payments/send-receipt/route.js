import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'
import emailService from '../../../../services/emailService.js'
import receiptService from '../../../../services/receiptService.js'
import { getPenaltyFeePercentage } from '../../../../lib/penaltyUtils'

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

    // Get bill details with tenant and room info
    const billDataResult = await pool.query(`
      SELECT 
        b.*,
        t.name as tenant_name,
        t.email as tenant_email,
        r.room_number,
        br.name as branch_name,
        br.address as branch_address,
        COALESCE(b.electric_rate_per_kwh, br.electricity_rate, 
          (SELECT setting_value::numeric FROM settings WHERE setting_key = 'electric_rate_per_kwh' LIMIT 1), 11.00) as electric_rate_per_kwh,
        COALESCE(b.penalty_fee_amount, 0) as penalty_fee_amount,
        COALESCE(b.penalty_applied, false) as penalty_applied
      FROM bills b
      LEFT JOIN tenants t ON b.tenant_id = t.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN branches br ON r.branch_id = br.id
      WHERE b.id = $1
    `, [bill_id])

    let billData = billDataResult.rows
    
    // If bill not found in active bills, check bill_history
    if (billData.length === 0) {
      console.log('Bill not found in active bills, checking bill_history...')
      const historyResult = await pool.query(`
        SELECT 
          bh.*,
          bh.tenant_name,
          t.email as tenant_email,
          bh.room_number,
          br.name as branch_name,
          br.address as branch_address,
          COALESCE(bh.electric_rate_per_kwh, br.electricity_rate, 
            (SELECT setting_value::numeric FROM settings WHERE setting_key = 'electric_rate_per_kwh' LIMIT 1), 11.00) as electric_rate_per_kwh,
          COALESCE(bh.penalty_fee_amount, 0) as penalty_fee_amount,
          COALESCE(bh.penalty_applied, false) as penalty_applied,
          COALESCE(bh.payment_method, 'cash') as payment_method
        FROM bill_history bh
        LEFT JOIN tenants t ON bh.original_tenant_id = t.id
        LEFT JOIN rooms r ON bh.room_id = r.id
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE bh.original_bill_id = $1
      `, [bill_id])
      
      billData = historyResult.rows
    }
    
    if (billData.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Bill not found in active bills or history' },
        { status: 404 }
      )
    }

    const bill = billData[0]

    // Check if tenant has email
    if (!bill.tenant_email) {
      return NextResponse.json(
        { success: false, message: 'Tenant email not found' },
        { status: 400 }
      )
    }

    // Get all payments for this bill
    const paymentsResult = await pool.query(`
      SELECT * FROM payments 
      WHERE bill_id = $1
      ORDER BY payment_date ASC
    `, [bill_id])

    const payments = paymentsResult.rows
    if (payments.length === 0) {
      console.log('No payments found in payments table, checking if this is an archived bill...')
      
      // For archived bills, we need to create a synthetic payment record from the bill_history data
      if (bill.payment_date) {
        // Create a synthetic payment record from the archived bill data
        const syntheticPayment = {
          bill_id: bill.original_bill_id,
          amount: bill.total_paid,
          payment_date: bill.payment_date,
          actual_payment_date: bill.payment_date,
          payment_method: bill.payment_method || 'cash', // Use stored payment method from bill_history
          notes: 'Payment completed (archived bill)'
        }
        
        console.log('Created synthetic payment record for archived bill:', syntheticPayment)
        
        // Use the synthetic payment record
        payments.push(syntheticPayment)
      } else {
        return NextResponse.json(
          { success: false, message: 'No payments found for this bill and no payment data in bill_history' },
          { status: 400 }
        )
      }
    }

    // Get penalty percentage from settings
    const penaltyPercentage = await getPenaltyFeePercentage()

    // Generate PDF receipt
    const pdfBuffer = await receiptService.generateReceiptPDF(bill, payments, penaltyPercentage)

    // Send email with receipt
    const emailResult = await emailService.sendReceiptToTenant(
      bill, 
      payments, 
      bill.tenant_email, 
      pdfBuffer,
      penaltyPercentage
    )

    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, message: 'Failed to send receipt email', error: emailResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Receipt sent successfully to ' + bill.tenant_email,
      messageId: emailResult.messageId
    })

  } catch (error) {
    console.error('Send receipt error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 