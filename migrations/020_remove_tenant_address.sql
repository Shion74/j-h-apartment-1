-- Remove address column from tenants table
ALTER TABLE tenants DROP COLUMN IF EXISTS address;

-- Remove address column from tenant_history table for consistency
ALTER TABLE tenant_history DROP COLUMN IF EXISTS address; 