-- Migration: Add contract management and email notification features
-- Run this script to add contract tracking to existing database

USE jh_apartment;

-- Add contract management fields to tenants table
ALTER TABLE tenants ADD COLUMN contract_start_date DATE COMMENT 'Contract start date (same as rent_start by default)';
ALTER TABLE tenants ADD COLUMN contract_end_date DATE COMMENT 'Contract end date (6 months from start by default)';
ALTER TABLE tenants ADD COLUMN contract_duration_months INT DEFAULT 6 COMMENT 'Contract duration in months';
ALTER TABLE tenants ADD COLUMN contract_status ENUM('active', 'expired', 'renewed', 'terminated') DEFAULT 'active' COMMENT 'Current contract status';
ALTER TABLE tenants ADD COLUMN welcome_email_sent BOOLEAN DEFAULT FALSE COMMENT 'Whether welcome email has been sent';
ALTER TABLE tenants ADD COLUMN deposit_receipt_sent BOOLEAN DEFAULT FALSE COMMENT 'Whether deposit receipt has been sent';
ALTER TABLE tenants ADD COLUMN contract_expiry_notified BOOLEAN DEFAULT FALSE COMMENT 'Whether contract expiry notification has been sent';

-- Create email notifications table to track sent emails
CREATE TABLE email_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  email_type ENUM('welcome', 'deposit_receipt', 'contract_expiry', 'contract_renewal', 'other') NOT NULL,
  email_subject VARCHAR(255) NOT NULL,
  email_body TEXT,
  recipient_email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
  error_message TEXT,
  attachments JSON COMMENT 'List of attachment file paths',
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Add email settings to settings table
INSERT INTO settings (setting_key, setting_value, description) VALUES 
('default_contract_duration', '6', 'Default contract duration in months'),
('contract_expiry_notice_days', '30', 'Days before contract expiry to send notification'),
('smtp_host', '', 'SMTP server host for email notifications'),
('smtp_port', '587', 'SMTP server port'),
('smtp_user', '', 'SMTP username for authentication'),
('smtp_password', '', 'SMTP password for authentication'),
('smtp_from_email', 'admin@jhapartment.com', 'From email address for notifications'),
('smtp_from_name', 'J&H Apartment Management', 'From name for email notifications')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Update existing tenants with contract information
UPDATE tenants SET 
  contract_start_date = rent_start,
  contract_end_date = DATE_ADD(rent_start, INTERVAL 6 MONTH),
  contract_duration_months = 6,
  contract_status = 'active'
WHERE contract_start_date IS NULL;

-- Create index for efficient contract expiry checking
CREATE INDEX idx_contract_end_date ON tenants(contract_end_date, contract_status); 