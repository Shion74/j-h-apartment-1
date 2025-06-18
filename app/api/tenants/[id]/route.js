import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'

export async function GET(request, { params }) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = params

    // Get specific tenant with room and branch details
    const tenantResult = await pool.query(`
      SELECT 
        t.*,
        r.room_number,
        r.monthly_rent,
        b.name as branch_name,
        b.address as branch_address
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.id = $1
    `, [id])

    const tenant = tenantResult.rows
    if (tenant.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      tenant: tenant[0]
    })

  } catch (error) {
    console.error('Tenant fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request, { params }) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = params
    const updateData = await request.json()

    // Start transaction
    await pool.query('BEGIN')

    try {
      // Build update query dynamically based on provided fields
      const updateFields = []
      const updateValues = []
      let paramCount = 1

      // Only include fields that were actually provided in the update
      if (updateData.name !== undefined) {
        updateFields.push(`name = $${paramCount}`)
        updateValues.push(updateData.name)
        paramCount++
      }
      if (updateData.mobile !== undefined) {
        // Format mobile number - add +63 prefix if not present and validate format
        let formattedMobile = updateData.mobile.replace(/\D/g, '') // Remove all non-digits
        
        // If mobile starts with +63, remove it and get the 10 digits
        if (updateData.mobile.startsWith('+63')) {
          formattedMobile = updateData.mobile.slice(3).replace(/\D/g, '')
        }
        
        // Validate mobile number format (should be exactly 10 digits starting with 9)
        if (!/^9\d{9}$/.test(formattedMobile)) {
          return NextResponse.json(
            { success: false, message: 'Mobile number must be 10 digits starting with 9 (e.g., 9171234567)' },
            { status: 400 }
          )
        }
        
        // Add +63 prefix for storage
        const fullMobileNumber = `+63${formattedMobile}`
        
        updateFields.push(`mobile = $${paramCount}`)
        updateValues.push(fullMobileNumber)
        paramCount++
      }
      if (updateData.email !== undefined) {
        updateFields.push(`email = $${paramCount}`)
        updateValues.push(updateData.email || null)
        paramCount++
      }
      if (updateData.room_id !== undefined) {
        updateFields.push(`room_id = $${paramCount}`)
        // Ensure room_id is an integer or null
        updateValues.push(updateData.room_id ? parseInt(updateData.room_id) : null)
        paramCount++
      }
      if (updateData.rent_start !== undefined) {
        updateFields.push(`rent_start = $${paramCount}`)
        updateValues.push(updateData.rent_start)
        paramCount++
      }
      if (updateData.initial_electric_reading !== undefined) {
        updateFields.push(`initial_electric_reading = $${paramCount}`)
        // Ensure numeric value
        updateValues.push(parseFloat(updateData.initial_electric_reading) || 0)
        paramCount++
      }

      // Add tenant id as the last parameter
      updateValues.push(id)

      // Only proceed with update if there are fields to update
      if (updateFields.length > 0) {
        await pool.query(`
          UPDATE tenants 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
        `, updateValues)
      }

      // Handle room changes if needed
      if (updateData.room_id !== undefined && updateData.room_id !== updateData.previous_room_id) {
        // If there was a previous room, mark it as vacant
        if (updateData.previous_room_id) {
          await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['vacant', parseInt(updateData.previous_room_id)])
        }
        // If there's a new room, mark it as occupied
        if (updateData.room_id) {
          await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['occupied', parseInt(updateData.room_id)])
        }
      }

      // Get updated tenant data with all related information
      const result = await pool.query(`
        SELECT 
          t.*,
          r.room_number,
          r.monthly_rent,
          b.name as branch_name,
          b.address as branch_address,
          -- Get advance payment information
          COALESCE(adv_dep.initial_amount, 0) as advance_payment,
          COALESCE(adv_dep.remaining_balance, 0) as advance_remaining,
          COALESCE(adv_dep.status, 'unpaid') as advance_payment_status,
          -- Get security deposit information
          COALESCE(sec_dep.initial_amount, 0) as security_deposit,
          COALESCE(sec_dep.remaining_balance, 0) as security_remaining,
          COALESCE(sec_dep.status, 'unpaid') as security_deposit_status
        FROM tenants t
        LEFT JOIN rooms r ON t.room_id = r.id
        LEFT JOIN branches b ON r.branch_id = b.id
        LEFT JOIN tenant_deposits adv_dep ON t.id = adv_dep.tenant_id AND adv_dep.deposit_type = 'advance'
        LEFT JOIN tenant_deposits sec_dep ON t.id = sec_dep.tenant_id AND sec_dep.deposit_type = 'security'
        WHERE t.id = $1
      `, [id])

      await pool.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Tenant updated successfully',
        tenant: result.rows[0]
      })

    } catch (error) {
      console.error('Transaction error:', error)
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Error updating tenant:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update tenant' },
      { status: 500 }
    )
  }
}

export async function DELETE(request, { params }) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = params
    const body = await request.json().catch(() => ({}))
        const {
      reason_for_leaving = 'other',
      notes: initialNotes = '',
      final_electric_reading = 0,
      force_delete = false,
      use_advance_payment_for_last_month = false,
      use_security_deposit_for_bills = false,
      create_final_bill = false,
      final_bill_data = null
    } = body

    let notes = initialNotes

    // Get complete tenant data before deletion
    const tenantResult = await pool.query(`
      SELECT 
        t.*,
        r.room_number,
        r.monthly_rent,
        b.name as branch_name,
        b.address as branch_address
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.id = $10
    `, [id])

    const tenant = tenantResult.rows
    if (tenant.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    const tenantData = tenant[0]

    // Check current month payment status
    const currentMonthPaymentResult = await pool.query(`
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN 'paid'
          ELSE 'unpaid'
        END as payment_status
      FROM bills 
      WHERE tenant_id = $11
        AND status = 'paid'
        AND (
          (rent_from <= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AND rent_to >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')) OR
          (rent_from <= LAST_DAY(CURRENT_DATE) AND rent_to >= LAST_DAY(CURRENT_DATE)) OR
          (rent_from >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AND rent_to <= LAST_DAY(CURRENT_DATE))
        )
    `, [id])

    // Get unpaid bills
    const unpaidBillsResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM bills 
      WHERE tenant_id = ? AND status = 'unpaid'
    `, [id])

    // Get paid bills total
    const paidBillsResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM bills 
      WHERE tenant_id = ? AND status = 'paid'
    `, [id])

    // Get last electric reading for billing info (same as regular billing)
    const lastBillResult = await pool.query(`
      SELECT electric_present_reading 
      FROM bills 
      WHERE tenant_id = $14
      ORDER BY rent_to DESC 
      LIMIT 1
    `, [id])

    const lastBill = lastBillResult.rows
    const lastElectricReading = lastBill.length > 0 ? parseFloat(lastBill[0].electric_present_reading || 0) : 0

    // Check if deletion is allowed
    const currentMonthPaid = currentMonthPayment[0].payment_status === 'paid'
    const hasUnpaidBills = unpaidBills[0].count > 0

    if (!force_delete && (!currentMonthPaid || hasUnpaidBills)) {
      const blockingReason = !currentMonthPaid 
        ? 'Current month rent not paid' 
        : `${unpaidBills[0].count} unpaid bills remaining`
      
      return NextResponse.json(
        { 
          success: false, 
          message: `Cannot delete tenant: ${blockingReason}. Use force delete if necessary.`,
          can_force_delete: true,
          blocking_reason: blockingReason
        },
        { status: 400 }
      )
    }

    // Calculate contract completion and deposit handling
    const contractEndDate = new Date(tenantData.contract_end_date)
    const currentDate = new Date()
    const isContractCompleted = currentDate >= contractEndDate
    const isEarlyTermination = currentDate < contractEndDate

    const securityDepositAmount = parseFloat(tenantData.security_deposit || 0)
    const securityUsedForBills = parseFloat(tenantData.security_used_for_bills || 0)
    const advancePaymentAmount = parseFloat(tenantData.advance_payment || 0)
    const advanceUsedForBills = parseFloat(tenantData.advance_used_for_bills || 0)
    const unpaidAmount = parseFloat(unpaidBills[0].total_amount || 0)
    
    // Calculate advance payment handling based on business rules
    let advancePaymentRefund = 0
    let advancePaymentUsedLastMonth = 0
    
    // Note: Advance payment usage is handled in final bill creation section
    // For early termination, any unused advance payment after daily rent will be refunded
    
    // Calculate security deposit handling based on business rules
    let securityDepositRefund = 0
    let securityDepositUsedForBills = 0
    
    if (isContractCompleted) {
      // Business Rule: Contract completed = security deposit can be used for bills and remaining refunded
      // Note: Actual usage will be calculated in final bill creation section
      securityDepositRefund = 0 // Will be calculated after final bill processing
    } else {
      // Business Rule: Early termination = security deposit is kept by landlord
      securityDepositRefund = 0
    }

    // Create final bill if requested
    let finalBillId = null
    if (create_final_bill && final_bill_data) {
      try {
        // Get the last electric reading from the most recent bill
        const lastBillResult = await pool.query(`
          SELECT electric_present_reading 
          FROM bills 
          WHERE tenant_id = $17
          ORDER BY rent_to DESC 
          LIMIT 1
        `, [id])

    const lastBill = lastBillResult.rows
        const lastElectricReading = lastBill.length > 0 ? parseFloat(lastBill[0].electric_present_reading || 0) : 0
        const currentElectricReading = parseFloat(final_bill_data.electric_present_reading || final_electric_reading)
        const electricConsumption = Math.max(0, currentElectricReading - lastElectricReading)

        // Use the same billing logic as regular bills
        const { default: Setting } = await import('../../../../models/setting.js')
        const currentRates = await Setting.getBillingRates()
        const finalElectricRate = currentRates.electric_rate_per_kwh
        const finalWaterAmount = final_bill_data.water_amount || currentRates.water_fixed_amount

        console.log('Using billing rates for final bill:', { 
          finalElectricRate, 
          finalWaterAmount, 
          currentRatesFromDB: currentRates 
        })

        // Calculate prorated rent based on days in the period (same logic as regular bills)
        const fromDate = new Date(final_bill_data.rent_from)
        const toDate = new Date(final_bill_data.rent_to)
        const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1
        const monthlyRent = parseFloat(tenantData.monthly_rent)
        const proratedRentAmount = Math.round((monthlyRent / 30) * daysDiff) // Round to whole number

        // Calculate electric amount (same as regular bills)
        const electricAmount = electricConsumption * finalElectricRate

        // Calculate total amount (same structure as regular bills)
        const totalAmount = parseFloat(proratedRentAmount) + 
                           parseFloat(electricAmount) + 
                           parseFloat(finalWaterAmount) + 
                           parseFloat(final_bill_data.extra_fee_amount || 0)

        console.log('Final bill calculation:', {
          proratedRentAmount,
          electricConsumption,
          finalElectricRate,
          electricAmount,
          finalWaterAmount,
          extra_fee_amount: final_bill_data.extra_fee_amount || 0,
          totalAmount,
          daysPeriod: daysDiff
        })

        // Create final bill with same structure as regular bills
        const billResultResult = await pool.query(`
          INSERT INTO bills (
            tenant_id, room_id, bill_date, rent_from, rent_to, rent_amount,
            electric_previous_reading, electric_present_reading, electric_consumption,
            electric_rate_per_kwh, electric_amount, water_amount,
            extra_fee_amount, extra_fee_description, total_amount, status
          ) VALUES ($19, $20, NOW() RETURNING id, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, 'unpaid')
        `, [
          tenantData.id, tenantData.room_id,
          final_bill_data.rent_from, final_bill_data.rent_to, proratedRentAmount,
          lastElectricReading, currentElectricReading, electricConsumption,
          finalElectricRate, electricAmount, finalWaterAmount,
          final_bill_data.extra_fee_amount || 0, final_bill_data.extra_fee_description || 'Final bill for move-out',
          totalAmount
        ])

        finalBillId = billResult.insertId
        console.log(`✅ Created final bill ${finalBillId} for tenant ${tenantData.name}`)

        // Apply deposits to final bill based on business rules
        // Separate prorated rent from other fees (electric, water, extras)
        const otherFeesAmount = totalAmount - proratedRentAmount // electric + water + extras

        console.log(`📊 Bill breakdown: Prorated rent: ₱${proratedRentAmount.toFixed(2)}, Other fees: ₱${otherFeesAmount.toFixed(2)}`)

        // Step 1: Apply advance payment to prorated rent portion (always allowed)
        const availableAdvancePayment = Math.max(0, advancePaymentAmount - advanceUsedForBills)
        const advancePaymentToUse = Math.min(availableAdvancePayment, proratedRentAmount)
        
        if (advancePaymentToUse > 0) {
          await pool.query(`
            INSERT INTO payments (bill_id, amount, payment_date, payment_method, notes) 
            VALUES ($33, $34, NOW() RETURNING id, 'advance_payment', 'Advance payment used for prorated rent')
          `, [finalBillId, advancePaymentToUse])

          await pool.query(`
            INSERT INTO deposit_transactions (
              tenant_id, bill_id, transaction_type, amount, description, created_by
            ) VALUES ($35, $36, 'advance_used_last_month', $37, 'Advance payment used for prorated rent', 'system') RETURNING id
          `, [tenantData.id, finalBillId, advancePaymentToUse])

          advancePaymentUsedLastMonth = advancePaymentToUse
        }

        // Step 2: Apply security deposit for other fees (only if contract completed)
        if (isContractCompleted && otherFeesAmount > 0) {
          // Get remaining bill amount after advance payment
          const billBalanceResult = await pool.query(`
            SELECT (total_amount - COALESCE(SUM(p.amount), 0)) as remaining_balance
            FROM bills b
            LEFT JOIN payments p ON b.id = p.bill_id
            WHERE b.id = $19
            GROUP BY b.id
          `, [finalBillId])

          const remainingBalance = billBalance.length > 0 ? parseFloat(billBalance[0].remaining_balance) : (totalAmount - advancePaymentToUse)
          const availableSecurityDeposit = Math.max(0, securityDepositAmount - securityUsedForBills)
          const securityDepositToUse = Math.min(availableSecurityDeposit, remainingBalance)

          if (securityDepositToUse > 0) {
            await pool.query(`
              INSERT INTO payments (bill_id, amount, payment_date, payment_method, notes) 
              VALUES ($40, $41, NOW() RETURNING id, 'security_deposit', 'Security deposit used for other fees (electric, water, extras)')
            `, [finalBillId, securityDepositToUse])

            await pool.query(`
              INSERT INTO deposit_transactions (
                tenant_id, bill_id, transaction_type, amount, description, created_by
              ) VALUES ($42, $43, 'security_used_bills', $44, 'Security deposit used for other fees', 'system') RETURNING id
            `, [tenantData.id, finalBillId, securityDepositToUse])

            securityDepositUsedForBills += securityDepositToUse
          }

          // Calculate final security deposit refund (remaining after bill payment)
          const totalSecurityUsed = securityUsedForBills + securityDepositToUse
          securityDepositRefund = Math.max(0, securityDepositAmount - totalSecurityUsed)
        } else if (!isContractCompleted) {
          // Early termination: security deposit cannot be used, will be kept
          console.log(`⚠️ Early termination: Security deposit cannot be used for bills`)
        }

        // Calculate advance payment refund (remaining after daily rent usage)
        const totalAdvanceUsed = advanceUsedForBills + advancePaymentUsedLastMonth
        advancePaymentRefund = Math.max(0, advancePaymentAmount - totalAdvanceUsed)

        // Check if final bill is now fully paid and update status
        const finalBillPaymentsResult = await pool.query(`
          SELECT COALESCE(SUM(amount), 0) as total_paid 
          FROM payments 
          WHERE bill_id = $21
        `, [finalBillId])

        const totalPaid = parseFloat(finalBillPayments[0].total_paid)
        if (totalPaid >= totalAmount) {
          await pool.query(`
            UPDATE bills SET status = 'paid', paid_date = NOW() WHERE id = $22
          `, [finalBillId])
        } else if (totalPaid > 0) {
          await pool.query(`
            UPDATE bills SET status = 'partial' WHERE id = $23
          `, [finalBillId])
        }

      } catch (billError) {
        console.error('Error creating final bill:', billError)
        // Continue with move-out process even if bill creation fails
        notes += ` | Final bill creation failed: ${billError.message}`
      }
    }

    // Use connection for transaction
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      // Record deposit transactions FIRST (while tenant still exists in active table)
      if (advancePaymentRefund > 0) {
        await connection.execute(`
          INSERT INTO deposit_transactions (
            tenant_id, transaction_type, amount, description, created_by
          ) VALUES ($48, 'advance_refund', $49, $50, 'system') RETURNING id
        `, [
          tenantData.id, 
          advancePaymentRefund, 
          `Advance payment refund on early termination`,
          'admin'
        ])
      }

      if (advancePaymentUsedLastMonth > 0) {
        await connection.execute(`
          INSERT INTO deposit_transactions (
            tenant_id, transaction_type, amount, description, created_by
          ) VALUES ($51, 'advance_used_last_month', $52, $53, 'system') RETURNING id
        `, [
          tenantData.id, 
          advancePaymentUsedLastMonth, 
          `Advance payment used for last month rent`,
          'admin'
        ])
      }

      if (securityDepositRefund > 0) {
        await connection.execute(`
          INSERT INTO deposit_transactions (
            tenant_id, transaction_type, amount, description, created_by
          ) VALUES ($54, 'security_refund', $55, $56, 'system') RETURNING id
        `, [
          tenantData.id, 
          securityDepositRefund, 
          `Security deposit refund on tenant departure - Contract ${isContractCompleted ? 'completed' : 'terminated early'}`,
          'admin'
        ])
      }

      if (securityDepositUsedForBills > 0) {
        await connection.execute(`
          INSERT INTO deposit_transactions (
            tenant_id, transaction_type, amount, description, created_by
          ) VALUES ($58, 'security_used_bills', $59, $60, 'system') RETURNING id
        `, [
          tenantData.id, 
          securityDepositUsedForBills, 
          `Security deposit used for outstanding bills`,
          'admin'
        ])
      }

      // Move tenant to history table
      await connection.execute(`
        INSERT INTO tenant_history (
          original_tenant_id, name, mobile, email, address, 
          room_id, room_number, branch_name,
          rent_start, rent_end, contract_start_date, contract_end_date, 
          contract_duration_months, contract_completed,
          initial_electric_reading, final_electric_reading,
          advance_payment, security_deposit,
          advance_payment_status, security_deposit_status,
          advance_payment_refund_amount, advance_payment_used_last_month,
          security_deposit_refund_amount, security_deposit_used_for_bills,
          total_bills_paid, total_bills_unpaid,
          reason_for_leaving, notes, deleted_by
        ) VALUES ($61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76, $77, $78, $79, $80, $81, $82, $83, $84, $85, $86, $87, $88, $25) RETURNING id
      `, [
        tenantData.id, tenantData.name, tenantData.mobile, tenantData.email, tenantData.address,
        tenantData.room_id, tenantData.room_number, tenantData.branch_name,
        tenantData.rent_start, currentDate.toISOString().split('T')[0], 
        tenantData.contract_start_date, tenantData.contract_end_date,
        tenantData.contract_duration_months, isContractCompleted,
        tenantData.initial_electric_reading, final_electric_reading,
        tenantData.advance_payment, tenantData.security_deposit,
        tenantData.advance_payment_status, tenantData.security_deposit_status,
        advancePaymentRefund, advancePaymentUsedLastMonth,
        securityDepositRefund, securityDepositUsedForBills,
        paidBills[0].total_amount, unpaidBills[0].total_amount,
        reason_for_leaving, notes, 'admin'
      ])

      // Move email notifications to history (don't delete)
      // Keep email notifications for audit trail

      // Don't modify bills - keep the tenant_id reference for historical tracking
      // The bills will remain linked to the original tenant_id for audit purposes

      // Free up the room if tenant was assigned to one
      if (tenantData.room_id) {
        await connection.execute(
          'UPDATE rooms SET status = ? WHERE id = ?',
          ['vacant', tenantData.room_id]
        )
      }

      // Delete the tenant from active table
      await connection.execute(
        'DELETE FROM tenants WHERE id = ?',
        [id]
      )

      // Commit transaction
      await connection.commit()

      // Send departure email if tenant has email
      let emailStatus = null
      if (tenantData.email) {
        try {
          const emailService = (await import('../../../../services/emailService.js')).default
          
          const departureInfo = {
            tenant_name: tenantData.name,
            room_number: tenantData.room_number,
            branch_name: tenantData.branch_name,
            rent_start: tenantData.rent_start,
            rent_end: currentDate.toISOString().split('T')[0],
            contract_completed: isContractCompleted,
            security_deposit_refund: securityDepositRefund,
            reason_for_leaving: reason_for_leaving,
            total_bills_paid: paidBills[0].total_amount,
            total_bills_unpaid: unpaidBills[0].total_amount
          }
          
          await emailService.sendDepartureEmail(tenantData.email, departureInfo)
          emailStatus = { success: true, message: 'Departure email sent successfully' }
          console.log(`✅ Departure email sent to ${tenantData.name} (${tenantData.email})`)
        } catch (emailError) {
          console.error('Failed to send departure email:', emailError)
          emailStatus = { success: false, error: emailError.message }
        }
      } else {
        emailStatus = { success: false, message: 'No email address on file' }
      }

      return NextResponse.json({
        success: true,
        message: `Tenant "${tenantData.name}" moved out successfully`,
        tenant_history: {
          id: tenantData.id,
          name: tenantData.name,
          room_freed: tenantData.room_id ? true : false,
          contract_completed: isContractCompleted,
          advance_payment_refund: advancePaymentRefund,
          advance_payment_used_last_month: advancePaymentUsedLastMonth,
          security_deposit_refund: securityDepositRefund,
          security_deposit_used_for_bills: securityDepositUsedForBills,
          reason_for_leaving: reason_for_leaving,
          final_bill_created: finalBillId ? true : false,
          final_bill_id: finalBillId,
          bills_status: {
            paid_bills: paidBills[0].count,
            paid_amount: paidBills[0].total_amount,
            unpaid_bills: unpaidBills[0].count,
            unpaid_amount: unpaidBills[0].total_amount
          },
          email_status: emailStatus
        }
      })

    } catch (transactionError) {
      // Rollback transaction on error
      await connection.rollback()
      throw transactionError
    } finally {
      // Release connection
      connection.release()
    }

  } catch (error) {
    console.error('Tenant deletion error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 