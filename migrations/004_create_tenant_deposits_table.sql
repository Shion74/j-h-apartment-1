-- Create tenant_deposits table for managing security and advance deposits

CREATE TABLE IF NOT EXISTS tenant_deposits (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deposit_type VARCHAR(20) NOT NULL CHECK (deposit_type IN ('advance', 'security')),
  initial_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  remaining_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'refunded', 'forfeited')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tenant_deposits_tenant_id ON tenant_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_deposits_type ON tenant_deposits(deposit_type);
CREATE INDEX IF NOT EXISTS idx_tenant_deposits_status ON tenant_deposits(status);

-- Create unique constraint to prevent duplicate deposits of same type for same tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_deposits_unique 
  ON tenant_deposits(tenant_id, deposit_type) WHERE status = 'active'; 