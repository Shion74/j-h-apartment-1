const { pool } = require('../config/database');
const Setting = require('./setting');

class Bill {
  // Get all bills with tenant and room details
  static async findAll() {
    try {
      const [rows] = await pool.execute(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        ORDER BY b.bill_date DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error finding all bills:', error);
      throw error;
    }
  }

  // Get unpaid bills
  static async findUnpaid() {
    try {
      const [rows] = await pool.execute(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.status = 'unpaid' OR b.status = 'partial'
        ORDER BY b.bill_date
      `);
      return rows;
    } catch (error) {
      console.error('Error finding unpaid bills:', error);
      throw error;
    }
  }

  // Get active bills (unpaid/partial)
  static async findActive() {
    try {
      const [rows] = await pool.execute(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.status IN ('unpaid', 'partial')
        ORDER BY b.bill_date DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error finding active bills:', error);
      throw error;
    }
  }

  // Get paid bills (archived)
  static async findPaid() {
    try {
      const [rows] = await pool.execute(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name,
               p.payment_date as paid_date
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        LEFT JOIN (
          SELECT bill_id, MAX(payment_date) as payment_date
          FROM payments
          GROUP BY bill_id
        ) p ON b.id = p.bill_id
        WHERE b.status = 'paid'
        ORDER BY b.bill_date DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error finding paid bills:', error);
      throw error;
    }
  }

  // Get bills by tenant ID
  static async findByTenantId(tenantId) {
    try {
      const [rows] = await pool.execute(`
        SELECT b.*, r.room_number, br.name as branch_name,
          (SELECT SUM(amount) FROM payments WHERE bill_id = b.id) as paid_amount
        FROM bills b
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.tenant_id = ?
        ORDER BY b.bill_date DESC
      `, [tenantId]);
      
      return rows;
    } catch (error) {
      console.error('Error finding bills by tenant ID:', error);
      throw error;
    }
  }

  // Get bill by ID with payments
  static async findById(id) {
    try {
      const [bills] = await pool.execute(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.id = ?
      `, [id]);
      
      if (!bills.length) {
        return null;
      }
      
      const bill = bills[0];
      
      // Get payments for this bill
      const [payments] = await pool.execute(
        'SELECT * FROM payments WHERE bill_id = ? ORDER BY payment_date DESC',
        [id]
      );
      
      bill.payments = payments;
      bill.paid_amount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      
      return bill;
    } catch (error) {
      console.error('Error finding bill by ID:', error);
      throw error;
    }
  }

  // Create a new comprehensive bill
  static async create(billData) {
    const { 
      tenant_id, 
      room_id, 
      bill_date,
      rent_from,
      rent_to,
      rent_amount,
      electric_present_reading = 0,
      electric_previous_reading = 0,
      electric_consumption = 0,
      electric_amount = 0,
      electric_reading_date,
      electric_previous_date,
      water_amount,
      extra_fee_amount = 0,
      extra_fee_description = null,
      total_amount,
      status = 'unpaid',
      notes,
      prepared_by
    } = billData;
    
    try {
      // Get current rates from settings
      const rates = await Setting.getBillingRates();
      const finalElectricRate = billData.electric_rate_per_kwh || rates.electric_rate_per_kwh;
      const finalWaterAmount = water_amount || rates.water_fixed_amount;
      
      // Convert undefined values to null for SQL compatibility
      const sqlParams = [
        tenant_id ?? null,
        room_id ?? null,
        bill_date ?? null,
        rent_from ?? null,
        rent_to ?? null,
        rent_amount ?? null,
        electric_present_reading ?? 0,
        electric_previous_reading ?? 0,
        electric_consumption ?? 0,
        finalElectricRate ?? null,
        electric_amount ?? 0,
        electric_reading_date ?? null,
        electric_previous_date ?? null,
        finalWaterAmount ?? null,
        extra_fee_amount ?? 0,
        extra_fee_description ?? null,
        total_amount ?? null,
        status ?? 'unpaid',
        notes ?? null,
        prepared_by ?? null
      ];
      
      const [result] = await pool.execute(`
        INSERT INTO bills (
          tenant_id, room_id, bill_date, rent_from, rent_to, rent_amount,
          electric_present_reading, electric_previous_reading, electric_consumption, 
          electric_rate_per_kwh, electric_amount, electric_reading_date, electric_previous_date,
          water_amount, extra_fee_amount, extra_fee_description, total_amount, status, notes, prepared_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, sqlParams);
      
      return {
        id: result.insertId,
        ...billData,
        electric_rate_per_kwh: finalElectricRate,
        water_amount: finalWaterAmount
      };
    } catch (error) {
      console.error('Error creating new bill:', error);
      throw error;
    }
  }

  // Update bill
  static async update(id, billData) {
    const { 
      bill_date,
      rent_from,
      rent_to,
      rent_amount,
      electric_present_reading,
      electric_previous_reading,
      electric_consumption,
      electric_rate_per_kwh,
      electric_amount,
      electric_reading_date,
      electric_previous_date,
      water_amount,
      total_amount,
      status,
      notes,
      prepared_by
    } = billData;
    
    try {
      // Convert undefined values to null for SQL compatibility
      const sqlParams = [
        bill_date ?? null,
        rent_from ?? null,
        rent_to ?? null,
        rent_amount ?? null,
        electric_present_reading ?? null,
        electric_previous_reading ?? null,
        electric_consumption ?? null,
        electric_rate_per_kwh ?? null,
        electric_amount ?? null,
        electric_reading_date ?? null,
        electric_previous_date ?? null,
        water_amount ?? null,
        total_amount ?? null,
        status ?? null,
        notes ?? null,
        prepared_by ?? null,
        id
      ];
      
      await pool.execute(`
        UPDATE bills SET 
          bill_date = ?, rent_from = ?, rent_to = ?, rent_amount = ?,
          electric_present_reading = ?, electric_previous_reading = ?, electric_consumption = ?, 
          electric_rate_per_kwh = ?, electric_amount = ?, electric_reading_date = ?, electric_previous_date = ?,
          water_amount = ?, total_amount = ?, status = ?, notes = ?, prepared_by = ?
        WHERE id = ?
      `, sqlParams);
      
      return { id, ...billData };
    } catch (error) {
      console.error('Error updating bill:', error);
      throw error;
    }
  }

  // Delete bill
  static async delete(id) {
    try {
      await pool.execute('DELETE FROM bills WHERE id = ?', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting bill:', error);
      throw error;
    }
  }

  // Update bill status
  static async updateStatus(id, status) {
    try {
      await pool.execute(
        'UPDATE bills SET status = ? WHERE id = ?',
        [status, id]
      );
      return true;
    } catch (error) {
      console.error('Error updating bill status:', error);
      throw error;
    }
  }



  // Calculate consumption and amounts based on readings and current rates
  static async calculateUtilityAmounts(presentReading, previousReading) {
    try {
      const rates = await Setting.getBillingRates();
      const consumption = Math.max(0, presentReading - previousReading);
      const electricAmount = consumption * rates.electric_rate_per_kwh;
      
      return { 
        consumption, 
        electricAmount,
        waterAmount: rates.water_fixed_amount,
        electricRate: rates.electric_rate_per_kwh
      };
    } catch (error) {
      console.error('Error calculating utility amounts:', error);
      throw error;
    }
  }

  // Get billing stats
  static async getStats() {
    try {
      const [rows] = await pool.execute(`
        SELECT
          COUNT(*) as total_bills,
          SUM(total_amount) as total_amount,
          SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN (status = 'unpaid' OR status = 'partial') THEN total_amount ELSE 0 END) as unpaid_amount,
          COUNT(CASE WHEN status = 'unpaid' OR status = 'partial' THEN 1 END) as unpaid_bills,
          SUM(rent_amount) as total_rent,
          SUM(electric_amount) as total_electric,
          SUM(water_amount) as total_water
        FROM bills
      `);
      
      return rows[0];
    } catch (error) {
      console.error('Error getting billing stats:', error);
      throw error;
    }
  }

  // AUTOMATIC BILLING METHODS - DISABLED
  // Note: Automatic billing has been disabled. Bills must be created manually.
  
  /*
  // Get bills that need next cycle generation (current period ended)
  static async getBillsNeedingNextCycle() {
    // DISABLED - Automatic billing cycles removed
    return [];
  }

  // Generate next billing cycle
  static async generateNextCycle(tenantId, roomId, lastBillEndDate, previousElectricReading, monthlyRent) {
    // DISABLED - Automatic billing cycles removed
    throw new Error('Automatic billing cycles have been disabled. Please create bills manually.');
  }

  // Process all automatic billing cycles
  static async processAutomaticCycles() {
    // DISABLED - Automatic billing cycles removed
    return [];
        }
  */

  // Get bills needing electricity reading update (3 days before cycle ends)
  static async getBillsNeedingElectricUpdate() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          b.*,
          t.name as tenant_name,
          t.email as tenant_email,
          r.room_number,
          r.monthly_rent,
          br.name as branch_name,
          br.address as branch_address
        FROM bills b
        INNER JOIN tenants t ON b.tenant_id = t.id
        INNER JOIN rooms r ON b.room_id = r.id
        INNER JOIN branches br ON r.branch_id = br.id
        WHERE b.status = 'unpaid'
        AND b.electric_consumption = 0
        AND DATEDIFF(b.rent_to, CURDATE()) <= 3
        AND DATEDIFF(b.rent_to, CURDATE()) >= 0
        ORDER BY b.rent_to ASC
      `);
      
      return rows;
    } catch (error) {
      console.error('Error finding bills needing electric update:', error);
      throw error;
    }
  }

  // Update electricity reading and auto-calculate amounts
  static async updateElectricReading(billId, presentReading, readingDate) {
    try {
      // Get current bill
      const bill = await this.findById(billId);
      if (!bill) {
        throw new Error('Bill not found');
      }

      const previousReading = parseFloat(bill.electric_previous_reading) || 0;
      const currentReading = parseFloat(presentReading) || 0;
      
      // Calculate consumption
      const consumption = Math.max(0, currentReading - previousReading);
      
      // Get current electric rate
      const Setting = require('./setting');
      const rates = await Setting.getBillingRates();
      const electricAmount = consumption * rates.electric_rate_per_kwh;
      
      // Calculate new total
      const newTotal = parseFloat(bill.rent_amount) + electricAmount + parseFloat(bill.water_amount);

      // Update bill
      const [result] = await pool.execute(`
        UPDATE bills SET 
          electric_present_reading = ?,
          electric_consumption = ?,
          electric_amount = ?,
          electric_reading_date = ?,
          total_amount = ?,
          notes = CONCAT(COALESCE(notes, ''), ' | Electric reading updated: ', ?, ' kWh on ', ?)
        WHERE id = ?
      `, [
        currentReading,
        consumption,
        electricAmount,
        readingDate,
        newTotal,
        currentReading,
        readingDate,
        billId
      ]);

      return {
        success: true,
        previousReading,
        currentReading,
        consumption,
        electricAmount,
        newTotal,
        message: `Electric reading updated: ${consumption} kWh consumed, ₱${electricAmount.toFixed(2)} charged`
      };
    } catch (error) {
      console.error('Error updating electric reading:', error);
      throw error;
    }
  }

  // Mark bill as ready to send (finalized)
  static async markAsReadyToSend(billId) {
    try {
      const [result] = await pool.execute(`
        UPDATE bills SET 
          notes = CONCAT(COALESCE(notes, ''), ' | Bill finalized and ready to send'),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [billId]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error marking bill as ready to send:', error);
      throw error;
    }
  }

  // Get bills needing billing reminders (3 days before due date and overdue)
  static async getBillsNeedingReminders() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          b.*,
          t.name as tenant_name,
          t.email as tenant_email,
          r.room_number,
          r.monthly_rent,
          br.name as branch_name,
          br.address as branch_address,
          COALESCE(SUM(p.amount), 0) as total_paid,
          (b.total_amount - COALESCE(SUM(p.amount), 0)) as remaining_balance,
          DATEDIFF(b.rent_to, CURDATE()) as days_until_due
        FROM bills b
        INNER JOIN tenants t ON b.tenant_id = t.id
        INNER JOIN rooms r ON b.room_id = r.id
        INNER JOIN branches br ON r.branch_id = br.id
        LEFT JOIN payments p ON b.id = p.bill_id
        WHERE b.status IN ('unpaid', 'partial')
        AND DATEDIFF(b.rent_to, CURDATE()) <= 3
        GROUP BY b.id
        ORDER BY b.rent_to ASC, br.name, r.room_number
      `);
      
      return rows;
    } catch (error) {
      console.error('Error finding bills needing reminders:', error);
      throw error;
    }
  }
}

module.exports = Bill; 