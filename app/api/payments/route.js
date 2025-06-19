import { NextResponse } from 'next/server'
import { pool } from '../../../lib/database'
import { requireAuth } from '../../../lib/auth'
import { calculatePenaltyFee, isPaymentLate } from '../../../lib/penaltyUtils'

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

// Add a helper function to map UI deposit types to database deposit types
function mapDepositType(uiDepositType) {
  const depositTypeMap = {
    'advance_payment': 'advance',
    'security_deposit': 'security'
  }
  return depositTypeMap[uiDepositType] || uiDepositType
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
      payment_type, // 'cash', 'gcash', 'bank', 'check', 'other'
      actual_payment_date, // actual date when tenant made the payment
      notes
    } = await request.json()

    // Get the authenticated user's name as prepared_by
    const prepared_by = authResult.user.name || 'System'

    // Validation
    if (!bill_id || !payment_amount || !payment_type || !actual_payment_date) {
      return NextResponse.json(
        { success: false, message: 'Required fields missing' },
        { status: 400 }
      )
    }

    // Get bill and tenant details
    const billDataResult = await pool.query(`
      SELECT 
        b.*,
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
    
    // Check if this is a refund bill - redirect to complete-refund endpoint
    if (bill.is_refund_bill) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Refund bills must be processed through the complete-refund endpoint, not regular payments',
          redirect_to_refund: true,
          bill_id: bill_id
        },
        { status: 400 }
      )
    }
    
    const requestedAmount = parseFloat(payment_amount)

    // Get total amount already paid for this bill
    const totalPaidResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM payments 
      WHERE bill_id = $1
    `, [bill_id])
    
    const alreadyPaidAmount = parseFloat(totalPaidResult.rows[0].total_paid)
    
    // Calculate penalty fee if payment is late (more than 10 days after billing cycle ends)
    let penaltyFee = 0
    
    const paymentDate = actual_payment_date ? new Date(actual_payment_date) : new Date()
    const rentToDate = new Date(bill.rent_to)
    
    // Check if payment is late and penalty hasn't been applied yet
    if (isPaymentLate(paymentDate, rentToDate) && !bill.penalty_applied) {
      penaltyFee = await calculatePenaltyFee(bill.total_amount)
    }
    
    // Calculate the total bill amount including penalty fee
    const totalBillAmount = parseFloat(bill.total_amount) + penaltyFee
    const remainingBalance = totalBillAmount - alreadyPaidAmount

    // Validate payment amount doesn't exceed remaining balance with penalty
    // For refund bills (negative amounts), we need different validation logic
    const isRefundBill = bill.is_refund_bill || parseFloat(bill.total_amount) < 0
    
    if (isRefundBill) {
      // For refund bills, validate that the payment amount doesn't exceed the refund amount in absolute terms
      const maxRefundAmount = Math.abs(remainingBalance)
      const requestedRefundAmount = Math.abs(requestedAmount)
      
      if (requestedRefundAmount > (maxRefundAmount + 0.01)) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Refund amount (${requestedRefundAmount.toFixed(2)}) cannot exceed available refund (${maxRefundAmount.toFixed(2)})` 
          },
          { status: 400 }
        )
      }
    } else {
      // For regular bills, use the original validation
      if (requestedAmount > (remainingBalance + 0.01)) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Payment amount (${requestedAmount.toFixed(2)}) cannot exceed remaining balance (${remainingBalance.toFixed(2)})` 
          },
          { status: 400 }
        )
      }
    }

    // If using deposits, validate against available deposit balance
    if (payment_type === 'deposit') {
      const dbDepositType = mapDepositType(payment_type)
      const depositResult = await pool.query(`
        SELECT remaining_balance 
        FROM tenant_deposits 
        WHERE tenant_id = $1 
          AND deposit_type = $2 
          AND status = 'active'
      `, [bill.tenant_id, dbDepositType])

      if (depositResult.rows.length === 0) {
        throw new Error(`No active ${payment_type} found for tenant`)
      }

      const availableDeposit = parseFloat(depositResult.rows[0].remaining_balance)
      if (requestedAmount > availableDeposit) {
        throw new Error(`Payment amount (${requestedAmount.toFixed(2)}) exceeds available ${payment_type} balance (${availableDeposit.toFixed(2)})`)
      }

      // Update deposit balance
      await pool.query(`
        UPDATE tenant_deposits 
        SET remaining_balance = remaining_balance - $1,
            updated_at = NOW()
        WHERE tenant_id = $2 
          AND deposit_type = $3 
          AND status = 'active'
      `, [requestedAmount, bill.tenant_id, dbDepositType])

      // Record deposit transaction
      await pool.query(`
        INSERT INTO deposit_transactions (
          tenant_id, deposit_type, type, amount, bill_id, notes, created_at
        ) VALUES ($1, $2, 'usage', $3, $4, $5, NOW())
      `, [bill.tenant_id, dbDepositType, requestedAmount, bill_id, notes])
    }

    // Map frontend payment types to database enum values
    const paymentTypeMapping = {
      'cash': 'cash',
      'gcash': 'gcash',
      'bank': 'bank_transfer',
      'check': 'check',
      'other': 'other'
    }
    const actualPaymentMethod = paymentTypeMapping[payment_type] || 'cash'

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
      }

      // Insert payment record with actual payment date
      // Use actual_payment_date for both fields - this allows historical data entry
      const finalPaymentDate = actual_payment_date || new Date().toISOString().split('T')[0]
      const paymentResult = await client.query(`
        INSERT INTO payments (
          bill_id, amount, payment_date, actual_payment_date, payment_method, notes
        ) VALUES ($1, $2, $3, $3, $4, $5) RETURNING id
      `, [
        bill_id, 
        requestedAmount, 
        finalPaymentDate, // Use actual payment date for payment_date too
        actualPaymentMethod, 
        notes || ''
      ])

      const paymentId = paymentResult.rows[0].id

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
        
        // When bill is fully paid, increment the contract cycle count
        await client.query(`
          UPDATE tenants 
          SET completed_cycles = COALESCE(completed_cycles, 0) + 1
          WHERE id = $1
        `, [bill.tenant_id])
      } else if (totalPaidAmount > 0) {
        billStatus = 'partial'
      }

      await client.query(`
        UPDATE bills SET status = $1 WHERE id = $2
      `, [billStatus, bill_id])

      // If bill is fully paid, archive it to bill_history
      let billArchived = false
      let tenantMovedOut = false
      
      if (billStatus === 'paid') {
        // Get the actual payment date from the most recent payment
        const actualPaymentDateResult = await client.query(`
          SELECT COALESCE(actual_payment_date, payment_date) as actual_payment_date
          FROM payments 
          WHERE bill_id = $1 
          ORDER BY created_at DESC 
          LIMIT 1
        `, [bill_id])
        
        const actualPaymentDate = actualPaymentDateResult.rows[0]?.actual_payment_date || new Date().toISOString().split('T')[0]

        // Archive to bill_history
        await client.query(`
          INSERT INTO bill_history (
            original_bill_id, original_tenant_id, room_id, bill_date,
            rent_from, rent_to, rent_amount, electric_previous_reading,
            electric_present_reading, electric_consumption, electric_rate_per_kwh, electric_amount,
            water_amount, extra_fee_amount, extra_fee_description,
            total_amount, status, prepared_by, is_final_bill, is_refund_bill,
            payment_date, actual_payment_date, total_paid, remaining_balance,
            tenant_name, room_number, branch_name, archived_by, archive_reason,
            deposit_applied, original_bill_amount, payment_method, electric_reading_date,
            due_date
          )
          SELECT 
            b.id, b.tenant_id, b.room_id, b.bill_date,
            b.rent_from, b.rent_to, b.rent_amount, b.electric_previous_reading,
            b.electric_present_reading, b.electric_consumption, b.electric_rate_per_kwh, b.electric_amount,
            b.water_amount, b.extra_fee_amount, b.extra_fee_description,
            b.total_amount, 'paid', $1, b.is_final_bill, b.is_refund_bill,
            CURRENT_DATE, $5, $2, 0,
            t.name, r.room_number, br.name, $1, 'payment_completed',
            b.deposit_applied, b.original_bill_amount, $3, b.electric_reading_date,
            b.due_date
          FROM bills b
          LEFT JOIN tenants t ON b.tenant_id = t.id
          LEFT JOIN rooms r ON b.room_id = r.id
          LEFT JOIN branches br ON r.branch_id = br.id
          WHERE b.id = $4
        `, [prepared_by, payment_amount, payment_type, bill_id, actualPaymentDate])

        // Archive payments to payment_history before deleting the bill
        await client.query(`
          INSERT INTO payment_history (
            original_payment_id, original_bill_id, tenant_name, room_number, branch_name,
            amount, payment_date, actual_payment_date, payment_method, payment_type,
            notes, processed_by, created_at, updated_at
          )
          SELECT 
            p.id, p.bill_id, $1, 
            (SELECT room_number FROM rooms WHERE id = bills.room_id),
            (SELECT br.name FROM branches br JOIN rooms r ON br.id = r.branch_id WHERE r.id = bills.room_id),
            p.amount, p.payment_date, 
            COALESCE(p.actual_payment_date, p.payment_date),
            p.payment_method, COALESCE(p.payment_type, 'regular'),
            p.notes, p.processed_by, p.created_at, p.updated_at
          FROM payments p
          JOIN bills ON p.bill_id = bills.id
          WHERE p.bill_id = $2
        `, [bill.tenant_name, bill_id])

        // Delete the payments
        await client.query('DELETE FROM payments WHERE bill_id = $1', [bill_id])

        // Delete the original bill
        await client.query('DELETE FROM bills WHERE id = $1', [bill_id])
        billArchived = true
        
        // If this is a final bill, archive the tenant and make the room available
        if (bill.is_final_bill) {
          console.log('Final bill paid - archiving tenant and making room available')
          
          // Get tenant and room details
          const tenantDetailsResult = await client.query(`
            SELECT 
              t.*,
              r.room_number,
              r.id as room_id,
              br.name as branch_name,
              (SELECT COALESCE(SUM(initial_amount), 0) 
               FROM tenant_deposits 
               WHERE tenant_id = t.id AND deposit_type = 'advance' AND status = 'active') as advance_payment,
              (SELECT COALESCE(SUM(initial_amount), 0) 
               FROM tenant_deposits 
               WHERE tenant_id = t.id AND deposit_type = 'security' AND status = 'active') as security_deposit,
              (SELECT COALESCE(SUM(initial_amount - remaining_balance), 0) 
               FROM tenant_deposits 
               WHERE tenant_id = t.id AND deposit_type = 'advance' AND status = 'active') as advance_used_for_bills,
              (SELECT COALESCE(SUM(initial_amount - remaining_balance), 0) 
               FROM tenant_deposits 
               WHERE tenant_id = t.id AND deposit_type = 'security' AND status = 'active') as security_used_for_bills
            FROM tenants t
            LEFT JOIN rooms r ON t.room_id = r.id
            LEFT JOIN branches br ON r.branch_id = br.id
            WHERE t.id = $1
          `, [bill.tenant_id])
          
          if (tenantDetailsResult.rows.length > 0) {
            const tenantDetails = tenantDetailsResult.rows[0]
            
            // Archive the tenant
            await client.query(`
              INSERT INTO tenant_history (
                original_tenant_id, name, mobile, email, room_id, room_number,
                branch_name, rent_start, rent_end, contract_start_date, contract_end_date, 
                contract_duration_months, contract_completed, initial_electric_reading,
                final_electric_reading, advance_payment, security_deposit,
                advance_payment_status, security_deposit_status,
                advance_payment_refund_amount, advance_payment_used_last_month,
                security_deposit_refund_amount, security_deposit_used_for_bills,
                total_bills_paid, total_bills_unpaid,
                reason_for_leaving, notes, deleted_by, move_out_date
              ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, NOW(), $9, $10,
                $11, true, $12,
                $13, $14, $15,
                'used', 'used',
                0, $16,
                0, $17,
                0, 0,
                $18, 'Tenant moved out after paying final bill', 'System', NOW()
              )
            `, [
              tenantDetails.id, tenantDetails.name, tenantDetails.mobile, tenantDetails.email,
              tenantDetails.room_id, tenantDetails.room_number,
              tenantDetails.branch_name, tenantDetails.rent_start, tenantDetails.contract_start_date, tenantDetails.contract_end_date,
              tenantDetails.contract_duration_months, tenantDetails.initial_electric_reading,
              bill.electric_present_reading || 0, tenantDetails.advance_payment || 0, tenantDetails.security_deposit || 0,
              tenantDetails.advance_used_for_bills || 0, tenantDetails.security_used_for_bills || 0,
              bill.move_out_reason || 'final_bill_paid'
            ])
            
            // Archive deposit records
            await client.query(`
              UPDATE tenant_deposits 
              SET status = 'used',
                  remaining_balance = 0,
                  updated_at = NOW(),
                  notes = CONCAT(COALESCE(notes, ''), ' | Used for final bill payment')
              WHERE tenant_id = $1 AND status = 'active'
            `, [bill.tenant_id])
            
            // Remove tenant from active tenants table
            await client.query('DELETE FROM tenants WHERE id = $1', [bill.tenant_id])
            
            // Make room available
            await client.query(`
              UPDATE rooms 
              SET status = 'vacant', 
                  tenant_id = NULL,
                  updated_at = NOW()
              WHERE id = $1
            `, [tenantDetails.room_id])
            
            tenantMovedOut = true
            console.log(`✅ Tenant ${tenantDetails.name} archived and room ${tenantDetails.room_number} made available`)
            
            // Send departure email to tenant
            if (tenantDetails.email) {
              try {
                const emailService = (await import('../../../services/emailService.js')).default
                
                const departureInfo = {
                  tenant_name: tenantDetails.name,
                  room_number: tenantDetails.room_number,
                  branch_name: tenantDetails.branch_name,
                  rent_start: tenantDetails.rent_start,
                  rent_end: new Date().toISOString().split('T')[0],
                  contract_completed: true,
                  security_deposit_refund: 0, // Will be calculated based on remaining deposits
                  reason_for_leaving: bill.move_out_reason || 'final_bill_paid',
                  total_bills_paid: totalPaidAmount,
                  total_bills_unpaid: 0
                }
                
                await emailService.sendDepartureEmail(tenantDetails.email, departureInfo)
                console.log(`✅ Departure email sent to ${tenantDetails.name} (${tenantDetails.email})`)
              } catch (emailError) {
                console.error('Failed to send departure email:', emailError)
              }
            }
          } else {
            console.log(`⚠️ Tenant not found for ID ${bill.tenant_id} - cannot archive`)
          }
        }
      }

      // Commit transaction
      await client.query('COMMIT')

      // Get updated payment details (check both bills and bill_history since bill might be archived)
      // Try to get payment from active payments table first
      let newPaymentResult = await client.query(`
        SELECT 
          p.*,
          COALESCE(b.total_amount, bh.total_amount) as bill_total,
          COALESCE(t.name, bh.tenant_name) as tenant_name,
          COALESCE(t.email, '') as tenant_email,
          COALESCE(r.room_number, bh.room_number) as room_number
        FROM payments p
        LEFT JOIN bills b ON p.bill_id = b.id
        LEFT JOIN bill_history bh ON p.bill_id = bh.original_bill_id
        LEFT JOIN tenants t ON COALESCE(b.tenant_id, bh.original_tenant_id) = t.id
        LEFT JOIN rooms r ON COALESCE(b.room_id, bh.room_id) = r.id
        WHERE p.id = $1
      `, [paymentId])

      // If not found in active payments, check payment_history
      if (newPaymentResult.rows.length === 0) {
        newPaymentResult = await client.query(`
          SELECT 
            ph.*,
            bh.total_amount as bill_total,
            ph.tenant_name,
            t.email as tenant_email,
            ph.room_number
          FROM payment_history ph
          LEFT JOIN bill_history bh ON ph.original_bill_id = bh.original_bill_id
          LEFT JOIN tenants t ON bh.original_tenant_id = t.id
          WHERE ph.original_payment_id = $1
        `, [paymentId])
      }

      // Release the client back to the pool
      client.release()

      const newPayment = newPaymentResult.rows[0]
      
      console.log('Payment query result:', {
        rowCount: newPaymentResult.rows.length,
        paymentId: paymentId,
        newPayment: newPayment ? 'Found' : 'Not found'
      })
      
      // Send receipt email if tenant has email and bill is fully paid
      let receiptStatus = null
      if (billStatus === 'paid' && newPayment && newPayment.tenant_email) {
        // Skip receipt emails for refund bills - they get departure emails instead
        if (bill.is_refund_bill) {
          receiptStatus = {
            email_sent: false,
            email_message: 'Refund bills do not send receipts - departure email sent instead',
            recipient: newPayment.tenant_email
          }
        } else {
          try {
            // Import services for receipt generation and email sending
            const emailService = (await import('../../../services/emailService.js')).default
            const receiptService = (await import('../../../services/receiptService.js')).default
            
            // Get all payments for this bill for the receipt
            let allPaymentsResult
            if (billArchived) {
              // If bill was archived, get payments from payment_history
              allPaymentsResult = await pool.query(`
                SELECT * FROM payment_history 
                WHERE original_bill_id = $1
                ORDER BY payment_date ASC
              `, [bill_id])
            } else {
              // If bill is still active, get payments from payments table
              allPaymentsResult = await pool.query(`
                SELECT * FROM payments 
                WHERE bill_id = $1
                ORDER BY payment_date ASC
              `, [bill_id])
            }

            // Get complete bill data (either from active bills or bill_history)
            let billForReceipt = bill
            
            // If bill was archived, get the data from bill_history
            if (billArchived) {
              const archivedBillResult = await pool.query(`
                SELECT * FROM bill_history WHERE original_bill_id = $1
              `, [bill_id])
              
              if (archivedBillResult.rows.length > 0) {
                billForReceipt = archivedBillResult.rows[0]
                
                // Make sure penalty fee information is included
                if (penaltyFee > 0) {
                  billForReceipt.penalty_fee_amount = penaltyFee
                  billForReceipt.penalty_applied = true
                }
              }
            } else {
              // For active bills, make sure penalty fee is included
              if (penaltyFee > 0) {
                billForReceipt.penalty_fee_amount = penaltyFee
                billForReceipt.penalty_applied = true
              }
            }
            
            // Add electric rate to bill object if not present
            if (!billForReceipt.electric_rate_per_kwh) {
              // Try to get branch-specific rate first
              const branchRateResult = await pool.query(`
                SELECT br.electricity_rate
                FROM rooms r
                LEFT JOIN branches br ON r.branch_id = br.id
                WHERE r.id = $1
              `, [billForReceipt.room_id])
              
              if (branchRateResult.rows.length > 0 && branchRateResult.rows[0].electricity_rate) {
                billForReceipt.electric_rate_per_kwh = parseFloat(branchRateResult.rows[0].electricity_rate)
              } else {
                // Fallback to global setting
                const rateResult = await pool.query(`
                  SELECT setting_value::numeric FROM settings WHERE setting_key = 'electric_rate_per_kwh' LIMIT 1
                `)
                if (rateResult.rows.length > 0) {
                  billForReceipt.electric_rate_per_kwh = parseFloat(rateResult.rows[0].setting_value)
                } else {
                  billForReceipt.electric_rate_per_kwh = 11.00 // Default fallback
                }
              }
            }

            // Generate PDF receipt
            const pdfBuffer = await receiptService.generateReceiptPDF(billForReceipt, allPaymentsResult.rows)

            // Send email with receipt
            const emailResult = await emailService.sendReceiptToTenant(
              billForReceipt, 
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
        }
      } else if (billStatus === 'paid' && newPayment && !newPayment.tenant_email) {
        receiptStatus = {
          email_sent: false,
          email_message: 'No email address on file for tenant',
          recipient: null
        }
      } else if (billStatus === 'paid' && !newPayment) {
        receiptStatus = {
          email_sent: false,
          email_message: 'Unable to retrieve payment details for receipt',
          recipient: null
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Payment completed successfully',
        payment: newPayment || null,
        bill_status: billStatus,
        bill_paid: billStatus === 'paid',
        bill_archived: billArchived,
        is_final_bill: bill.is_final_bill,
        tenant_moved_out: tenantMovedOut,
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