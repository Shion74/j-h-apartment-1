-- Migration: Add payment date tracking to bill_history table

-- Add actual payment date column (date when tenant actually paid)
ALTER TABLE bill_history ADD COLUMN IF NOT EXISTS actual_payment_date DATE;

-- Add last payment date column (date when payment was processed in system)
ALTER TABLE bill_history ADD COLUMN IF NOT EXISTS last_payment_date DATE;

-- Create index for better performance on payment date queries
CREATE INDEX IF NOT EXISTS idx_bill_history_actual_payment_date ON bill_history(actual_payment_date);

-- Update the bill_history table comments
COMMENT ON COLUMN bill_history.actual_payment_date IS 'Date when tenant actually made the payment (manually entered)';
COMMENT ON COLUMN bill_history.last_payment_date IS 'Date when payment was processed in the system'; 