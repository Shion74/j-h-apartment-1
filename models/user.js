const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

class User {
  // Get user by username
  static async findByUsername(username) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  // Get user by id
  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT id, username, role FROM users WHERE id = ?',
        [id]
      );
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding user by id:', error);
      throw error;
    }
  }

  // Create a new user
  static async create(userData) {
    const { username, password, role = 'manager' } = userData;
    
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insert new user
      const [result] = await pool.execute(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, role]
      );
      
      return {
        id: result.insertId,
        username,
        role
      };
    } catch (error) {
      console.error('Error creating new user:', error);
      throw error;
    }
  }

  // Authenticate user
  static async authenticate(username, password) {
    try {
      // Find user by username
      const user = await this.findByUsername(username);
      if (!user) {
        return { success: false, message: 'Invalid username or password' };
      }
      
      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return { success: false, message: 'Invalid username or password' };
      }
      
      // Create JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.SESSION_SECRET || 'j&h-apartment-secret-key',
        { expiresIn: '24h' }
      );
      
      // Return user info and token
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        },
        token
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      throw error;
    }
  }

  // Get all users
  static async findAll() {
    try {
      const [rows] = await pool.execute(
        'SELECT id, username, role, created_at FROM users'
      );
      return rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }
}

module.exports = User; 