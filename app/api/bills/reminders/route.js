import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'
import emailService from '../../../../services/emailService'
import Bill from '../../../../models/bill'

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

    console.log('🔔 Processing billing reminders...')

    // Get bills that need reminders (due within 3 days or overdue)
    const billsNeedingReminders = await Bill.getBillsNeedingReminders()
    
    if (billsNeedingReminders.length === 0) {
      console.log('✅ No bills need reminders today')
      return NextResponse.json({
        success: true,
        message: 'No bills need reminders today',
        bills_processed: 0,
        reminders_sent: 0
      })
    }

    console.log(`📋 Found ${billsNeedingReminders.length} bills needing reminders`)

    // Filter bills that haven't had a reminder sent today
    const today = new Date().toISOString().split('T')[0]
    const billsToRemind = []

    for (const bill of billsNeedingReminders) {
      // Check if reminder was already sent today for this bill
      const [existingReminder] = await pool.execute(`
        SELECT id FROM billing_reminders 
        WHERE bill_id = ? AND reminder_date = ?
      `, [bill.id, today])

      if (existingReminder.length === 0) {
        billsToRemind.push(bill)
      }
    }

    if (billsToRemind.length === 0) {
      console.log('✅ All reminders for today have already been sent')
      return NextResponse.json({
        success: true,
        message: 'All reminders for today have already been sent',
        bills_processed: billsNeedingReminders.length,
        reminders_sent: 0
      })
    }

    console.log(`📧 Sending reminder for ${billsToRemind.length} bills`)

    // Send email reminder to management
    const emailResult = await emailService.sendBillingReminderToManagement(billsToRemind)
    
    let remindersSent = 0
    let errors = []

    if (emailResult.success) {
      // Record reminders in database
      for (const bill of billsToRemind) {
        try {
          await pool.execute(`
            INSERT INTO billing_reminders 
            (bill_id, reminder_date, days_before_due, email_sent, email_sent_at) 
            VALUES (?, ?, ?, TRUE, NOW())
          `, [bill.id, today, bill.days_until_due])

          // Also log in email_notifications table
          await pool.execute(`
            INSERT INTO email_notifications 
            (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
            VALUES (?, 'billing_reminder', ?, 'official.jhapartment@gmail.com', 'sent', NOW())
          `, [bill.tenant_id, `Billing Reminder - ${bill.tenant_name} - Room ${bill.room_number}`])

          remindersSent++
        } catch (error) {
          console.error(`❌ Failed to record reminder for bill ${bill.id}:`, error)
          errors.push({
            bill_id: bill.id,
            tenant_name: bill.tenant_name,
            error: error.message
          })
        }
      }

      console.log(`✅ Successfully sent billing reminder email with ${remindersSent} bills`)
    } else {
      console.error('❌ Failed to send billing reminder email:', emailResult.error)
      
      // Record failed attempts
      for (const bill of billsToRemind) {
        try {
          await pool.execute(`
            INSERT INTO billing_reminders 
            (bill_id, reminder_date, days_before_due, email_sent, email_sent_at) 
            VALUES (?, ?, ?, FALSE, NULL)
          `, [bill.id, today, bill.days_until_due])

          await pool.execute(`
            INSERT INTO email_notifications 
            (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
            VALUES (?, 'billing_reminder', ?, 'official.jhapartment@gmail.com', 'failed', ?)
          `, [bill.tenant_id, `Billing Reminder - ${bill.tenant_name} - Room ${bill.room_number}`, emailResult.error])
        } catch (recordError) {
          console.error(`❌ Failed to record failed reminder for bill ${bill.id}:`, recordError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: emailResult.success ? 
        `Billing reminder sent successfully for ${remindersSent} bills` : 
        `Failed to send billing reminder: ${emailResult.error}`,
      bills_processed: billsNeedingReminders.length,
      bills_to_remind: billsToRemind.length,
      reminders_sent: remindersSent,
      email_result: emailResult,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('❌ Billing reminders error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check what bills need reminders (for testing/preview)
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

    // Get bills that need reminders
    const billsNeedingReminders = await Bill.getBillsNeedingReminders()
    
    // Check which ones haven't had reminders sent today
    const today = new Date().toISOString().split('T')[0]
    const billsWithReminderStatus = []

    for (const bill of billsNeedingReminders) {
      const [existingReminder] = await pool.execute(`
        SELECT id, email_sent, email_sent_at FROM billing_reminders 
        WHERE bill_id = ? AND reminder_date = ?
      `, [bill.id, today])

      billsWithReminderStatus.push({
        ...bill,
        reminder_sent_today: existingReminder.length > 0,
        reminder_details: existingReminder[0] || null
      })
    }

    return NextResponse.json({
      success: true,
      bills_needing_reminders: billsNeedingReminders.length,
      bills_without_reminders_today: billsWithReminderStatus.filter(b => !b.reminder_sent_today).length,
      bills: billsWithReminderStatus
    })

  } catch (error) {
    console.error('❌ Get billing reminders error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
} 