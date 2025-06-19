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

    // Calculate statistics (including archived payments, using actual payment dates)
    const monthlyStatsResult = await pool.query(`
      WITH all_payments AS (
        SELECT amount, COALESCE(actual_payment_date, payment_date) as payment_date FROM payments
        UNION ALL
        SELECT amount, COALESCE(actual_payment_date, payment_date) as payment_date FROM payment_history
      )
      SELECT 
        COALESCE(SUM(amount), 0) as monthly_collected,
        COUNT(*) as monthly_payments
      FROM all_payments
      WHERE TO_CHAR(payment_date, 'YYYY-MM') = $1
    `, [currentMonth])

    const totalStatsResult = await pool.query(`
      WITH all_payments AS (
        SELECT amount FROM payments
        UNION ALL
        SELECT amount FROM payment_history
      )
      SELECT 
        COALESCE(SUM(amount), 0) as total_collected,
        COUNT(*) as total_payments
      FROM all_payments
    `)

    const averageStatsResult = await pool.query(`
      WITH all_payments AS (
        SELECT amount FROM payments
        UNION ALL
        SELECT amount FROM payment_history
      )
      SELECT 
        COALESCE(AVG(amount), 0) as average_payment
      FROM all_payments
    `)

    return NextResponse.json({
      success: true,
      stats: {
        monthly_collected: parseFloat(monthlyStatsResult.rows[0].monthly_collected),
        monthly_payments: monthlyStatsResult.rows[0].monthly_payments,
        total_collected: parseFloat(totalStatsResult.rows[0].total_collected),
        total_payments: totalStatsResult.rows[0].total_payments,
        average_payment: parseFloat(averageStatsResult.rows[0].average_payment)
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