# Database Migrations Summary

## Overview
This document summarizes all the database migrations that have been applied to the J&H Apartment system to support advanced functionality.

## Migrations Applied

### 1. Contract Management (`add_contract_management.sql`)
**Purpose**: Add contract tracking and email notification features.

**Changes Made:**
- Added contract management fields to `tenants` table:
  - `contract_start_date` - Contract start date
  - `contract_end_date` - Contract end date  
  - `contract_duration_months` - Contract duration (default: 6 months)
  - `contract_status` - Current contract status (active, expired, renewed, terminated)
  - `welcome_email_sent` - Track welcome email status
  - `deposit_receipt_sent` - Track deposit receipt email status
  - `contract_expiry_notified` - Track contract expiry notification status

- Created `email_notifications` table:
  - Track all email notifications sent to tenants
  - Support for multiple email types (welcome, deposit_receipt, contract_expiry, etc.)
  - Email status tracking (sent, failed, pending)
  - Attachment support

- Added email settings to `settings` table:
  - SMTP configuration settings
  - Contract management settings

### 2. Tenant Deposits (`add_tenant_deposits.sql`)
**Purpose**: Add advance payment and security deposit functionality.

**Changes Made:**
- Added deposit fields to `tenants` table:
  - `advance_payment` - One month advance payment amount
  - `security_deposit` - Security deposit amount
  - `advance_payment_used` - Amount of advance payment already used
  - `security_deposit_used` - Amount of security deposit already used
  - `advance_payment_status` - Payment status (paid/unpaid)
  - `security_deposit_status` - Payment status (paid/unpaid)

- Created `deposit_transactions` table:
  - Track all deposit transactions (deposit, use, refund)
  - Link to bills when deposits are used for payments
  - Track what deposits were used for (rent, electricity, water, etc.)

- Updated `payments` table:
  - Added `advance_payment` and `security_deposit` payment methods

### 3. Billing Reminders (`add_billing_reminders.sql`)
**Purpose**: Add automated billing reminder functionality.

**Changes Made:**
- Updated `email_notifications` table:
  - Added `billing_reminder` email type
  - Made `tenant_id` nullable for system-wide notifications

- Created `billing_reminders` table:
  - Track when billing reminders are sent
  - Prevent duplicate reminders on same date
  - Track email delivery status

### 4. Bill Creation Reminders (`update_billing_reminders_for_tenant_support.sql`)
**Purpose**: Update billing reminders to support both payment reminders and bill creation reminders.

**Changes Made:**
- Updated `billing_reminders` table:
  - Added `tenant_id` column for bill creation reminders
  - Added `reminder_type` enum (payment_reminder, bill_creation)
  - Made `bill_id` nullable for bill creation reminders
  - Updated constraints to handle both reminder types
  - Added performance indexes

- Updated `email_notifications` table:
  - Added `bill_creation_reminder` email type

## Current Database Schema Features

### Reminder System
The system now supports two types of reminders:

1. **Payment Reminders**: For existing bills that are overdue or due soon
   - Uses `bill_id` to reference existing bills
   - Type: `payment_reminder`

2. **Bill Creation Reminders**: For tenants who need new bills created
   - Uses `tenant_id` to reference tenants
   - Type: `bill_creation`
   - Triggers when tenant's billing cycle is ending in 3 days

### Key Tables Updated

#### `billing_reminders` Table
```sql
CREATE TABLE billing_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NULL,                    -- For payment reminders
  tenant_id INT NULL,                  -- For bill creation reminders
  reminder_type ENUM('payment_reminder', 'bill_creation'),
  reminder_date DATE NOT NULL,
  days_before_due INT NOT NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Constraints and indexes for both reminder types
);
```

#### `email_notifications` Table
```sql
CREATE TABLE email_notifications (
  -- ... other fields ...
  email_type ENUM('welcome', 'deposit_receipt', 'contract_expiry', 
                  'contract_renewal', 'bill', 'billing_reminder', 
                  'bill_creation_reminder', 'other') NOT NULL,
  -- ... other fields ...
);
```

## Migration Runner

Created `scripts/migrate.js` to run database migrations:

```bash
node scripts/migrate.js
```

The migration runner:
- Runs all migrations in order
- Handles errors gracefully (skips already applied changes)
- Provides detailed logging
- Supports both DDL and DML statements

## Updated Files

1. **`config/database.sql`** - Updated to include all migration changes
2. **`scripts/migrate.js`** - New migration runner script
3. **`app/api/bills/reminders/route.js`** - Updated to support tenant-based reminders
4. **`models/bill.js`** - `getBillsNeedingReminders()` method updated for bill creation reminders
5. **`services/emailService.js`** - Updated email templates for bill creation reminders

## Current Status

✅ **Migration Runner**: Created and tested
✅ **Database Schema**: Updated to latest version
✅ **Billing Reminders**: Support both payment and bill creation reminders
✅ **API Endpoints**: Updated to handle new reminder system
✅ **Email System**: Updated templates and logic

## Next Steps

1. **Test the reminder system**: Try the "Send Reminders" button in the admin panel
2. **Verify email delivery**: Check that bill creation reminders are sent correctly
3. **Monitor performance**: Ensure the new indexes improve query performance

## Notes

- All migrations are idempotent (can be run multiple times safely)
- The system maintains backward compatibility with existing data
- Database constraints ensure data integrity across all tables
- Email tracking provides full audit trail of all notifications sent 