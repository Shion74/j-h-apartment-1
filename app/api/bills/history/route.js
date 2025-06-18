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
    const tenantId = searchParams.get('tenant_id')
    const tenantName = searchParams.get('tenant_name')
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 20
    const offset = (page - 1) * limit

    // Build query conditions
    let whereConditions = []
    let queryParams = []

    if (tenantId) {
      whereConditions.push('original_tenant_id = $' + (queryParams.length + 1))
      queryParams.push(tenantId)
    }

    if (tenantName) {
      whereConditions.push('tenant_name ILIKE $' + (queryParams.length + 1))
      queryParams.push(`%${tenantName}%`)
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : ''

    // Get bill history with pagination
    const billHistoryResult = await pool.query(`
      SELECT 
        *,
        (rent_to - rent_from) as days_in_period
      FROM bill_history 
      ${whereClause}
      ORDER BY original_tenant_id, rent_from
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset])

    // Get total count for pagination
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM bill_history 
      ${whereClause}
    `, queryParams)

    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / limit)

    // Get summary statistics if specific tenant requested
    let tenantSummary = null
    if (tenantId) {
      const summaryResult = await pool.query(`
        SELECT 
          tenant_name,
          original_tenant_id,
          COUNT(*) as total_bills,
          SUM(total_amount) as total_billed,
          SUM(amount_paid) as total_paid,
          SUM(remaining_balance) as total_unpaid,
          MIN(rent_from) as first_bill_period,
          MAX(rent_to) as last_bill_period,
          COUNT(CASE WHEN is_final_bill = true THEN 1 END) as final_bills_count
        FROM bill_history 
        WHERE original_tenant_id = $1
        GROUP BY tenant_name, original_tenant_id
      `, [tenantId])

      tenantSummary = summaryResult.rows[0] || null
    }

    const billHistory = billHistoryResult.rows

    return NextResponse.json({
      success: true,
      bill_history: billHistory,
      tenant_summary: tenantSummary,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: total,
        records_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    })

  } catch (error) {
    console.error('Bill history fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 