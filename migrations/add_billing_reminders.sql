-- Migration: Add billing reminders functionality
-- This adds support for automated billing reminder emails
-- Run date: 2024-12-16

USE jh_apartment;

-- Update email_notifications table to support billing reminders
-- First, check if the table exists and modify it
ALTER TABLE email_notifications 
MODIFY COLUMN tenant_id INT NULL COMMENT 'Tenant ID - can be NULL for system-wide notifications';

ALTER TABLE email_notifications 
MODIFY COLUMN email_type ENUM('welcome', 'deposit_receipt', 'contract_expiry', 'contract_renewal', 'bill', 'billing_reminder', 'other') NOT NULL COMMENT 'Type of email notification';

-- Create billing_reminders table to track when reminders were sent
CREATE TABLE IF NOT EXISTS billing_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL COMMENT 'Reference to the bill that needs reminder',
  reminder_date DATE NOT NULL COMMENT 'Date when the reminder was sent',
  days_before_due INT NOT NULL COMMENT 'Days before due date when reminder was sent (negative for overdue)',
  email_sent BOOLEAN DEFAULT FALSE COMMENT 'Whether the email was successfully sent',
  email_sent_at TIMESTAMP NULL COMMENT 'When the email was actually sent',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  UNIQUE KEY unique_bill_reminder_date (bill_id, reminder_date),
  INDEX idx_reminder_date (reminder_date),
  INDEX idx_bill_id (bill_id)
) COMMENT 'Tracks billing reminder emails sent to management';

-- Insert a record to track this migration
INSERT INTO email_notifications 
(tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
VALUES 
(NULL, 'other', 'Billing Reminders System Activated', 'official.jhapartment@gmail.com', 'sent', NOW());

-- Display success message
SELECT 'Billing reminders migration completed successfully!' as message;
SELECT 'Tables created/updated:' as info;
SELECT '- email_notifications (updated to support billing_reminder type)' as table1;
SELECT '- billing_reminders (new table for tracking reminders)' as table2;
SELECT 'System is now ready to send automated billing reminders!' as status; 