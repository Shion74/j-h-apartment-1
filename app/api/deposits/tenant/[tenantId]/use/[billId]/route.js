import { NextResponse } from 'next/server'
import { pool } from '../../../../../../../lib/database'
import { requireAuth } from '../../../../../../../lib/auth'

export async function POST(request, { params }) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { tenantId, billId } = params
    const {
      transaction_type, // 'advance_payment' or 'security_deposit'
      amount,
      used_for, // 'rent', 'utilities', 'extra_fees', etc.
      description
    } = await request.json()

    // Validation
    if (!transaction_type || !amount || amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid transaction data' },
        { status: 400 }
      )
    }

    if (!['advance_payment', 'security_deposit'].includes(transaction_type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    // Get tenant deposit information
    const tenantRowsResult = await pool.query(
      'SELECT advance_payment, security_deposit, deposit_status FROM tenants WHERE id = ?',
      [tenantId]
    )

    const tenantRows = tenantRowsResult.rows
    if (tenantRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    const tenant = tenantRows[0]

    // Check if deposits are paid
    if (tenant.deposit_status !== 'paid') {
      return NextResponse.json(
        { success: false, message: 'Deposits must be marked as paid before using' },
        { status: 400 }
      )
    }

    // Calculate available balance
    const usageRowsResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as used_amount
      FROM deposit_transactions 
      WHERE tenant_id = ? AND transaction_type = ? AND type = 'usage'
    `, [tenantId, transaction_type])

    const totalDeposit = parseFloat(tenant[transaction_type]) || 0
    const usedAmount = parseFloat(usageRows[0].used_amount) || 0
    const availableAmount = totalDeposit - usedAmount

    if (amount > availableAmount) {
      return NextResponse.json(
        { success: false, message: `Insufficient ${transaction_type.replace('_', ' ')} balance. Available: ₱${availableAmount.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Start transaction
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Record deposit usage
      await connection.execute(`
        INSERT INTO deposit_transactions 
        (tenant_id, bill_id, transaction_type, type, amount, used_for, description, transaction_date) 
        VALUES ($4, $5, $6, 'usage', $7, $8, $9, NOW() RETURNING id)
      `, [tenantId, billId, transaction_type, amount, used_for, description])

      // Create corresponding payment record
      await connection.execute(`
        INSERT INTO payments (bill_id, amount, payment_date, payment_method, notes) 
        VALUES ($10, $11, CURRENT_DATE, $12, $4) RETURNING id
      `, [billId, amount, transaction_type, `${description} - Deposit used for ${used_for}`])

      // Check if bill is now fully paid
      const [billRows] = await connection.execute(
        'SELECT total_amount FROM bills WHERE id = ?',
        [billId]
      )

      if (billRows.length > 0) {
        const [totalPaidRows] = await connection.execute(
          'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE bill_id = ?',
          [billId]
        )

        const billAmount = parseFloat(billRows[0].total_amount)
        const totalPaid = parseFloat(totalPaidRows[0].total_paid)

        let newStatus = 'partial'
        if (totalPaid >= billAmount) {
          newStatus = 'paid'
        }

        // Update bill status
        const updateQuery = newStatus === 'paid' 
          ? 'UPDATE bills SET status = $17, paid_date = CURRENT_DATE WHERE id = ?'
          : 'UPDATE bills SET status = ? WHERE id = ?'
        
        const updateParams = newStatus === 'paid' 
          ? [newStatus, billId]
          : [newStatus, billId]

        await connection.execute(updateQuery, updateParams)
      }

      await connection.commit()

      return NextResponse.json({
        success: true,
        message: `${transaction_type.replace('_', ' ')} used successfully`,
        remaining_balance: availableAmount - amount
      })

    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

  } catch (error) {
    console.error('Deposit usage error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 