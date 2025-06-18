-- Create contracts table for managing tenant contracts

CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  duration_months INTEGER DEFAULT 6,
  monthly_rent DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated', 'expired')),
  termination_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_room_id ON contracts(room_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(start_date, end_date); 