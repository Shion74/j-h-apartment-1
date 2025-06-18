import { pool } from '../lib/database.js';

class Branch {
  // Get all branches
  static async findAll() {
    try {
      const result = await pool.query(`
        SELECT b.*, 
               COUNT(r.id) as room_count,
               COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
               COUNT(CASE WHEN r.status = 'vacant' THEN 1 END) as vacant_rooms,
               COUNT(CASE WHEN r.status = 'maintenance' THEN 1 END) as maintenance_rooms,
               SUM(r.monthly_rent) as total_rent,
               SUM(CASE WHEN r.status = 'occupied' THEN r.monthly_rent ELSE 0 END) as occupied_rent
        FROM branches b
        LEFT JOIN rooms r ON b.id = r.branch_id
        GROUP BY b.id
        ORDER BY b.name
      `);
      return result.rows;
    } catch (error) {
      console.error('Error finding all branches:', error);
      throw error;
    }
  }

  // Get branch by ID
  static async findById(id) {
    try {
      const result = await pool.query(`
        SELECT b.*, 
               COUNT(r.id) as room_count,
               COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
               COUNT(CASE WHEN r.status = 'vacant' THEN 1 END) as vacant_rooms,
               COUNT(CASE WHEN r.status = 'maintenance' THEN 1 END) as maintenance_rooms
        FROM branches b
        LEFT JOIN rooms r ON b.id = r.branch_id
        WHERE b.id = $1
        GROUP BY b.id
      `, [id]);
      
      return result.rows.length ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding branch by ID:', error);
      throw error;
    }
  }

  // Get branch with its rooms
  static async findWithRooms(id) {
    try {
      // Get branch info
      const branch = await this.findById(id);
      if (!branch) return null;

      // Get rooms for this branch
      const result = await pool.query(`
        SELECT r.*, t.id as tenant_id, t.name as tenant_name 
        FROM rooms r
        LEFT JOIN tenants t ON r.id = t.room_id
        WHERE r.branch_id = $1
        ORDER BY r.room_number
      `, [id]);

      return {
        ...branch,
        rooms: result.rows
      };
    } catch (error) {
      console.error('Error finding branch with rooms:', error);
      throw error;
    }
  }

  // Create a new branch
  static async create(branchData) {
    const { 
      name, 
      description, 
      address, 
      monthly_rent = 3500.00, 
      water_rate = 200.00, 
      electricity_rate = 12.00 
    } = branchData;
    
    try {
      const result = await pool.query(
        'INSERT INTO branches (name, description, address, monthly_rent, water_rate, electricity_rate) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [name, description || null, address || null, monthly_rent, water_rate, electricity_rate]
      );
      
      return {
        id: result.rows[0].id,
        ...branchData,
        monthly_rent,
        water_rate,
        electricity_rate
      };
    } catch (error) {
      console.error('Error creating new branch:', error);
      throw error;
    }
  }

  // Update branch
  static async update(id, branchData) {
    const { name, description, address, monthly_rent, water_rate, electricity_rate } = branchData;
    
    try {
      await pool.query(
        'UPDATE branches SET name = $1, description = $2, address = $3, monthly_rent = $4, water_rate = $5, electricity_rate = $6 WHERE id = $7',
        [name, description || null, address || null, monthly_rent, water_rate, electricity_rate, id]
      );
      
      return { id, ...branchData };
    } catch (error) {
      console.error('Error updating branch:', error);
      throw error;
    }
  }

  // Update branch rates only
  static async updateRates(id, rates) {
    const { monthly_rent, water_rate, electricity_rate } = rates;
    
    try {
      await pool.query(
        'UPDATE branches SET monthly_rent = $1, water_rate = $2, electricity_rate = $3 WHERE id = $4',
        [monthly_rent, water_rate, electricity_rate, id]
      );
      
      return { id, ...rates };
    } catch (error) {
      console.error('Error updating branch rates:', error);
      throw error;
    }
  }

  // Update all rooms in branch to use branch's monthly rent
  static async syncRoomRates(id) {
    try {
      await pool.query(`
        UPDATE rooms 
        SET monthly_rent = b.monthly_rent 
        FROM branches b 
        WHERE rooms.branch_id = b.id AND b.id = $1
      `, [id]);
      
      return true;
    } catch (error) {
      console.error('Error syncing room rates:', error);
      throw error;
    }
  }

  // Delete branch
  static async delete(id) {
    try {
      // Check if branch has rooms
      const result = await pool.query('SELECT COUNT(*) as count FROM rooms WHERE branch_id = $1', [id]);
      if (result.rows[0].count > 0) {
        throw new Error('Cannot delete branch with existing rooms');
      }

      await pool.query('DELETE FROM branches WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting branch:', error);
      throw error;
    }
  }

  // Get branch stats
  static async getStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(DISTINCT b.id) as total_branches,
          COUNT(r.id) as total_rooms,
          COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
          COUNT(CASE WHEN r.status = 'vacant' THEN 1 END) as vacant_rooms,
          COUNT(CASE WHEN r.status = 'maintenance' THEN 1 END) as maintenance_rooms,
          SUM(r.monthly_rent) as total_rent,
          SUM(CASE WHEN r.status = 'occupied' THEN r.monthly_rent ELSE 0 END) as occupied_rent
        FROM branches b
        LEFT JOIN rooms r ON b.id = r.branch_id
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting branch stats:', error);
      throw error;
    }
  }
}

export default Branch; 