-- Add missing processed_by column to payments table

ALTER TABLE payments ADD COLUMN IF NOT EXISTS processed_by INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS processed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
 
-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_payments_processed_by ON payments(processed_by); 