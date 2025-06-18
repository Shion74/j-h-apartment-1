-- Migration: Add refund-related columns to bill_history table

-- Add refund bill indicator column
ALTER TABLE bill_history ADD COLUMN IF NOT EXISTS is_refund_bill BOOLEAN DEFAULT FALSE;

-- Add refund-specific columns
ALTER TABLE bill_history ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Add archive-related columns if missing
ALTER TABLE bill_history ADD COLUMN IF NOT EXISTS archived_by VARCHAR(100) DEFAULT 'System';
ALTER TABLE bill_history ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- Create index for better performance on refund bills in history
CREATE INDEX IF NOT EXISTS idx_bill_history_is_refund_bill ON bill_history(is_refund_bill);

-- Update the bill_history table comments
COMMENT ON COLUMN bill_history.is_refund_bill IS 'Indicates if this archived bill was a refund bill (negative amount)';
COMMENT ON COLUMN bill_history.refund_reason IS 'Reason for the refund (e.g., deposit refund after move-out)';
COMMENT ON COLUMN bill_history.archived_by IS 'User who archived this bill';
COMMENT ON COLUMN bill_history.archive_reason IS 'Reason why this bill was archived'; 