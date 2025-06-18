-- =====================================================
-- DATABASE CLEANUP SCRIPT
-- =====================================================
-- WARNING: This will permanently delete ALL tenant and billing data!
-- 
-- This includes:
-- - All active tenants
-- - All archived tenants (tenant_history)
-- - All active bills  
-- - All archived bills (bill_history)
-- - All payments and transactions
-- - All deposits and refunds
-- 
-- Use with extreme caution!
-- =====================================================

BEGIN;

-- Clear payments first (has foreign key constraints)
DELETE FROM payments;

-- Clear all bill-related data
DELETE FROM bills;
DELETE FROM bill_history;

-- Clear deposit and transaction data
DELETE FROM deposit_transactions;
DELETE FROM tenant_deposits;
DELETE FROM refunds;

-- Clear contract data
DELETE FROM contracts;

-- Clear email notifications
DELETE FROM email_notifications;

-- Clear tenant data
DELETE FROM tenants;
DELETE FROM tenant_history;

-- Reset all rooms to vacant status
UPDATE rooms 
SET status = 'vacant', tenant_id = NULL 
WHERE status != 'vacant' OR tenant_id IS NOT NULL;

-- Reset auto-increment sequences (PostgreSQL)
-- Comment out if using MySQL or if sequences don't exist
ALTER SEQUENCE IF EXISTS tenants_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS bills_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS payments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS tenant_deposits_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS contracts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS deposit_transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS refunds_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS email_notifications_id_seq RESTART WITH 1;

COMMIT;

-- Success message
SELECT 'Database cleanup completed successfully!' as result; 