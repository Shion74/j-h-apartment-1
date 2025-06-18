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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 20
    const search = searchParams.get('search') || ''
    const reason = searchParams.get('reason') || ''
    const offset = (page - 1) * limit

    // Build search conditions
    let whereConditions = []
    let queryParams = []

    if (search) {
      whereConditions.push('(name LIKE $' + (queryParams.length + 1) + ' OR mobile LIKE $' + (queryParams.length + 2) + ' OR room_number LIKE $' + (queryParams.length + 3) + ')')
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    if (reason) {
      whereConditions.push('reason_for_leaving = $' + (queryParams.length + 1))
      queryParams.push(reason)
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : ''

    // Get tenant history with pagination
    const tenantHistoryResult = await pool.query(`
      SELECT 
        *,
        (rent_end - rent_start) as days_stayed,
        CASE 
          WHEN contract_completed = true THEN 'Completed'
          WHEN reason_for_leaving = 'early_termination' THEN 'Early Termination'
          WHEN reason_for_leaving = 'eviction' THEN 'Evicted'
          ELSE 'Other'
        END as departure_type
      FROM tenant_history 
      ${whereClause}
      ORDER BY deleted_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset])

    // Get total count for pagination
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM tenant_history 
      ${whereClause}
    `, queryParams)

    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / limit)

    // Get summary statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_tenants,
        SUM(CASE WHEN contract_completed = true THEN 1 ELSE 0 END) as completed_contracts,
        SUM(CASE WHEN reason_for_leaving = 'early_termination' THEN 1 ELSE 0 END) as early_terminations,
        SUM(CASE WHEN reason_for_leaving = 'eviction' THEN 1 ELSE 0 END) as evictions,
        SUM(security_deposit_refund_amount) as total_refunds_given,
        AVG(rent_end - rent_start) as avg_stay_duration,
        SUM(total_bills_paid) as total_revenue_collected,
        SUM(total_bills_unpaid) as total_unpaid_amount
      FROM tenant_history
    `)

    const tenantHistory = tenantHistoryResult.rows
    const stats = statsResult.rows

    return NextResponse.json({
      success: true,
      tenant_history: tenantHistory,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: total,
        records_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      statistics: stats[0]
    })

  } catch (error) {
    console.error('Tenant history fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 