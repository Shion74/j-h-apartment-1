const { pool } = require('../lib/database.js');

async function checkAndPopulateSettings() {
  try {
    // Check if settings table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'settings'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating settings table...');
      await pool.query(`
        CREATE TABLE settings (
          id SERIAL PRIMARY KEY,
          setting_key VARCHAR(255) UNIQUE NOT NULL,
          setting_value TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    // Check existing settings
    const existing = await pool.query('SELECT * FROM settings');
    console.log('Existing settings:', existing.rows);
    
    // Add default billing rates if they don't exist
    const defaultSettings = [
      { key: 'electric_rate_per_kwh', value: '12.00', description: 'Electric rate per kWh' },
      { key: 'water_fixed_amount', value: '200.00', description: 'Fixed water amount per month' },
      { key: 'default_room_rate', value: '3500.00', description: 'Default room rate per month' }
    ];
    
    for (const setting of defaultSettings) {
      const existingRow = existing.rows.find(row => row.setting_key === setting.key);
      if (!existingRow) {
        console.log(`Adding setting: ${setting.key} = ${setting.value}`);
        await pool.query(`
          INSERT INTO settings (setting_key, setting_value, description) 
          VALUES ($1, $2, $3)
        `, [setting.key, setting.value, setting.description]);
      } else {
        console.log(`Setting exists: ${setting.key} = ${existingRow.setting_value}`);
      }
    }
    
    // Show final settings
    const final = await pool.query('SELECT * FROM settings ORDER BY setting_key');
    console.log('Final settings:', final.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAndPopulateSettings(); 