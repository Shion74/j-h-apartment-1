-- Migration 021: Add payment_date column to bills table
-- This column will store when a bill was actually paid

ALTER TABLE bills ADD COLUMN payment_date DATE;

-- Add comment to explain the column
COMMENT ON COLUMN bills.payment_date IS 'Date when the bill was actually paid by the tenant';

-- Update existing paid bills to have a payment_date (set to updated_at date)
UPDATE bills 
SET payment_date = updated_at::date 
WHERE status = 'paid' AND payment_date IS NULL; 