-- Fix payments table by adding missing payment_amount column

-- Add payment_amount column if it doesn't exist
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Also ensure other common payment columns exist
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'regular';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS actual_payment_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_payment_amount ON payments(payment_amount);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(actual_payment_date); 