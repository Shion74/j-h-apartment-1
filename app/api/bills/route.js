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
          WHEN b.due_date IS NOT NULL AND CURRENT_DATE > b.due_date AND b.status != 'paid' AND b.status != 'refund' THEN TRUE
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
      ORDER BY 
        CASE WHEN b.status = 'refund' THEN 0 ELSE 1 END,  -- Refund bills first
        b.bill_date DESC
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
      extra_fee_description,
      is_final_bill = false,
      move_out_reason,
      move_out_notes,
      deposit_applied = 0,
      original_bill_amount = 0,
      deposit_breakdown = null,
      total_amount = null, // Allow explicit total_amount to be provided
      admin_override = false // Allow admin to override unpaid bills validation
    } = await request.json()

    console.log('Bill creation request:', { 
      electric_rate_per_kwh, 
      water_amount,
      is_final_bill,
      move_out_reason,
      total_amount,
      deposit_applied,
      original_bill_amount,
      admin_override
    })

    // Log admin override usage for audit trail
    if (admin_override) {
      console.log(`⚠️ ADMIN OVERRIDE: Bill creation bypassing unpaid bills validation for tenant_id ${tenant_id}`)
    }

    // Validation
    if (!tenant_id || !room_id || !rent_from || !rent_to || !rent_amount) {
      return NextResponse.json(
        { success: false, message: 'Required fields missing' },
        { status: 400 }
      )
    }

    // Check for existing unpaid bills for this tenant (business rule)
    // This prevents creating new bills when tenant has outstanding payments
    // Final bills (move-out) are allowed as they're required for tenant departure
    // Admin can override this validation for special circumstances
    if (!is_final_bill && !admin_override) {
      const unpaidBillsResult = await pool.query(`
        SELECT 
          b.id, 
          b.total_amount, 
          b.rent_from, 
          b.rent_to,
          b.status,
          r.room_number
        FROM bills b
        LEFT JOIN rooms r ON b.room_id = r.id
        WHERE b.tenant_id = $1 
        AND b.status IN ('unpaid', 'partial')
        ORDER BY b.rent_from DESC
      `, [tenant_id])

      if (unpaidBillsResult.rows.length > 0) {
        const unpaidBills = unpaidBillsResult.rows
        const totalUnpaid = unpaidBills.reduce((sum, bill) => sum + parseFloat(bill.total_amount), 0)
        
                 console.log(`🚫 BILL CREATION BLOCKED: Tenant ${tenant_id} has ${unpaidBills.length} unpaid bill(s) totaling ₱${totalUnpaid.toFixed(2)}`)
         
         return NextResponse.json(
           { 
             success: false, 
             message: `Cannot create new bill. Tenant has ${unpaidBills.length} unpaid bill(s) totaling ₱${totalUnpaid.toFixed(2)}`,
             error_type: 'unpaid_bills_exist',
             unpaid_bills: unpaidBills.map(bill => ({
               id: bill.id,
               amount: bill.total_amount,
               period: `${bill.rent_from} to ${bill.rent_to}`,
               status: bill.status,
               room_number: bill.room_number
             })),
             total_unpaid: totalUnpaid,
             suggestion: 'Please ensure all existing bills are paid before creating a new bill, or create a final bill for move-out.'
           },
           { status: 400 }
         )
      }
    }

    // Get branch-specific rates if not provided
    let finalElectricRate = electric_rate_per_kwh
    let finalWaterAmount = water_amount
    
    if (!finalElectricRate || !finalWaterAmount) {
      // Get branch-specific rates from room's branch
      const branchRatesResult = await pool.query(`
        SELECT br.electricity_rate, br.water_rate, br.name as branch_name
        FROM rooms r
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE r.id = $1
      `, [room_id])
      
      if (branchRatesResult.rows.length > 0) {
        const branchRates = branchRatesResult.rows[0]
        finalElectricRate = finalElectricRate || parseFloat(branchRates.electricity_rate) || 11.00
        finalWaterAmount = finalWaterAmount || parseFloat(branchRates.water_rate) || 200.00
        
        console.log('Using branch-specific rates:', { 
          branch_name: branchRates.branch_name,
          finalElectricRate, 
          finalWaterAmount,
          from_branch: true
        })
      } else {
        // Fallback to global settings if branch rates not found
        const currentRates = await Setting.getBillingRates()
        finalElectricRate = finalElectricRate || currentRates.electric_rate_per_kwh
        finalWaterAmount = finalWaterAmount || currentRates.water_fixed_amount
        
        console.log('Using global fallback rates:', { 
          finalElectricRate, 
          finalWaterAmount, 
          from_global: true
        })
      }
    } else {
      console.log('Using provided rates:', { 
        finalElectricRate, 
        finalWaterAmount, 
        from_request: true
      })
    }

    // Calculate electric amount
    const electricConsumption = Math.max(0, electric_present_reading - electric_previous_reading)
    const electricAmount = parseFloat((electricConsumption * finalElectricRate).toFixed(2))

    // Calculate total amount - but respect the provided total_amount for final bills
    let totalAmount;
    if (total_amount !== null) {
      totalAmount = total_amount
    } else {
      totalAmount = parseFloat((
        parseFloat(rent_amount) +
        electricAmount +
        parseFloat(finalWaterAmount) +
        parseFloat(extra_fee_amount || 0)
      ).toFixed(2))
    }

    // Create the bill - store readings exactly as provided
    const result = await pool.query(`
      INSERT INTO bills (
        tenant_id, room_id, bill_date, rent_from, rent_to, rent_amount,
        electric_previous_reading, electric_present_reading, electric_consumption,
        electric_rate_per_kwh, electric_amount, water_amount,
        extra_fee_amount, extra_fee_description, total_amount, status,
        is_final_bill, move_out_reason, notes, deposit_applied, original_bill_amount
      ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'unpaid', $15, $16, $17, $18, $19)
      RETURNING id
    `, [
      tenant_id, room_id, rent_from, rent_to, rent_amount,
      electric_previous_reading, electric_present_reading, electricConsumption,
      finalElectricRate, electricAmount, finalWaterAmount,
      extra_fee_amount || 0, extra_fee_description || null, totalAmount,
      is_final_bill, move_out_reason || null, move_out_notes || null,
      deposit_applied || 0, original_bill_amount || totalAmount
    ])

    const insertId = result.rows[0].id

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

    // Handle email notifications differently for final bills vs regular bills
    let emailStatus = null
    if (bill.tenant_email) {
      try {
        if (is_final_bill) {
          // For final bills, use the specialized final bill email template
          const depositApplied = parseFloat(bill.deposit_applied || 0)
          
          // Send final bill email with deposit information
          const emailSent = await emailService.sendFinalBillToTenant(bill, bill.tenant_email)
          
          // Log email notification
          await pool.query(`
            INSERT INTO email_notifications 
            (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
            VALUES ($1, 'bill', 'Final Bill - Move Out', $2, $3, NOW())
          `, [bill.tenant_id, bill.tenant_email, emailSent ? 'sent' : 'failed'])

          emailStatus = { 
            success: emailSent, 
            message: emailSent ? 
              `✅ Final bill email sent to ${bill.tenant_name} (${bill.tenant_email})` : 
              'Failed to send final bill email' 
          }
          
          if (emailSent) {
            console.log(`✅ Final bill email sent to ${bill.tenant_name} (${bill.tenant_email})`)
          } else {
            console.error(`❌ Failed to send final bill email to ${bill.tenant_name} (${bill.tenant_email})`)
          }
        } else {
          // For regular bills, send standard bill email
          await emailService.sendBillToTenant(bill, bill.tenant_email)
          
          // Log email notification
          await pool.query(`
            INSERT INTO email_notifications 
            (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
            VALUES ($1, 'bill', 'New Bill Generated', $2, 'sent', NOW())
          `, [bill.tenant_id, bill.tenant_email])

          emailStatus = { success: true, message: 'Bill email sent successfully' }
          console.log(`✅ Bill email sent to ${bill.tenant_name} (${bill.tenant_email})`)
        }
      } catch (emailError) {
        console.error('Failed to send bill email:', emailError)
        
        // Log failed email attempt
        const emailType = 'bill' // Use 'bill' for both regular and final bills
        const emailSubject = is_final_bill ? 'Final Bill - Move Out' : 'New Bill Generated'
        await pool.query(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
          VALUES ($1, $2, $3, $4, 'failed', $5)
        `, [bill.tenant_id, emailType, emailSubject, bill.tenant_email, emailError.message])

        emailStatus = { success: false, error: emailError.message }
      }
    } else {
      emailStatus = { success: false, message: 'No email address provided' }
    }

    return NextResponse.json({
      success: true,
      message: is_final_bill ? 'Final bill created successfully' : 'Bill created successfully',
      bill_id: insertId,
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