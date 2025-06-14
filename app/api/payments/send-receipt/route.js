import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'
import emailService from '../../../../services/emailService.js'
import receiptService from '../../../../services/receiptService.js'

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
    const [billData] = await pool.execute(`
      SELECT 
        b.*,
        t.name as tenant_name,
        t.email as tenant_email,
        r.room_number,
        br.name as branch_name,
        br.address as branch_address
      FROM bills b
      LEFT JOIN tenants t ON b.tenant_id = t.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN branches br ON r.branch_id = br.id
      WHERE b.id = ?
    `, [bill_id])

    if (billData.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Bill not found' },
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
    const [payments] = await pool.execute(`
      SELECT * FROM payments 
      WHERE bill_id = ? 
      ORDER BY payment_date ASC
    `, [bill_id])

    if (payments.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No payments found for this bill' },
        { status: 400 }
      )
    }

    // Generate PDF receipt
    const pdfBuffer = await receiptService.generateReceiptPDF(bill, payments)

    // Send email with receipt
    const emailResult = await emailService.sendReceiptToTenant(
      bill, 
      payments, 
      bill.tenant_email, 
      pdfBuffer
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