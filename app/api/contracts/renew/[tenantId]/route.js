import { NextResponse } from 'next/server'
import { pool } from '../../../../../lib/database'
import { requireAuth } from '../../../../../lib/auth'

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
    const { duration_months = 6 } = await request.json()

    // Validate input
    if (!tenantId || isNaN(parseInt(tenantId))) {
      return NextResponse.json(
        { success: false, message: 'Valid tenant ID is required' },
        { status: 400 }
      )
    }

    if (!duration_months || duration_months < 1 || duration_months > 24) {
      return NextResponse.json(
        { success: false, message: 'Duration must be between 1 and 24 months' },
        { status: 400 }
      )
    }

    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Get current tenant info
      const [tenants] = await connection.execute(
        'SELECT * FROM tenants WHERE id = ?',
        [tenantId]
      )

      if (tenants.length === 0) {
        await connection.rollback()
        return NextResponse.json(
          { success: false, message: 'Tenant not found' },
          { status: 404 }
        )
      }

      const tenant = tenants[0]
      const newStartDate = new Date(tenant.contract_end_date)
      const newEndDate = new Date(newStartDate)
      newEndDate.setMonth(newEndDate.getMonth() + parseInt(duration_months))

      // Update tenant contract
      await connection.execute(
        `UPDATE tenants SET 
         contract_start_date = ?,
         contract_end_date = ?,
         contract_duration_months = ?,
         contract_status = 'renewed',
         contract_expiry_notified = FALSE
         WHERE id = ?`,
        [
          newStartDate.toISOString().split('T')[0],
          newEndDate.toISOString().split('T')[0],
          duration_months,
          tenantId
        ]
      )

      // Log renewal notification
      await connection.execute(
        `INSERT INTO email_notifications 
         (tenant_id, email_type, email_subject, recipient_email, status) 
         VALUES (?, 'contract_renewal', ?, ?, 'pending')`,
        [
          tenantId,
          'Contract Renewal Confirmation',
          tenant.email || 'no-email@example.com'
        ]
      )

      await connection.commit()

      return NextResponse.json({
        success: true,
        message: 'Contract renewed successfully',
        newStartDate: newStartDate.toISOString().split('T')[0],
        newEndDate: newEndDate.toISOString().split('T')[0],
        duration: duration_months
      })

    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

  } catch (error) {
    console.error('Contract renewal error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 