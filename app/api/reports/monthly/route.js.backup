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
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7) // YYYY-MM format
    const year = month.split('-')[0]
    const monthNum = month.split('-')[1]

    // Get month start and end dates
    const monthStart = `${month}-01`
    const monthEnd = new Date(year, monthNum, 0).toISOString().slice(0, 10)

    // 1. Financial Summary
    const [financialData] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN p.payment_date BETWEEN ? AND ? THEN p.amount END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN b.bill_date BETWEEN ? AND ? THEN b.total_amount END), 0) as total_billed,
        COALESCE(SUM(CASE WHEN b.bill_date BETWEEN ? AND ? AND b.status = 'unpaid' THEN b.total_amount END), 0) as unpaid_amount,
        COALESCE(SUM(CASE WHEN b.bill_date BETWEEN ? AND ? AND b.status = 'partial' THEN b.total_amount - COALESCE(paid_amounts.total_paid, 0) END), 0) as partial_amount,
        COUNT(DISTINCT CASE WHEN p.payment_date BETWEEN ? AND ? THEN p.id END) as total_transactions,
        COUNT(DISTINCT CASE WHEN b.bill_date BETWEEN ? AND ? THEN b.id END) as bills_generated
      FROM bills b
      LEFT JOIN payments p ON b.id = p.bill_id
      LEFT JOIN (
        SELECT bill_id, SUM(amount) as total_paid
        FROM payments
        GROUP BY bill_id
      ) paid_amounts ON b.id = paid_amounts.bill_id
    `, [monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd])

    // 2. Tenant Statistics
    const [tenantStats] = await pool.execute(`
      SELECT 
        COUNT(CASE WHEN t.rent_start BETWEEN ? AND ? THEN 1 END) as new_tenants,
        COUNT(CASE WHEN th.deleted_at BETWEEN ? AND ? THEN 1 END) as departed_tenants,
        COUNT(CASE WHEN t.contract_status = 'active' THEN 1 END) as active_tenants,
        COUNT(CASE WHEN t.contract_end_date BETWEEN ? AND DATE_ADD(?, INTERVAL 30 DAY) THEN 1 END) as expiring_contracts
      FROM tenants t
      LEFT JOIN tenant_history th ON th.original_tenant_id = t.id
    `, [monthStart, monthEnd, monthStart, monthEnd, monthEnd, monthEnd])

    // 3. Room Occupancy
    const [roomStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_rooms,
        COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
        COUNT(CASE WHEN r.status = 'vacant' THEN 1 END) as vacant_rooms,
        ROUND((COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) / COUNT(*)) * 100, 2) as occupancy_rate
      FROM rooms r
    `)

    // 4. Branch Performance
    const [branchPerformance] = await pool.execute(`
      SELECT 
        br.name as branch_name,
        COUNT(r.id) as total_rooms,
        COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
        COALESCE(SUM(CASE WHEN p.payment_date BETWEEN ? AND ? THEN p.amount END), 0) as branch_revenue,
        COUNT(DISTINCT CASE WHEN t.rent_start BETWEEN ? AND ? THEN t.id END) as new_tenants_count
      FROM branches br
      LEFT JOIN rooms r ON br.id = r.branch_id
      LEFT JOIN tenants t ON r.id = t.room_id
      LEFT JOIN bills b ON t.id = b.tenant_id
      LEFT JOIN payments p ON b.id = p.bill_id
      GROUP BY br.id, br.name
      ORDER BY branch_revenue DESC
    `, [monthStart, monthEnd, monthStart, monthEnd])

    // 5. Payment Method Analysis
    const [paymentMethods] = await pool.execute(`
      SELECT 
        p.payment_method,
        COUNT(*) as transaction_count,
        SUM(p.amount) as total_amount
      FROM payments p
      WHERE p.payment_date BETWEEN ? AND ?
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `, [monthStart, monthEnd])

    // 6. Top Performing Metrics
    const [topMetrics] = await pool.execute(`
      SELECT 
        'highest_paying_tenant' as metric_type,
        t.name as tenant_name,
        r.room_number,
        SUM(p.amount) as total_paid
      FROM payments p
      JOIN bills b ON p.bill_id = b.id
      JOIN tenants t ON b.tenant_id = t.id
      JOIN rooms r ON t.room_id = r.id
      WHERE p.payment_date BETWEEN ? AND ?
      GROUP BY t.id, t.name, r.room_number
      ORDER BY total_paid DESC
      LIMIT 5
    `, [monthStart, monthEnd])

    // 7. Outstanding Bills Summary
    const [outstandingBills] = await pool.execute(`
      SELECT 
        COUNT(CASE WHEN b.status = 'unpaid' THEN 1 END) as unpaid_bills_count,
        COUNT(CASE WHEN b.status = 'partial' THEN 1 END) as partial_bills_count,
        COALESCE(SUM(CASE WHEN b.status = 'unpaid' THEN b.total_amount END), 0) as unpaid_total,
        COALESCE(SUM(CASE WHEN b.status = 'partial' THEN b.total_amount - COALESCE(paid_amounts.total_paid, 0) END), 0) as partial_remaining
      FROM bills b
      LEFT JOIN (
        SELECT bill_id, SUM(amount) as total_paid
        FROM payments
        GROUP BY bill_id
      ) paid_amounts ON b.id = paid_amounts.bill_id
      WHERE b.status IN ('unpaid', 'partial')
    `)

    // 8. Monthly Trends (compare with previous month)
    const prevMonth = new Date(year, monthNum - 2, 1).toISOString().slice(0, 7)
    const prevMonthStart = `${prevMonth}-01`
    const prevMonthEnd = new Date(year, monthNum - 1, 0).toISOString().slice(0, 10)

    const [previousMonthData] = await pool.execute(`
      SELECT 
        COALESCE(SUM(p.amount), 0) as prev_revenue,
        COUNT(DISTINCT p.id) as prev_transactions
      FROM payments p
      WHERE p.payment_date BETWEEN ? AND ?
    `, [prevMonthStart, prevMonthEnd])

    // Calculate growth rates
    const currentRevenue = financialData[0].total_revenue
    const previousRevenue = previousMonthData[0].prev_revenue
    const revenueGrowth = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue * 100).toFixed(2)
      : 0

    // Compile the report
    const monthlyReport = {
      report_period: {
        month: month,
        month_name: new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        start_date: monthStart,
        end_date: monthEnd,
        generated_at: new Date().toISOString()
      },
      financial_summary: {
        total_revenue: parseFloat(financialData[0].total_revenue),
        total_billed: parseFloat(financialData[0].total_billed),
        collection_rate: financialData[0].total_billed > 0 
          ? ((financialData[0].total_revenue / financialData[0].total_billed) * 100).toFixed(2)
          : 0,
        unpaid_amount: parseFloat(financialData[0].unpaid_amount),
        partial_amount: parseFloat(financialData[0].partial_amount),
        total_transactions: financialData[0].total_transactions,
        bills_generated: financialData[0].bills_generated,
        revenue_growth: parseFloat(revenueGrowth)
      },
      tenant_statistics: {
        new_tenants: tenantStats[0].new_tenants,
        departed_tenants: tenantStats[0].departed_tenants,
        active_tenants: tenantStats[0].active_tenants,
        expiring_contracts: tenantStats[0].expiring_contracts,
        net_tenant_change: tenantStats[0].new_tenants - tenantStats[0].departed_tenants
      },
      occupancy_metrics: {
        total_rooms: roomStats[0].total_rooms,
        occupied_rooms: roomStats[0].occupied_rooms,
        vacant_rooms: roomStats[0].vacant_rooms,
        occupancy_rate: parseFloat(roomStats[0].occupancy_rate)
      },
      branch_performance: branchPerformance.map(branch => ({
        branch_name: branch.branch_name,
        total_rooms: branch.total_rooms,
        occupied_rooms: branch.occupied_rooms,
        occupancy_rate: branch.total_rooms > 0 
          ? ((branch.occupied_rooms / branch.total_rooms) * 100).toFixed(2)
          : 0,
        revenue: parseFloat(branch.branch_revenue),
        new_tenants: branch.new_tenants_count
      })),
      payment_analysis: {
        by_method: paymentMethods.map(method => ({
          payment_method: method.payment_method,
          transaction_count: method.transaction_count,
          total_amount: parseFloat(method.total_amount),
          percentage: financialData[0].total_revenue > 0 
            ? ((method.total_amount / financialData[0].total_revenue) * 100).toFixed(2)
            : 0
        }))
      },
      top_performers: topMetrics.map(metric => ({
        tenant_name: metric.tenant_name,
        room_number: metric.room_number,
        total_paid: parseFloat(metric.total_paid)
      })),
      outstanding_summary: {
        unpaid_bills_count: outstandingBills[0].unpaid_bills_count,
        partial_bills_count: outstandingBills[0].partial_bills_count,
        total_outstanding: parseFloat(outstandingBills[0].unpaid_total) + parseFloat(outstandingBills[0].partial_remaining)
      }
    }

    return NextResponse.json({
      success: true,
      report: monthlyReport
    })

  } catch (error) {
    console.error('Monthly report generation error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { month, email_recipients } = await request.json()
    const reportMonth = month || new Date().toISOString().slice(0, 7)

    // Generate the report
    const reportResponse = await fetch(`${request.url}?month=${reportMonth}`, {
      headers: {
        'Authorization': request.headers.get('Authorization')
      }
    })
    const reportData = await reportResponse.json()

    if (!reportData.success) {
      return NextResponse.json(
        { success: false, message: 'Failed to generate report' },
        { status: 500 }
      )
    }

    // Send email report if recipients provided
    if (email_recipients && email_recipients.length > 0) {
      try {
        const emailService = (await import('../../../../services/emailService.js')).default
        
        for (const email of email_recipients) {
          await emailService.sendMonthlyReport(email, reportData.report)
        }

        return NextResponse.json({
          success: true,
          message: 'Monthly report generated and sent successfully',
          report: reportData.report,
          email_sent: true,
          recipients: email_recipients
        })
      } catch (emailError) {
        console.error('Email sending error:', emailError)
        return NextResponse.json({
          success: true,
          message: 'Report generated but email sending failed',
          report: reportData.report,
          email_sent: false,
          email_error: emailError.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Monthly report generated successfully',
      report: reportData.report,
      email_sent: false
    })

  } catch (error) {
    console.error('Monthly report POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 