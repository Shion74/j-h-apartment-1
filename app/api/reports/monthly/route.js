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
    const year = parseInt(month.split('-')[0])
    const monthNum = parseInt(month.split('-')[1])

    // Get month start and end dates for calendar reference
    const calendarMonthStart = `${month}-01`
    const calendarMonthEnd = new Date(year, monthNum, 0).toISOString().slice(0, 10)

    // For billing cycle approach: 
    // - Revenue: Based on payments made during the calendar month
    // - Billing: Based on billing cycles that END during the calendar month (rent_to within month)
    // - This aligns with when tenants are expected to pay and when revenue is actually collected
    
    console.log(`📊 Generating billing cycle report for ${month}`)
    console.log(`📅 Calendar boundaries: ${calendarMonthStart} to ${calendarMonthEnd}`)
    console.log(`🏠 Looking for billing cycles ending in this month and payments made in this month`)

    // 1. Financial Summary - Billing Cycle Based
    // Revenue: Payments made during the calendar month
    // Billing: Bills for cycles ending during the calendar month (rent_to within month)
    const financialDataResult = await pool.query(`
      WITH all_payments AS (
        SELECT bill_id, payment_date, amount, id FROM payments
        UNION ALL
        SELECT original_bill_id as bill_id, payment_date, amount, original_payment_id as id FROM payment_history
      ),
      all_bills AS (
        SELECT id, bill_date, total_amount, status, rent_from, rent_to FROM bills
        UNION ALL
        SELECT original_bill_id as id, bill_date, total_amount, status, rent_from, rent_to FROM bill_history
      ),
      billing_cycles_ending_this_month AS (
        -- Bills for billing cycles that END in this calendar month
        SELECT * FROM all_bills 
        WHERE rent_to BETWEEN $1 AND $2
      ),
      payments_made_this_month AS (
        -- Payments actually made during this calendar month
        SELECT * FROM all_payments 
        WHERE payment_date BETWEEN $3 AND $4
      )
      SELECT 
        -- Revenue: Actual payments received this month
        COALESCE(SUM(pmtm.amount), 0) as total_revenue,
        -- Billing: Bills for cycles ending this month (what tenants should pay)
        COALESCE(SUM(bcem.total_amount), 0) as total_billed,
        -- Unpaid: From current unpaid bills where cycle ended this month
        COALESCE(SUM(CASE WHEN bcem.status = 'unpaid' THEN bcem.total_amount END), 0) as unpaid_amount,
        -- Partial: From current partial bills where cycle ended this month
        COALESCE(SUM(CASE WHEN bcem.status = 'partial' THEN bcem.total_amount - COALESCE(paid_amounts.total_paid, 0) END), 0) as partial_amount,
        -- Transactions: Payment count this month
        COUNT(DISTINCT pmtm.id) as total_transactions,
        -- Bills: Billing cycles ending this month
        COUNT(DISTINCT bcem.id) as bills_generated,
        -- Cycle info for debugging
        COUNT(DISTINCT bcem.id) as cycles_ending_this_month,
        COUNT(DISTINCT pmtm.id) as payments_this_month
      FROM billing_cycles_ending_this_month bcem
      FULL OUTER JOIN payments_made_this_month pmtm ON bcem.id = pmtm.bill_id
      LEFT JOIN bills b ON bcem.id = b.id
      LEFT JOIN (
        SELECT bill_id, SUM(amount) as total_paid
        FROM payments
        GROUP BY bill_id
      ) paid_amounts ON b.id = paid_amounts.bill_id
    `, [calendarMonthStart, calendarMonthEnd, calendarMonthStart, calendarMonthEnd])

    // 2. Tenant Statistics
    const tenantStatsResult = await pool.query(`
      SELECT 
        COUNT(CASE WHEN t.rent_start BETWEEN $1 AND $2 THEN 1 END) as new_tenants,
        COUNT(CASE WHEN th.deleted_at BETWEEN $3 AND $4 THEN 1 END) as departed_tenants,
        COUNT(CASE WHEN t.contract_status = 'active' THEN 1 END) as active_tenants,
        COUNT(CASE WHEN t.contract_end_date BETWEEN $5 AND ($6::date + INTERVAL '30 days') THEN 1 END) as expiring_contracts
      FROM tenants t
      LEFT JOIN tenant_history th ON th.original_tenant_id = t.id
    `, [calendarMonthStart, calendarMonthEnd, calendarMonthStart, calendarMonthEnd, calendarMonthEnd, calendarMonthEnd])

    // 3. Room Occupancy
    const roomStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_rooms,
        COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
        COUNT(CASE WHEN r.status = 'vacant' THEN 1 END) as vacant_rooms,
        ROUND((COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) / COUNT(*)) * 100, 2) as occupancy_rate
      FROM rooms r
    `)

    // 4. Branch Performance - Based on payments made this month
    const branchPerformanceResult = await pool.query(`
      WITH all_payments AS (
        SELECT bill_id, payment_date, amount FROM payments
        UNION ALL
        SELECT original_bill_id as bill_id, payment_date, amount FROM payment_history
      )
      SELECT 
        br.name as branch_name,
        COUNT(r.id) as total_rooms,
        COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
        COALESCE(SUM(CASE WHEN ap.payment_date BETWEEN $1 AND $2 THEN ap.amount END), 0) as branch_revenue,
        COUNT(DISTINCT CASE WHEN t.rent_start BETWEEN $3 AND $4 THEN t.id END) as new_tenants_count
      FROM branches br
      LEFT JOIN rooms r ON br.id = r.branch_id
      LEFT JOIN tenants t ON r.id = t.room_id
      LEFT JOIN bills b ON t.id = b.tenant_id
      LEFT JOIN all_payments ap ON b.id = ap.bill_id
      GROUP BY br.id, br.name
      ORDER BY branch_revenue DESC
    `, [calendarMonthStart, calendarMonthEnd, calendarMonthStart, calendarMonthEnd])

    // 5. Payment Method Analysis - Payments made this month
    const paymentMethodsResult = await pool.query(`
      WITH all_payments AS (
        SELECT payment_method::text as payment_method, payment_date, amount FROM payments
        UNION ALL
        SELECT payment_method::text as payment_method, payment_date, amount FROM payment_history
      )
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM all_payments
      WHERE payment_date BETWEEN $1 AND $2
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `, [calendarMonthStart, calendarMonthEnd])

    // 6. Top Performing Metrics - Based on payments made this month
    const topMetricsResult = await pool.query(`
      WITH all_payments AS (
        SELECT bill_id, payment_date, amount FROM payments
        UNION ALL
        SELECT original_bill_id as bill_id, payment_date, amount FROM payment_history
      ),
      all_bills AS (
        SELECT id, tenant_id FROM bills
        UNION ALL
        SELECT original_bill_id as id, original_tenant_id as tenant_id FROM bill_history
      )
      SELECT 
        'highest_paying_tenant' as metric_type,
        COALESCE(t.name, bh.tenant_name) as tenant_name,
        COALESCE(r.room_number, bh.room_number) as room_number,
        SUM(ap.amount) as total_paid
      FROM all_payments ap
      JOIN all_bills ab ON ap.bill_id = ab.id
      LEFT JOIN tenants t ON ab.tenant_id = t.id
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN bill_history bh ON ab.id = bh.original_bill_id
      WHERE ap.payment_date BETWEEN $1 AND $2
      GROUP BY COALESCE(t.id, bh.original_tenant_id), COALESCE(t.name, bh.tenant_name), COALESCE(r.room_number, bh.room_number)
      ORDER BY total_paid DESC
      LIMIT 5
    `, [calendarMonthStart, calendarMonthEnd])

    // 7. Outstanding Bills Summary
    const outstandingBillsResult = await pool.query(`
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

    // 8. Monthly Trends (compare with previous month) - Based on payment dates
    const prevMonth = new Date(year, monthNum - 2, 1).toISOString().slice(0, 7)
    const prevMonthStart = `${prevMonth}-01`
    const prevMonthEnd = new Date(year, monthNum - 1, 0).toISOString().slice(0, 10)

    const previousMonthDataResult = await pool.query(`
      WITH all_payments AS (
        SELECT amount, payment_date, id FROM payments
        UNION ALL
        SELECT amount, payment_date, original_payment_id as id FROM payment_history
      )
      SELECT 
        COALESCE(SUM(amount), 0) as prev_revenue,
        COUNT(DISTINCT id) as prev_transactions
      FROM all_payments
      WHERE payment_date BETWEEN $1 AND $2
    `, [prevMonthStart, prevMonthEnd])

    // Extract results
    const financialData = financialDataResult.rows
    const tenantStats = tenantStatsResult.rows
    const roomStats = roomStatsResult.rows
    const branchPerformance = branchPerformanceResult.rows
    const paymentMethods = paymentMethodsResult.rows
    const topMetrics = topMetricsResult.rows
    const outstandingBills = outstandingBillsResult.rows
    const previousMonthData = previousMonthDataResult.rows

    // Check if this month has any data
    const hasData = financialData[0].total_revenue > 0 || financialData[0].total_billed > 0 || financialData[0].total_transactions > 0

        // If no data exists, get available months for suggestions based on billing cycles
    let availableMonths = []
    if (!hasData) {
      console.log(`📊 No billing cycles ending in ${month}. Checking available months...`)
      const availableMonthsResult = await pool.query(`
        WITH all_bills AS (
          SELECT rent_to FROM bills
          UNION ALL
          SELECT rent_to FROM bill_history
        ),
        all_payments AS (
          SELECT payment_date FROM payments
          UNION ALL
          SELECT payment_date FROM payment_history
        ),
        billing_months AS (
          SELECT DISTINCT TO_CHAR(rent_to, 'YYYY-MM') as month
          FROM all_bills
          WHERE rent_to IS NOT NULL
        ),
        payment_months AS (
          SELECT DISTINCT TO_CHAR(payment_date, 'YYYY-MM') as month
          FROM all_payments
          WHERE payment_date IS NOT NULL
        )
        SELECT month FROM billing_months
        UNION
        SELECT month FROM payment_months
        ORDER BY month DESC
        LIMIT 12
      `)
      availableMonths = availableMonthsResult.rows.map(row => row.month)
      console.log(`📅 Available months with billing cycles or payments: ${availableMonths.join(', ')}`)
    }

    // Calculate growth rates
    const currentRevenue = financialData[0].total_revenue
    const previousRevenue = previousMonthData[0].prev_revenue
    const revenueGrowth = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue * 100).toFixed(2)
      : 0

    // Debug information
    console.log(`💰 Financial Summary for ${month}:`)
    console.log(`   Revenue (payments made): ₱${currentRevenue}`)
    console.log(`   Billed (cycles ending): ₱${financialData[0].total_billed}`)
    console.log(`   Cycles ending this month: ${financialData[0].cycles_ending_this_month || 0}`)
    console.log(`   Payments this month: ${financialData[0].payments_this_month || 0}`)
    console.log(`   Transactions: ${financialData[0].total_transactions}`)
    console.log(`   Bills generated: ${financialData[0].bills_generated}`)

    // Compile the report
    const monthlyReport = {
      report_period: {
        month: month,
        month_name: new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        start_date: calendarMonthStart,
        end_date: calendarMonthEnd,
        generated_at: new Date().toISOString(),
        has_data: hasData,
        available_months: hasData ? [] : availableMonths,
        report_type: 'billing_cycle_based',
        description: 'Revenue based on payments made during the month. Billing based on tenant cycles ending during the month.'
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