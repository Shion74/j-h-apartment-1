-- Add deposit columns to bills table for final bill calculations
-- This allows tracking of deposit application in final bills

ALTER TABLE bills ADD COLUMN IF NOT EXISTS deposit_applied DECIMAL(10,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS original_bill_amount DECIMAL(10,2) DEFAULT 0;

-- Also add these columns to bill_history table for consistency
ALTER TABLE bill_history ADD COLUMN IF NOT EXISTS deposit_applied DECIMAL(10,2) DEFAULT 0;
ALTER TABLE bill_history ADD COLUMN IF NOT EXISTS original_bill_amount DECIMAL(10,2) DEFAULT 0;

-- Update existing final bills to have the same value for original_bill_amount as total_amount
UPDATE bills 
SET original_bill_amount = total_amount
WHERE is_final_bill = TRUE AND original_bill_amount = 0;

UPDATE bill_history
SET original_bill_amount = total_amount
WHERE is_final_bill = TRUE AND original_bill_amount = 0; 