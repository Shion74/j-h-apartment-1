# Billing Reminders System

## Overview

The billing reminder system automatically sends email notifications to `official.jhapartment@gmail.com` for bills that are due within 3 days or are overdue. This helps management stay on top of collections and ensures no bills are forgotten.

## Features

- **Automatic Detection**: Identifies bills due within 3 days or overdue
- **Daily Notifications**: Sends consolidated email with all bills needing attention
- **Duplicate Prevention**: Prevents sending multiple reminders for the same bill on the same day
- **Comprehensive Reporting**: Includes bill details, tenant information, and recommended actions
- **Statistics Tracking**: Maintains records of sent reminders for reporting

## How It Works

### Email Trigger Conditions
Emails are sent for bills that meet ANY of these criteria:
- Due today (0 days remaining)
- Due within 1-3 days
- Overdue (past due date)
- Partially paid bills that are due soon or overdue

### Email Content
Each reminder email includes:
- Summary statistics (total bills, total amount, overdue count)
- Bills grouped by due date
- Individual bill details (tenant, room, branch, amount)
- Color-coded urgency indicators
- Recommended actions for management

### Frequency
- **Daily**: One email per day (if there are bills needing attention)
- **Time**: Recommended to run at 9:00 AM daily
- **Deduplication**: Won't send duplicate reminders for the same bill on the same day

## Setup Instructions

### 1. Database Setup
The system requires two additional database tables that are automatically created:

```sql
-- Email notifications tracking
CREATE TABLE email_notifications (
  -- ... (automatically created)
);

-- Billing reminders tracking  
CREATE TABLE billing_reminders (
  -- ... (automatically created)
);
```

### 2. Email Configuration
Ensure your email settings are configured in the admin panel:
- SMTP Host, Port, Username, Password
- From Email Address
- Test the email configuration before setting up reminders

### 3. Manual Triggering
You can manually trigger billing reminders from:
- **Dashboard**: Click "Send Reminders" button in the Billing Reminders panel
- **API**: POST request to `/api/bills/reminders`

### 4. Automated Scheduling (Optional)

#### Option A: Manual Script Execution
Run the script manually when needed:
```bash
node scripts/run-billing-reminders.js
```

#### Option B: Cron Job (Linux/Mac)
Set up a daily cron job to run automatically:
```bash
# Edit crontab
crontab -e

# Add this line to run daily at 9:00 AM
0 9 * * * cd /path/to/your/project && node scripts/run-billing-reminders.js >> logs/billing-reminders.log 2>&1
```

#### Option C: Windows Task Scheduler
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger to "Daily" at 9:00 AM
4. Set action to start program: `node`
5. Add arguments: `scripts/run-billing-reminders.js`
6. Set start in: `C:\path\to\your\project`

## Usage

### Dashboard Interface
1. Go to the Dashboard
2. Look for the "Billing Reminders" panel
3. Click "Send Reminders" to manually trigger
4. View bills needing attention and last run time

### API Endpoints

#### Send Reminders
```http
POST /api/bills/reminders
Authorization: Bearer <token>
```

#### Check Bills Needing Reminders
```http
GET /api/bills/reminders
Authorization: Bearer <token>
```

### Script Execution
```bash
# Run the standalone script
node scripts/run-billing-reminders.js

# View recent logs (if using cron)
tail -f logs/billing-reminders.log
```

## Email Sample

**Subject**: `Billing Reminder - 5 Bills Due Soon`

**Content**: 
- Summary: 5 bills totaling ₱32,500 (2 overdue)
- Bills grouped by due date with tenant details
- Color-coded urgency (red=overdue, orange=due today, yellow=due soon)
- Recommended actions for management

## Monitoring & Maintenance

### View Statistics
- Dashboard shows recent reminder activity
- API endpoint provides detailed statistics
- Database tables track all reminder history

### Troubleshooting
1. **No emails received**: Check email configuration in admin panel
2. **Duplicate emails**: System prevents this automatically
3. **Missing bills**: Verify bill due dates and status
4. **Script errors**: Check logs and database connectivity

### Maintenance
- Old reminder records are automatically cleaned up after 90 days
- Weekly cleanup runs on Sundays when using the script
- Monitor email delivery success rates

## Technical Details

### Database Tables
- `billing_reminders`: Tracks when reminders were sent for each bill
- `email_notifications`: Logs all email attempts (success/failure)

### Key Files
- `services/emailService.js`: Email template and sending logic
- `services/billingReminderService.js`: Core reminder processing
- `app/api/bills/reminders/route.js`: API endpoints
- `scripts/run-billing-reminders.js`: Standalone execution script
- `models/bill.js`: Database queries for bills needing reminders

### Security
- Requires authentication for all API calls
- Email addresses are validated
- Database queries use prepared statements
- Error handling prevents information leakage

## Support

For issues or questions:
1. Check the dashboard for recent activity
2. Review logs for error messages
3. Verify email configuration
4. Test with manual trigger first
5. Check database connectivity

The system is designed to be reliable and self-monitoring, with comprehensive logging and error handling to ensure billing reminders are never missed. 