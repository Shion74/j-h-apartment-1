-- Add completed_cycles column to tenants table to track billing cycles

-- Add completed_cycles column with default 0
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS completed_cycles INTEGER DEFAULT 0;

-- Update existing tenants based on their paid bills in bill_history
UPDATE tenants t
SET completed_cycles = (
  SELECT COUNT(*)
  FROM bill_history bh
  WHERE bh.original_tenant_id = t.id
  AND bh.status = 'paid'
  AND NOT bh.is_final_bill
); 