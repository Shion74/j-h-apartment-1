# MySQL to PostgreSQL Migration Guide for Supabase

## Overview
This guide helps you migrate your J&H Apartment Management System from MySQL to PostgreSQL using Supabase.

## Key Differences

### Data Types
- `INT AUTO_INCREMENT` → `SERIAL`
- `ENUM('value1', 'value2')` → Custom types
- `DECIMAL(10,2)` → `NUMERIC(10,2)`
- `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` → `TIMESTAMPTZ DEFAULT NOW()`
- `JSON` → `JSONB`

### Functions
- `CURDATE()` → `CURRENT_DATE`
- `DATE_ADD()` → `+ INTERVAL`
- `DATEDIFF()` → `DATE_PART('day', date1 - date2)`

## Step 1: Supabase Setup

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Get your project URL and API keys
4. Go to SQL Editor

## Step 2: PostgreSQL Schema

Run this in Supabase SQL Editor:

```sql
-- Create ENUM types
CREATE TYPE user_role AS ENUM ('admin', 'manager');
CREATE TYPE room_status AS ENUM ('occupied', 'vacant', 'maintenance');
CREATE TYPE contract_status AS ENUM ('active', 'expired', 'renewed', 'terminated');
CREATE TYPE payment_status AS ENUM ('paid', 'unpaid');
CREATE TYPE bill_status AS ENUM ('paid', 'unpaid', 'partial');
CREATE TYPE payment_method AS ENUM ('cash', 'gcash', 'bank_transfer', 'check', 'advance_payment', 'security_deposit', 'other');
CREATE TYPE email_type AS ENUM ('welcome', 'deposit_receipt', 'contract_expiry', 'contract_renewal', 'bill', 'billing_reminder', 'bill_creation_reminder', 'other');
CREATE TYPE email_status AS ENUM ('sent', 'failed', 'pending');
CREATE TYPE reminder_type AS ENUM ('payment_reminder', 'bill_creation');
CREATE TYPE transaction_type AS ENUM ('advance_payment', 'security_deposit', 'advance_refund', 'security_refund', 'advance_used_last_month', 'security_used_bills', 'deposit_adjustment');
CREATE TYPE transaction_action AS ENUM ('deposit', 'use', 'refund');
CREATE TYPE used_for_type AS ENUM ('rent', 'electricity', 'water', 'full_bill', 'refund');

-- Settings table
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'manager',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branches table
CREATE TABLE branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms table
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  room_number VARCHAR(10) NOT NULL,
  branch_id INTEGER NOT NULL,
  status room_status NOT NULL DEFAULT 'vacant',
  monthly_rent NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE (room_number, branch_id)
);

-- Tenants table
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  address TEXT,
  room_id INTEGER,
  rent_start DATE NOT NULL,
  initial_electric_reading NUMERIC(10, 2) DEFAULT 0.00,
  contract_start_date DATE,
  contract_end_date DATE,
  contract_duration_months INTEGER DEFAULT 6,
  contract_status contract_status DEFAULT 'active',
  welcome_email_sent BOOLEAN DEFAULT FALSE,
  deposit_receipt_sent BOOLEAN DEFAULT FALSE,
  contract_expiry_notified BOOLEAN DEFAULT FALSE,
  advance_payment NUMERIC(10, 2) DEFAULT 3500.00,
  security_deposit NUMERIC(10, 2) DEFAULT 3500.00,
  advance_payment_used NUMERIC(10, 2) DEFAULT 0.00,
  security_deposit_used NUMERIC(10, 2) DEFAULT 0.00,
  advance_payment_status payment_status DEFAULT 'unpaid',
  security_deposit_status payment_status DEFAULT 'unpaid',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

-- Bills table
CREATE TABLE bills (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  bill_date DATE NOT NULL,
  rent_from DATE NOT NULL,
  rent_to DATE NOT NULL,
  rent_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  electric_present_reading NUMERIC(10, 2) DEFAULT 0.00,
  electric_previous_reading NUMERIC(10, 2) DEFAULT 0.00,
  electric_consumption NUMERIC(10, 2) DEFAULT 0.00,
  electric_rate_per_kwh NUMERIC(10, 2) DEFAULT 12.00,
  electric_amount NUMERIC(10, 2) DEFAULT 0.00,
  electric_reading_date DATE,
  electric_previous_date DATE,
  water_amount NUMERIC(10, 2) DEFAULT 200.00,
  extra_fee_amount NUMERIC(10, 2) DEFAULT 0.00,
  extra_fee_description VARCHAR(255),
  penalty_fee_amount NUMERIC(10, 2) DEFAULT 0.00,
  penalty_applied BOOLEAN DEFAULT FALSE,
  due_date DATE,
  is_overdue BOOLEAN DEFAULT FALSE,
  total_amount NUMERIC(10, 2) NOT NULL,
  status bill_status NOT NULL DEFAULT 'unpaid',
  paid_date DATE,
  notes TEXT,
  prepared_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, rent_from, rent_to)
);

-- Payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  actual_payment_date DATE,
  payment_method payment_method NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

-- Email notifications table
CREATE TABLE email_notifications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  email_type email_type NOT NULL,
  email_subject VARCHAR(255) NOT NULL,
  email_body TEXT,
  recipient_email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status email_status DEFAULT 'pending',
  error_message TEXT,
  attachments JSONB,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Billing reminders table
CREATE TABLE billing_reminders (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER,
  tenant_id INTEGER,
  reminder_type reminder_type DEFAULT 'payment_reminder',
  reminder_date DATE NOT NULL,
  days_before_due INTEGER NOT NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Deposit transactions table
CREATE TABLE deposit_transactions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  bill_id INTEGER,
  transaction_type transaction_type NOT NULL,
  action transaction_action NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  used_for used_for_type,
  description TEXT,
  created_by VARCHAR(100) DEFAULT 'System',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL
);

-- Tenant history table
CREATE TABLE tenant_history (
  id SERIAL PRIMARY KEY,
  original_tenant_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  address TEXT,
  room_id INTEGER,
  room_number VARCHAR(10),
  branch_name VARCHAR(100),
  rent_start DATE NOT NULL,
  rent_end DATE NOT NULL,
  contract_start_date DATE,
  contract_end_date DATE,
  contract_duration_months INTEGER DEFAULT 6,
  contract_completed BOOLEAN DEFAULT FALSE,
  initial_electric_reading NUMERIC(10, 2) DEFAULT 0.00,
  final_electric_reading NUMERIC(10, 2) DEFAULT 0.00,
  advance_payment NUMERIC(10, 2) DEFAULT 3500.00,
  security_deposit NUMERIC(10, 2) DEFAULT 3500.00,
  advance_payment_status payment_status DEFAULT 'unpaid',
  security_deposit_status payment_status DEFAULT 'unpaid',
  advance_payment_refund_amount NUMERIC(10,2) DEFAULT 0.00,
  advance_payment_used_last_month NUMERIC(10,2) DEFAULT 0.00,
  security_deposit_refund_amount NUMERIC(10,2) DEFAULT 0.00,
  security_deposit_used_for_bills NUMERIC(10,2) DEFAULT 0.00,
  total_bills_paid NUMERIC(10, 2) DEFAULT 0.00,
  total_bills_unpaid NUMERIC(10, 2) DEFAULT 0.00,
  reason_for_leaving VARCHAR(100),
  notes TEXT,
  deleted_by VARCHAR(100) DEFAULT 'admin',
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default data
INSERT INTO users (username, password, role) VALUES 
('admin', '$2b$10$Wt1CpSBjeAklSj03qTvN6.GZIAbtxwWNbgfeX2aLlBbtz9HvM3I5i', 'admin');

INSERT INTO settings (setting_key, setting_value, description) VALUES 
('electric_rate_per_kwh', '12.00', 'Electricity rate per kilowatt hour (₱)'),
('water_fixed_amount', '200.00', 'Fixed water amount per room per month (₱)'),
('default_room_rate', '3500.00', 'Default monthly rent for new rooms (₱)'),
('default_contract_duration', '6', 'Default contract duration in months'),
('contract_expiry_notice_days', '30', 'Days before contract expiry to send notification'),
('smtp_host', '', 'SMTP server host for email notifications'),
('smtp_port', '587', 'SMTP server port'),
('smtp_user', '', 'SMTP username for authentication'),
('smtp_password', '', 'SMTP password for authentication'),
('smtp_from_email', 'admin@jhapartment.com', 'From email address for notifications'),
('smtp_from_name', 'J&H Apartment Management', 'From name for email notifications'),
('default_advance_payment', '3500.00', 'Default advance payment amount (₱)'),
('default_security_deposit', '3500.00', 'Default security deposit amount (₱)');

INSERT INTO branches (name, address) VALUES 
('J & H apartment', 'Patin-ay, Prosperidad, Agusan Del Sur');

INSERT INTO rooms (room_number, branch_id, status, monthly_rent) VALUES 
('1', 1, 'vacant', 3500.00),
('2', 1, 'vacant', 3500.00),
('3', 1, 'vacant', 3500.00),
('4', 1, 'vacant', 3500.00),
('5', 1, 'vacant', 3500.00),
('6', 1, 'vacant', 3500.00),
('7', 1, 'vacant', 3500.00);

-- Create update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Step 3: Update Dependencies

```bash
npm uninstall mysql2
npm install pg @supabase/supabase-js
```

## Step 4: Update Database Connection

```javascript
// lib/database.js
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

export { pool }
```

## Step 5: Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:[password]@[host]:[port]/postgres

# Other settings
JWT_SECRET=your-jwt-secret
```

## Step 6: Query Updates

### Parameter Placeholders
- MySQL: `?` → PostgreSQL: `$1, $2, $3`

### Method Changes
```javascript
// MySQL
const [rows] = await pool.execute('SELECT * FROM tenants WHERE id = ?', [id])

// PostgreSQL  
const result = await pool.query('SELECT * FROM tenants WHERE id = $1', [id])
const rows = result.rows
```

### Insert with RETURNING
```javascript
// MySQL
const [result] = await pool.execute('INSERT INTO tenants (...) VALUES (...)')
const insertId = result.insertId

// PostgreSQL
const result = await pool.query('INSERT INTO tenants (...) VALUES (...) RETURNING id')
const insertId = result.rows[0].id
```

### Date Functions
```javascript
// MySQL
CURDATE() → CURRENT_DATE
DATE_ADD(date, INTERVAL 1 MONTH) → date + INTERVAL '1 month'
DATEDIFF(date1, date2) → DATE_PART('day', date1 - date2)
```

## Step 7: Data Migration

Create migration script:

```javascript
// migrate-data.js
const mysql = require('mysql2/promise')
const { Pool } = require('pg')

const mysqlPool = mysql.createPool({
  host: 'localhost',
  user: 'root', 
  password: '',
  database: 'jh_apartment'
})

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
})

async function migrateData() {
  // Migrate settings
  const [settings] = await mysqlPool.execute('SELECT * FROM settings')
  for (const setting of settings) {
    await pgPool.query(
      'INSERT INTO settings (setting_key, setting_value, description) VALUES ($1, $2, $3) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2',
      [setting.setting_key, setting.setting_value, setting.description]
    )
  }

  // Migrate branches
  const [branches] = await mysqlPool.execute('SELECT * FROM branches')
  for (const branch of branches) {
    await pgPool.query(
      'INSERT INTO branches (id, name, description, address) VALUES ($1, $2, $3, $4)',
      [branch.id, branch.name, branch.description, branch.address]
    )
  }

  // Continue for other tables...
  console.log('Migration completed!')
}

migrateData()
```

## Benefits of PostgreSQL/Supabase

1. **Better Performance** - Complex queries run faster
2. **JSON Support** - Native JSONB for better JSON handling  
3. **Real-time** - Built-in real-time subscriptions
4. **Authentication** - Built-in auth system
5. **Automatic Backups** - Handled by Supabase
6. **Scalability** - Better scaling options

## Common Issues

1. **Case Sensitivity** - PostgreSQL is case-sensitive
2. **Boolean Values** - Use `true`/`false` not `1`/`0`
3. **Date Formats** - Use ISO format `YYYY-MM-DD`
4. **Enum Types** - Must be created before use

## Recent Migrations (PostgreSQL)

```sql
-- Migration 023: Add GCash to payment method enum
-- This migration adds 'gcash' to the payment_method enum type
-- Required because GCash is a popular payment method in the Philippines

-- Add 'gcash' to the existing payment_method enum
ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'gcash';

-- Migration 024: Add payment_method to bill_history table  
-- This migration adds payment_method column to preserve payment method information for archived bills
-- Required for proper receipt generation from archived bills

-- Add payment_method column with default 'cash' for existing records
ALTER TABLE bill_history 
ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_bill_history_payment_method ON bill_history(payment_method);

-- Update existing records to have 'cash' as default
UPDATE bill_history 
SET payment_method = 'cash' 
WHERE payment_method IS NULL;

-- Migration 025: Create payment_history table for archived payments
-- This migration creates payment_history table to preserve payment records when bills are archived
-- Required to maintain financial reporting accuracy and historical payment data

CREATE TABLE IF NOT EXISTS payment_history (
  id SERIAL PRIMARY KEY,
  original_payment_id INTEGER NOT NULL, -- Original payment ID from payments table
  original_bill_id INTEGER NOT NULL, -- Original bill ID that was paid
  tenant_name VARCHAR(100) NOT NULL, -- Tenant name at time of payment
  room_number VARCHAR(10), -- Room number at time of payment
  branch_name VARCHAR(100), -- Branch name at time of payment
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  actual_payment_date DATE, -- When payment was actually made
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  payment_type VARCHAR(20) DEFAULT 'regular', -- regular, deposit, refund, etc
  notes TEXT,
  processed_by VARCHAR(100), -- Who processed the payment
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP, -- Original payment creation time
  updated_at TIMESTAMP -- Original payment update time
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_history_original_bill_id ON payment_history(original_bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_date ON payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_method ON payment_history(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_history_tenant_name ON payment_history(tenant_name);
CREATE INDEX IF NOT EXISTS idx_payment_history_archived_at ON payment_history(archived_at);
```

Your apartment management system will be more robust and scalable with PostgreSQL and Supabase! 