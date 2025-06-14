const { pool } = require('../config/database');

class Room {
  // Get all rooms
  static async findAll() {
    try {
      const [rows] = await pool.execute(`
        SELECT r.*, b.name as branch_name, t.id as tenant_id, t.name as tenant_name 
        FROM rooms r
        LEFT JOIN branches b ON r.branch_id = b.id
        LEFT JOIN tenants t ON r.id = t.room_id
        ORDER BY b.name, r.room_number
      `);
      return rows;
    } catch (error) {
      console.error('Error finding all rooms:', error);
      throw error;
    }
  }

  // Get rooms by branch
  static async findByBranch(branchId) {
    try {
      const [rows] = await pool.execute(`
        SELECT r.*, b.name as branch_name, t.id as tenant_id, t.name as tenant_name 
        FROM rooms r
        LEFT JOIN branches b ON r.branch_id = b.id
        LEFT JOIN tenants t ON r.id = t.room_id
        WHERE r.branch_id = ?
        ORDER BY r.room_number
      `, [branchId]);
      return rows;
    } catch (error) {
      console.error('Error finding rooms by branch:', error);
      throw error;
    }
  }

  // Get room by ID
  static async findById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT r.*, b.name as branch_name, t.id as tenant_id, t.name as tenant_name, t.mobile, t.email
        FROM rooms r
        LEFT JOIN branches b ON r.branch_id = b.id
        LEFT JOIN tenants t ON r.id = t.room_id
        WHERE r.id = ?
      `, [id]);
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding room by ID:', error);
      throw error;
    }
  }

  // Get vacant rooms
  static async findVacant() {
    try {
      const [rows] = await pool.execute(`
        SELECT r.*, b.name as branch_name
        FROM rooms r
        LEFT JOIN branches b ON r.branch_id = b.id
        WHERE r.status = "vacant" 
        ORDER BY b.name, r.room_number
      `);
      return rows;
    } catch (error) {
      console.error('Error finding vacant rooms:', error);
      throw error;
    }
  }

  // Create a new room
  static async create(roomData) {
    const { room_number, branch_id, monthly_rent, status = 'vacant' } = roomData;
    
    try {
      const [result] = await pool.execute(
        'INSERT INTO rooms (room_number, branch_id, monthly_rent, status) VALUES (?, ?, ?, ?)',
        [room_number, branch_id, monthly_rent, status]
      );
      
      return {
        id: result.insertId,
        ...roomData
      };
    } catch (error) {
      console.error('Error creating new room:', error);
      throw error;
    }
  }

  // Update room
  static async update(id, roomData) {
    const { room_number, branch_id, monthly_rent, status } = roomData;
    
    try {
      await pool.execute(
        'UPDATE rooms SET room_number = ?, branch_id = ?, monthly_rent = ?, status = ? WHERE id = ?',
        [room_number, branch_id, monthly_rent, status, id]
      );
      
      return { id, ...roomData };
    } catch (error) {
      console.error('Error updating room:', error);
      throw error;
    }
  }

  // Delete room
  static async delete(id) {
    try {
      await pool.execute('DELETE FROM rooms WHERE id = ?', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error;
    }
  }

  // Get room stats
  static async getStats() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
          SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant,
          SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
          SUM(monthly_rent) as total_rent,
          SUM(CASE WHEN status = 'occupied' THEN monthly_rent ELSE 0 END) as occupied_rent
        FROM rooms
      `);
      
      return rows[0];
    } catch (error) {
      console.error('Error getting room stats:', error);
      throw error;
    }
  }

  // Bulk update monthly rent
  static async bulkUpdateRent(monthlyRent, branchId = null) {
    try {
      let query = 'UPDATE rooms SET monthly_rent = ?';
      let params = [monthlyRent];
      
      if (branchId) {
        query += ' WHERE branch_id = ?';
        params.push(branchId);
      }
      
      const [result] = await pool.execute(query, params);
      
      return result;
    } catch (error) {
      console.error('Error bulk updating room rent:', error);
      throw error;
    }
  }
}

module.exports = Room; 