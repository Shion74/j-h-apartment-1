const { pool } = require('../config/database');

class Tenant {
  // Get all tenants with their room details
  static async findAll() {
    try {
      const [rows] = await pool.execute(`
        SELECT t.*, r.room_number, r.monthly_rent 
        FROM tenants t
        LEFT JOIN rooms r ON t.room_id = r.id
        ORDER BY t.name
      `);
      return rows;
    } catch (error) {
      console.error('Error finding all tenants:', error);
      throw error;
    }
  }

  // Get tenant by ID with room details
  static async findById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT t.*, r.room_number, r.monthly_rent 
        FROM tenants t
        LEFT JOIN rooms r ON t.room_id = r.id
        WHERE t.id = ?
      `, [id]);
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding tenant by ID:', error);
      throw error;
    }
  }

  // Create a new tenant
  static async create(tenantData) {
    const { 
      name, mobile, email, address, room_id, rent_start, initial_electric_reading,
      advance_payment, security_deposit, advance_payment_status, security_deposit_status
    } = tenantData;
    
    try {
      console.log('🔍 Tenant.create() - Starting with data:', JSON.stringify(tenantData, null, 2));
      
      // Get default deposit amounts from settings
      const Setting = require('./setting');
      const settings = await Setting.getBillingRates();
      
      const defaultAdvance = advance_payment || settings.default_advance_payment || 3500.00;
      const defaultDeposit = security_deposit || settings.default_security_deposit || 3500.00;
      
      // Calculate contract dates
      const contractStart = new Date(rent_start);
      const contractEnd = new Date(contractStart);
      contractEnd.setMonth(contractEnd.getMonth() + 6); // 6 months default
      
      console.log('🔍 Calculated values:', {
        defaultAdvance,
        defaultDeposit,
        contractStart: contractStart.toISOString(),
        contractEnd: contractEnd.toISOString()
      });
      
      // Validate required fields before processing
      if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new Error('Name is required and cannot be empty');
      }
      if (!mobile || typeof mobile !== 'string' || mobile.trim() === '') {
        throw new Error('Mobile is required and cannot be empty');
      }
      if (!rent_start || isNaN(Date.parse(rent_start))) {
        throw new Error('Valid rent start date is required');
      }
      
      // Properly handle empty strings vs undefined/null values
      const sqlParams = [
        name.trim(), // name should not be empty - ensure trimmed
        mobile.trim(), // mobile should not be empty - ensure trimmed  
        email && email.trim() ? email.trim() : null, // preserve empty strings for email but clean up
        address && address.trim() ? address.trim() : null, // preserve empty strings for address but clean up
        room_id === undefined || room_id === '' ? null : parseInt(room_id), // room_id can be null
        rent_start, // rent_start should not be empty
        initial_electric_reading === undefined ? 0 : (parseFloat(initial_electric_reading) || 0),
        defaultAdvance,
        defaultDeposit, 
        advance_payment_status || 'unpaid',
        security_deposit_status || 'unpaid',
        contractStart.toISOString().split('T')[0],
        contractEnd.toISOString().split('T')[0], 
        6,
        'active'
      ];
      
      console.log('🔍 SQL Parameters prepared:', sqlParams.map((param, index) => ({
        index,
        value: param,
        type: typeof param,
        isNull: param === null,
        isUndefined: param === undefined,
        isEmpty: param === '',
        length: typeof param === 'string' ? param.length : 'N/A'
      })));
      
      // Insert new tenant with deposit and contract fields
      console.log('🔍 Executing INSERT query...');
      const [result] = await pool.execute(`
        INSERT INTO tenants (
          name, mobile, email, address, room_id, rent_start, initial_electric_reading,
          advance_payment, security_deposit, advance_payment_status, security_deposit_status,
          contract_start_date, contract_end_date, contract_duration_months, contract_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, sqlParams);
      
      console.log('🔍 INSERT result:', result);
      const insertedId = result.insertId;
      console.log('🔍 Inserted tenant ID:', insertedId);
      
      // Immediate verification - check what was actually inserted
      console.log('🔍 Immediate verification - checking what was inserted...');
      const [immediateCheck] = await pool.execute(
        'SELECT * FROM tenants WHERE id = ?',
        [insertedId]
      );
      
      console.log('🔍 Immediate check result:', immediateCheck[0] ? {
        id: immediateCheck[0].id,
        name: `"${immediateCheck[0].name}"`,
        mobile: `"${immediateCheck[0].mobile}"`,
        email: immediateCheck[0].email,
        name_length: immediateCheck[0].name ? immediateCheck[0].name.length : 'NULL',
        mobile_length: immediateCheck[0].mobile ? immediateCheck[0].mobile.length : 'NULL'
      } : 'NO RECORD FOUND!');
      
      // Update room status to occupied
      if (room_id) {
        console.log('🔍 Updating room status for room_id:', room_id);
        await pool.execute(
          'UPDATE rooms SET status = "occupied" WHERE id = ?',
          [room_id]
        );
      }
      
      // Fetch the complete tenant data with room information
      console.log('🔍 Fetching complete data with JOIN...');
      const [completeData] = await pool.execute(`
        SELECT t.*, r.room_number, r.monthly_rent 
        FROM tenants t
        LEFT JOIN rooms r ON t.room_id = r.id
        WHERE t.id = ?
      `, [insertedId]);
      
      console.log('🔍 Complete data result:', completeData[0] ? {
        id: completeData[0].id,
        name: `"${completeData[0].name}"`,
        mobile: `"${completeData[0].mobile}"`,
        email: completeData[0].email,
        room_number: completeData[0].room_number,
        name_length: completeData[0].name ? completeData[0].name.length : 'NULL',
        mobile_length: completeData[0].mobile ? completeData[0].mobile.length : 'NULL'
      } : 'NO RECORD FOUND IN JOIN!');
      
      const finalResult = completeData[0];
      console.log('🔍 Returning final result:', finalResult);
      
      return finalResult;
    } catch (error) {
      console.error('❌ Error creating new tenant:', error);
      console.error('❌ Stack trace:', error.stack);
      throw error;
    }
  }

  // Update tenant
  static async update(id, tenantData) {
    const { name, mobile, email, address, room_id, rent_start, initial_electric_reading } = tenantData;
    
    try {
      // Get current tenant data to check if room has changed
      const [currentTenant] = await pool.execute(
        'SELECT room_id FROM tenants WHERE id = ?',
        [id]
      );
      
      const oldRoomId = currentTenant[0]?.room_id;
      
      // Handle required vs optional fields separately
      const sqlParams = [
        name || null, // name is required, should not be null
        mobile || null, // mobile is required, should not be null
        email || null, // optional field
        address || null, // optional field
        room_id || null, // optional field
        rent_start || null, // rent_start is required, should not be null
        initial_electric_reading || 0,
        id
      ];
      
      // Update tenant
      await pool.execute(
        'UPDATE tenants SET name = ?, mobile = ?, email = ?, address = ?, room_id = ?, rent_start = ?, initial_electric_reading = ? WHERE id = ?',
        sqlParams
      );
      
      // If room has changed, update room status
      if (oldRoomId !== room_id) {
        // Set old room to vacant
        if (oldRoomId) {
          await pool.execute(
            'UPDATE rooms SET status = "vacant" WHERE id = ?',
            [oldRoomId]
          );
        }
        
        // Set new room to occupied
        if (room_id) {
          await pool.execute(
            'UPDATE rooms SET status = "occupied" WHERE id = ?',
            [room_id]
          );
        }
      }
      
      return { id, ...tenantData };
    } catch (error) {
      console.error('Error updating tenant:', error);
      throw error;
    }
  }

  // Safe update for specific fields only (used for email status updates)
  static async updateSpecificFields(id, fieldsToUpdate) {
    try {
      const allowedFields = [
        'welcome_email_sent', 'deposit_receipt_sent', 'contract_expiry_notified',
        'advance_payment_status', 'security_deposit_status'
      ];
      
      const updateFields = [];
      const updateValues = [];
      
      for (const [field, value] of Object.entries(fieldsToUpdate)) {
        if (allowedFields.includes(field)) {
          updateFields.push(`${field} = ?`);
          updateValues.push(value);
        }
      }
      
      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      updateValues.push(id);
      
      const query = `UPDATE tenants SET ${updateFields.join(', ')} WHERE id = ?`;
      
      console.log('🔧 Safe field update:', { id, fieldsToUpdate, query });
      
      const [result] = await pool.execute(query, updateValues);
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating specific tenant fields:', error);
      throw error;
    }
  }

  // Delete tenant
  static async delete(id) {
    try {
      // Get tenant room before deleting
      const [tenant] = await pool.execute(
        'SELECT room_id FROM tenants WHERE id = ?',
        [id]
      );
      
      const roomId = tenant[0]?.room_id;
      
      // Delete tenant
      await pool.execute('DELETE FROM tenants WHERE id = ?', [id]);
      
      // Set room to vacant
      if (roomId) {
        await pool.execute(
          'UPDATE rooms SET status = "vacant" WHERE id = ?',
          [roomId]
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error;
    }
  }

  // Count total tenants
  static async count() {
    try {
      const [rows] = await pool.execute('SELECT COUNT(*) as count FROM tenants');
      return rows[0].count;
    } catch (error) {
      console.error('Error counting tenants:', error);
      throw error;
    }
  }
}

module.exports = Tenant; 