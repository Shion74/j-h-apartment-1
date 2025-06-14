import cron from 'node-cron'
import { pool } from './database.js'

class ReportScheduler {
  constructor() {
    this.isRunning = false
    this.scheduledTasks = new Map()
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('Report scheduler is already running')
      return
    }

    console.log('Starting monthly report scheduler...')
    
    // Schedule monthly reports to run on the 1st of each month at 9:00 AM
    const monthlyTask = cron.schedule('0 9 1 * *', async () => {
      console.log('Running scheduled monthly report generation...')
      await this.generateAndSendMonthlyReports()
    }, {
      scheduled: false,
      timezone: 'Asia/Manila'
    })

    this.scheduledTasks.set('monthly', monthlyTask)
    monthlyTask.start()

    this.isRunning = true
    console.log('Report scheduler started successfully')
    console.log('- Monthly reports: 1st of each month at 9:00 AM')
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      console.log('Report scheduler is not running')
      return
    }

    console.log('Stopping report scheduler...')
    
    this.scheduledTasks.forEach((task, name) => {
      task.stop()
      console.log(`Stopped ${name} task`)
    })

    this.scheduledTasks.clear()
    this.isRunning = false
    console.log('Report scheduler stopped')
  }

  // Generate and send monthly reports
  async generateAndSendMonthlyReports() {
    try {
      console.log('Generating monthly business reports...')
      
      // Get previous month
      const now = new Date()
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const monthString = lastMonth.toISOString().slice(0, 7) // YYYY-MM format

      // Get report recipients
      const recipients = await this.getReportRecipients()
      
      if (recipients.length === 0) {
        console.log('No report recipients configured, skipping email delivery')
        return
      }

      // Generate the report using the API endpoint logic
      const reportData = await this.generateMonthlyReport(monthString)
      
      if (!reportData) {
        console.error('Failed to generate monthly report')
        return
      }

      // Send emails to all recipients
      const emailService = (await import('../services/emailService.js')).default
      
      for (const recipient of recipients) {
        try {
          await emailService.sendMonthlyReport(recipient, reportData)
          console.log(`Monthly report sent to: ${recipient}`)
        } catch (error) {
          console.error(`Failed to send report to ${recipient}:`, error.message)
        }
      }

      console.log(`Monthly report for ${monthString} generated and sent to ${recipients.length} recipients`)

    } catch (error) {
      console.error('Error in automated monthly report generation:', error)
    }
  }

  // Generate monthly report data (simplified version of the API)
  async generateMonthlyReport(month) {
    try {
      const year = month.split('-')[0]
      const monthNum = month.split('-')[1]
      const monthStart = `${month}-01`
      const monthEnd = new Date(year, monthNum, 0).toISOString().slice(0, 10)

      // Use the same queries as the API endpoint
      const [financialData] = await pool.execute(`
        SELECT 
          COALESCE(SUM(CASE WHEN p.payment_date BETWEEN ? AND ? THEN p.amount END), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN b.bill_date BETWEEN ? AND ? THEN b.total_amount END), 0) as total_billed,
          COUNT(DISTINCT CASE WHEN p.payment_date BETWEEN ? AND ? THEN p.id END) as total_transactions,
          COUNT(DISTINCT CASE WHEN b.bill_date BETWEEN ? AND ? THEN b.id END) as bills_generated
        FROM bills b
        LEFT JOIN payments p ON b.id = p.bill_id
      `, [monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd])

      const [tenantStats] = await pool.execute(`
        SELECT 
          COUNT(CASE WHEN t.rent_start BETWEEN ? AND ? THEN 1 END) as new_tenants,
          COUNT(CASE WHEN t.contract_status = 'active' THEN 1 END) as active_tenants
        FROM tenants t
      `, [monthStart, monthEnd])

      const [roomStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_rooms,
          COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
          ROUND((COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) / COUNT(*)) * 100, 2) as occupancy_rate
        FROM rooms r
      `)

      const [branchPerformance] = await pool.execute(`
        SELECT 
          br.name as branch_name,
          COUNT(r.id) as total_rooms,
          COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
          COALESCE(SUM(CASE WHEN p.payment_date BETWEEN ? AND ? THEN p.amount END), 0) as branch_revenue
        FROM branches br
        LEFT JOIN rooms r ON br.id = r.branch_id
        LEFT JOIN tenants t ON r.id = t.room_id
        LEFT JOIN bills b ON t.id = b.tenant_id
        LEFT JOIN payments p ON b.id = p.bill_id
        GROUP BY br.id, br.name
        ORDER BY branch_revenue DESC
      `, [monthStart, monthEnd])

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

      const [topMetrics] = await pool.execute(`
        SELECT 
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
          total_transactions: financialData[0].total_transactions,
          bills_generated: financialData[0].bills_generated,
          revenue_growth: 0 // Simplified for scheduler
        },
        tenant_statistics: {
          new_tenants: tenantStats[0].new_tenants,
          departed_tenants: 0,
          active_tenants: tenantStats[0].active_tenants,
          expiring_contracts: 0,
          net_tenant_change: tenantStats[0].new_tenants
        },
        occupancy_metrics: {
          total_rooms: roomStats[0].total_rooms,
          occupied_rooms: roomStats[0].occupied_rooms,
          vacant_rooms: roomStats[0].total_rooms - roomStats[0].occupied_rooms,
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
          new_tenants: 0
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

      return monthlyReport

    } catch (error) {
      console.error('Error generating monthly report:', error)
      return null
    }
  }

  // Get report recipients
  async getReportRecipients() {
    try {
      // Default recipients - you can modify this or add database settings
      return ['official.jhapartment@gmail.com']
    } catch (error) {
      console.error('Error getting report recipients:', error)
      return ['official.jhapartment@gmail.com']
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.scheduledTasks.keys()),
      nextRun: this.isRunning ? 'Next: 1st of next month at 9:00 AM' : 'Not scheduled'
    }
  }
}

// Create singleton instance
const reportScheduler = new ReportScheduler()

export default reportScheduler
