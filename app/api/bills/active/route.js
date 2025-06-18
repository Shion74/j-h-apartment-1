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

    // Get all active bills (unpaid or partial)
    const billsResult = await pool.query(`
      SELECT 
        b.*,
        t.name as tenant_name,
        r.room_number,
        br.name as branch_name
      FROM bills b
      JOIN tenants t ON b.tenant_id = t.id
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN branches br ON r.branch_id = br.id
      WHERE b.status IN ('unpaid', 'partial')
    const bills = billsResult.rows
      ORDER BY b.bill_date DESC
    `)

    return NextResponse.json({
      success: true,
      bills
    })

  } catch (error) {
    console.error('Active bills fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 