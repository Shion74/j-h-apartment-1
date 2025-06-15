import { NextResponse } from 'next/server'
import { pool } from '../../../lib/database'
import { requireAuth } from '../../../lib/auth'

export async function GET(request) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    // Get all payments with bill and tenant details
    const result = await pool.query(`
      SELECT 
        p.*,
        b.total_amount as bill_total,
        b.rent_from,
        b.rent_to,
        t.name as tenant_name,
        r.room_number,
        br.name as branch_name
      FROM payments p
      LEFT JOIN bills b ON p.bill_id = b.id
      LEFT JOIN tenants t ON b.tenant_id = t.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN branches br ON r.branch_id = br.id
      ORDER BY p.payment_date DESC, p.created_at DESC
    `)

    return NextResponse.json({
      success: true,
      payments: result.rows
    })

  } catch (error) {
    console.error('Payments fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const {
      bill_id,
      payment_amount,
      payment_method, // 'regular' or 'deposit'
      payment_type, // for regular: 'cash', 'gcash', 'bank', etc. for deposit: 'advance' or 'security'
      actual_payment_date, // actual date when tenant made the payment
      notes
    } = await request.json()

    // Validation
    if (!bill_id || !payment_amount || !payment_method) {
      return NextResponse.json(
        { success: false, message: 'Required fields missing' },
        { status: 400 }
      )
    }

    // Get bill and tenant details
    const billDataResult = await pool.query(`
      SELECT 
        b.*,
        t.advance_payment,
        t.security_deposit,
        t.advance_payment_status,
        t.security_deposit_status,
        t.name as tenant_name,
        t.email as tenant_email,
        r.room_number
      FROM bills b
      LEFT JOIN tenants t ON b.tenant_id = t.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.id = $1
    `, [bill_id])

    const billData = billDataResult.rows
    if (billData.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Bill not found' },
        { status: 404 }
      )
    }

    const bill = billData[0]
    const requestedAmount = parseFloat(payment_amount)
    
    // Calculate penalty fee if payment is late (more than 10 days after bill date)
    let penaltyFee = 0
    
    // Normalize dates to midnight for proper comparison
    const paymentDate = actual_payment_date ? new Date(actual_payment_date) : new Date()
    paymentDate.setHours(0, 0, 0, 0) // Set to midnight
    
    const billDate = new Date(bill.bill_date)
    billDate.setHours(0, 0, 0, 0) // Set to midnight
    
    const dueDate = new Date(bill.due_date || billDate.getTime() + (10 * 24 * 60 * 60 * 1000)) // 10 days after bill date
    dueDate.setHours(0, 0, 0, 0) // Set to midnight
    
    console.log(`🔍 Date comparison debug:`)
    console.log(`  Payment Date: ${paymentDate.toDateString()} (${paymentDate.getTime()})`)
    console.log(`  Due Date: ${dueDate.toDateString()} (${dueDate.getTime()})`)
    console.log(`  Is Late: ${paymentDate > dueDate}`)
    console.log(`  Penalty Applied: ${bill.penalty_applied}`)
    
    // Check if payment is late and penalty hasn't been applied yet
    if (paymentDate > dueDate && !bill.penalty_applied) {
      penaltyFee = parseFloat(bill.total_amount) * 0.01 // 1% of total bill amount
      console.log(`⚠️ Late payment detected: Payment date ${paymentDate.toDateString()} > Due date ${dueDate.toDateString()}`)
      console.log(`💰 Penalty fee calculated: ₱${penaltyFee.toFixed(2)} (1% of ₱${bill.total_amount})`)
    } else {
      console.log(`ℹ️ No penalty applied - Payment is on time or penalty already exists`)
    }

    // Handle payment method mapping
    let actualPaymentMethod
    if (payment_method === 'regular') {
      // Map frontend payment types to database enum values
      const paymentTypeMapping = {
        'cash': 'cash',
        'gcash': 'other', // GCash maps to 'other'
        'bank': 'bank_transfer',
        'check': 'check',
        'other': 'other'
      }
      actualPaymentMethod = paymentTypeMapping[payment_type] || 'cash'
    } else if (payment_method === 'deposit') {
      // For deposit payments
      if (payment_type === 'advance') {
        actualPaymentMethod = 'advance_payment'
      } else if (payment_type === 'security') {
        actualPaymentMethod = 'security_deposit'
      } else {
        actualPaymentMethod = 'other'
      }
    } else {
      // Direct payment method (for backward compatibility)
      actualPaymentMethod = payment_method
    }

    // Validate payment method against database enum
    const validPaymentMethods = ['cash', 'bank_transfer', 'check', 'advance_payment', 'security_deposit', 'other']
    if (!validPaymentMethods.includes(actualPaymentMethod)) {
      return NextResponse.json(
        { success: false, message: `Invalid payment method: ${payment_method}/${payment_type}` },
        { status: 400 }
      )
    }

    // Start PostgreSQL transaction
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      // Apply penalty fee to bill if applicable
      if (penaltyFee > 0) {
        await client.query(`
          UPDATE bills 
          SET penalty_fee_amount = $1, penalty_applied = TRUE, total_amount = total_amount + $1
          WHERE id = $2
        `, [penaltyFee, bill_id])
        
        console.log(`✅ Applied penalty fee of ₱${penaltyFee.toFixed(2)} to bill ${bill_id}`)
      }

      // Insert payment record with actual payment date
      const paymentResult = await client.query(`
        INSERT INTO payments (
          bill_id, amount, payment_date, actual_payment_date, payment_method, notes
        ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5) RETURNING id
      `, [
        bill_id, 
        requestedAmount, 
        actual_payment_date || new Date().toISOString().split('T')[0], 
        actualPaymentMethod, 
        notes || ''
      ])

      const paymentId = paymentResult.rows[0].id

      // If using deposit payment methods, update tenant deposits
      if (actualPaymentMethod === 'advance_payment' && payment_type === 'advance') {
        const availableAdvance = parseFloat(bill.advance_payment) || 0
        const newAdvanceAmount = availableAdvance - requestedAmount
        
        await client.query(
          'UPDATE tenants SET advance_payment = $1 WHERE id = $2',
          [Math.max(0, newAdvanceAmount), bill.tenant_id]
        )
      } else if (actualPaymentMethod === 'security_deposit' && payment_type === 'security') {
        const availableSecurity = parseFloat(bill.security_deposit) || 0
        const newSecurityAmount = availableSecurity - requestedAmount
        
        await client.query(
          'UPDATE tenants SET security_deposit = $1 WHERE id = $2',
          [Math.max(0, newSecurityAmount), bill.tenant_id]
        )
      }

      // Calculate total payments for this bill
      const totalPaidResult = await client.query(`
        SELECT COALESCE(SUM(amount), 0) as total_paid
        FROM payments 
        WHERE bill_id = $1
      `, [bill_id])

      // Get updated bill total (including penalty if applied)
      const updatedBillResult = await client.query(`
        SELECT total_amount FROM bills WHERE id = $1
      `, [bill_id])

      const totalPaidAmount = parseFloat(totalPaidResult.rows[0].total_paid)
      const billTotal = parseFloat(updatedBillResult.rows[0].total_amount)
      
      // Update bill status
      let billStatus = 'unpaid'
      if (totalPaidAmount >= billTotal) {
        billStatus = 'paid'
      } else if (totalPaidAmount > 0) {
        billStatus = 'partial'
      }

      await client.query(`
        UPDATE bills SET status = $1 WHERE id = $2
      `, [billStatus, bill_id])

      // Commit transaction
      await client.query('COMMIT')

      // Get updated payment details
      const newPaymentResult = await pool.query(`
        SELECT 
          p.*,
          b.total_amount as bill_total,
          t.name as tenant_name,
          t.email as tenant_email,
          r.room_number
        FROM payments p
        LEFT JOIN bills b ON p.bill_id = b.id
        LEFT JOIN tenants t ON b.tenant_id = t.id
        LEFT JOIN rooms r ON b.room_id = r.id
        WHERE p.id = $1
      `, [paymentId])

      const newPayment = newPaymentResult.rows[0]
      
      // Send receipt email if tenant has email and bill is fully paid
      let receiptStatus = null
      if (billStatus === 'paid' && newPayment.tenant_email) {
        try {
          // Import services for receipt generation and email sending
          const emailService = (await import('../../../services/emailService.js')).default
          const receiptService = (await import('../../../services/receiptService.js')).default
          
          // Get all payments for this bill for the receipt
          const allPaymentsResult = await pool.query(`
            SELECT * FROM payments 
            WHERE bill_id = $1
            ORDER BY payment_date ASC
          `, [bill_id])

          // Generate PDF receipt
          const pdfBuffer = await receiptService.generateReceiptPDF(bill, allPaymentsResult.rows)

          // Send email with receipt
          const emailResult = await emailService.sendReceiptToTenant(
            bill, 
            allPaymentsResult.rows, 
            newPayment.tenant_email, 
            pdfBuffer
          )

          receiptStatus = {
            email_sent: emailResult.success,
            email_message: emailResult.success ? 'Receipt sent successfully' : emailResult.error,
            recipient: newPayment.tenant_email
          }
        } catch (emailError) {
          console.error('Receipt email error:', emailError)
          receiptStatus = {
            email_sent: false,
            email_message: 'Failed to send receipt email: ' + emailError.message,
            recipient: newPayment.tenant_email
          }
        }
      } else if (billStatus === 'paid' && !newPayment.tenant_email) {
        receiptStatus = {
          email_sent: false,
          email_message: 'No email address on file for tenant',
          recipient: null
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Payment completed successfully',
        payment: newPayment,
        bill_status: billStatus,
        total_paid: totalPaidAmount,
        remaining_balance: billTotal - totalPaidAmount,
        penalty_applied: penaltyFee > 0,
        penalty_amount: penaltyFee,
        receipt: receiptStatus
      })

    } catch (error) {
      // Rollback transaction
      await client.query('ROLLBACK')
      throw error
    } finally {
      // Release client
      client.release()
    }

  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get payment statistics
export async function GET_STATS(request) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    // Get current month
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    // Calculate statistics
    const monthlyStatsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as monthly_collected,
        COUNT(*) as monthly_payments
      FROM payments 
      WHERE DATE_FORMAT(payment_date, '%Y-%m') = $16
    `, [currentMonth])

    const totalStatsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_collected,
        COUNT(*) as total_payments
      FROM payments
    `)

    const averageStatsResult = await pool.query(`
      SELECT 
        COALESCE(AVG(amount), 0) as average_payment
      FROM payments
    `)

    return NextResponse.json({
      success: true,
      stats: {
        monthly_collected: parseFloat(monthlyStats[0].monthly_collected),
        monthly_payments: monthlyStats[0].monthly_payments,
        total_collected: parseFloat(totalStats[0].total_collected),
        total_payments: totalStats[0].total_payments,
        average_payment: parseFloat(averageStats[0].average_payment)
      }
    })

  } catch (error) {
    console.error('Payment stats error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 