-- Seed tenant_deposits table with data from existing tenants

INSERT INTO tenant_deposits (tenant_id, deposit_type, initial_amount, remaining_balance, status)
SELECT 
  id,
  'advance',
  COALESCE(advance_payment, 3500.00),
  COALESCE(advance_payment, 3500.00),
  'active'
FROM tenants 
WHERE id NOT IN (SELECT tenant_id FROM tenant_deposits WHERE deposit_type = 'advance')
  AND contract_status = 'active';

INSERT INTO tenant_deposits (tenant_id, deposit_type, initial_amount, remaining_balance, status)
SELECT 
  id,
  'security',
  COALESCE(security_deposit, 3500.00),
  COALESCE(security_deposit, 3500.00),
  'active'
FROM tenants 
WHERE id NOT IN (SELECT tenant_id FROM tenant_deposits WHERE deposit_type = 'security')
  AND contract_status = 'active'; 