import { NextResponse } from 'next/server'
import { pool } from '../../../../../lib/database'
import { requireAuth } from '../../../../../lib/auth'

export async function GET(request, { params }) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = params

    // Count paid bills from both active bills and bill_history tables
    const paidBillsResult = await pool.query(`
      SELECT COUNT(*) as paid_cycles
      FROM (
        SELECT id FROM bills 
        WHERE tenant_id = $1 AND status = 'paid'
        UNION ALL
        SELECT id FROM bill_history 
        WHERE original_tenant_id = $1 AND status = 'paid'
      ) AS all_paid_bills
    `, [id])

    const paidCycles = parseInt(paidBillsResult.rows[0]?.paid_cycles || 0)

    // Get contract duration for context
    const tenantResult = await pool.query(`
      SELECT contract_duration_months, completed_cycles
      FROM tenants
      WHERE id = $1
    `, [id])

    const contractDurationMonths = tenantResult.rows[0]?.contract_duration_months || 0
    const recordedCompletedCycles = tenantResult.rows[0]?.completed_cycles || 0

    return NextResponse.json({
      success: true,
      tenant_id: id,
      paid_cycles: paidCycles,
      contract_duration_months: contractDurationMonths,
      recorded_completed_cycles: recordedCompletedCycles
    })
  } catch (error) {
    console.error('Error getting paid cycles:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to get paid cycles' },
      { status: 500 }
    )
  }
} 