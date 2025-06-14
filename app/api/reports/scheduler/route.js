import { NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth'
import reportScheduler from '../../../../lib/report-scheduler.js'

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

    // Get scheduler status
    const status = reportScheduler.getStatus()

    return NextResponse.json({
      success: true,
      scheduler: status
    })

  } catch (error) {
    console.error('Scheduler status error:', error)
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

    const { action } = await request.json()

    switch (action) {
      case 'start':
        reportScheduler.start()
        return NextResponse.json({
          success: true,
          message: 'Report scheduler started',
          scheduler: reportScheduler.getStatus()
        })

      case 'stop':
        reportScheduler.stop()
        return NextResponse.json({
          success: true,
          message: 'Report scheduler stopped',
          scheduler: reportScheduler.getStatus()
        })

      case 'test':
        // Manually trigger report generation for testing
        await reportScheduler.generateAndSendMonthlyReports()
        return NextResponse.json({
          success: true,
          message: 'Test report generation triggered',
          scheduler: reportScheduler.getStatus()
        })

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Scheduler control error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
