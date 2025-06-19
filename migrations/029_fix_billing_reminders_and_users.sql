-- Migration 029: Fix billing reminders table and add email column to users
-- This fixes the structure to support both payment reminders and bill creation reminders

-- Fix users table - add email column if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Update billing_reminders table to support both types of reminders
-- Add tenant_id column if missing
ALTER TABLE billing_reminders ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- Add reminder_type column if missing  
DO $$
BEGIN
  -- Check if reminder_type column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'billing_reminders' 
    AND column_name = 'reminder_type'
  ) THEN
    -- Create enum type first
    DO $ENUM$
    BEGIN
      CREATE TYPE reminder_type_enum AS ENUM ('payment_reminder', 'bill_creation');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $ENUM$;
    
    -- Add column with enum type
    ALTER TABLE billing_reminders 
    ADD COLUMN reminder_type reminder_type_enum DEFAULT 'bill_creation';
  END IF;
END $$;

-- Make bill_id nullable (for bill creation reminders)
ALTER TABLE billing_reminders ALTER COLUMN bill_id DROP NOT NULL;

-- Add foreign key for tenant_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'billing_reminders_tenant_id_fkey'
  ) THEN
    ALTER TABLE billing_reminders 
    ADD CONSTRAINT billing_reminders_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop old unique constraint if exists
ALTER TABLE billing_reminders DROP CONSTRAINT IF EXISTS idx_billing_reminders_unique;

-- Add new constraints for both reminder types
DO $$
BEGIN
  -- Unique constraint for bill creation reminders (tenant_id + date + type)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_tenant_creation_reminder'
  ) THEN
    ALTER TABLE billing_reminders 
    ADD CONSTRAINT unique_tenant_creation_reminder 
    UNIQUE (tenant_id, reminder_date, reminder_type);
  END IF;
  
  -- Unique constraint for payment reminders (bill_id + date)  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_bill_payment_reminder'
  ) THEN
    ALTER TABLE billing_reminders 
    ADD CONSTRAINT unique_bill_payment_reminder 
    UNIQUE (bill_id, reminder_date);
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_reminders_tenant_id ON billing_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_reminders_reminder_type ON billing_reminders(reminder_type);

-- Update email_notifications to support bill_creation_reminder type
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_notifications_email_type_check'
  ) THEN
    ALTER TABLE email_notifications DROP CONSTRAINT email_notifications_email_type_check;
  END IF;
  
  -- Add updated constraint with bill_creation_reminder type
  ALTER TABLE email_notifications 
  ADD CONSTRAINT email_notifications_email_type_check 
  CHECK (email_type IN ('welcome', 'deposit_receipt', 'contract_expiry', 'contract_renewal', 'bill', 'billing_reminder', 'bill_creation_reminder', 'other'));
END $$; 