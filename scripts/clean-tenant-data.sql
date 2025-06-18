-- Script to safely delete all tenant and billing data
-- This script preserves system structure while removing all tenant-related records

-- Disable triggers temporarily to avoid trigger-related issues
SET session_replication_role = 'replica';

-- Clear billing reminders
TRUNCATE TABLE billing_reminders CASCADE;

-- Clear email notifications related to tenants/bills
DELETE FROM email_notifications 
WHERE email_type IN ('welcome', 'deposit_receipt', 'contract_expiry', 'contract_renewal', 'bill', 'billing_reminder');

-- Clear deposit transactions
TRUNCATE TABLE deposit_transactions CASCADE;

-- Clear payments
TRUNCATE TABLE payments CASCADE;

-- Clear bills and bill history
TRUNCATE TABLE bills CASCADE;
TRUNCATE TABLE bill_history CASCADE;

-- Clear tenant deposits
TRUNCATE TABLE tenant_deposits CASCADE;

-- Clear contracts
TRUNCATE TABLE contracts CASCADE;

-- Clear tenants and tenant history
TRUNCATE TABLE tenants CASCADE;
TRUNCATE TABLE tenant_history CASCADE;

-- Reset room status to vacant
UPDATE rooms SET 
  status = 'vacant',
  tenant_id = NULL;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Verify the cleanup
SELECT 
  (SELECT COUNT(*) FROM tenants) as tenant_count,
  (SELECT COUNT(*) FROM tenant_history) as tenant_history_count,
  (SELECT COUNT(*) FROM bills) as bill_count,
  (SELECT COUNT(*) FROM bill_history) as bill_history_count,
  (SELECT COUNT(*) FROM payments) as payment_count,
  (SELECT COUNT(*) FROM deposit_transactions) as deposit_transaction_count,
  (SELECT COUNT(*) FROM contracts) as contract_count,
  (SELECT COUNT(*) FROM rooms WHERE status != 'vacant') as occupied_room_count; 