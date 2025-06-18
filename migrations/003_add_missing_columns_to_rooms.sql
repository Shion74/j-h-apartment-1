-- Add missing columns to rooms table for tenant management

-- Add tenant_id column to track which tenant is in which room
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- Add foreign key constraint (PostgreSQL doesn't support IF NOT EXISTS for constraints)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rooms_tenant_id'
  ) THEN
    ALTER TABLE rooms ADD CONSTRAINT fk_rooms_tenant_id 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_rooms_tenant_id ON rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status); 