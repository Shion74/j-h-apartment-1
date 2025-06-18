-- Add missing columns to bills table for move-out functionality

-- Add final bill indicator
ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_final_bill BOOLEAN DEFAULT FALSE;

-- Add move-out related columns
ALTER TABLE bills ADD COLUMN IF NOT EXISTS move_out_reason TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS move_out_notes TEXT;

-- Add payment tracking columns
ALTER TABLE bills ADD COLUMN IF NOT EXISTS total_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(10,2) DEFAULT 0;

-- Add prepared by column if missing
ALTER TABLE bills ADD COLUMN IF NOT EXISTS prepared_by VARCHAR(100) DEFAULT 'Admin';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_bills_is_final_bill ON bills(is_final_bill);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_status ON bills(tenant_id, status); 