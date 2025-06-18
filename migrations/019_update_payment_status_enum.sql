-- Add 'used' value to payment_status enum
-- This is needed for tenant_history when archiving tenants after final bill payment

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'used';

-- Update existing tenant_history records that might have null values
UPDATE tenant_history
SET advance_payment_status = 'paid'
WHERE advance_payment_status IS NULL;

UPDATE tenant_history
SET security_deposit_status = 'paid'
WHERE security_deposit_status IS NULL; 