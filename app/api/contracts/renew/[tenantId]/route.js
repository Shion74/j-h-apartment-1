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

    try {
      // Get current tenant info
      const tenantResult = await pool.query(
        'SELECT * FROM tenants WHERE id = $1',
        [tenantId]
      )

      if (tenantResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Tenant not found' },
          { status: 404 }
        )
      }

      const tenant = tenantResult.rows[0]
      const newStartDate = new Date(tenant.contract_end_date)
      const newEndDate = new Date(newStartDate)
      newEndDate.setMonth(newEndDate.getMonth() + parseInt(duration_months))
      
      // Count paid billing cycles for this tenant
      // Use both active bills and bill_history tables for accurate count
      const paidCyclesResult = await pool.query(`
        SELECT COUNT(*) as paid_cycles
        FROM (
          SELECT id FROM bills 
          WHERE tenant_id = $1 AND status = 'paid'
          AND is_final_bill = false
          UNION ALL
          SELECT id FROM bill_history 
          WHERE original_tenant_id = $1 AND status = 'paid'
          AND is_final_bill = false
        ) AS all_paid_bills
      `, [tenantId])
      
      // Use the actual count of paid cycles
      const paidCycles = parseInt(paidCyclesResult.rows[0].paid_cycles) || 0
      console.log('Paid cycles for tenant:', paidCycles)
      
      // Begin transaction
      await pool.query('BEGIN')
      
      // Update tenant contract - keep the completed cycles and add new contract duration
      // This is important - we need to set the contract_duration_months to the NEW total duration
      // For example, if tenant completed 2 cycles of a 6-month contract and renews for 6 more months,
      // the new contract_duration_months should be 12 (not just 6)
      const totalContractDuration = parseInt(tenant.contract_duration_months || 6) + parseInt(duration_months)
      
      await pool.query(
        `UPDATE tenants SET 
         contract_start_date = $1,
         contract_end_date = $2,
         contract_duration_months = $3,
         contract_status = 'active',
         contract_expiry_notified = FALSE,
         completed_cycles = $4
         WHERE id = $5`,
        [
          newStartDate.toISOString().split('T')[0],
          newEndDate.toISOString().split('T')[0],
          totalContractDuration, // Use the total duration including previous contract
          paidCycles,
          tenantId
        ]
      )

      // Log renewal notification
      await pool.query(
        `INSERT INTO email_notifications 
         (tenant_id, email_type, email_subject, recipient_email, status) 
         VALUES ($1, 'contract_renewal', $2, $3, 'pending')`,
        [
          tenantId,
          'Contract Renewal Confirmation',
          tenant.email || 'no-email@example.com'
        ]
      )

      await pool.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Contract renewed successfully',
        newStartDate: newStartDate.toISOString().split('T')[0],
        newEndDate: newEndDate.toISOString().split('T')[0],
        duration: duration_months,
        totalContractDuration: totalContractDuration,
        completedCycles: paidCycles
      })

    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Contract renewal error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 