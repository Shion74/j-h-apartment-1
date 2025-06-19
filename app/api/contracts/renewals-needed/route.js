import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'

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

    // Get tenants who need contract renewal
    // This includes tenants who have completed cycles >= (contract_duration_months - 1)
    // meaning they're in their final month and need renewal
    const result = await pool.query(`
      SELECT 
        t.id,
        t.name,
        t.email,
        t.mobile,
        t.contract_start_date,
        t.contract_end_date,
        t.contract_duration_months,
        t.contract_status,
        t.completed_cycles,
        r.room_number,
        b.name as branch_name,
        r.monthly_rent,
        -- Calculate days until contract expiry
        DATE_PART('day', t.contract_end_date - CURRENT_DATE) as days_until_expiry,
        -- Calculate renewal urgency level
        CASE 
          WHEN t.completed_cycles >= (t.contract_duration_months - 1) THEN 'immediate'
          WHEN t.completed_cycles >= (t.contract_duration_months - 2) THEN 'soon' 
          ELSE 'future'
        END as renewal_urgency
      FROM tenants t
      JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.contract_status IN ('active', 'renewed')
        AND t.completed_cycles >= (t.contract_duration_months - 1)
      ORDER BY 
        t.completed_cycles DESC,
        t.contract_end_date ASC,
        t.name ASC
    `)

    return NextResponse.json({
      success: true,
      renewals: result.rows,
      summary: {
        total_needing_renewal: result.rows.length,
        immediate: result.rows.filter(t => t.renewal_urgency === 'immediate').length,
        soon: result.rows.filter(t => t.renewal_urgency === 'soon').length
      }
    })

  } catch (error) {
    console.error('Error fetching renewal-needed tenants:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 