-- Migration 022: Add missing electric_rate_per_kwh column to bill_history table
-- This column is needed for receipt generation from archived bills

ALTER TABLE bill_history ADD COLUMN IF NOT EXISTS electric_rate_per_kwh DECIMAL(10,2) DEFAULT 11.00;

-- Add comment to explain the column
COMMENT ON COLUMN bill_history.electric_rate_per_kwh IS 'Electricity rate per kWh used in the original bill calculation';

-- Update existing records to have the default rate of 11.00 if they don't have a value
UPDATE bill_history 
SET electric_rate_per_kwh = 11.00 
WHERE electric_rate_per_kwh IS NULL; 