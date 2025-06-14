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
        return {
          success: true,
          message: 'All reminders for today have already been sent',
          bills_processed: billsNeedingReminders.length,
          reminders_sent: 0
        }
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

      return {
        success: true,
        message: emailResult.success ? 
          `Billing reminder sent successfully for ${remindersSent} bills` : 
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
      const [stats] = await pool.execute(`
        SELECT 
          DATE(reminder_date) as date,
          COUNT(*) as total_reminders,
          SUM(CASE WHEN email_sent = TRUE THEN 1 ELSE 0 END) as successful_reminders,
          SUM(CASE WHEN email_sent = FALSE THEN 1 ELSE 0 END) as failed_reminders
        FROM billing_reminders 
        WHERE reminder_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(reminder_date)
        ORDER BY reminder_date DESC
      `, [days])

      return {
        success: true,
        stats
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
      const [result] = await pool.execute(`
        DELETE FROM billing_reminders 
        WHERE reminder_date < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      `)

      console.log(`🧹 Cleaned up ${result.affectedRows} old reminder records`)
      
      return {
        success: true,
        message: `Cleaned up ${result.affectedRows} old reminder records`,
        deleted_count: result.affectedRows
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