const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

class PDFReportService {
  constructor() {
    this.pageMargin = 60
    this.contentWidth = 510 // Page width minus margins
    this.primaryColor = '#2563eb'
    this.secondaryColor = '#64748b'
    this.successColor = '#16a34a'
    this.dangerColor = '#dc2626'
    this.lightGray = '#f8fafc'
    this.darkGray = '#334155'
  }

  async generateMonthlyReportPDF(reportData, filePath = null) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          margin: this.pageMargin,
          size: 'A4',
          info: {
            Title: 'J&H Apartment Monthly Report',
            Author: 'J&H Apartment Management System',
            Subject: `Monthly Report - ${reportData.report_period.month_name}`,
            Keywords: 'apartment, report, financial, monthly'
          }
        })

        // If no filePath provided, generate a temporary one
        if (!filePath) {
          const tempDir = path.join(process.cwd(), 'temp')
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
          }
          const monthName = reportData.report_period.month_name.replace(/\s+/g, '_')
          filePath = path.join(tempDir, `monthly_report_${monthName}_${Date.now()}.pdf`)
        }

        const stream = fs.createWriteStream(filePath)
        doc.pipe(stream)

        // Generate PDF content
        this.addHeader(doc, reportData)
        this.addExecutiveSummary(doc, reportData)
        this.addFinancialPerformance(doc, reportData)
        this.addOccupancyMetrics(doc, reportData)
        this.addBranchPerformance(doc, reportData)
        this.addTenantStatistics(doc, reportData)
        this.addPaymentAnalysis(doc, reportData)
        this.addTopPerformers(doc, reportData)
        this.addAlertsSection(doc, reportData)
        this.addFooter(doc, reportData)

        doc.end()

        stream.on('finish', () => {
          resolve(filePath)
        })

        stream.on('error', (error) => {
          reject(error)
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  addHeader(doc, reportData) {
    // Company Logo/Title
    doc.fontSize(28)
       .fillColor(this.primaryColor)
       .text('J&H APARTMENT', this.pageMargin, this.pageMargin, { align: 'center' })
       .fontSize(16)
       .fillColor(this.darkGray)
       .text('Monthly Business Report', { align: 'center' })
       .moveDown(0.5)

    // Report Period with background
    const periodY = doc.y
    doc.rect(this.pageMargin, periodY, this.contentWidth, 40)
       .fill(this.lightGray)
       .stroke('#e2e8f0')

    doc.fontSize(14)
       .fillColor(this.primaryColor)
       .text(reportData.report_period.month_name, this.pageMargin + 20, periodY + 8)
       .fontSize(10)
       .fillColor(this.secondaryColor)
       .text(`Generated on ${new Date(reportData.report_period.generated_at).toLocaleDateString()}`, 
             this.pageMargin + 20, periodY + 25)

    doc.y = periodY + 50
    this.addSeparator(doc)
  }

  addExecutiveSummary(doc, reportData) {
    this.addSectionTitle(doc, 'Executive Summary')

    const summary = reportData.financial_summary
    const occupancy = reportData.occupancy_metrics
    const tenants = reportData.tenant_statistics

    // Four metric cards in a 2x2 grid
    const cardWidth = (this.contentWidth - 20) / 2
    const cardHeight = 70
    const startY = doc.y

    // Top row
    this.addMetricCard(doc, this.pageMargin, doc.y, cardWidth, cardHeight,
      'P' + summary.total_revenue.toLocaleString(), 'Total Revenue',
      `${summary.revenue_growth >= 0 ? 'Up' : 'Down'} ${Math.abs(summary.revenue_growth)}%`,
      summary.revenue_growth >= 0 ? this.successColor : this.dangerColor)

    this.addMetricCard(doc, this.pageMargin + cardWidth + 20, startY, cardWidth, cardHeight,
      `${occupancy.occupancy_rate}%`, 'Occupancy Rate',
      `${occupancy.occupied_rooms}/${occupancy.total_rooms} rooms`)

    // Bottom row
    doc.y = startY + cardHeight + 15
    const bottomY = doc.y

    this.addMetricCard(doc, this.pageMargin, doc.y, cardWidth, cardHeight,
      tenants.active_tenants.toString(), 'Active Tenants',
      `Net: ${tenants.net_tenant_change >= 0 ? '+' : ''}${tenants.net_tenant_change}`)

    this.addMetricCard(doc, this.pageMargin + cardWidth + 20, bottomY, cardWidth, cardHeight,
      `${summary.collection_rate}%`, 'Collection Rate',
      `P${summary.total_billed.toLocaleString()} billed`)

    doc.y = bottomY + cardHeight + 20
  }

  addFinancialPerformance(doc, reportData) {
    this.addSectionTitle(doc, 'Financial Performance')

    const summary = reportData.financial_summary
    const outstanding = reportData.outstanding_summary

    // Financial metrics in clean rows
    const metrics = [
      ['Total Transactions:', summary.total_transactions.toString()],
      ['Total Billed:', `P${summary.total_billed.toLocaleString()}`],
      ['Total Revenue:', `P${summary.total_revenue.toLocaleString()}`],
      ['Outstanding Amount:', `P${outstanding.total_outstanding.toLocaleString()}`]
    ]

    const startY = doc.y
    metrics.forEach((metric, index) => {
      const rowY = startY + (index * 25)
      
      // Alternating row background
      if (index % 2 === 0) {
        doc.rect(this.pageMargin, rowY - 3, this.contentWidth, 20)
           .fill('#f8fafc')
      }

      doc.fillColor(this.darkGray)
         .fontSize(11)
         .text(metric[0], this.pageMargin + 10, rowY, { width: 200 })
         .fontSize(11)
         .fillColor(this.primaryColor)
         .text(metric[1], this.pageMargin + 220, rowY, { align: 'right', width: 200 })
    })

    doc.y = startY + (metrics.length * 25) + 15
  }

  addOccupancyMetrics(doc, reportData) {
    this.addSectionTitle(doc, 'Occupancy Overview')

    const occupancy = reportData.occupancy_metrics
    const cardWidth = this.contentWidth / 3 - 10
    const cardHeight = 60
    const startY = doc.y

    // Three occupancy cards
    this.addSmallMetricCard(doc, this.pageMargin, doc.y, cardWidth, cardHeight,
      occupancy.total_rooms.toString(), 'Total Rooms')

    this.addSmallMetricCard(doc, this.pageMargin + cardWidth + 15, startY, cardWidth, cardHeight,
      occupancy.occupied_rooms.toString(), 'Occupied Rooms')

    this.addSmallMetricCard(doc, this.pageMargin + 2 * (cardWidth + 15), startY, cardWidth, cardHeight,
      (occupancy.total_rooms - occupancy.occupied_rooms).toString(), 'Vacant Rooms')

    doc.y = startY + cardHeight + 20
  }

  addBranchPerformance(doc, reportData) {
    this.addSectionTitle(doc, 'Branch Performance')

    if (reportData.branch_performance.length === 0) {
      doc.fontSize(11)
         .fillColor(this.secondaryColor)
         .text('No branch data available.')
         .moveDown(1)
      return
    }

    // Table setup
    const tableY = doc.y
    const colWidths = [120, 80, 60, 120]
    const headers = ['Branch', 'Occupancy', 'Rate %', 'Revenue']
    
    this.addTableHeader(doc, tableY, colWidths, headers)

    let currentY = tableY + 30
    reportData.branch_performance.forEach((branch, index) => {
      this.addTableRow(doc, currentY, colWidths, [
        branch.branch_name,
        `${branch.occupied_rooms}/${branch.total_rooms}`,
        `${branch.occupancy_rate}%`,
        `P${branch.revenue.toLocaleString()}`
      ], index % 2 === 0)

      currentY += 25
    })

    doc.y = currentY + 15
  }

  addTenantStatistics(doc, reportData) {
    this.addSectionTitle(doc, 'Tenant Statistics')

    const stats = reportData.tenant_statistics
    const cardWidth = this.contentWidth / 3 - 10
    const cardHeight = 65
    const startY = doc.y

    this.addSmallMetricCard(doc, this.pageMargin, doc.y, cardWidth, cardHeight,
      stats.new_tenants.toString(), 'New Tenants', 'This Month')

    this.addSmallMetricCard(doc, this.pageMargin + cardWidth + 15, startY, cardWidth, cardHeight,
      stats.departed_tenants.toString(), 'Departed', 'This Month')

    this.addSmallMetricCard(doc, this.pageMargin + 2 * (cardWidth + 15), startY, cardWidth, cardHeight,
      stats.expiring_contracts.toString(), 'Expiring Soon', 'Next 30 Days')

    doc.y = startY + cardHeight + 20
  }

  addPaymentAnalysis(doc, reportData) {
    this.addSectionTitle(doc, 'Payment Methods')

    if (reportData.payment_analysis.by_method.length === 0) {
      doc.fontSize(11)
         .fillColor(this.secondaryColor)
         .text('No payment data available for this period.')
         .moveDown(1)
      return
    }

    const tableY = doc.y
    const colWidths = [120, 80, 120, 80]
    const headers = ['Method', 'Count', 'Amount', '%']
    
    this.addTableHeader(doc, tableY, colWidths, headers)

    let currentY = tableY + 30
    reportData.payment_analysis.by_method.forEach((method, index) => {
      this.addTableRow(doc, currentY, colWidths, [
        method.payment_method.toUpperCase(),
        method.transaction_count.toString(),
        `P${method.total_amount.toLocaleString()}`,
        `${method.percentage}%`
      ], index % 2 === 0)

      currentY += 25
    })

    doc.y = currentY + 15
  }

  addTopPerformers(doc, reportData) {
    if (reportData.top_performers.length === 0) return

    this.addSectionTitle(doc, 'Top Paying Tenants')

    const tableY = doc.y
    const colWidths = [200, 80, 120]
    const headers = ['Tenant Name', 'Room', 'Amount Paid']
    
    this.addTableHeader(doc, tableY, colWidths, headers)

    let currentY = tableY + 30
    reportData.top_performers.forEach((tenant, index) => {
      this.addTableRow(doc, currentY, colWidths, [
        tenant.tenant_name,
        tenant.room_number,
        `P${tenant.total_paid.toLocaleString()}`
      ], index % 2 === 0)

      currentY += 25
    })

    doc.y = currentY + 15
  }

  addAlertsSection(doc, reportData) {
    const outstanding = reportData.outstanding_summary
    const occupancy = reportData.occupancy_metrics
    const tenants = reportData.tenant_statistics

    const alerts = []

    if (outstanding.total_outstanding > 0) {
      alerts.push({
        title: 'Outstanding Payments',
        message: `P${outstanding.total_outstanding.toLocaleString()} in outstanding payments need attention.`,
        color: this.dangerColor
      })
    }

    if (tenants.expiring_contracts > 0) {
      alerts.push({
        title: 'Contract Renewals',
        message: `${tenants.expiring_contracts} contracts are expiring in the next 30 days.`,
        color: '#f59e0b'
      })
    }

    if (occupancy.occupancy_rate < 80) {
      alerts.push({
        title: 'Low Occupancy',
        message: `Occupancy rate is ${occupancy.occupancy_rate}%. Consider marketing strategies.`,
        color: '#f59e0b'
      })
    }

    if (alerts.length > 0) {
      this.addSectionTitle(doc, 'Alerts & Recommendations')

      alerts.forEach(alert => {
        this.addAlert(doc, alert.title, alert.message, alert.color)
      })
    } else {
      this.addSectionTitle(doc, 'Status')
      doc.fontSize(12)
         .fillColor(this.successColor)
         .text('No immediate alerts. All metrics are within normal ranges.')
         .moveDown(1)
    }
  }

  addFooter(doc, reportData) {
    const footerY = doc.page.height - 80

    doc.y = footerY
    this.addSeparator(doc)

    doc.fontSize(10)
       .fillColor(this.secondaryColor)
       .text('J&H Apartment Management System', { align: 'center' })
       .text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, { align: 'center' })
       .text('This report contains confidential business information.', { align: 'center' })
  }

  // Helper methods
  addSectionTitle(doc, title) {
    doc.moveDown(0.5)
       .fontSize(14)
       .fillColor(this.primaryColor)
       .text(title)
       .moveDown(0.3)
  }

  addSeparator(doc) {
    doc.strokeColor('#e2e8f0')
       .lineWidth(1)
       .moveTo(this.pageMargin, doc.y)
       .lineTo(doc.page.width - this.pageMargin, doc.y)
       .stroke()
       .moveDown(0.5)
  }

  addMetricCard(doc, x, y, width, height, value, label, subtitle = '', subtitleColor = this.secondaryColor) {
    // Card background
    doc.rect(x, y, width, height)
       .fill('#ffffff')
       .stroke('#e2e8f0')

    // Card content
    doc.fontSize(20)
       .fillColor(this.primaryColor)
       .text(value, x + 15, y + 10, { width: width - 30 })
       .fontSize(10)
       .fillColor(this.darkGray)
       .text(label, x + 15, y + 35, { width: width - 30 })

    if (subtitle) {
      doc.fontSize(9)
         .fillColor(subtitleColor)
         .text(subtitle, x + 15, y + 50, { width: width - 30 })
    }
  }

  addSmallMetricCard(doc, x, y, width, height, value, label, subtitle = '') {
    // Card background
    doc.rect(x, y, width, height)
       .fill('#ffffff')
       .stroke('#e2e8f0')

    // Card content
    doc.fontSize(16)
       .fillColor(this.primaryColor)
       .text(value, x + 10, y + 8, { width: width - 20, align: 'center' })
       .fontSize(9)
       .fillColor(this.darkGray)
       .text(label, x + 10, y + 30, { width: width - 20, align: 'center' })

    if (subtitle) {
      doc.fontSize(8)
         .fillColor(this.secondaryColor)
         .text(subtitle, x + 10, y + 45, { width: width - 20, align: 'center' })
    }
  }

  addTableHeader(doc, y, colWidths, headers) {
    doc.rect(this.pageMargin, y, this.contentWidth, 25)
       .fill(this.primaryColor)

    let currentX = this.pageMargin
    headers.forEach((header, index) => {
      doc.fontSize(10)
         .fillColor('#ffffff')
         .text(header, currentX + 8, y + 8, { width: colWidths[index] - 16 })
      currentX += colWidths[index]
    })
  }

  addTableRow(doc, y, colWidths, data, isEven = false) {
    if (isEven) {
      doc.rect(this.pageMargin, y, this.contentWidth, 20)
         .fill('#f8fafc')
    }

    let currentX = this.pageMargin
    data.forEach((item, index) => {
      doc.fontSize(9)
         .fillColor(this.darkGray)
         .text(item.toString(), currentX + 8, y + 5, { width: colWidths[index] - 16 })
      currentX += colWidths[index]
    })
  }

  addAlert(doc, title, message, color = '#f59e0b') {
    const alertY = doc.y
    const alertHeight = 35

    // Alert background
    doc.rect(this.pageMargin, alertY, this.contentWidth, alertHeight)
       .fill('#fef3c7')
       .stroke(color)

    // Alert content
    doc.fontSize(10)
       .fillColor('#92400e')
       .text(`${title}: ${message}`, this.pageMargin + 15, alertY + 8, {
         width: this.contentWidth - 30,
         height: alertHeight - 16
       })

    doc.y = alertY + alertHeight + 10
  }

  // Cleanup method to remove temporary files
  static cleanup(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (error) {
      console.error('Error cleaning up PDF file:', error)
    }
  }
}

module.exports = PDFReportService 