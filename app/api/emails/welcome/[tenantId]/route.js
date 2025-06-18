import { NextResponse } from 'next/server'
import { pool } from '../../../../../lib/database'
import { requireAuth } from '../../../../../lib/auth'
import emailService from '../../../../../services/emailService.js'

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

    // Validate tenant ID
    if (!tenantId || isNaN(parseInt(tenantId))) {
      return NextResponse.json(
        { success: false, message: 'Valid tenant ID is required' },
        { status: 400 }
      )
    }

    // Get tenant information
    const tenantsResult = await pool.query(`
      SELECT t.*, r.room_number, r.monthly_rent, b.name as branch_name
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

    // Check if tenant has email
    if (!tenant.email) {
      return NextResponse.json(
        { success: false, message: 'Tenant has no email address' },
        { status: 400 }
      )
    }

    // Send welcome email
    const roomInfo = {
      room_number: tenant.room_number,
      monthly_rent: tenant.monthly_rent,
      branch_name: tenant.branch_name
    }
    
    await emailService.sendWelcomeEmail(tenant, roomInfo)

    // Log email notification
    await pool.query(`
      INSERT INTO email_notifications 
      (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
      VALUES ($1, 'welcome', 'Welcome to J&H Apartment', $2, 'sent', NOW())
    `, [tenant.id, tenant.email])

    return NextResponse.json({
      success: true,
      message: 'Welcome email sent successfully',
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        room: tenant.room_number,
        branch: tenant.branch_name
      }
    })

  } catch (error) {
    console.error('Welcome email error:', error)
    
    // Log failed email attempt
    if (params.tenantId) {
      try {
        // Try to get tenant email for logging, but use fallback if not available
        let tenantEmail = 'unknown'
        try {
          const emailResult = await pool.query('SELECT email FROM tenants WHERE id = $1', [params.tenantId])
          if (emailResult.rows.length > 0) {
            tenantEmail = emailResult.rows[0].email || 'unknown'
          }
        } catch (emailLookupError) {
          // Use fallback if can't get tenant email
        }
        
        await pool.query(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
          VALUES ($1, 'welcome', 'Welcome to J&H Apartment', $2, 'failed', $3)
        `, [params.tenantId, tenantEmail, error.message])
      } catch (logError) {
        console.error('Failed to log email error:', logError)
      }
    }

    return NextResponse.json(
      { success: false, message: 'Failed to send welcome email', error: error.message },
      { status: 500 }
    )
  }
}