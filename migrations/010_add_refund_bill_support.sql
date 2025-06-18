-- Migration: Add refund bill support to bills table

-- Add refund bill indicator column
ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_refund_bill BOOLEAN DEFAULT FALSE;

-- Add refund-specific columns
ALTER TABLE bills ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Update bill status enum to include 'refund' status
-- For PostgreSQL, we need to add the new enum value
DO $$
BEGIN
  -- Check if 'refund' status already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'refund' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'bill_status')
  ) THEN
    ALTER TYPE bill_status ADD VALUE 'refund';
  END IF;
END $$;

-- Create index for better performance on refund bills
CREATE INDEX IF NOT EXISTS idx_bills_is_refund_bill ON bills(is_refund_bill);
CREATE INDEX IF NOT EXISTS idx_bills_refund_status ON bills(status) WHERE status = 'refund';

-- Update the bills table comment
COMMENT ON COLUMN bills.is_refund_bill IS 'Indicates if this bill is a refund bill (negative amount)';
COMMENT ON COLUMN bills.refund_reason IS 'Reason for the refund (e.g., deposit refund after move-out)'; 