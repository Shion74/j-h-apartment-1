import { pool } from '../lib/database.js';
import Setting from './setting.js';

class Bill {
  // Get all bills with tenant and room details
  static async findAll() {
    try {
      const result = await pool.query(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        ORDER BY b.bill_date DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Error finding all bills:', error);
      throw error;
    }
  }

  // Get unpaid bills
  static async findUnpaid() {
    try {
      const result = await pool.query(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.status = 'unpaid' OR b.status = 'partial'
        ORDER BY b.bill_date
      `);
      return result.rows;
    } catch (error) {
      console.error('Error finding unpaid bills:', error);
      throw error;
    }
  }

  // Get active bills (unpaid/partial)
  static async findActive() {
    try {
      const result = await pool.query(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.status IN ('unpaid', 'partial')
        ORDER BY b.bill_date DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Error finding active bills:', error);
      throw error;
    }
  }

  // Get paid bills (archived)
  static async findPaid() {
    try {
      const result = await pool.query(`
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
      return result.rows;
    } catch (error) {
      console.error('Error finding paid bills:', error);
      throw error;
    }
  }

  // Get bills by tenant ID
  static async findByTenantId(tenantId) {
    try {
      const result = await pool.query(`
        SELECT b.*, r.room_number, br.name as branch_name,
          (SELECT SUM(amount) FROM payments WHERE bill_id = b.id) as paid_amount
        FROM bills b
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.tenant_id = $1
        ORDER BY b.bill_date DESC
      `, [tenantId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error finding bills by tenant ID:', error);
      throw error;
    }
  }

  // Get bill by ID with payments
  static async findById(id) {
    try {
      const result = await pool.query(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.id = $1
      `, [id]);
      
      if (!result.rows.length) {
        return null;
      }
      
      const bill = result.rows[0];
      
      // Get payments for this bill
      const paymentsResult = await pool.query(
        'SELECT * FROM payments WHERE bill_id = $1 ORDER BY payment_date DESC',
        [id]
      );
      
      bill.payments = paymentsResult.rows;
      bill.paid_amount = paymentsResult.rows.reduce((sum, payment) => sum + Number(payment.amount), 0);
      
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
      
      const result = await pool.query(`
        INSERT INTO bills (
          tenant_id, room_id, bill_date, rent_from, rent_to, rent_amount,
          electric_present_reading, electric_previous_reading, electric_consumption, 
          electric_rate_per_kwh, electric_amount, electric_reading_date, electric_previous_date,
          water_amount, extra_fee_amount, extra_fee_description, total_amount, status, notes, prepared_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id
      `, sqlParams);
      
      return {
        id: result.rows[0].id,
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
      
      await pool.query(`
        UPDATE bills SET 
          bill_date = $1, rent_from = $2, rent_to = $3, rent_amount = $4,
          electric_present_reading = $5, electric_previous_reading = $6, electric_consumption = $7, 
          electric_rate_per_kwh = $8, electric_amount = $9, electric_reading_date = $10, electric_previous_date = $11,
          water_amount = $12, total_amount = $13, status = $14, notes = $15, prepared_by = $16
        WHERE id = $17
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
      await pool.query('DELETE FROM bills WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting bill:', error);
      throw error;
    }
  }

  // Update bill status
  static async updateStatus(id, status) {
    try {
      await pool.query(
        'UPDATE bills SET status = $1 WHERE id = $2',
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

  // Get bill statistics
  static async getStats() {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) as total_bills,
          SUM(total_amount) as total_amount,
          SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN status = 'unpaid' THEN total_amount ELSE 0 END) as unpaid_amount,
          SUM(CASE WHEN status = 'partial' THEN total_amount ELSE 0 END) as partial_amount,
          AVG(total_amount) as average_bill_amount,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_bills,
          COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_bills,
          COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_bills
        FROM bills
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting bill statistics:', error);
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
      const result = await pool.query(`
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
        AND EXTRACT(DAY FROM (b.rent_to - CURRENT_DATE)) <= 3
        AND EXTRACT(DAY FROM (b.rent_to - CURRENT_DATE)) >= 0
        ORDER BY b.rent_to ASC
      `);
      
      return result.rows;
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
      const rates = await Setting.getBillingRates();
      const electricAmount = consumption * rates.electric_rate_per_kwh;
      
      // Calculate new total
      const newTotal = parseFloat(bill.rent_amount) + electricAmount + parseFloat(bill.water_amount);

      // Update bill
      const result = await pool.query(`
        UPDATE bills SET 
          electric_present_reading = $1,
          electric_consumption = $2,
          electric_amount = $3,
          electric_reading_date = $4,
          total_amount = $5,
          notes = COALESCE(notes, '') || ' | Electric reading updated: ' || $6 || ' kWh on ' || $7
        WHERE id = $8
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
      const result = await pool.query(`
        UPDATE bills SET 
          notes = COALESCE(notes, '') || ' | Bill finalized and ready to send',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [billId]);

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error marking bill as ready to send:', error);
      throw error;
    }
  }

  // Get tenants needing bill creation reminders (3 days before billing cycle ends)
  static async getBillsNeedingReminders() {
    try {
      const result = await pool.query(`
        SELECT 
          t.id as tenant_id,
          t.name as tenant_name,
          t.email as tenant_email,
          t.rent_start,
          r.id as room_id,
          r.room_number,
          r.monthly_rent,
          br.name as branch_name,
          br.address as branch_address,
          -- Calculate next billing period end date
          CASE 
            WHEN t.rent_start IS NOT NULL THEN
              CASE 
                -- For first bill: one month from rent_start, same day of month
                WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                  (t.rent_start + INTERVAL '1 month') - INTERVAL '1 day'
                -- For subsequent bills: one month from last bill end date
                ELSE 
                  ((SELECT rent_to FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1) + INTERVAL '1 day' + INTERVAL '1 month') - INTERVAL '1 day'
              END
            ELSE DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
          END as next_bill_due_date,
          -- Calculate days until billing cycle ends
          CASE 
            WHEN t.rent_start IS NOT NULL THEN
              CASE 
                WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                  EXTRACT(DAY FROM ((t.rent_start + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE)
                ELSE 
                  EXTRACT(DAY FROM (((SELECT rent_to FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1) + INTERVAL '1 day' + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE)
              END
            ELSE NULL
          END as days_until_due,
          -- Check if tenant already has an unpaid bill
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM bills b2 
              WHERE b2.tenant_id = t.id 
              AND b2.status IN ('unpaid', 'partial')
            ) THEN 'already_has_unpaid_bill'
            ELSE 'needs_billing'
          END as billing_status,
          -- Get last electric reading
          COALESCE(
            (SELECT electric_present_reading 
             FROM bills 
             WHERE tenant_id = t.id 
             ORDER BY bill_date DESC 
             LIMIT 1), 
            t.initial_electric_reading,
            0
          ) as last_electric_reading
        FROM tenants t
        INNER JOIN rooms r ON t.room_id = r.id
        INNER JOIN branches br ON r.branch_id = br.id
        WHERE t.contract_status = 'active'
        AND t.rent_start IS NOT NULL
        -- Only tenants who don't already have unpaid bills
        AND NOT EXISTS (
          SELECT 1 FROM bills b2 
          WHERE b2.tenant_id = t.id 
          AND b2.status IN ('unpaid', 'partial')
        )
        -- Only tenants whose billing cycle is ending in 3 days or less (but not overdue)
        AND CASE 
          WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
            EXTRACT(DAY FROM ((t.rent_start + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE) <= 3
            AND EXTRACT(DAY FROM ((t.rent_start + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE) >= 0
          ELSE 
            EXTRACT(DAY FROM (((SELECT rent_to FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1) + INTERVAL '1 day' + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE) <= 3
            AND EXTRACT(DAY FROM (((SELECT rent_to FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1) + INTERVAL '1 day' + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE) >= 0
        END
        ORDER BY br.name, r.room_number
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Error finding tenants needing bill creation reminders:', error);
      throw error;
    }
  }
}

export default Bill; 