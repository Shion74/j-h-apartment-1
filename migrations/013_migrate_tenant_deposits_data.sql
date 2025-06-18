-- Migration: Move existing tenant deposit data from tenant table to tenant_deposits table

-- Insert advance payment deposits for existing tenants
INSERT INTO tenant_deposits (tenant_id, deposit_type, initial_amount, remaining_balance, status, notes)
SELECT 
  id as tenant_id,
  'advance' as deposit_type,
  COALESCE(advance_payment, 3500.00) as initial_amount,
  CASE 
    WHEN advance_payment_status = 'paid' THEN COALESCE(advance_payment, 3500.00) - COALESCE(advance_payment_used, 0)
    ELSE 0
  END as remaining_balance,
  CASE 
    WHEN advance_payment_status = 'paid' THEN 'active'
    ELSE 'unpaid'
  END as status,
  'Migrated from tenant table' as notes
FROM tenants 
WHERE id NOT IN (
  SELECT tenant_id FROM tenant_deposits WHERE deposit_type = 'advance'
)
AND (advance_payment IS NOT NULL OR advance_payment_status IS NOT NULL);

-- Insert security deposits for existing tenants  
INSERT INTO tenant_deposits (tenant_id, deposit_type, initial_amount, remaining_balance, status, notes)
SELECT 
  id as tenant_id,
  'security' as deposit_type,
  COALESCE(security_deposit, 3500.00) as initial_amount,
  CASE 
    WHEN security_deposit_status = 'paid' THEN COALESCE(security_deposit, 3500.00) - COALESCE(security_deposit_used, 0)
    ELSE 0
  END as remaining_balance,
  CASE 
    WHEN security_deposit_status = 'paid' THEN 'active'
    ELSE 'unpaid'
  END as status,
  'Migrated from tenant table' as notes
FROM tenants 
WHERE id NOT IN (
  SELECT tenant_id FROM tenant_deposits WHERE deposit_type = 'security'
)
AND (security_deposit IS NOT NULL OR security_deposit_status IS NOT NULL);

-- Create deposit transactions for existing used amounts (if any)
INSERT INTO deposit_transactions (tenant_id, transaction_type, action, amount, description, created_by, transaction_date)
SELECT 
  id as tenant_id,
  'advance_payment' as transaction_type,
  'use' as action,
  advance_payment_used as amount,
  'Historical deposit usage (migrated from tenant table)' as description,
  'Migration' as created_by,
  created_at::date as transaction_date
FROM tenants 
WHERE advance_payment_used > 0
AND id NOT IN (
  SELECT tenant_id FROM deposit_transactions 
  WHERE transaction_type = 'advance_payment' AND action = 'use' AND description LIKE '%migrated%'
);

INSERT INTO deposit_transactions (tenant_id, transaction_type, action, amount, description, created_by, transaction_date)
SELECT 
  id as tenant_id,
  'security_deposit' as transaction_type,
  'use' as action,
  security_deposit_used as amount,
  'Historical deposit usage (migrated from tenant table)' as description,
  'Migration' as created_by,
  created_at::date as transaction_date
FROM tenants 
WHERE security_deposit_used > 0
AND id NOT IN (
  SELECT tenant_id FROM deposit_transactions 
  WHERE transaction_type = 'security_deposit' AND action = 'use' AND description LIKE '%migrated%'
);

-- Optional: Comment out the following lines if you want to keep the old columns for backwards compatibility
-- Remove old deposit columns from tenants table (commented out for safety)
-- ALTER TABLE tenants DROP COLUMN IF EXISTS advance_payment;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS security_deposit;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS advance_payment_status;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS security_deposit_status;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS advance_payment_used;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS security_deposit_used; 