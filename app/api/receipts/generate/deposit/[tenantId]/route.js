import { NextResponse } from 'next/server'
import { pool } from '../../../../../../lib/database'
import { requireAuth } from '../../../../../../lib/auth'
import depositReceiptService from '../../../../../../services/depositReceiptService.js'
import emailService from '../../../../../../services/emailService.js'

export async function POST(request, { params }) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { tenantId } = params
    const { send_email = false } = await request.json()

    // Validate tenant ID
    if (!tenantId || isNaN(parseInt(tenantId))) {
      return NextResponse.json(
        { success: false, message: 'Valid tenant ID is required' },
        { status: 400 }
      )
    }

    // Get tenant with deposit information
    const tenantsResult = await pool.query(`
      SELECT t.*, r.room_number, b.name as branch_name, b.address as branch_address
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.id = $1
    `, [tenantId])

    const tenants = tenantsResult.rows
    if (tenants.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    const tenant = tenants[0]

    // Check if tenant has paid deposits
    const hasPaidAdvance = tenant.advance_payment_status === 'paid'
    const hasPaidSecurity = tenant.security_deposit_status === 'paid'

    if (!hasPaidAdvance && !hasPaidSecurity) {
      return NextResponse.json(
        { success: false, message: 'No paid deposits found for this tenant' },
        { status: 400 }
      )
    }

    // Prepare deposit data
    const depositData = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        room_number: tenant.room_number,
        branch_name: tenant.branch_name,
        branch_address: tenant.branch_address
      },
      deposits: []
    }

    if (hasPaidAdvance) {
      depositData.deposits.push({
        type: 'Advance Payment',
        amount: tenant.advance_payment,
        status: 'paid',
        paid_date: tenant.advance_payment_date || tenant.created_at
      })
    }

    if (hasPaidSecurity) {
      depositData.deposits.push({
        type: 'Security Deposit',
        amount: tenant.security_deposit,
        status: 'paid',
        paid_date: tenant.security_deposit_date || tenant.created_at
      })
    }

    // Generate deposit receipt PDF
    const pdfBuffer = await depositReceiptService.generateDepositReceipt(depositData)

    // If email is requested and tenant has email
    if (send_email && tenant.email) {
      try {
        await emailService.sendDepositReceipt(tenant, pdfBuffer)
        
        // Log email notification
        await pool.query(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
          VALUES ($2, 'deposit_receipt', 'Deposit Receipt - J&H Apartment', $3, 'sent', NOW() RETURNING id)
        `, [tenant.id, tenant.email])

        return NextResponse.json({
          success: true,
          message: 'Deposit receipt generated and sent via email',
          tenant: {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            deposits: depositData.deposits
          }
        })
      } catch (emailError) {
        console.error('Failed to send deposit receipt email:', emailError)
        
        // Still return the PDF even if email fails
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="deposit-receipt-${tenant.name.replace(/\s+/g, '-')}-${Date.now()}.pdf"`
          }
        })
      }
    } else {
      // Return PDF file directly
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="deposit-receipt-${tenant.name.replace(/\s+/g, '-')}-${Date.now()}.pdf"`
        }
      })
    }

  } catch (error) {
    console.error('Deposit receipt generation error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to generate deposit receipt', error: error.message },
      { status: 500 }
    )
  }
} 