-- Add move_out_date column to tenant_history table
-- This column is used when archiving tenants after paying final bills

ALTER TABLE tenant_history ADD COLUMN IF NOT EXISTS move_out_date TIMESTAMP WITH TIME ZONE;

-- Update existing records to have a default move_out_date value
UPDATE tenant_history
SET move_out_date = rent_end
WHERE move_out_date IS NULL; 