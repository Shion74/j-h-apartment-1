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

    // Get current month
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    // Calculate statistics
    const [monthlyStats] = await pool.execute(`
      SELECT 
        COALESCE(SUM(amount), 0) as monthly_collected,
        COUNT(*) as monthly_payments
      FROM payments 
      WHERE DATE_FORMAT(payment_date, '%Y-%m') = ?
    `, [currentMonth])

    const [totalStats] = await pool.execute(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_collected,
        COUNT(*) as total_payments
      FROM payments
    `)

    const [averageStats] = await pool.execute(`
      SELECT 
        COALESCE(AVG(amount), 0) as average_payment
      FROM payments
    `)

    return NextResponse.json({
      success: true,
      stats: {
        monthly_collected: parseFloat(monthlyStats[0].monthly_collected),
        monthly_payments: monthlyStats[0].monthly_payments,
        total_collected: parseFloat(totalStats[0].total_collected),
        total_payments: totalStats[0].total_payments,
        average_payment: parseFloat(averageStats[0].average_payment)
      }
    })

  } catch (error) {
    console.error('Payment stats error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 