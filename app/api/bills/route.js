import { NextResponse } from 'next/server'
import { pool } from '../../../lib/database'
import { requireAuth } from '../../../lib/auth'
import emailService from '../../../services/emailService'

export async function GET(request) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    // Get all bills with tenant and room details, including payment information
    const [bills] = await pool.execute(`
      SELECT 
        b.*,
        t.name as tenant_name,
        r.room_number,
        br.name as branch_name,
        COALESCE(SUM(p.amount), 0) as total_paid,
        (b.total_amount - COALESCE(SUM(p.amount), 0)) as remaining_balance
      FROM bills b
      LEFT JOIN tenants t ON b.tenant_id = t.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN branches br ON r.branch_id = br.id
      LEFT JOIN payments p ON b.id = p.bill_id
      GROUP BY b.id
      ORDER BY b.bill_date DESC
    `)

    return NextResponse.json({
      success: true,
      bills
    })

  } catch (error) {
    console.error('Bills fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
      tenant_id,
      room_id,
      rent_from,
      rent_to,
      rent_amount,
      electric_previous_reading,
      electric_present_reading,
      electric_rate_per_kwh,
      water_amount,
      extra_fee_amount,
      extra_fee_description
    } = await request.json()

    // Validation
    if (!tenant_id || !room_id || !rent_from || !rent_to || !rent_amount) {
      return NextResponse.json(
        { success: false, message: 'Required fields missing' },
        { status: 400 }
      )
    }

    // Calculate electric amount
    const electricConsumption = (electric_present_reading || 0) - (electric_previous_reading || 0)
    const electricAmount = electricConsumption * (electric_rate_per_kwh || 12.00)

    // Calculate total amount
    const totalAmount = parseFloat(rent_amount) + 
                       parseFloat(electricAmount) + 
                       parseFloat(water_amount || 0) + 
                       parseFloat(extra_fee_amount || 0)

    // Insert new bill
    const [result] = await pool.execute(`
      INSERT INTO bills (
        tenant_id, room_id, bill_date, rent_from, rent_to, rent_amount,
        electric_previous_reading, electric_present_reading, electric_consumption,
        electric_rate_per_kwh, electric_amount, water_amount,
        extra_fee_amount, extra_fee_description, total_amount, status
      ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')
    `, [
      tenant_id, room_id, rent_from, rent_to, rent_amount,
      electric_previous_reading || 0, electric_present_reading || 0, electricConsumption,
      electric_rate_per_kwh || 12.00, electricAmount, water_amount || 0,
      extra_fee_amount || 0, extra_fee_description || '', totalAmount
    ])

    // Get the newly created bill with details including tenant email
    const [newBill] = await pool.execute(`
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
    `, [result.insertId])

    const bill = newBill[0]

    // Send email notification if tenant has email
    let emailStatus = null
    if (bill.tenant_email) {
      try {
        await emailService.sendBillToTenant(bill, bill.tenant_email)
        
        // Log email notification
        await pool.execute(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
          VALUES (?, 'bill', 'New Bill Generated', ?, 'sent', NOW())
        `, [bill.tenant_id, bill.tenant_email])

        emailStatus = { success: true, message: 'Bill email sent successfully' }
        console.log(`✅ Bill email sent to ${bill.tenant_name} (${bill.tenant_email})`)
      } catch (emailError) {
        console.error('Failed to send bill email:', emailError)
        
        // Log failed email attempt
        await pool.execute(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
          VALUES (?, 'bill', 'New Bill Generated', ?, 'failed', ?)
        `, [bill.tenant_id, bill.tenant_email, emailError.message])

        emailStatus = { success: false, error: emailError.message }
      }
    } else {
      emailStatus = { success: false, message: 'No email address provided' }
    }

    return NextResponse.json({
      success: true,
      message: 'Bill created successfully',
      bill,
      email_status: emailStatus
    })

  } catch (error) {
    console.error('Bill creation error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 