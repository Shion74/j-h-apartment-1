-- Drop database if exists and create a new one
DROP DATABASE IF EXISTS jh_apartment;
CREATE DATABASE IF NOT EXISTS jh_apartment;

-- Use the database
USE jh_apartment;

-- Drop tables if they exist (in reverse order due to foreign key constraints)
DROP TABLE IF EXISTS deposit_transactions;
DROP TABLE IF EXISTS email_notifications;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bills;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS branches;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS billing_reminders;

-- Settings table for configurable rates
CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users table for authentication
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager') NOT NULL DEFAULT 'manager',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Branches table
CREATE TABLE branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(10) NOT NULL,
  branch_id INT NOT NULL,
  status ENUM('occupied', 'vacant', 'maintenance') NOT NULL DEFAULT 'vacant',
  monthly_rent DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE KEY unique_room_per_branch (room_number, branch_id)
);

-- Tenants table (includes contract management and deposit fields)
CREATE TABLE tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  address TEXT,
  room_id INT,
  rent_start DATE NOT NULL,
  initial_electric_reading DECIMAL(10, 2) DEFAULT 0.00,
  -- Contract Management Fields
  contract_start_date DATE COMMENT 'Contract start date (same as rent_start by default)',
  contract_end_date DATE COMMENT 'Contract end date (6 months from start by default)',
  contract_duration_months INT DEFAULT 6 COMMENT 'Contract duration in months',
  contract_status ENUM('active', 'expired', 'renewed', 'terminated') DEFAULT 'active' COMMENT 'Current contract status',
  welcome_email_sent BOOLEAN DEFAULT FALSE COMMENT 'Whether welcome email has been sent',
  deposit_receipt_sent BOOLEAN DEFAULT FALSE COMMENT 'Whether deposit receipt has been sent',
  contract_expiry_notified BOOLEAN DEFAULT FALSE COMMENT 'Whether contract expiry notification has been sent',
  -- Deposit Fields
  advance_payment DECIMAL(10, 2) DEFAULT 3500.00 COMMENT 'One month advance payment (usually same as monthly rent)',
  security_deposit DECIMAL(10, 2) DEFAULT 3500.00 COMMENT 'Security deposit for damages/utilities',
  advance_payment_used DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Amount of advance payment already used',
  security_deposit_used DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Amount of security deposit already used',
  advance_payment_status ENUM('paid', 'unpaid') DEFAULT 'unpaid' COMMENT 'Status of advance payment',
  security_deposit_status ENUM('paid', 'unpaid') DEFAULT 'unpaid' COMMENT 'Status of security deposit',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  INDEX idx_contract_end_date (contract_end_date, contract_status)
);

-- Bills table
CREATE TABLE bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  room_id INT NOT NULL,
  bill_date DATE NOT NULL,
  -- Rent Details
  rent_from DATE NOT NULL,
  rent_to DATE NOT NULL,
  rent_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  -- Electric Details
  electric_present_reading DECIMAL(10, 2) DEFAULT 0.00,
  electric_previous_reading DECIMAL(10, 2) DEFAULT 0.00,
  electric_consumption DECIMAL(10, 2) DEFAULT 0.00,
  electric_rate_per_kwh DECIMAL(10, 2) DEFAULT 12.00,
  electric_amount DECIMAL(10, 2) DEFAULT 0.00,
  electric_reading_date DATE,
  electric_previous_date DATE,
  -- Water Details (Fixed amount per room)
  water_amount DECIMAL(10, 2) DEFAULT 200.00,
  -- Extra Fee Details (Maintenance, etc.)
  extra_fee_amount DECIMAL(10, 2) DEFAULT 0.00,
  extra_fee_description VARCHAR(255) DEFAULT NULL,
  -- Total and Status
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('paid', 'unpaid', 'partial') NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  prepared_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  -- Prevent duplicate bills for same tenant in same period
  UNIQUE KEY unique_tenant_period (tenant_id, rent_from, rent_to)
);

-- Payments table (includes advance payment and security deposit payment methods)
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method ENUM('cash', 'gcash', 'bank_transfer', 'check', 'advance_payment', 'security_deposit', 'other') NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

-- Email notifications table to track sent emails
CREATE TABLE email_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NULL,
  email_type ENUM('welcome', 'deposit_receipt', 'contract_expiry', 'contract_renewal', 'bill', 'billing_reminder', 'bill_creation_reminder', 'other') NOT NULL,
  email_subject VARCHAR(255) NOT NULL,
  email_body TEXT,
  recipient_email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
  error_message TEXT,
  attachments JSON COMMENT 'List of attachment file paths',
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Billing reminders tracking table (supports both payment reminders and bill creation reminders)
CREATE TABLE billing_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NULL COMMENT 'Reference to existing bill (for payment reminders) - NULL for bill creation reminders',
  tenant_id INT NULL COMMENT 'Tenant ID for bill creation reminders',
  reminder_type ENUM('payment_reminder', 'bill_creation') DEFAULT 'payment_reminder' COMMENT 'Type of reminder sent',
  reminder_date DATE NOT NULL,
  days_before_due INT NOT NULL COMMENT 'Days before due date when reminder was sent (negative for overdue)',
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT unique_bill_payment_reminder UNIQUE (bill_id, reminder_date),
  CONSTRAINT unique_tenant_creation_reminder UNIQUE (tenant_id, reminder_date, reminder_type),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_reminder_type (reminder_type)
);

-- Deposit transactions table to track usage
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

-- Insert admin user (password: admin123)
INSERT INTO users (username, password, role) VALUES 
('admin', '$2b$10$Wt1CpSBjeAklSj03qTvN6.GZIAbtxwWNbgfeX2aLlBbtz9HvM3I5i', 'admin');

-- Insert default settings (includes all migration settings)
INSERT INTO settings (setting_key, setting_value, description) VALUES 
('electric_rate_per_kwh', '12.00', 'Electricity rate per kilowatt hour (₱)'),
('water_fixed_amount', '200.00', 'Fixed water amount per room per month (₱)'),
('default_room_rate', '3500.00', 'Default monthly rent for new rooms (₱)'),
-- Contract Management Settings
('default_contract_duration', '6', 'Default contract duration in months'),
('contract_expiry_notice_days', '30', 'Days before contract expiry to send notification'),
('smtp_host', '', 'SMTP server host for email notifications'),
('smtp_port', '587', 'SMTP server port'),
('smtp_user', '', 'SMTP username for authentication'),
('smtp_password', '', 'SMTP password for authentication'),
('smtp_from_email', 'admin@jhapartment.com', 'From email address for notifications'),
('smtp_from_name', 'J&H Apartment Management', 'From name for email notifications'),
-- Deposit Settings
('default_advance_payment', '3500.00', 'Default advance payment amount (₱)'),
('default_security_deposit', '3500.00', 'Default security deposit amount (₱)');

-- Insert default main branch
INSERT INTO branches (name, address) VALUES 
('J & H apartment', 'Patin-ay, Prosperidad, Agusan Del Sur');

-- Insert rooms for the main branch (numbered 1, 2, 3, etc. with rent 3500)
INSERT INTO rooms (room_number, branch_id, status, monthly_rent) VALUES 
('1', 1, 'vacant', 3500.00),
('2', 1, 'vacant', 3500.00),
('3', 1, 'vacant', 3500.00),
('4', 1, 'vacant', 3500.00),
('5', 1, 'vacant', 3500.00),
('6', 1, 'vacant', 3500.00),
('7', 1, 'vacant', 3500.00);