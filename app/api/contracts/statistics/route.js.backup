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
    const [stats] = await pool.execute(`
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
    const [expiring] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM tenants t
      WHERE t.contract_status = 'active'
        AND t.contract_end_date IS NOT NULL
        AND DATEDIFF(t.contract_end_date, CURDATE()) <= 30
        AND DATEDIFF(t.contract_end_date, CURDATE()) > 0
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