-- Create payment_history table to preserve payment records when bills are archived
-- This ensures financial reports continue to work with historical data

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