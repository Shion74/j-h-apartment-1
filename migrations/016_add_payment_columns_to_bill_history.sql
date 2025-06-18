-- Add payment-related columns to bill_history table

ALTER TABLE bill_history 
ADD COLUMN IF NOT EXISTS total_paid DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP; 