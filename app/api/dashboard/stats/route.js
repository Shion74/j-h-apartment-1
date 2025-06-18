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
    const branchesResult = await pool.query('SELECT COUNT(*) as count FROM branches')
    const roomsResult = await pool.query('SELECT COUNT(*) as count FROM rooms')
    const occupiedRoomsResult = await pool.query('SELECT COUNT(*) as count FROM rooms WHERE status = $1', ['occupied'])
    const tenantsResult = await pool.query('SELECT COUNT(*) as count FROM tenants WHERE contract_status = $1', ['active'])
    
    // Calculate monthly revenue (current month paid bills, including archived)
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const revenueResult = await pool.query(`
      WITH all_payments AS (
        SELECT amount, payment_date FROM payments
        UNION ALL
        SELECT amount, payment_date FROM payment_history
      )
      SELECT COALESCE(SUM(amount), 0) as revenue
      FROM all_payments
      WHERE TO_CHAR(payment_date, 'YYYY-MM') = $1
    `, [currentMonth])

    // Get unpaid bills with details
    const unpaidBillsResult = await pool.query(`
      SELECT 
        b.id,
        b.tenant_id,
        b.total_amount,
        b.rent_from,
        b.rent_to,
        b.status,
        t.name as tenant_name,
        r.room_number,
        br.name as branch_name
      FROM bills b
      JOIN tenants t ON b.tenant_id = t.id
      JOIN rooms r ON t.room_id = r.id
      JOIN branches br ON r.branch_id = br.id
      WHERE b.status = $1
      ORDER BY b.rent_from DESC
    `, ['unpaid'])

    const stats = {
      totalBranches: branchesResult.rows[0].count,
      totalRooms: roomsResult.rows[0].count,
      occupiedRooms: occupiedRoomsResult.rows[0].count,
      totalTenants: tenantsResult.rows[0].count,
      monthlyRevenue: parseFloat(revenueResult.rows[0].revenue) || 0,
      pendingBills: unpaidBillsResult.rows.length,
      unpaidBills: unpaidBillsResult.rows.map(bill => ({
        id: bill.id,
        tenant_name: bill.tenant_name,
        room_number: bill.room_number,
        branch_name: bill.branch_name,
        total_amount: bill.total_amount,
        rent_from: bill.rent_from,
        rent_to: bill.rent_to
      }))
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