-- Add missing columns to tenants table for move-out functionality

-- Add status column for tenant lifecycle management
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Add move out date tracking
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS move_out_date DATE;

-- Add contract status if it doesn't exist
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contract_status VARCHAR(20) DEFAULT 'active';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_contract_status ON tenants(contract_status); 