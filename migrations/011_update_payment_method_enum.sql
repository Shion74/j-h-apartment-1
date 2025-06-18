-- Update payment_method enum to include 'deposit' value

-- First, check if the enum type exists and what values it has
DO $$
BEGIN
  -- Add 'deposit' to the payment_method enum if it doesn't exist
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    -- Try to add 'deposit' to existing enum (will fail silently if already exists)
    BEGIN
      ALTER TYPE payment_method ADD VALUE 'deposit';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, continue
      NULL;
    END;
  ELSE
    -- If no enum exists, the column might be VARCHAR, so no action needed
    NULL;
  END IF;
END $$; 