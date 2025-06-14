-- Migration: Add advance payment and security deposit functionality
-- Run this script to add deposit tracking to existing database

USE jh_apartment;

-- Add advance payment and security deposit fields to tenants table
ALTER TABLE tenants ADD COLUMN advance_payment DECIMAL(10, 2) DEFAULT 3500.00 COMMENT 'One month advance payment (usually same as monthly rent)';
ALTER TABLE tenants ADD COLUMN security_deposit DECIMAL(10, 2) DEFAULT 3500.00 COMMENT 'Security deposit for damages/utilities';
ALTER TABLE tenants ADD COLUMN advance_payment_used DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Amount of advance payment already used';
ALTER TABLE tenants ADD COLUMN security_deposit_used DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Amount of security deposit already used';
ALTER TABLE tenants ADD COLUMN advance_payment_status ENUM('paid', 'unpaid') DEFAULT 'unpaid' COMMENT 'Status of advance payment';
ALTER TABLE tenants ADD COLUMN security_deposit_status ENUM('paid', 'unpaid') DEFAULT 'unpaid' COMMENT 'Status of security deposit';

-- Create deposit transactions table to track usage
CREATE TABLE deposit_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  bill_id INT NULL, -- NULL for initial deposits, set when used for bills
  transaction_type ENUM('advance_payment', 'security_deposit') NOT NULL,
  action ENUM('deposit', 'use', 'refund') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  used_for ENUM('rent', 'electricity', 'water', 'full_bill', 'refund') NULL COMMENT 'What the deposit was used for',
  description TEXT,
  created_by VARCHAR(100) DEFAULT 'System',
  transaction_date DATE NOT NULL DEFAULT (CURDATE()),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL
);

-- Update payment methods to include advance and deposit options
ALTER TABLE payments MODIFY COLUMN payment_method ENUM('cash', 'bank_transfer', 'check', 'advance_payment', 'security_deposit', 'other') NOT NULL;

-- Add settings for default deposit amounts
INSERT INTO settings (setting_key, setting_value, description) VALUES 
('default_advance_payment', '3500.00', 'Default advance payment amount (₱)'),
('default_security_deposit', '3500.00', 'Default security deposit amount (₱)');

-- Update existing tenants to have the default amounts (mark as unpaid since they're existing)
UPDATE tenants SET 
  advance_payment = 3500.00,
  security_deposit = 3500.00,
  advance_payment_status = 'unpaid',
  security_deposit_status = 'unpaid'
WHERE advance_payment IS NULL OR security_deposit IS NULL; 