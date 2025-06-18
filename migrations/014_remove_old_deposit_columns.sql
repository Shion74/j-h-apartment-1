-- Remove old deposit columns from tenants table now that we use tenant_deposits
ALTER TABLE tenants 
  DROP COLUMN IF EXISTS advance_payment,
  DROP COLUMN IF EXISTS security_deposit,
  DROP COLUMN IF EXISTS advance_payment_used,
  DROP COLUMN IF EXISTS security_deposit_used,
  DROP COLUMN IF EXISTS advance_payment_status,
  DROP COLUMN IF EXISTS security_deposit_status; 