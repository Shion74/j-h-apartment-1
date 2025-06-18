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

    // Get contract statistics
    const statsResult = await pool.query(`
      SELECT 
        contract_status,
        COUNT(*) as count,
        GROUP_CONCAT(CONCAT(name, ' (Room ', r.room_number, ')') SEPARATOR ', ') as tenants
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      WHERE t.room_id IS NOT NULL
      GROUP BY contract_status
    `)
    
    // Get contracts expiring in 30 days
    const expiringResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM tenants t
      WHERE t.contract_status = 'active'
        AND t.contract_end_date IS NOT NULL
        AND DATE_PART('day', t.contract_end_date - CURRENT_DATE) <= 30
        AND DATE_PART('day', t.contract_end_date - CURRENT_DATE) > 0
    `)

    return NextResponse.json({
      success: true,
      statistics: {
        contractStatus: stats,
        expiringIn30Days: expiring[0].count
      }
    })

  } catch (error) {
    console.error('Contract statistics error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 