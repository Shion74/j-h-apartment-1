import { NextResponse } from 'next/server'
import { pool } from '../../../../../lib/database'
import { requireAuth } from '../../../../../lib/auth'
import emailService from '../../../../../services/emailService'
import Setting from '../../../../../models/setting'

// Helper function to create refund bill
async function createRefundBill(tenantId, tenant, refundAmount, description) {
  try {
    const currentDate = new Date().toISOString().split('T')[0]
    
    // Get electric rate for refund bill (although it's not used for calculation, needed for receipt generation)
    let electricRate = 11.00 // Default
    if (tenant.room_id) {
      const branchRatesResult = await pool.query(`
        SELECT br.electricity_rate
        FROM rooms r
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE r.id = $1
      `, [tenant.room_id])
      
      if (branchRatesResult.rows.length > 0 && branchRatesResult.rows[0].electricity_rate) {
        electricRate = parseFloat(branchRatesResult.rows[0].electricity_rate)
      } else {
        // Fallback to global setting
        const rateResult = await pool.query(`
          SELECT setting_value::numeric FROM settings WHERE setting_key = 'electric_rate_per_kwh' LIMIT 1
        `)
        if (rateResult.rows.length > 0) {
          electricRate = parseFloat(rateResult.rows[0].setting_value)
        }
      }
    }
    
    const result = await pool.query(`
      INSERT INTO bills (
        tenant_id, room_id, bill_date, due_date,
        rent_from, rent_to, rent_amount,
        electric_previous_reading, electric_present_reading, electric_consumption, electric_rate_per_kwh, electric_amount,
        water_amount, extra_fee_amount, extra_fee_description,
        total_amount, status, prepared_by, is_final_bill, is_refund_bill, refund_reason
      ) VALUES (
        $1, $2, $3, $3,
        $3, $3, 0,
        0, 0, 0, $6, 0,
        0, 0, '',
        $4, 'refund', 'System', true, true, $5
      ) RETURNING id
    `, [
      tenantId,
      tenant.room_id,
      currentDate,
      -Math.abs(refundAmount), // Negative amount for refund
      description,
      electricRate // Add electric rate parameter
    ])
    
    const billId = result.rows[0].id
    console.log(`✅ Created refund bill ID ${billId} for ₱${refundAmount} refund`)
    
    return billId
  } catch (error) {
    console.error('Error creating refund bill:', error)
    throw error
  }
}

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

    const { id } = params
    const {
      reason_for_leaving = 'early_termination',
      notes = '',
      final_electric_reading = 0,
      final_bill_rent_from,
      final_bill_rent_to,
      water_amount = 0,
      extra_fee_amount = 0,
      extra_fee_description = '',
      paid_cycles = 0,
      is_normal_termination = false
    } = await request.json()

    // Convert string values to numbers to prevent parsing issues
    const finalElectricReading = parseFloat(final_electric_reading) || 0
    const extraFeeAmount = parseFloat(extra_fee_amount) || 0
    let waterAmount = parseFloat(water_amount) || 0

    console.log('Request data received:', {
      final_electric_reading,
      water_amount, 
      extra_fee_amount,
      finalElectricReading,
      waterAmount,
      extraFeeAmount
    })

    // Get tenant data first
    const tenantResult = await pool.query(`
      SELECT 
        t.*,
        r.room_number,
        r.monthly_rent,
        b.name as branch_name
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.id = $1
    `, [id])

    if (tenantResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    const tenant = tenantResult.rows[0]

    // Get branch-specific electric rate from the tenant's room
    let electricRate = 0
    
    if (tenant.room_id) {
      const branchRatesResult = await pool.query(`
        SELECT br.electricity_rate, br.water_rate, br.name as branch_name
        FROM rooms r
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE r.id = $1
      `, [tenant.room_id])
      
      if (branchRatesResult.rows.length > 0) {
        const branchRates = branchRatesResult.rows[0]
        electricRate = parseFloat(branchRates.electricity_rate) || 11.00
        // Use branch water rate if not provided in request
        if (!water_amount) {
          waterAmount = parseFloat(branchRates.water_rate) || 200.00
        }
        
        console.log('Using branch-specific rates for move-out:', {
          branch_name: branchRates.branch_name,
          electricRate,
          waterAmount,
          from_branch: true
        })
      } else {
        // Fallback to global settings
        const settings = await Setting.getBillingRates()
        electricRate = settings.electric_rate_per_kwh || 11.00
        if (!water_amount) {
          waterAmount = settings.water_fixed_amount || 200.00
        }
        
        console.log('Using global fallback rates for move-out:', {
          electricRate,
          waterAmount,
          from_global: true
        })
      }
    } else {
      // Fallback to global settings if no room
      const settings = await Setting.getBillingRates()
      electricRate = settings.electric_rate_per_kwh || 11.00
      if (!water_amount) {
        waterAmount = settings.water_fixed_amount || 200.00
      }
      
      console.log('Using global settings (no room found):', {
        electricRate,
        waterAmount
      })
    }

    // Check for unpaid bills
    const unpaidBillsResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM bills 
      WHERE tenant_id = $1 AND status = 'unpaid'
    `, [id])

    const unpaidBills = unpaidBillsResult.rows[0]
    const hasUnpaidBills = parseInt(unpaidBills.count) > 0

    // Get last bill info for final bill calculation
    const lastBillResult = await pool.query(`
      SELECT electric_present_reading, rent_to, rent_from, 'active' as source
      FROM bills 
      WHERE tenant_id = $1
      UNION ALL
      SELECT electric_present_reading, rent_to, rent_from, 'archived' as source
      FROM bill_history 
      WHERE original_tenant_id = $1
      ORDER BY rent_to DESC 
      LIMIT 1
    `, [id])

    const lastBill = lastBillResult.rows[0]
    const lastElectricReading = lastBill ? parseFloat(lastBill.electric_present_reading || 0) : 0

    // Get tenant's deposit balances from tenant_deposits table
    const depositsResult = await pool.query(`
      SELECT 
        deposit_type,
        initial_amount,
        remaining_balance,
        status
      FROM tenant_deposits 
      WHERE tenant_id = $1 
        AND status = 'active'
    `, [id])

    // Calculate total deposits based on business rules
    const deposits = depositsResult.rows
    const advanceDeposit = deposits.find(d => d.deposit_type === 'advance')
    const securityDeposit = deposits.find(d => d.deposit_type === 'security')
    const advancePaymentBalance = parseFloat(advanceDeposit?.remaining_balance || 0)
    const securityDepositBalance = parseFloat(securityDeposit?.remaining_balance || 0)
    
    // IMPORTANT: Apply business rules for deposit usage based on termination type
    // For early termination: only advance deposit can be used
    // For normal termination: both deposits can be used
    let usableDepositBalance = advancePaymentBalance
    if (is_normal_termination || reason_for_leaving === 'normal_termination') {
      usableDepositBalance += securityDepositBalance
    }
    
    console.log('Deposit usage based on termination type:', {
      reason_for_leaving,
      is_normal_termination,
      paid_cycles,
      advancePaymentBalance,
      securityDepositBalance,
      usableDepositBalance
    })

    // Calculate final bill if there's a billing period
    let totalBillAmount = 0
    if (final_bill_rent_from && final_bill_rent_to) {
              // Calculate prorated rent
        const fromDate = new Date(final_bill_rent_from)
        const toDate = new Date(final_bill_rent_to)
        const daysInPeriod = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1
        const dailyRate = tenant.monthly_rent / 30
        const proratedRent = Math.round(dailyRate * daysInPeriod) // Round to whole number
      
      // Calculate electricity cost
      const electricConsumption = Math.max(0, finalElectricReading - lastElectricReading)
      const electricAmount = electricConsumption * electricRate
      
      console.log('Detailed bill calculation:', {
        proratedRent: proratedRent,
        electricConsumption: electricConsumption,
        electricRate: electricRate,
        electricAmount: electricAmount,
        waterAmount: waterAmount,
        extraFeeAmount: extraFeeAmount,
        finalElectricReading: finalElectricReading,
        lastElectricReading: lastElectricReading,
        daysInPeriod: daysInPeriod,
        dailyRate: dailyRate
      })
      
      // Calculate total final bill amount (includes all charges)
      const finalPeriodAmount = proratedRent + electricAmount + waterAmount + extraFeeAmount
      
      console.log('Final period calculation:', {
        proratedRent,
        electricAmount,
        waterAmount,
        extraFeeAmount,
        finalPeriodAmount
      })
      
      // Total bills = unpaid bills + final period charges
      totalBillAmount = parseFloat(unpaidBills.total_amount || 0) + finalPeriodAmount
    } else {
      // No final billing period, only unpaid bills
      totalBillAmount = parseFloat(unpaidBills.total_amount || 0)
    }

    console.log('Move-out analysis:', {
      tenant_name: tenant.name,
      hasUnpaidBills,
      unpaidAmount: parseFloat(unpaidBills.total_amount || 0),
      final_period_amount: totalBillAmount - parseFloat(unpaidBills.total_amount || 0),
      totalBillAmount,
      usableDepositBalance,
      refundableBalance: Math.max(0, usableDepositBalance - totalBillAmount),
      outstandingBalance: Math.max(0, totalBillAmount - usableDepositBalance),
      hasRefundableBalance: usableDepositBalance > totalBillAmount,
      hasOutstandingBalance: totalBillAmount > usableDepositBalance,
      needsFinalBill: totalBillAmount > parseFloat(unpaidBills.total_amount || 0)
    })

    // CORRECTED LOGIC: Determine bill type based on deposit vs bill balance
    if (totalBillAmount > parseFloat(unpaidBills.total_amount || 0)) {
      // There's a final billing period - determine if it's refund or final bill
      const refundableBalance = Math.max(0, usableDepositBalance - totalBillAmount)
      const outstandingBalance = Math.max(0, totalBillAmount - usableDepositBalance)
      const hasRefundableBalance = usableDepositBalance > totalBillAmount
      const hasOutstandingBalance = totalBillAmount > usableDepositBalance
      
      if (hasRefundableBalance) {
        // Case: Deposits can cover all bills + tenant gets refund - CREATE REFUND BILL
        console.log(`💰 Deposits cover bills with refund (₱${refundableBalance.toFixed(2)}) - creating REFUND BILL`)
        
        try {
          const refundBillResult = await pool.query(`
            INSERT INTO bills (
              tenant_id, room_id, bill_date, rent_from, rent_to,
              rent_amount, electric_rate_per_kwh, total_amount, status, is_refund_bill, refund_reason,
              prepared_by, deposit_applied, original_bill_amount
            ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, 'unpaid', true,
              'Deposit refund after move-out (bills covered)', 'system', $8, $9)
            RETURNING id
          `, [
            id,
            tenant.room_id,
            final_bill_rent_from,
            final_bill_rent_to,
            0, // rent_amount is 0 for refund bills
            electricRate, // Include electric rate for receipt generation
            -refundableBalance, // Negative amount for refund
            totalBillAmount, // deposit_applied = actual bills amount
            totalBillAmount // original_bill_amount = actual bills that were covered
          ])

          const refundBillId = refundBillResult.rows[0].id
          console.log(`✅ Created refund bill #${refundBillId} for ₱${refundableBalance.toFixed(2)}`)

          // Update tenant deposits to used status since they've been applied
          await pool.query(`
            UPDATE tenant_deposits 
            SET status = 'used',
                remaining_balance = 0,
                updated_at = NOW(),
                notes = CONCAT(COALESCE(notes, ''), ' | Applied to refund bill #', $2::text, ' - bills covered, refund due')
            WHERE tenant_id = $1 AND status = 'active'
          `, [id, refundBillId])

          // Send refund notification email to tenant
          if (tenant.email) {
            try {
              const emailService = (await import('../../../../../services/emailService.js')).default
              
              const emailResult = await emailService.sendRefundNotificationEmail({
                tenant_name: tenant.name,
                room_number: tenant.room_number,
                branch_name: tenant.branch_name,
                rent_from: final_bill_rent_from,
                rent_to: final_bill_rent_to,
                total_amount: totalBillAmount
              }, tenant.email, refundableBalance)
              
              console.log(`✅ Refund notification email sent to ${tenant.name} (${tenant.email})`)
            } catch (emailError) {
              console.error('Failed to send refund notification email:', emailError)
            }
          }

          return NextResponse.json({
            success: true,
            message: 'Refund bill created successfully. Admin must process the refund to complete move-out.',
            action: 'refund_bill_created',
            bill_type: 'refund',
            refund_bill_id: refundBillId,
            refund_amount: refundableBalance,
            bills_covered: totalBillAmount,
            tenant_name: tenant.name,
            tenant_archived: false,
            room_made_available: false,
            requires_admin_action: true,
            admin_action_description: 'Process refund bill to complete move-out and archive tenant',
            termination_type: is_normal_termination ? 'normal_termination' : 'early_termination',
            breakdown: {
              unpaid_bills: parseFloat(unpaidBills.total_amount || 0),
              final_bill_amount: totalBillAmount - parseFloat(unpaidBills.total_amount || 0),
              total_bills_amount: totalBillAmount,
              usable_deposit_balance: usableDepositBalance,
              refundable_amount: refundableBalance,
              outstanding_amount: 0
            }
          })

        } catch (error) {
          console.error('Error creating refund bill:', error)
          throw error
        }
        
      } else if (hasOutstandingBalance) {
        // Case: Bills exceed deposits - CREATE FINAL BILL for tenant to pay
        console.log(`📋 Bills exceed deposits (₱${outstandingBalance.toFixed(2)} outstanding) - creating FINAL BILL`)

        try {
          // Calculate prorated rent for final bill
          const fromDate = new Date(final_bill_rent_from)
          const toDate = new Date(final_bill_rent_to)
          const daysInPeriod = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1
          const dailyRate = tenant.monthly_rent / 30
          const proratedRent = Math.round(dailyRate * daysInPeriod) // Round to whole number

          const billRequest = {
            tenant_id: id,
            room_id: tenant.room_id,
            rent_from: final_bill_rent_from,
            rent_to: final_bill_rent_to,
            rent_amount: proratedRent,
            electric_previous_reading: lastElectricReading,
            electric_present_reading: finalElectricReading,
            electric_rate_per_kwh: electricRate,
            water_amount: waterAmount,
            extra_fee_amount: extraFeeAmount,
            extra_fee_description: extra_fee_description || '',
            is_final_bill: true,
            move_out_reason: reason_for_leaving,
            total_amount: outstandingBalance, // Only the outstanding amount that tenant needs to pay
            deposit_applied: usableDepositBalance, // Deposits will be automatically applied
            original_bill_amount: totalBillAmount // Full bill amount before deposit application
          }

          console.log('Final bill creation request:', billRequest)

          const billResponse = await fetch('http://localhost:3000/api/bills', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': request.headers.get('Authorization')
            },
            body: JSON.stringify(billRequest)
          })

          if (!billResponse.ok) {
            throw new Error(`Failed to create final bill: ${billResponse.status}`)
          }

          const billResult = await billResponse.json()
          
          // Send final bill email to tenant
          if (tenant.email) {
            try {
              const emailService = (await import('../../../../../services/emailService.js')).default
              
              const emailResult = await emailService.sendFinalBillToTenant({
                tenant_name: tenant.name,
                room_number: tenant.room_number,
                branch_name: tenant.branch_name,
                bill_date: new Date().toISOString().split('T')[0],
                rent_from: final_bill_rent_from,
                rent_to: final_bill_rent_to,
                rent_amount: dailyRate * daysInPeriod,
                electric_amount: electricRate * (finalElectricReading - lastElectricReading),
                electric_rate_per_kwh: electricRate, // Include the branch-specific rate
                water_amount: waterAmount,
                extra_fee_amount: extraFeeAmount,
                extra_fee_description: extra_fee_description || '',
                total_amount: outstandingBalance, // Send the outstanding amount (what tenant pays)
                outstanding_amount: outstandingBalance,
                available_deposits: usableDepositBalance,
                original_bill_amount: totalBillAmount, // Include full bill amount for transparency
                is_final_bill: true
              }, tenant.email)
              
              console.log(`✅ Final bill email sent to ${tenant.name} (${tenant.email})`)
            } catch (emailError) {
              console.error('Failed to send final bill email:', emailError)
            }
          }

          return NextResponse.json({
            success: true,
            message: `✅ Final bill created. Amount: ₱${totalBillAmount.toFixed(2)}. Outstanding: ₱${outstandingBalance.toFixed(2)}.`,
            action: 'final_bill_created',
            bill_type: 'final',
            bill_id: billResult.bill_id,
            bills_amount: totalBillAmount,
            outstanding_balance: outstandingBalance,
            deposit_balance: usableDepositBalance,
            can_complete_moveout: false,
            has_final_bill: true,
            requires_tenant_action: true,
            tenant_action_description: 'Pay final bill to complete move-out',
            termination_type: is_normal_termination ? 'normal_termination' : 'early_termination',
            breakdown: {
              unpaid_bills: parseFloat(unpaidBills.total_amount || 0),
              final_bill_amount: totalBillAmount - parseFloat(unpaidBills.total_amount || 0),
              total_bills_amount: totalBillAmount,
              usable_deposit_balance: usableDepositBalance,
              outstanding_amount: outstandingBalance,
              refundable_amount: 0
            }
          })
        } catch (error) {
          console.error('Error creating final bill:', error)
          return NextResponse.json(
            { success: false, message: 'Failed to create final bill' },
            { status: 500 }
          )
        }
        
      } else {
        // Case: Bills exactly match deposits - CREATE FINAL BILL with no outstanding
        console.log(`⚖️ Bills exactly match deposits (₱${totalBillAmount.toFixed(2)}) - creating FINAL BILL`)
        
        // This case is the same as outstanding balance but with 0 remaining
        // Create final bill and it will be auto-paid with deposits
        try {
                  const fromDate = new Date(final_bill_rent_from)
        const toDate = new Date(final_bill_rent_to)
        const daysInPeriod = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1
        const dailyRate = tenant.monthly_rent / 30
        const proratedRent = Math.round(dailyRate * daysInPeriod) // Round to whole number

          const billRequest = {
            tenant_id: id,
            room_id: tenant.room_id,
            rent_from: final_bill_rent_from,
            rent_to: final_bill_rent_to,
            rent_amount: proratedRent,
            electric_previous_reading: lastElectricReading,
            electric_present_reading: finalElectricReading,
            electric_rate_per_kwh: electricRate,
            water_amount: waterAmount,
            extra_fee_amount: extraFeeAmount,
            extra_fee_description: extra_fee_description || '',
            is_final_bill: true,
            move_out_reason: reason_for_leaving,
            total_amount: totalBillAmount,
            deposit_applied: 0,
            original_bill_amount: totalBillAmount
          }

          const billResponse = await fetch('http://localhost:3000/api/bills', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': request.headers.get('Authorization')
            },
            body: JSON.stringify(billRequest)
          })

          if (!billResponse.ok) {
            throw new Error(`Failed to create final bill: ${billResponse.status}`)
          }

          const billResult = await billResponse.json()

          return NextResponse.json({
            success: true,
            message: `✅ Final bill created. Deposits exactly cover bill amount: ₱${totalBillAmount.toFixed(2)}.`,
            action: 'final_bill_created',
            bill_type: 'final_exact',
            bill_id: billResult.bill_id,
            bills_amount: totalBillAmount,
            outstanding_balance: 0,
            deposit_balance: usableDepositBalance,
            can_complete_moveout: true,
            has_final_bill: true,
            requires_tenant_action: false,
            tenant_action_description: 'Deposits will cover the final bill automatically',
            termination_type: is_normal_termination ? 'normal_termination' : 'early_termination',
            breakdown: {
              unpaid_bills: parseFloat(unpaidBills.total_amount || 0),
              final_bill_amount: totalBillAmount - parseFloat(unpaidBills.total_amount || 0),
              total_bills_amount: totalBillAmount,
              usable_deposit_balance: usableDepositBalance,
              outstanding_amount: 0,
              refundable_amount: 0
            }
          })
        } catch (error) {
          console.error('Error creating exact final bill:', error)
          return NextResponse.json(
            { success: false, message: 'Failed to create final bill' },
            { status: 500 }
          )
        }
      }
    } else if (usableDepositBalance > 0) {
      // No final billing needed, but there are deposits to refund
      console.log(`💰 No final billing needed - creating refund bill for deposits (₱${usableDepositBalance})`)

      try {
        const refundBillResult = await pool.query(`
          INSERT INTO bills (
            tenant_id, room_id, bill_date, rent_from, rent_to,
            rent_amount, total_amount, status, is_refund_bill, refund_reason,
            prepared_by, deposit_applied, original_bill_amount
          ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, 'unpaid', true,
            'Deposit refund after move-out', 'system', $7, $8)
          RETURNING id
        `, [
          id,
          tenant.room_id,
          final_bill_rent_from || new Date().toISOString().split('T')[0],
          final_bill_rent_to || new Date().toISOString().split('T')[0],
          0, // rent_amount is 0 for refund bills
          -usableDepositBalance, // Negative amount for refund
          usableDepositBalance,
          0 // original_bill_amount is 0 since no bills to pay
        ])

        const refundBillId = refundBillResult.rows[0].id
        console.log(`✅ Created refund bill #${refundBillId} for ₱${usableDepositBalance}`)

        // Update tenant deposits to used status since they've been applied
        await pool.query(`
          UPDATE tenant_deposits 
          SET status = 'used',
              remaining_balance = 0,
              updated_at = NOW(),
              notes = CONCAT(COALESCE(notes, ''), ' | Applied to move-out refund bill #', $2::text)
          WHERE tenant_id = $1 AND status = 'active'
        `, [id, refundBillId])

        return NextResponse.json({
          success: true,
          message: 'Refund bill created successfully. Admin must process the refund to complete move-out.',
          action: 'refund_bill_created',
          refund_bill_id: refundBillId,
          refund_amount: usableDepositBalance,
          tenant_name: tenant.name,
          final_bill_amount: 0,
          deposits_used: usableDepositBalance,
          tenant_archived: false,
          room_made_available: false,
          requires_admin_action: true,
          admin_action_description: 'Process refund bill to complete move-out and archive tenant',
          termination_type: is_normal_termination ? 'normal_termination' : 'early_termination',
          breakdown: {
            unpaid_bills: parseFloat(unpaidBills.total_amount || 0),
            final_bill_amount: 0,
            advance_payment_balance: advancePaymentBalance,
            security_deposit_balance: securityDepositBalance,
            usable_deposit_balance: usableDepositBalance,
            refundable_amount: usableDepositBalance
          }
        })

      } catch (error) {
        console.error('Error creating refund bill:', error)
        throw error
      }

    } else {
      // No final billing needed and no deposits to refund - archive tenant immediately
      console.log(`✅ No final billing needed and no deposits - archiving tenant immediately`)

      try {
        // Archive the tenant
        await pool.query(`
          INSERT INTO tenant_history (
            original_tenant_id, name, mobile, email, room_id, room_number,
            branch_name, rent_start, rent_end, contract_start_date, contract_end_date,
            contract_duration_months, contract_completed, initial_electric_reading,
            final_electric_reading, move_out_date, reason_for_leaving,
            deleted_by
          )
          SELECT 
            t.id, t.name, t.mobile, t.email, t.room_id, r.room_number,
            br.name, t.rent_start, CURRENT_DATE, t.contract_start_date, t.contract_end_date,
            t.contract_duration_months, true, t.initial_electric_reading,
            $2, CURRENT_DATE, $3,
            'System'
          FROM tenants t
          JOIN rooms r ON t.room_id = r.id
          JOIN branches br ON r.branch_id = br.id
          WHERE t.id = $1
        `, [id, finalElectricReading, reason_for_leaving])

        // Delete from active tenants
        await pool.query('DELETE FROM tenants WHERE id = $1', [id])

        // Make room available
        await pool.query(`
          UPDATE rooms 
          SET status = 'vacant',
              tenant_id = NULL,
              updated_at = NOW()
          WHERE id = $1
        `, [tenant.room_id])

        console.log(`✅ Archived tenant and made room available (no bills, no deposits)`)

        return NextResponse.json({
          success: true,
          message: 'Move-out processed successfully. Tenant archived and room made available.',
          tenant_name: tenant.name,
          final_bill_amount: 0,
          deposits_used: 0,
          tenant_archived: true,
          room_made_available: true,
          refund_amount: 0
        })

      } catch (error) {
        console.error('Error completing move-out (no bills, no deposits):', error)
        throw error
      }
    }
  } catch (error) {
    console.error('Move-out error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to process move-out' },
      { status: 500 }
    )
  }
} 