-- Migration 028: Add payment date preference settings for historical data entry
-- This allows admins to choose between using system date vs actual payment date

-- Add setting to control payment date behavior
INSERT INTO settings (setting_key, setting_value, category, description) 
VALUES 
  ('use_actual_payment_date_for_reports', 'true', 'payment', 'Use actual payment date instead of system date for all reports and calculations')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Add setting for payment entry mode  
INSERT INTO settings (setting_key, setting_value, category, description)
VALUES 
  ('payment_entry_mode', 'historical', 'payment', 'Mode for payment entry: "current" uses today''s date, "historical" allows custom dates')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Comment explaining the two-date system
-- payment_date: Date when payment was processed in system
-- actual_payment_date: Date when tenant actually made the payment (can be historical) 