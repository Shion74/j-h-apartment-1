import { pool } from '../lib/database.js'
import emailService from './emailService.js'
import Bill from '../models/bill.js'

class BillingReminderService {
  
  // Main function to process daily billing reminders
  static async processDailyReminders() {
    try {
      console.log('🔔 Starting daily billing reminders process...')
      
      // Get bills that need reminders (due within 3 days or overdue)
      const billsNeedingReminders = await Bill.getBillsNeedingReminders()
      
      if (billsNeedingReminders.length === 0) {
        console.log('✅ No bills need reminders today')
        return {
          success: true,
          message: 'No bills need reminders today',
          bills_processed: 0,
          reminders_sent: 0
        }
      }

      console.log(`📋 Found ${billsNeedingReminders.length} bills needing reminders`)

      // Filter bills that haven't had a reminder sent today
      const today = new Date().toISOString().split('T')[0]
      const billsToRemind = []

      for (const tenant of billsNeedingReminders) {
        // Check if reminder was already sent today for this tenant
        const existingReminderResult = await pool.query(`
          SELECT id FROM billing_reminders 
          WHERE tenant_id = $1 AND reminder_date = $2
        `, [tenant.tenant_id, today])

        if (existingReminderResult.rows.length === 0) {
          billsToRemind.push(tenant)
        }
      }

      if (billsToRemind.length === 0) {
        console.log('✅ All reminders for today have already been sent')
        return {
          success: true,
          message: 'All reminders for today have already been sent',
          bills_processed: billsNeedingReminders.length,
          reminders_sent: 0
        }
      }

      console.log(`📧 Sending reminder for ${billsToRemind.length} tenants`)

      // Send email reminder to management
      const emailResult = await emailService.sendBillingReminderToManagement(billsToRemind)
      
      let remindersSent = 0
      let errors = []

      if (emailResult.success) {
        // Record reminders in database
        for (const tenant of billsToRemind) {
          try {
            await pool.query(`
              INSERT INTO billing_reminders 
              (tenant_id, reminder_date, days_before_due, email_sent, email_sent_at) 
              VALUES ($1, $2, $3, TRUE, NOW())
            `, [tenant.tenant_id, today, tenant.days_until_due])

            // Also log in email_notifications table
            await pool.query(`
              INSERT INTO email_notifications 
              (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
              VALUES ($1, 'billing_reminder', $2, 'official.jhapartment@gmail.com', 'sent', NOW())
            `, [tenant.tenant_id, `Billing Reminder - ${tenant.tenant_name} - Room ${tenant.room_number}`])

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

        console.log(`✅ Successfully sent billing reminder email with ${remindersSent} tenants`)
      } else {
        console.error('❌ Failed to send billing reminder email:', emailResult.error)
        
        // Record failed attempts
        for (const tenant of billsToRemind) {
          try {
            await pool.query(`
              INSERT INTO billing_reminders 
              (tenant_id, reminder_date, days_before_due, email_sent, email_sent_at) 
              VALUES ($1, $2, $3, FALSE, NULL)
            `, [tenant.tenant_id, today, tenant.days_until_due])

            await pool.query(`
              INSERT INTO email_notifications 
              (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
              VALUES ($1, 'billing_reminder', $2, 'official.jhapartment@gmail.com', 'failed', $3)
            `, [tenant.tenant_id, `Billing Reminder - ${tenant.tenant_name} - Room ${tenant.room_number}`, emailResult.error])
          } catch (recordError) {
            console.error(`❌ Failed to record failed reminder for tenant ${tenant.tenant_id}:`, recordError)
          }
        }
      }

      return {
        success: true,
        message: emailResult.success ? 
          `Billing reminder sent successfully for ${remindersSent} tenants` : 
          `Failed to send billing reminder: ${emailResult.error}`,
        bills_processed: billsNeedingReminders.length,
        bills_to_remind: billsToRemind.length,
        reminders_sent: remindersSent,
        email_result: emailResult,
        errors: errors.length > 0 ? errors : undefined
      }

    } catch (error) {
      console.error('❌ Daily billing reminders error:', error)
      return {
        success: false,
        message: 'Internal server error',
        error: error.message
      }
    }
  }

  // Get reminder statistics
  static async getReminderStats(days = 30) {
    try {
      const statsResult = await pool.query(`
        SELECT 
          DATE(reminder_date) as date,
          COUNT(*) as total_reminders,
          SUM(CASE WHEN email_sent = TRUE THEN 1 ELSE 0 END) as successful_reminders,
          SUM(CASE WHEN email_sent = FALSE THEN 1 ELSE 0 END) as failed_reminders
        FROM billing_reminders 
        WHERE reminder_date >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(reminder_date)
        ORDER BY reminder_date DESC
      `)

      return {
        success: true,
        stats: statsResult.rows
      }
    } catch (error) {
      console.error('❌ Error getting reminder stats:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Clean up old reminder records (older than 90 days)
  static async cleanupOldReminders() {
    try {
      const result = await pool.query(`
        DELETE FROM billing_reminders 
        WHERE reminder_date < CURRENT_DATE - INTERVAL '90 days'
      `)

      console.log(`🧹 Cleaned up ${result.rowCount} old reminder records`)
      
      return {
        success: true,
        message: `Cleaned up ${result.rowCount} old reminder records`,
        deleted_count: result.rowCount
      }
    } catch (error) {
      console.error('❌ Error cleaning up old reminders:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default BillingReminderService 