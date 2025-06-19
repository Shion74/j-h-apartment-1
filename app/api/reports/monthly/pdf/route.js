import { NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth'

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
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    // Generate the report data first by calling the main reports API
    const baseUrl = new URL(request.url)
    baseUrl.pathname = baseUrl.pathname.replace('/pdf', '')
    baseUrl.search = `month=${month}`
    
    const reportResponse = await fetch(baseUrl.toString(), {
      headers: {
        'Authorization': request.headers.get('Authorization')
      }
    })
    
    const reportData = await reportResponse.json()

    if (!reportData.success) {
      return NextResponse.json(
        { success: false, message: 'Failed to generate report data' },
        { status: 500 }
      )
    }

    // Generate PDF
    const PDFReportService = require('../../../../../services/pdfReportService')
    const pdfService = new PDFReportService()
    const pdfPath = await pdfService.generateMonthlyReportPDF(reportData.report)

    // Read the PDF file
    const fs = require('fs')
    const pdfBuffer = fs.readFileSync(pdfPath)

    // Clean up temporary file
    PDFReportService.cleanup(pdfPath)

    // Generate filename
    const monthName = reportData.report.report_period.month_name.replace(/\s+/g, '_')
    const filename = `J&H_Monthly_Report_${monthName}.pdf`

    // Return PDF as download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to generate PDF report' },
      { status: 500 }
    )
  }
} 