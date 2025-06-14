import { NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth'
import emailService from '../../../../services/emailService.js'

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

    const { email_type = 'test', recipient_email } = await request.json()

    // Validate email
    if (!recipient_email || !recipient_email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Valid recipient email is required' },
        { status: 400 }
      )
    }

    let result = {}

    try {
      switch (email_type) {
        case 'test':
          await emailService.sendTestEmail(recipient_email)
          result = {
            type: 'Test Email',
            message: 'Test email sent successfully'
          }
          break

        case 'welcome':
          const mockTenant = {
            id: 999,
            name: 'Test User',
            email: recipient_email,
            room_number: 'Test Room',
            room_type: 'Standard',
            monthly_rent: 5000,
            branch_name: 'Main Branch',
            contract_start_date: new Date().toISOString().split('T')[0],
            contract_end_date: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
          await emailService.sendWelcomeEmail(mockTenant)
          result = {
            type: 'Welcome Email',
            message: 'Test welcome email sent successfully'
          }
          break

        case 'bill_notification':
          const mockBill = {
            id: 999,
            tenant_id: 999,
            tenant_name: 'Test User',
            tenant_email: recipient_email,
            room_number: 'Test Room',
            billing_month: new Date().toISOString().slice(0, 7),
            total_amount: 6500,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'pending'
          }
          await emailService.sendBillNotification(mockBill)
          result = {
            type: 'Bill Notification',
            message: 'Test bill notification sent successfully'
          }
          break

        case 'contract_expiry':
          const mockExpiringTenant = {
            id: 999,
            name: 'Test User',
            email: recipient_email,
            room_number: 'Test Room',
            contract_end_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
          await emailService.sendContractExpiryNotification(mockExpiringTenant, 15)
          result = {
            type: 'Contract Expiry Notification',
            message: 'Test contract expiry notification sent successfully'
          }
          break

        default:
          return NextResponse.json(
            { success: false, message: 'Invalid email type. Use: test, welcome, bill_notification, or contract_expiry' },
            { status: 400 }
          )
      }

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        details: {
          email_type,
          recipient: recipient_email,
          sent_at: new Date().toISOString(),
          ...result
        }
      })

    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to send test email',
          error: emailError.message,
          details: {
            email_type,
            recipient: recipient_email,
            attempted_at: new Date().toISOString()
          }
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Email test error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
}

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

    // Return available email test types
    return NextResponse.json({
      success: true,
      message: 'Email test endpoints available',
      available_types: [
        {
          type: 'test',
          description: 'Basic test email to verify SMTP configuration'
        },
        {
          type: 'welcome',
          description: 'Welcome email template for new tenants'
        },
        {
          type: 'bill_notification',
          description: 'Monthly bill notification template'
        },
        {
          type: 'contract_expiry',
          description: 'Contract expiry warning template'
        }
      ],
      usage: {
        method: 'POST',
        body: {
          email_type: 'test|welcome|bill_notification|contract_expiry',
          recipient_email: 'test@example.com'
        }
      }
    })

  } catch (error) {
    console.error('Email test info error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 