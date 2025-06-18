-- Add 'gcash' to payment_method enum
-- This migration adds 'gcash' as a valid payment method

-- For PostgreSQL, add to enum type
DO $$
BEGIN
    -- Check if 'gcash' value already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
        AND enumlabel = 'gcash'
    ) THEN
        -- Add 'gcash' to the payment_method enum
        ALTER TYPE payment_method ADD VALUE 'gcash';
        RAISE NOTICE 'Added gcash to payment_method enum';
    ELSE
        RAISE NOTICE 'gcash already exists in payment_method enum';
    END IF;
END
$$; 