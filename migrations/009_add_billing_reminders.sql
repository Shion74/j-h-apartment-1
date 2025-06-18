-- Migration: Add billing reminders functionality for PostgreSQL
-- This adds support for automated billing reminder emails

-- Update email_notifications table to support billing reminders
-- Add billing_reminder type if not already present
DO $$
BEGIN
  -- Check if the email_type constraint exists and update it
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_notifications_email_type_check'
  ) THEN
    ALTER TABLE email_notifications DROP CONSTRAINT email_notifications_email_type_check;
  END IF;
  
  -- Add the new constraint with billing_reminder type
  ALTER TABLE email_notifications 
  ADD CONSTRAINT email_notifications_email_type_check 
  CHECK (email_type IN ('welcome', 'deposit_receipt', 'contract_expiry', 'contract_renewal', 'bill', 'billing_reminder', 'other'));
END $$;

-- Create billing_reminders table to track when reminders were sent
CREATE TABLE IF NOT EXISTS billing_reminders (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  days_before_due INTEGER NOT NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_reminders_bill_id ON billing_reminders(bill_id);
CREATE INDEX IF NOT EXISTS idx_billing_reminders_reminder_date ON billing_reminders(reminder_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_reminders_unique 
  ON billing_reminders(bill_id, reminder_date); 