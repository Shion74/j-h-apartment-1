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

    // Get statistics from database
    const [branchesResult] = await pool.execute('SELECT COUNT(*) as count FROM branches')
    const [roomsResult] = await pool.execute('SELECT COUNT(*) as count FROM rooms')
    const [occupiedRoomsResult] = await pool.execute('SELECT COUNT(*) as count FROM rooms WHERE status = "occupied"')
    const [tenantsResult] = await pool.execute('SELECT COUNT(*) as count FROM tenants WHERE contract_status = "active"')
    
    // Calculate monthly revenue (current month paid bills)
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const [revenueResult] = await pool.execute(`
      SELECT COALESCE(SUM(p.amount), 0) as revenue
      FROM payments p
      JOIN bills b ON p.bill_id = b.id
      WHERE DATE_FORMAT(p.payment_date, '%Y-%m') = ?
    `, [currentMonth])

    // Get pending bills count
    const [pendingBillsResult] = await pool.execute('SELECT COUNT(*) as count FROM bills WHERE status = "unpaid"')

    const stats = {
      totalBranches: branchesResult[0].count,
      totalRooms: roomsResult[0].count,
      occupiedRooms: occupiedRoomsResult[0].count,
      totalTenants: tenantsResult[0].count,
      monthlyRevenue: parseFloat(revenueResult[0].revenue) || 0,
      pendingBills: pendingBillsResult[0].count
    }

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 