import { NextResponse } from 'next/server'
import { pool } from '../../../lib/database'
import { requireAuth } from '../../../lib/auth'
import emailService from '../../../services/emailService'

import Setting from '../../../models/setting.js'

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

    // Get all bills with tenant and room details, including payment information and penalty status
    const result = await pool.query(`
      SELECT 
        b.*,
        t.name as tenant_name,
        r.room_number,
        br.name as branch_name,
        COALESCE(SUM(p.amount), 0) as total_paid,
        (b.total_amount - COALESCE(SUM(p.amount), 0)) as remaining_balance,
        CASE 
          WHEN b.due_date IS NOT NULL AND CURRENT_DATE > b.due_date AND b.status != 'paid' THEN TRUE
          ELSE FALSE
        END as is_overdue,
        DATE_PART('day', CURRENT_DATE - COALESCE(b.due_date, b.bill_date + INTERVAL '10 days')) as days_overdue,
        -- Get the actual payment date from the latest payment
        (SELECT p2.actual_payment_date 
         FROM payments p2 
         WHERE p2.bill_id = b.id 
         ORDER BY p2.payment_date DESC 
         LIMIT 1) as actual_payment_date,
        -- Get the system payment date as fallback
        (SELECT p2.payment_date 
         FROM payments p2 
         WHERE p2.bill_id = b.id 
         ORDER BY p2.payment_date DESC 
         LIMIT 1) as last_payment_date
      FROM bills b
      LEFT JOIN tenants t ON b.tenant_id = t.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN branches br ON r.branch_id = br.id
      LEFT JOIN payments p ON b.id = p.bill_id
      GROUP BY b.id, t.name, r.room_number, br.name
      ORDER BY b.bill_date DESC
    `)
    const bills = result.rows

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

    console.log('Bill creation request:', { electric_rate_per_kwh, water_amount })

    // Validation
    if (!tenant_id || !room_id || !rent_from || !rent_to || !rent_amount) {
      return NextResponse.json(
        { success: false, message: 'Required fields missing' },
        { status: 400 }
      )
    }

    // Get current rates from settings if not provided
    const currentRates = await Setting.getBillingRates()
    const finalElectricRate = electric_rate_per_kwh || currentRates.electric_rate_per_kwh
    const finalWaterAmount = water_amount || currentRates.water_fixed_amount

    console.log('Using rates:', { 
      finalElectricRate, 
      finalWaterAmount, 
      currentRatesFromDB: currentRates 
    })

    // Calculate electric amount
    const electricConsumption = (electric_present_reading || 0) - (electric_previous_reading || 0)
    const electricAmount = electricConsumption * finalElectricRate

    // Calculate total amount
    const totalAmount = parseFloat(rent_amount) + 
                       parseFloat(electricAmount) + 
                       parseFloat(finalWaterAmount) + 
                       parseFloat(extra_fee_amount || 0)

    console.log('Bill calculation:', {
      rent_amount,
      electricConsumption,
      finalElectricRate,
      electricAmount,
      finalWaterAmount,
      extra_fee_amount: extra_fee_amount || 0,
      totalAmount
    })

    // Insert new bill with due date (10 days after bill date)
    const insertResult = await pool.query(`
      INSERT INTO bills (
        tenant_id, room_id, bill_date, rent_from, rent_to, rent_amount,
        electric_previous_reading, electric_present_reading, electric_consumption,
        electric_rate_per_kwh, electric_amount, water_amount,
        extra_fee_amount, extra_fee_description, total_amount, status, due_date
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'unpaid', NOW() + INTERVAL '10 days')
      RETURNING id
    `, [
      tenant_id, room_id, rent_from, rent_to, rent_amount,
      electric_previous_reading || 0, electric_present_reading || 0, electricConsumption,
      finalElectricRate, electricAmount, finalWaterAmount,
      extra_fee_amount || 0, extra_fee_description || '', totalAmount
    ])
    const insertId = insertResult.rows[0].id

    // Get the newly created bill with details including tenant email
    const newBillResult = await pool.query(`
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
      WHERE b.id = $1
    `, [insertId])

    const bill = newBillResult.rows[0]

    // Send email notification if tenant has email
    let emailStatus = null
    if (bill.tenant_email) {
      try {
        await emailService.sendBillToTenant(bill, bill.tenant_email)
        
        // Log email notification
        await pool.query(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
          VALUES ($1, 'bill', 'New Bill Generated', $2, 'sent', NOW())
        `, [bill.tenant_id, bill.tenant_email])

        emailStatus = { success: true, message: 'Bill email sent successfully' }
        console.log(`✅ Bill email sent to ${bill.tenant_name} (${bill.tenant_email})`)
      } catch (emailError) {
        console.error('Failed to send bill email:', emailError)
        
        // Log failed email attempt
        await pool.query(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
          VALUES ($1, 'bill', 'New Bill Generated', $2, 'failed', $3)
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