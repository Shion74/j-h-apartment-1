import { verify } from 'jsonwebtoken'
import { pool } from '../../../../lib/database'

export async function POST(req) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const decoded = verify(token, process.env.JWT_SECRET)

    const { bill_id, tenant_id, termination_reason } = await req.json()

    if (!bill_id || !tenant_id) {
      return Response.json({ message: 'Bill ID and Tenant ID are required' }, { status: 400 })
    }

    // Start transaction
    await db.execute('START TRANSACTION')

    try {
      // Get bill details
      const [billRows] = await db.execute(
        'SELECT * FROM bills WHERE id = ? AND tenant_id = ?',
        [bill_id, tenant_id]
      )

      if (billRows.length === 0) {
        throw new Error('Bill not found')
      }

      const bill = billRows[0]
      const billAmount = parseFloat(bill.total_amount)

      // Get tenant contract and deposit information
      const [tenantRows] = await db.execute(`
        SELECT 
          t.*,
          c.start_date,
          c.duration_months,
          c.status as contract_status,
          DATEDIFF(CURDATE(), c.start_date) as days_in_contract,
          (c.duration_months * 30) as total_contract_days
        FROM tenants t
        LEFT JOIN contracts c ON t.id = c.tenant_id AND c.status = 'active'
        WHERE t.id = ?
      `, [tenant_id])

      if (tenantRows.length === 0) {
        throw new Error('Tenant not found')
      }

      const tenant = tenantRows[0]
      const isEarlyTermination = termination_reason !== 'contract_completed' && 
                               termination_reason !== 'Contract Completed'
      
      console.log('Contract analysis:', {
        termination_reason,
        isEarlyTermination,
        days_in_contract: tenant.days_in_contract,
        total_contract_days: tenant.total_contract_days
      })

      // Get deposit balances
      const [depositRows] = await db.execute(`
        SELECT 
          SUM(CASE WHEN deposit_type = 'advance' THEN remaining_balance ELSE 0 END) as advance_balance,
          SUM(CASE WHEN deposit_type = 'security' THEN remaining_balance ELSE 0 END) as security_balance
        FROM tenant_deposits 
        WHERE tenant_id = ? AND remaining_balance > 0
      `, [tenant_id])

      const deposits = depositRows[0] || { advance_balance: 0, security_balance: 0 }
      let advanceBalance = parseFloat(deposits.advance_balance) || 0
      let securityBalance = parseFloat(deposits.security_balance) || 0

      console.log('Available deposits:', { advanceBalance, securityBalance })

      // Apply business rules for deposit usage
      let usableAdvance = advanceBalance
      let usableSecurity = isEarlyTermination ? 0 : securityBalance // Security deposit is non-refundable for early termination

      let totalUsableDeposits = usableAdvance + usableSecurity
      let amountFromAdvance = 0
      let amountFromSecurity = 0
      let refundAmount = 0
      let outstandingBalance = 0

      console.log('Deposit usage rules:', { 
        isEarlyTermination, 
        usableAdvance, 
        usableSecurity, 
        totalUsableDeposits,
        billAmount 
      })

      if (totalUsableDeposits >= billAmount) {
        // Deposits cover the full bill
        if (usableAdvance >= billAmount) {
          // Advance payment can cover the full bill
          amountFromAdvance = billAmount
          amountFromSecurity = 0
          refundAmount = (usableAdvance - billAmount) + usableSecurity
        } else {
          // Use all advance payment + part of security deposit
          amountFromAdvance = usableAdvance
          amountFromSecurity = billAmount - usableAdvance
          refundAmount = usableSecurity - amountFromSecurity
        }
      } else {
        // Deposits don't cover the full bill
        amountFromAdvance = usableAdvance
        amountFromSecurity = usableSecurity
        outstandingBalance = billAmount - totalUsableDeposits
      }

      console.log('Payment calculation:', {
        amountFromAdvance,
        amountFromSecurity,
        refundAmount,
        outstandingBalance
      })

      // Update deposit balances
      if (amountFromAdvance > 0) {
        await db.execute(`
          UPDATE tenant_deposits 
          SET remaining_balance = remaining_balance - ?
          WHERE tenant_id = ? AND deposit_type = 'advance' AND remaining_balance > 0
        `, [amountFromAdvance, tenant_id])
      }

      if (amountFromSecurity > 0) {
        await db.execute(`
          UPDATE tenant_deposits 
          SET remaining_balance = remaining_balance - ?
          WHERE tenant_id = ? AND deposit_type = 'security' AND remaining_balance > 0
        `, [amountFromSecurity, tenant_id])
      }

      // Create payment record
      const paymentAmount = amountFromAdvance + amountFromSecurity
      const [paymentResult] = await db.execute(`
        INSERT INTO payments (
          bill_id, payment_amount, payment_method, payment_type, 
          actual_payment_date, processed_date, notes, processed_by
        ) VALUES (?, ?, 'deposit', 'automatic', CURDATE(), NOW(), ?, ?)
      `, [
        bill_id, 
        paymentAmount, 
        `Paid using deposits: ₱${amountFromAdvance} advance + ₱${amountFromSecurity} security`,
        decoded.userId
      ])

      // Update bill status
      let billStatus = 'paid'
      if (outstandingBalance > 0) {
        billStatus = 'partial'
      }

      await db.execute(`
        UPDATE bills 
        SET status = ?, total_paid = ?, remaining_balance = ?
        WHERE id = ?
      `, [billStatus, paymentAmount, outstandingBalance, bill_id])

      let tenantMovedOut = false
      let newBillId = null

      // Handle outstanding balance by creating a new bill
      if (outstandingBalance > 0) {
        const [newBillResult] = await db.execute(`
          INSERT INTO bills (
            tenant_id, room_id, rent_from, rent_to, rent_amount, 
            electric_previous_reading, electric_present_reading, electric_consumption, electric_amount,
            electric_reading_date, electric_previous_date, water_amount, extra_fee_amount, extra_fee_description,
            total_amount, bill_date, status, prepared_by, is_final_bill, move_out_reason, move_out_notes
          ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, CURDATE(), CURDATE(), 0, ?, 'Outstanding balance from final bill', ?, CURDATE(), 'unpaid', 'System', 1, ?, ?)
        `, [
          tenant_id, bill.room_id, bill.rent_from, bill.rent_to,
          outstandingBalance, // extra_fee_amount contains the outstanding balance
          outstandingBalance, // total_amount
          termination_reason,
          `Outstanding balance after deposit payment: ₱${outstandingBalance.toFixed(2)}`
        ])

        newBillId = newBillResult.insertId

        // Send email for outstanding balance bill
        const [tenantEmail] = await db.execute(
          'SELECT email FROM tenants WHERE id = ?',
          [tenant_id]
        )

        if (tenantEmail[0]?.email) {
          // Here you would send an email notification about the outstanding balance
          console.log(`Should send outstanding balance notification to: ${tenantEmail[0].email}`)
        }
      } else {
        // Bill is fully paid, check if tenant should be moved out
        if (bill.is_final_bill) {
          // Archive the tenant
          await db.execute(`
            UPDATE tenants 
            SET status = 'archived', move_out_date = CURDATE()
            WHERE id = ?
          `, [tenant_id])

          // Update contract status
          await db.execute(`
            UPDATE contracts 
            SET status = 'completed', end_date = CURDATE()
            WHERE tenant_id = ? AND status = 'active'
          `, [tenant_id])

          // Update room status to available
          await db.execute(`
            UPDATE rooms 
            SET tenant_id = NULL, status = 'available'
            WHERE tenant_id = ?
          `, [tenant_id])

          tenantMovedOut = true
        }
      }

      // Process refund if any
      if (refundAmount > 0) {
        // Create refund record
        await db.execute(`
          INSERT INTO refunds (
            tenant_id, refund_amount, refund_type, refund_date, 
            notes, processed_by, status
          ) VALUES (?, ?, 'deposit', CURDATE(), ?, ?, 'pending')
        `, [
          tenant_id, 
          refundAmount,
          `Deposit refund after final bill payment`,
          decoded.userId
        ])
      }

      // Send receipt email if bill is fully paid
      if (billStatus === 'paid') {
        const [tenantEmail] = await db.execute(
          'SELECT email FROM tenants WHERE id = ?',
          [tenant_id]
        )

        if (tenantEmail[0]?.email) {
          // Here you would send a payment receipt email
          console.log(`Should send payment receipt to: ${tenantEmail[0].email}`)
        }
      }

      await db.execute('COMMIT')

      return Response.json({
        success: true,
        message: 'Payment processed using deposits successfully',
        payment_amount: paymentAmount,
        amount_from_advance: amountFromAdvance,
        amount_from_security: amountFromSecurity,
        refund_amount: refundAmount,
        outstanding_balance: outstandingBalance,
        tenant_moved_out: tenantMovedOut,
        new_bill_id: newBillId,
        bill_status: billStatus
      })

    } catch (error) {
      await db.execute('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Pay with deposits error:', error)
    return Response.json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    }, { status: 500 })
  }
} 