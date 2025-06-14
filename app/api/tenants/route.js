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

    // Get all tenants with room and branch details
    const [tenants] = await pool.execute(`
      SELECT 
        t.*,
        r.room_number,
        r.monthly_rent,
        b.name as branch_name
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      ORDER BY t.name
    `)

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
      address, 
      room_id, 
      rent_start,
      initial_electric_reading,
      advance_payment,
      security_deposit,
      advance_payment_status,
      security_deposit_status
    } = await request.json()

    // Validation
    if (!name || !mobile || !rent_start) {
      return NextResponse.json(
        { success: false, message: 'Name, mobile, and rent start date are required' },
        { status: 400 }
      )
    }

    // Calculate contract end date (6 months from start)
    const startDate = new Date(rent_start)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 6)

    // Insert new tenant with deposit information
    const [result] = await pool.execute(`
      INSERT INTO tenants (
        name, mobile, email, address, room_id, rent_start,
        contract_start_date, contract_end_date, contract_duration_months,
        initial_electric_reading, contract_status,
        advance_payment, security_deposit, 
        advance_payment_status, security_deposit_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, mobile, email || null, address || null, room_id || null, rent_start,
      rent_start, endDate.toISOString().split('T')[0], 6,
      initial_electric_reading || 0, 'active',
      advance_payment || 3500.00, security_deposit || 3500.00,
      advance_payment_status || 'unpaid', security_deposit_status || 'unpaid'
    ])

    // Update room status if room is assigned
    if (room_id) {
      await pool.execute(
        'UPDATE rooms SET status = ? WHERE id = ?',
        ['occupied', room_id]
      )
    }

    // Get the newly created tenant with room details
    const [newTenant] = await pool.execute(`
      SELECT 
        t.*,
        r.room_number,
        r.monthly_rent,
        b.name as branch_name,
        b.address as branch_address
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.id = ?
    `, [result.insertId])

    const tenant = newTenant[0]

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
        await pool.execute(
          'UPDATE tenants SET welcome_email_sent = TRUE WHERE id = ?',
          [tenant.id]
        )

        // Log email notification
        await pool.execute(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
          VALUES (?, 'welcome', 'Welcome to J&H Apartment', ?, 'sent', NOW())
        `, [tenant.id, tenant.email])

        emailStatus = { success: true, message: 'Welcome email sent successfully' }
        console.log(`✅ Welcome email sent to ${tenant.name} (${tenant.email})`)
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError)
        
        // Log failed email attempt
        await pool.execute(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
          VALUES (?, 'welcome', 'Welcome to J&H Apartment', ?, 'failed', ?)
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