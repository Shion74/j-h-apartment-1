import { NextResponse } from 'next/server'
import { pool } from '../../../lib/database'
import { requireAuth } from '../../../lib/auth'
import emailService from '../../../services/emailService.js'

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

    // Get all active tenants with room, branch details, billing cycle progress, and deposit information
    const result = await pool.query(`
      SELECT 
        t.*,
        r.room_number,
        r.monthly_rent,
        b.name as branch_name,
        -- Get advance deposit information
        COALESCE(adv_dep.initial_amount, 0) as advance_payment,
        COALESCE(adv_dep.remaining_balance, 0) as advance_remaining,
        COALESCE(adv_dep.status, 'unpaid') as advance_payment_status,
        -- Get security deposit information
        COALESCE(sec_dep.initial_amount, 0) as security_deposit,
        COALESCE(sec_dep.remaining_balance, 0) as security_remaining,
        COALESCE(sec_dep.status, 'unpaid') as security_deposit_status,
        -- Count paid billing cycles from bill_history (archived paid bills)
        COALESCE(
          (SELECT COUNT(*) 
           FROM bill_history bh 
           WHERE bh.original_tenant_id = t.id 
           AND bh.status = 'paid'
           AND bh.is_final_bill = false), 
          0
        ) as paid_cycles_count,
        -- Use completed_cycles field or fallback to 0
        COALESCE(t.completed_cycles, 0) as completed_cycles,
        -- Check if tenant has any final bill (contract completion indicator)
        EXISTS(
          SELECT 1 
          FROM bill_history bh 
          WHERE bh.original_tenant_id = t.id 
          AND bh.is_final_bill = true
        ) as has_final_bill,
        -- Calculate contract progress percentage based on completed cycles vs total duration
        CASE 
          WHEN t.contract_duration_months > 0 THEN
            ROUND(
              (COALESCE(t.completed_cycles, 0) * 100.0 / t.contract_duration_months), 1
            )
          ELSE 0
        END as contract_progress_percentage,
        -- Calculate the correct cycle count for display (completed_cycles/contract_duration_months)
        COALESCE(t.completed_cycles, 0)::text || '/' || t.contract_duration_months::text || ' cycles' as correct_cycles_display
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN tenant_deposits adv_dep ON t.id = adv_dep.tenant_id AND adv_dep.deposit_type = 'advance'
      LEFT JOIN tenant_deposits sec_dep ON t.id = sec_dep.tenant_id AND sec_dep.deposit_type = 'security'
      WHERE t.status = 'active'
      ORDER BY t.name
    `)
    const tenants = result.rows

    return NextResponse.json({
      success: true,
      tenants
    })

  } catch (error) {
    console.error('Tenants fetch error:', error)
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
      name, 
      mobile, 
      email, 
      room_id, 
      rent_start,
      initial_electric_reading,
      advance_payment,
      security_deposit,
      advance_payment_status,
      security_deposit_status
    } = await request.json()

    // Validation
    if (!name || !mobile || !rent_start || !room_id || initial_electric_reading === undefined || initial_electric_reading === '') {
      return NextResponse.json(
        { success: false, message: 'All fields are required: name, mobile, rent start date, room, and initial electric reading' },
        { status: 400 }
      )
    }

    // Format mobile number - add +63 prefix if not present and validate format
    let formattedMobile = mobile.replace(/\D/g, '') // Remove all non-digits
    
    // If mobile starts with +63, remove it and get the 10 digits
    if (mobile.startsWith('+63')) {
      formattedMobile = mobile.slice(3).replace(/\D/g, '')
    }
    
    // Validate mobile number format (should be exactly 10 digits starting with 9)
    if (!/^9\d{9}$/.test(formattedMobile)) {
      return NextResponse.json(
        { success: false, message: 'Mobile number must be 10 digits starting with 9 (e.g., 9171234567)' },
        { status: 400 }
      )
    }
    
    // Add +63 prefix for storage
    const fullMobileNumber = `+63${formattedMobile}`

    // Parse and validate numeric values
    const parsedElectricReading = parseFloat(initial_electric_reading)
    const parsedAdvancePayment = parseFloat(advance_payment || 3500.00)
    const parsedSecurityDeposit = parseFloat(security_deposit || 3500.00)
    const parsedRoomId = parseInt(room_id)

    if (isNaN(parsedElectricReading) || parsedElectricReading < 0) {
      return NextResponse.json(
        { success: false, message: 'Initial electric reading must be a valid positive number' },
        { status: 400 }
      )
    }

    if (isNaN(parsedAdvancePayment) || parsedAdvancePayment <= 0) {
      return NextResponse.json(
        { success: false, message: 'Advance payment must be a valid positive amount' },
        { status: 400 }
      )
    }

    if (isNaN(parsedSecurityDeposit) || parsedSecurityDeposit <= 0) {
      return NextResponse.json(
        { success: false, message: 'Security deposit must be a valid positive amount' },
        { status: 400 }
      )
    }

    if (isNaN(parsedRoomId) || parsedRoomId <= 0) {
      return NextResponse.json(
        { success: false, message: 'Please select a valid room' },
        { status: 400 }
      )
    }

    // Calculate contract end date (6 months from start)
    const startDate = new Date(rent_start)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 6)

    // Insert new tenant without deposit information (deposits go to separate table)
    const insertResult = await pool.query(`
      INSERT INTO tenants (
        name, mobile, email, room_id, rent_start,
        contract_start_date, contract_end_date, contract_duration_months,
        initial_electric_reading, contract_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      name, fullMobileNumber, email || null, parsedRoomId, rent_start,
      rent_start, endDate.toISOString().split('T')[0], 6,
      parsedElectricReading, 'active'
    ])
    const insertId = insertResult.rows[0].id

    // Create advance payment deposit record
    const advanceStatus = advance_payment_status || 'unpaid'
    await pool.query(`
      INSERT INTO tenant_deposits (
        tenant_id, deposit_type, initial_amount, remaining_balance, status
      ) VALUES ($1, 'advance', $2, $3, $4)
    `, [insertId, parsedAdvancePayment, advanceStatus === 'paid' ? parsedAdvancePayment : 0, advanceStatus === 'paid' ? 'active' : 'unpaid'])

    // Create security deposit record
    const securityStatus = security_deposit_status || 'unpaid'
    await pool.query(`
      INSERT INTO tenant_deposits (
        tenant_id, deposit_type, initial_amount, remaining_balance, status
      ) VALUES ($1, 'security', $2, $3, $4)
    `, [insertId, parsedSecurityDeposit, securityStatus === 'paid' ? parsedSecurityDeposit : 0, securityStatus === 'paid' ? 'active' : 'unpaid'])

    // Update room status if room is assigned
    await pool.query(
      'UPDATE rooms SET status = $1 WHERE id = $2',
      ['occupied', parsedRoomId]
    )

    // Get the newly created tenant with room and deposit details
    const newTenantResult = await pool.query(`
      SELECT 
        t.*,
        r.room_number,
        r.monthly_rent,
        b.name as branch_name,
        b.address as branch_address,
        -- Get advance deposit information
        COALESCE(adv_dep.initial_amount, 0) as advance_payment,
        COALESCE(adv_dep.remaining_balance, 0) as advance_remaining,
        COALESCE(adv_dep.status, 'unpaid') as advance_payment_status,
        -- Get security deposit information
        COALESCE(sec_dep.initial_amount, 0) as security_deposit,
        COALESCE(sec_dep.remaining_balance, 0) as security_remaining,
        COALESCE(sec_dep.status, 'unpaid') as security_deposit_status
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN tenant_deposits adv_dep ON t.id = adv_dep.tenant_id AND adv_dep.deposit_type = 'advance'
      LEFT JOIN tenant_deposits sec_dep ON t.id = sec_dep.tenant_id AND sec_dep.deposit_type = 'security'
      WHERE t.id = $1
    `, [insertId])

    const tenant = newTenantResult.rows[0]

    // Send welcome email if tenant has email address
    let emailStatus = null
    if (tenant.email) {
      try {
        // Prepare room info for email
        const roomInfo = {
          room_number: tenant.room_number || 'N/A',
          monthly_rent: tenant.monthly_rent || 0,
          branch_name: tenant.branch_name || 'J&H Apartment'
        }
        
        await emailService.sendWelcomeEmail(tenant, roomInfo)
        
        // Mark welcome email as sent
        await pool.query(
          'UPDATE tenants SET welcome_email_sent = TRUE WHERE id = $1',
          [tenant.id]
        )

        // Log email notification
        await pool.query(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
          VALUES ($1, 'welcome', 'Welcome to J&H Apartment', $2, 'sent', NOW())
        `, [tenant.id, tenant.email])

        emailStatus = { success: true, message: 'Welcome email sent successfully' }
        console.log(`✅ Welcome email sent to ${tenant.name} (${tenant.email})`)
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError)
        
        // Log failed email attempt
        await pool.query(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
          VALUES ($1, 'welcome', 'Welcome to J&H Apartment', $2, 'failed', $3)
        `, [tenant.id, tenant.email, emailError.message])

        emailStatus = { success: false, error: emailError.message }
      }
    } else {
      emailStatus = { success: false, message: 'No email address provided' }
    }

    return NextResponse.json({
      success: true,
      message: 'Tenant created successfully',
      tenant,
      email_status: emailStatus
    })

  } catch (error) {
    console.error('Tenant creation error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 