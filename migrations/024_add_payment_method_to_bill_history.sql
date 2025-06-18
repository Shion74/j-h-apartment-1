-- Add payment_method column to bill_history table
-- This allows us to preserve payment method information when bills are archived

-- Add payment_method column with default 'cash' for existing records
ALTER TABLE bill_history 
ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_bill_history_payment_method ON bill_history(payment_method);

-- Update existing records to have 'cash' as default
UPDATE bill_history 
SET payment_method = 'cash' 
WHERE payment_method IS NULL; 