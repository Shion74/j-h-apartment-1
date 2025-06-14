const { pool } = require('../config/database');

class Setting {
  // Get all settings
  static async findAll() {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM settings ORDER BY setting_key'
      );
      return rows;
    } catch (error) {
      console.error('Error finding all settings:', error);
      throw error;
    }
  }

  // Get setting by key
  static async findByKey(key) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM settings WHERE setting_key = ?',
        [key]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding setting by key:', error);
      throw error;
    }
  }

  // Get setting value by key
  static async getValue(key) {
    try {
      const setting = await this.findByKey(key);
      return setting ? parseFloat(setting.setting_value) : null;
    } catch (error) {
      console.error('Error getting setting value:', error);
      throw error;
    }
  }

  // Update setting value (create if doesn't exist)
  static async updateValue(key, value, description = null) {
    try {
      // Use INSERT ... ON DUPLICATE KEY UPDATE for upsert functionality
      const [result] = await pool.execute(`
        INSERT INTO settings (setting_key, setting_value, description) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        setting_value = VALUES(setting_value),
        description = COALESCE(VALUES(description), description)
      `, [key, value, description]);
      
      return true; // Always return true since upsert always succeeds
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  }

  // Create new setting
  static async create(key, value, description = null) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
        [key, value, description]
      );
      
      return {
        id: result.insertId,
        setting_key: key,
        setting_value: value,
        description
      };
    } catch (error) {
      console.error('Error creating setting:', error);
      throw error;
    }
  }

  // Get current rates for billing
  static async getBillingRates() {
    try {
      const electricRate = await this.getValue('electric_rate_per_kwh') || 12.00;
      const waterAmount = await this.getValue('water_fixed_amount') || 200.00;
      const roomRate = await this.getValue('default_room_rate') || 3500.00;
      
      return {
        electric_rate_per_kwh: electricRate,
        water_fixed_amount: waterAmount,
        default_room_rate: roomRate
      };
    } catch (error) {
      console.error('Error getting billing rates:', error);
      throw error;
    }
  }

  // Update multiple billing rates at once
  static async updateBillingRates(rates) {
    try {
      const updates = [];
      
      if (rates.electric_rate_per_kwh !== undefined) {
        updates.push(this.updateValue('electric_rate_per_kwh', rates.electric_rate_per_kwh));
      }
      
      if (rates.water_fixed_amount !== undefined) {
        updates.push(this.updateValue('water_fixed_amount', rates.water_fixed_amount));
      }
      
      if (rates.default_room_rate !== undefined) {
        updates.push(this.updateValue('default_room_rate', rates.default_room_rate));
      }
      
      await Promise.all(updates);
      return true;
    } catch (error) {
      console.error('Error updating billing rates:', error);
      throw error;
    }
  }
}

module.exports = Setting; 