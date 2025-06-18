-- Create refunds table for tracking deposit refunds

CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  refund_amount DECIMAL(10,2) NOT NULL,
  refund_type VARCHAR(20) NOT NULL CHECK (refund_type IN ('advance', 'security', 'overpayment')),
  refund_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
  payment_method VARCHAR(50),
  notes TEXT,
  processed_by INTEGER,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_refunds_tenant_id ON refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_type ON refunds(refund_type);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_date ON refunds(refund_date); 