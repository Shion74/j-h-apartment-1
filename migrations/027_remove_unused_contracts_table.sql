-- Remove unused contracts table since contract management is handled in tenants table

-- Drop the unused contracts table and its indexes
DROP INDEX IF EXISTS idx_contracts_tenant_id;
DROP INDEX IF EXISTS idx_contracts_room_id;
DROP INDEX IF EXISTS idx_contracts_status;
DROP INDEX IF EXISTS idx_contracts_dates;
DROP TABLE IF EXISTS contracts;

-- Add comment to document the decision
-- Contract management is handled directly in the tenants table with fields:
-- contract_start_date, contract_end_date, contract_duration_months, 
-- contract_status, completed_cycles 