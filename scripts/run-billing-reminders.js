#!/usr/bin/env node

// Billing Reminders Script
// This script can be run manually or scheduled as a cron job
// Usage: node scripts/run-billing-reminders.js

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from the project root
config({ path: join(__dirname, '..', '.env.local') })

// Import the billing reminder service
import BillingReminderService from '../services/billingReminderService.js'

async function main() {
  console.log('🚀 Starting Billing Reminders Script')
  console.log('📅 Date:', new Date().toLocaleString())
  console.log('=' .repeat(50))

  try {
    // Process daily reminders
    const result = await BillingReminderService.processDailyReminders()
    
    console.log('\n📊 Results:')
    console.log('Success:', result.success)
    console.log('Message:', result.message)
    console.log('Bills Processed:', result.bills_processed || 0)
    console.log('Bills to Remind:', result.bills_to_remind || 0)
    console.log('Reminders Sent:', result.reminders_sent || 0)
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Errors:')
      result.errors.forEach(error => {
        console.log(`  - Bill ${error.bill_id} (${error.tenant_name}): ${error.error}`)
      })
    }

    if (result.email_result) {
      console.log('\n📧 Email Result:')
      console.log('  Success:', result.email_result.success)
      if (result.email_result.success) {
        console.log('  Message ID:', result.email_result.messageId)
        console.log('  Bills Count:', result.email_result.billsCount)
      } else {
        console.log('  Error:', result.email_result.error)
      }
    }

    // Get and display recent stats
    console.log('\n📈 Recent Reminder Statistics (Last 7 days):')
    const statsResult = await BillingReminderService.getReminderStats(7)
    
    if (statsResult.success && statsResult.stats.length > 0) {
      console.log('Date\t\tTotal\tSent\tFailed')
      console.log('-'.repeat(40))
      statsResult.stats.forEach(stat => {
        console.log(`${stat.date}\t${stat.total_reminders}\t${stat.successful_reminders}\t${stat.failed_reminders}`)
      })
    } else {
      console.log('No reminder statistics available')
    }

    // Cleanup old records (run weekly - only on Sundays)
    const today = new Date()
    if (today.getDay() === 0) { // Sunday
      console.log('\n🧹 Running weekly cleanup of old reminder records...')
      const cleanupResult = await BillingReminderService.cleanupOldReminders()
      console.log('Cleanup Result:', cleanupResult.message)
    }

    console.log('\n✅ Billing Reminders Script Completed Successfully')
    process.exit(0)

  } catch (error) {
    console.error('\n❌ Script Error:', error)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

// Run the script
main() 