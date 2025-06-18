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
    const [tenants] = await pool.execute(`
      SELECT t.*, r.room_number, r.monthly_rent, b.name as branch_name
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.id = ?
    `, [tenantId])

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
    await emailService.sendWelcomeEmail(tenant)

    // Log email notification
    await pool.execute(`
      INSERT INTO email_notifications 
      (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
      VALUES (?, 'welcome', 'Welcome to J&H Apartment', ?, 'sent', NOW())
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
        await pool.execute(`
          INSERT INTO email_notifications 
          (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
          VALUES (?, 'welcome', 'Welcome to J&H Apartment', ?, 'failed', ?)
        `, [params.tenantId, 'unknown', error.message])
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