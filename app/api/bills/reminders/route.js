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

    // Get tenants that need bill creation reminders
    const tenantsNeedingReminders = await Bill.getBillsNeedingReminders()
    
    if (tenantsNeedingReminders.length === 0) {
      console.log('✅ No tenants need bill creation reminders today')
      return NextResponse.json({
        success: true,
        message: 'No tenants need bill creation reminders today',
        tenants_processed: 0,
        reminders_sent: 0
      })
    }

    console.log(`📋 Found ${tenantsNeedingReminders.length} tenants needing bill creation reminders`)

    // Filter tenants that haven't had a reminder sent today
    const today = new Date().toISOString().split('T')[0]
    const tenantsToRemind = []

    for (const tenant of tenantsNeedingReminders) {
      // Check if bill creation reminder was already sent today for this tenant
      const existingReminderResult = await pool.query(`
        SELECT id FROM billing_reminders 
        WHERE tenant_id = $1 AND reminder_date = $2 AND reminder_type = 'bill_creation'
      `, [tenant.tenant_id, today])

    const existingReminder = existingReminderResult.rows
      if (existingReminder.length === 0) {
        tenantsToRemind.push(tenant)
      }
    }

    if (tenantsToRemind.length === 0) {
      console.log('✅ All bill creation reminders for today have already been sent')
      return NextResponse.json({
        success: true,
        message: 'All bill creation reminders for today have already been sent',
        tenants_processed: tenantsNeedingReminders.length,
        reminders_sent: 0
      })
    }

    console.log(`📧 Sending bill creation reminder for ${tenantsToRemind.length} tenants`)

    // Send email reminder to management
    const emailResult = await emailService.sendBillingReminderToManagement(tenantsToRemind)
    
    let remindersSent = 0
    let errors = []

    if (emailResult.success) {
      // Record reminders in database
      for (const tenant of tenantsToRemind) {
        try {
          await pool.query(`
            INSERT INTO billing_reminders 
            (tenant_id, reminder_date, days_before_due, email_sent, email_sent_at, reminder_type) 
            VALUES ($1, $2, $3, TRUE, NOW(), 'bill_creation') RETURNING id
          `, [tenant.tenant_id, today, tenant.days_until_due])

          // Also log in email_notifications table
          await pool.query(`
            INSERT INTO email_notifications 
            (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
            VALUES ($1, 'bill_creation_reminder', $2, 'official.jhapartment@gmail.com', 'sent', NOW()) RETURNING id
          `, [tenant.tenant_id, `Bill Creation Reminder - ${tenant.tenant_name} - Room ${tenant.room_number}`])

          remindersSent++
        } catch (error) {
          console.error(`❌ Failed to record reminder for tenant ${tenant.tenant_id}:`, error)
          errors.push({
            tenant_id: tenant.tenant_id,
            tenant_name: tenant.tenant_name,
            error: error.message
          })
        }
      }

      console.log(`✅ Successfully sent bill creation reminder email for ${remindersSent} tenants`)
    } else {
      console.error('❌ Failed to send bill creation reminder email:', emailResult.error)
      
      // Record failed attempts
      for (const tenant of tenantsToRemind) {
        try {
          await pool.query(`
            INSERT INTO billing_reminders 
            (tenant_id, reminder_date, days_before_due, email_sent, email_sent_at, reminder_type) 
            VALUES ($1, $2, $3, FALSE, NULL, 'bill_creation') RETURNING id
          `, [tenant.tenant_id, today, tenant.days_until_due])

          await pool.query(`
            INSERT INTO email_notifications 
            (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
            VALUES ($1, 'bill_creation_reminder', $2, 'official.jhapartment@gmail.com', 'failed', $3) RETURNING id
          `, [tenant.tenant_id, `Bill Creation Reminder - ${tenant.tenant_name} - Room ${tenant.room_number}`, emailResult.error])
        } catch (recordError) {
          console.error(`❌ Failed to record failed reminder for tenant ${tenant.tenant_id}:`, recordError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: emailResult.success ? 
        `Bill creation reminder sent successfully for ${remindersSent} tenants` : 
        `Failed to send bill creation reminder: ${emailResult.error}`,
      tenants_processed: tenantsNeedingReminders.length,
      tenants_to_remind: tenantsToRemind.length,
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

    // Get tenants that need bill creation reminders
    const tenantsNeedingReminders = await Bill.getBillsNeedingReminders()
    
    // Check which ones haven't had reminders sent today
    const today = new Date().toISOString().split('T')[0]
    const tenantsWithReminderStatus = []

    for (const tenant of tenantsNeedingReminders) {
      const existingReminderResult = await pool.query(`
        SELECT id, email_sent, email_sent_at FROM billing_reminders 
        WHERE tenant_id = $1 AND reminder_date = $2 AND reminder_type = 'bill_creation'
      `, [tenant.tenant_id, today])

    const existingReminder = existingReminderResult.rows
      tenantsWithReminderStatus.push({
        ...tenant,
        reminder_sent_today: existingReminder.length > 0,
        reminder_details: existingReminder[0] || null
      })
    }

    return NextResponse.json({
      success: true,
      tenants_needing_reminders: tenantsNeedingReminders.length,
      tenants_without_reminders_today: tenantsWithReminderStatus.filter(t => !t.reminder_sent_today).length,
      tenants: tenantsWithReminderStatus
    })

  } catch (error) {
    console.error('❌ Get billing reminders error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
} 