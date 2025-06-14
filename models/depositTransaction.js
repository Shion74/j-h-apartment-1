const { pool } = require('../config/database');

class DepositTransaction {
  // Record initial deposit payment
  static async recordInitialDeposit(tenantId, transactionType, amount, createdBy = 'System') {
    try {
      const [result] = await pool.execute(`
        INSERT INTO deposit_transactions (
          tenant_id, transaction_type, action, amount, description, created_by, transaction_date
        ) VALUES (?, ?, 'deposit', ?, ?, ?, CURDATE())
      `, [
        tenantId,
        transactionType,
        amount,
        `Initial ${transactionType.replace('_', ' ')} payment`,
        createdBy
      ]);
      
      return {
        id: result.insertId,
        tenant_id: tenantId,
        transaction_type: transactionType,
        action: 'deposit',
        amount: amount
      };
    } catch (error) {
      console.error('Error recording initial deposit:', error);
      throw error;
    }
  }
  
  // Use deposit for bill payment
  static async useDepositForBill(tenantId, billId, transactionType, amount, usedFor, description, createdBy = 'Admin') {
    try {
      const [result] = await pool.execute(`
        INSERT INTO deposit_transactions (
          tenant_id, bill_id, transaction_type, action, amount, used_for, description, created_by, transaction_date
        ) VALUES (?, ?, ?, 'use', ?, ?, ?, ?, CURDATE())
      `, [
        tenantId,
        billId,
        transactionType,
        amount,
        usedFor,
        description,
        createdBy
      ]);
      
      // Update tenant's used amount
      const usedField = transactionType === 'advance_payment' ? 'advance_payment_used' : 'security_deposit_used';
      await pool.execute(`
        UPDATE tenants 
        SET ${usedField} = ${usedField} + ? 
        WHERE id = ?
      `, [amount, tenantId]);
      
      return {
        id: result.insertId,
        tenant_id: tenantId,
        bill_id: billId,
        transaction_type: transactionType,
        action: 'use',
        amount: amount,
        used_for: usedFor
      };
    } catch (error) {
      console.error('Error using deposit for bill:', error);
      throw error;
    }
  }
  
  // Get tenant's deposit balance
  static async getTenantDepositBalance(tenantId) {
    try {
      const [tenantData] = await pool.execute(`
        SELECT 
          advance_payment,
          security_deposit,
          advance_payment_used,
          security_deposit_used,
          advance_payment_status,
          security_deposit_status
        FROM tenants 
        WHERE id = ?
      `, [tenantId]);
      
      if (tenantData.length === 0) {
        throw new Error('Tenant not found');
      }
      
      const tenant = tenantData[0];
      
      return {
        advance_payment: {
          total: parseFloat(tenant.advance_payment) || 0,
          used: parseFloat(tenant.advance_payment_used) || 0,
          available: (parseFloat(tenant.advance_payment) || 0) - (parseFloat(tenant.advance_payment_used) || 0),
          status: tenant.advance_payment_status
        },
        security_deposit: {
          total: parseFloat(tenant.security_deposit) || 0,
          used: parseFloat(tenant.security_deposit_used) || 0,
          available: (parseFloat(tenant.security_deposit) || 0) - (parseFloat(tenant.security_deposit_used) || 0),
          status: tenant.security_deposit_status
        }
      };
    } catch (error) {
      console.error('Error getting tenant deposit balance:', error);
      throw error;
    }
  }
  
  // Get transaction history for a tenant
  static async getTenantTransactionHistory(tenantId) {
    try {
      const [transactions] = await pool.execute(`
        SELECT 
          dt.*,
          b.bill_date,
          b.rent_from,
          b.rent_to,
          b.total_amount as bill_amount
        FROM deposit_transactions dt
        LEFT JOIN bills b ON dt.bill_id = b.id
        WHERE dt.tenant_id = ?
        ORDER BY dt.created_at DESC
      `, [tenantId]);
      
      return transactions;
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }
  
  // Record deposit refund when tenant moves out
  static async recordRefund(tenantId, transactionType, amount, description, createdBy = 'Admin') {
    try {
      const [result] = await pool.execute(`
        INSERT INTO deposit_transactions (
          tenant_id, transaction_type, action, amount, used_for, description, created_by, transaction_date
        ) VALUES (?, ?, 'refund', ?, 'refund', ?, ?, CURDATE())
      `, [
        tenantId,
        transactionType,
        amount,
        description,
        createdBy
      ]);
      
      return {
        id: result.insertId,
        tenant_id: tenantId,
        transaction_type: transactionType,
        action: 'refund',
        amount: amount
      };
    } catch (error) {
      console.error('Error recording refund:', error);
      throw error;
    }
  }
  
  // Update deposit status (paid/unpaid)
  static async updateDepositStatus(tenantId, transactionType, status) {
    try {
      const statusField = transactionType === 'advance_payment' ? 'advance_payment_status' : 'security_deposit_status';
      
      const [result] = await pool.execute(`
        UPDATE tenants 
        SET ${statusField} = ? 
        WHERE id = ?
      `, [status, tenantId]);
      
      // Record the status change transaction
      if (status === 'paid') {
        const amount = transactionType === 'advance_payment' ? 
          (await pool.execute('SELECT advance_payment FROM tenants WHERE id = ?', [tenantId]))[0][0].advance_payment :
          (await pool.execute('SELECT security_deposit FROM tenants WHERE id = ?', [tenantId]))[0][0].security_deposit;
        
        await this.recordInitialDeposit(tenantId, transactionType, amount, 'Admin');
      }
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating deposit status:', error);
      throw error;
    }
  }
}

module.exports = DepositTransaction; 