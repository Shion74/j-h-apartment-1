const { pool } = require('../config/database');

class Payment {
  // Get all payments with bill and tenant info
  static async findAll() {
    try {
      const [rows] = await pool.execute(`
        SELECT p.*, b.tenant_id, b.total_amount as bill_amount, b.rent_to as due_date, b.status as bill_status,
               t.name as tenant_name, r.room_number
        FROM payments p
        JOIN bills b ON p.bill_id = b.id
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        ORDER BY p.payment_date DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error finding all payments:', error);
      throw error;
    }
  }

  // Get payment by ID
  static async findById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT p.*, b.tenant_id, b.total_amount as bill_amount, b.rent_to as due_date, 
               CONCAT('Monthly Bill (', DATE_FORMAT(b.rent_from, '%b %d'), ' - ', DATE_FORMAT(b.rent_to, '%b %d, %Y'), ')') as description,
               t.name as tenant_name, r.room_number
        FROM payments p
        JOIN bills b ON p.bill_id = b.id
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        WHERE p.id = ?
      `, [id]);
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding payment by ID:', error);
      throw error;
    }
  }

  // Get payments by bill ID
  static async findByBillId(billId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM payments WHERE bill_id = ? ORDER BY payment_date DESC',
        [billId]
      );
      return rows;
    } catch (error) {
      console.error('Error finding payments by bill ID:', error);
      throw error;
    }
  }

  // Get payments by tenant ID
  static async findByTenantId(tenantId) {
    try {
      const [rows] = await pool.execute(`
        SELECT p.*, b.total_amount as bill_amount, 
               CONCAT('Monthly Bill (', DATE_FORMAT(b.rent_from, '%b %d'), ' - ', DATE_FORMAT(b.rent_to, '%b %d, %Y'), ')') as description, 
               r.room_number
        FROM payments p
        JOIN bills b ON p.bill_id = b.id
        JOIN rooms r ON b.room_id = r.id
        WHERE b.tenant_id = ?
        ORDER BY p.payment_date DESC
      `, [tenantId]);
      
      return rows;
    } catch (error) {
      console.error('Error finding payments by tenant ID:', error);
      throw error;
    }
  }

  // Create a new payment with deadlock retry
  static async create(paymentData, retryCount = 0) {
    const { bill_id, amount, payment_date, payment_method, notes = '' } = paymentData;
    const maxRetries = 3;
    
    try {
      // Start a transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // Insert payment
        const [result] = await connection.execute(
          'INSERT INTO payments (bill_id, amount, payment_date, payment_method, notes) VALUES (?, ?, ?, ?, ?)',
          [bill_id, amount, payment_date, payment_method, notes]
        );
        
        // Get bill info
        const [bills] = await connection.execute(
          'SELECT * FROM bills WHERE id = ?',
          [bill_id]
        );
        
        if (!bills.length) {
          throw new Error('Bill not found');
        }
        
        const bill = bills[0];
        
        // Get total paid amount for this bill
        const [payments] = await connection.execute(
          'SELECT SUM(amount) as total_paid FROM payments WHERE bill_id = ?',
          [bill_id]
        );
        
        const totalPaid = Number(payments[0].total_paid || 0);
        
        // Update bill status based on payment
        let newStatus;
        if (totalPaid >= bill.total_amount) {
          newStatus = 'paid';
        } else if (totalPaid > 0) {
          newStatus = 'partial';
        } else {
          newStatus = 'unpaid';
        }
        
        // Update bill status
        await connection.execute(
          'UPDATE bills SET status = ? WHERE id = ?',
          [newStatus, bill_id]
        );
        
        // If bill is fully paid, archive it by adding archive timestamp
        if (newStatus === 'paid') {
          await connection.execute(
            'UPDATE bills SET notes = CONCAT(COALESCE(notes, ""), "\n[ARCHIVED: ", NOW(), "] - Bill fully paid and archived to history") WHERE id = ?',
            [bill_id]
          );
        }
        
        await connection.commit();
        
        return {
          id: result.insertId,
          ...paymentData,
          bill_status: newStatus
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      // Handle deadlock with retry
      if (error.code === 'ER_LOCK_DEADLOCK' && retryCount < maxRetries) {
        console.log(`Deadlock detected, retrying payment creation (attempt ${retryCount + 1}/${maxRetries + 1})`);
        // Wait a random amount of time between 100-500ms before retrying
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
        return this.create(paymentData, retryCount + 1);
      }
      
      console.error('Error creating new payment:', error);
      throw error;
    }
  }

  // Update payment
  static async update(id, paymentData) {
    const { amount, payment_date, payment_method, notes } = paymentData;
    
    try {
      // Start a transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // Get payment info to get bill_id
        const [payments] = await connection.execute(
          'SELECT bill_id FROM payments WHERE id = ?',
          [id]
        );
        
        if (!payments.length) {
          throw new Error('Payment not found');
        }
        
        const bill_id = payments[0].bill_id;
        
        // Update payment
        await connection.execute(
          'UPDATE payments SET amount = ?, payment_date = ?, payment_method = ?, notes = ? WHERE id = ?',
          [amount, payment_date, payment_method, notes, id]
        );
        
        // Get bill info
        const [bills] = await connection.execute(
          'SELECT * FROM bills WHERE id = ?',
          [bill_id]
        );
        
        if (!bills.length) {
          throw new Error('Bill not found');
        }
        
        const bill = bills[0];
        
        // Get total paid amount for this bill
        const [totalPayments] = await connection.execute(
          'SELECT SUM(amount) as total_paid FROM payments WHERE bill_id = ?',
          [bill_id]
        );
        
        const totalPaid = Number(totalPayments[0].total_paid || 0);
        
        // Update bill status based on payment
        let newStatus;
        if (totalPaid >= bill.total_amount) {
          newStatus = 'paid';
        } else if (totalPaid > 0) {
          newStatus = 'partial';
        } else {
          newStatus = 'unpaid';
        }
        
        // Update bill status
        await connection.execute(
          'UPDATE bills SET status = ? WHERE id = ?',
          [newStatus, bill_id]
        );
        
        await connection.commit();
        
        return {
          id,
          ...paymentData,
          bill_id,
          bill_status: newStatus
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  }

  // Delete payment
  static async delete(id) {
    try {
      // Start a transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // Get payment info to get bill_id
        const [payments] = await connection.execute(
          'SELECT bill_id FROM payments WHERE id = ?',
          [id]
        );
        
        if (!payments.length) {
          throw new Error('Payment not found');
        }
        
        const bill_id = payments[0].bill_id;
        
        // Delete payment
        await connection.execute('DELETE FROM payments WHERE id = ?', [id]);
        
        // Get bill info
        const [bills] = await connection.execute(
          'SELECT * FROM bills WHERE id = ?',
          [bill_id]
        );
        
        if (!bills.length) {
          throw new Error('Bill not found');
        }
        
        const bill = bills[0];
        
        // Get total paid amount for this bill after deletion
        const [totalPayments] = await connection.execute(
          'SELECT SUM(amount) as total_paid FROM payments WHERE bill_id = ?',
          [bill_id]
        );
        
        const totalPaid = Number(totalPayments[0].total_paid || 0);
        
        // Update bill status based on payment
        let newStatus;
        if (totalPaid >= bill.total_amount) {
          newStatus = 'paid';
        } else if (totalPaid > 0) {
          newStatus = 'partial';
        } else {
          newStatus = 'unpaid';
        }
        
        // Update bill status
        await connection.execute(
          'UPDATE bills SET status = ? WHERE id = ?',
          [newStatus, bill_id]
        );
        
        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      throw error;
    }
  }

  // Get payment stats
  static async getStats() {
    try {
      // Get total payments
      const [totalResults] = await pool.execute(`
        SELECT SUM(amount) as total_collected
        FROM payments
      `);
      
      // Get monthly payments
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const [monthlyResults] = await pool.execute(`
        SELECT SUM(amount) as monthly_collected
        FROM payments
        WHERE MONTH(payment_date) = ? AND YEAR(payment_date) = ?
      `, [currentMonth, currentYear]);
      
      // Get yearly payments
      const [yearlyResults] = await pool.execute(`
        SELECT SUM(amount) as yearly_collected
        FROM payments
        WHERE YEAR(payment_date) = ?
      `, [currentYear]);
      
      return {
        total_collected: totalResults[0].total_collected || 0,
        monthly_collected: monthlyResults[0].monthly_collected || 0,
        yearly_collected: yearlyResults[0].yearly_collected || 0
      };
    } catch (error) {
      console.error('Error getting payment stats:', error);
      throw error;
    }
  }
}

module.exports = Payment; 