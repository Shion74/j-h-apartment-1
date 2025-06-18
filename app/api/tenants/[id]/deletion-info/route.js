import { NextResponse } from 'next/server'
import { pool } from '../../../../../lib/database'
import { requireAuth } from '../../../../../lib/auth'

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

    // Get tenant data with room and branch details
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

    const tenantData = tenant[0]

    // Check current month payment status
    const currentMonthPaymentResult = await pool.query(`
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN 'paid'
          ELSE 'unpaid'
        END as payment_status
      FROM bills 
      WHERE tenant_id = $1
        AND status = 'paid'
        AND (
          (rent_from <= DATE_TRUNC('month', CURRENT_DATE) AND rent_to >= DATE_TRUNC('month', CURRENT_DATE)) OR
          (rent_from <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day') AND rent_to >= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')) OR
          (rent_from >= DATE_TRUNC('month', CURRENT_DATE) AND rent_to <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))
        )
    `, [id])

    // Get unpaid bills
    const unpaidBillsResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM bills 
      WHERE tenant_id = $1 AND status = 'unpaid'
    `, [id])

    // Get paid bills total
    const paidBillsResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM bills 
      WHERE tenant_id = $1 AND status = 'paid'
    `, [id])

    // Get last bill info for billing calculations (check both active bills and bill_history)
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

    const lastBill = lastBillResult.rows
    const lastElectricReading = lastBill.length > 0 ? lastBill[0].electric_present_reading || 0 : 0
    const lastBillEndDate = lastBill.length > 0 ? lastBill[0].rent_to : null
    const lastBillSource = lastBill.length > 0 ? lastBill[0].source : null
    
    console.log('Last bill info:', { 
      lastBillEndDate, 
      lastElectricReading, 
      source: lastBillSource,
      tenant_id: id 
    })
    
    // Calculate the next billing period start date (day after last bill ended)
    let nextBillStartDate = null
    if (lastBillEndDate) {
      try {
        // The database stores dates, and we need to properly handle them for the current billing cycle
        // If the last bill ended on June 6, then the current billing cycle starts on June 7
        
        console.log('Last bill end date from DB:', lastBillEndDate)
        
        // Handle both string and Date object cases
        let endDate
        if (lastBillEndDate instanceof Date) {
          // If it's already a Date object, use it directly
          endDate = new Date(lastBillEndDate)
        } else {
          // If it's a string, parse it properly
          endDate = new Date(lastBillEndDate + 'T00:00:00.000Z')
        }
        
        // Validate the date
        if (isNaN(endDate.getTime())) {
          console.error('Invalid lastBillEndDate:', lastBillEndDate)
          // Fallback to tenant's rent_start date
          endDate = new Date(tenantData.rent_start + 'T00:00:00.000Z')
          if (isNaN(endDate.getTime())) {
            throw new Error('Both lastBillEndDate and rent_start are invalid')
          }
        }
        
        // Add 1 day to get the start of the current billing cycle
        const nextBillStart = new Date(endDate)
        nextBillStart.setUTCDate(nextBillStart.getUTCDate() + 1)
        
        // Validate the calculated date
        if (isNaN(nextBillStart.getTime())) {
          console.error('Invalid calculated nextBillStart date')
          nextBillStartDate = null
        } else {
          nextBillStartDate = nextBillStart
          console.log('Parsed end date:', endDate.toISOString().split('T')[0])
          console.log('Calculated next bill start date:', nextBillStart.toISOString().split('T')[0])
          console.log('This should be the current billing cycle start date for final billing')
        }
      } catch (dateError) {
        console.error('Error processing lastBillEndDate:', dateError)
        nextBillStartDate = null
      }
    } else {
      // If no bills exist, use rent_start date
      try {
        const rentStartDate = new Date(tenantData.rent_start + 'T00:00:00.000Z')
        if (isNaN(rentStartDate.getTime())) {
          console.error('Invalid rent_start date:', tenantData.rent_start)
          nextBillStartDate = null
        } else {
          nextBillStartDate = rentStartDate
          console.log('No bills found, using rent_start date:', rentStartDate.toISOString().split('T')[0])
        }
      } catch (dateError) {
        console.error('Error processing rent_start date:', dateError)
        nextBillStartDate = null
      }
    }

    // Check if contract is completed
    const contractEndDate = new Date(tenantData.contract_end_date)
    const currentDate = new Date()
    const isContractCompleted = currentDate >= contractEndDate
    const isEarlyTermination = currentDate < contractEndDate

    // Calculate deposit refund
    // Get tenant deposits from tenant_deposits table
    const depositsResult = await pool.query(`
      SELECT 
        deposit_type,
        initial_amount,
        remaining_balance,
        status
      FROM tenant_deposits 
      WHERE tenant_id = $1 AND status = 'active'
    `, [id])

    // Calculate balances for each deposit type
    const advanceDeposit = depositsResult.rows.find(d => d.deposit_type === 'advance')
    const securityDeposit = depositsResult.rows.find(d => d.deposit_type === 'security')
    
    const advancePaymentAmount = parseFloat(advanceDeposit?.initial_amount || 0)
    const advancePaymentBalance = parseFloat(advanceDeposit?.remaining_balance || 0)
    const securityDepositAmount = parseFloat(securityDeposit?.initial_amount || 0)
    const securityDepositBalance = parseFloat(securityDeposit?.remaining_balance || 0)
    
    console.log('Tenant deposits from tenant_deposits table:', {
      advanceDeposit,
      securityDeposit,
      advancePaymentAmount,
      advancePaymentBalance,
      securityDepositAmount,
      securityDepositBalance
    })

    const unpaidBills = unpaidBillsResult.rows
    const paidBills = paidBillsResult.rows
    const currentMonthPayment = currentMonthPaymentResult.rows
    
    const unpaidAmount = parseFloat(unpaidBills[0].total_amount || 0)
    
    let securityDepositRefund = 0
    if (isContractCompleted && unpaidBills[0].count === 0) {
      securityDepositRefund = securityDepositBalance
    }

    // Business rule: Advance payment can only be used for last month if contract is completed
    const canUseAdvancePaymentForLastMonth = isContractCompleted && advancePaymentBalance > 0

    // Determine if deletion is allowed
    const currentMonthPaid = currentMonthPayment[0].payment_status === 'paid'
    const canDelete = currentMonthPaid || unpaidBills[0].count === 0

    // Calculate days remaining in contract
    const daysRemaining = isEarlyTermination 
      ? Math.ceil((contractEndDate - currentDate) / (1000 * 60 * 60 * 24))
      : 0

    return NextResponse.json({
      success: true,
      tenant_info: {
        id: tenantData.id,
        name: tenantData.name,
        room_number: tenantData.room_number || 'N/A',
        branch_name: tenantData.branch_name || 'N/A',
        contract_start_date: tenantData.contract_start_date,
        contract_end_date: tenantData.contract_end_date,
        rent_start: tenantData.rent_start,
        monthly_rent: tenantData.monthly_rent
      },
      billing_info: {
        last_electric_reading: lastElectricReading,
        last_electric_reading_date: lastBill.length > 0 ? lastBill[0].rent_to : null,
        last_bill_end_date: lastBillEndDate,
        last_bill_source: lastBillSource,
        next_bill_start_date: nextBillStartDate && !isNaN(nextBillStartDate.getTime()) ? nextBillStartDate.toISOString().split('T')[0] : null
      },
      payment_status: {
        current_month_paid: currentMonthPaid,
        unpaid_bills_count: unpaidBills[0].count,
        unpaid_bills_amount: unpaidBills[0].total_amount,
        paid_bills_count: paidBills[0].count,
        paid_bills_amount: paidBills[0].total_amount
      },
      contract_status: {
        is_completed: isContractCompleted,
        is_early_termination: isEarlyTermination,
        days_remaining: daysRemaining,
        completion_percentage: Math.min(100, Math.round(
          ((currentDate - new Date(tenantData.contract_start_date)) / 
           (contractEndDate - new Date(tenantData.contract_start_date))) * 100
        ))
      },
      deposit_info: {
        advance_payment: {
          original_amount: advancePaymentAmount,
          used_for_bills: advancePaymentAmount - advancePaymentBalance,
          remaining_balance: advancePaymentBalance,
          status: advanceDeposit?.status || 'inactive',
          can_use_for_last_month: canUseAdvancePaymentForLastMonth,
          refundable_on_early_termination: isEarlyTermination && advancePaymentBalance > 0,
          business_rule: isEarlyTermination ?
            'Advance payment will be refunded on early termination' : 
            'Advance payment can be used for last month rent on contract completion'
        },
        security_deposit: {
          original_amount: securityDepositAmount,
          used_for_bills: securityDepositAmount - securityDepositBalance,
          remaining_balance: securityDepositBalance,
          refund_amount: securityDepositRefund,
          status: securityDeposit?.status || 'inactive',
          refundable: isContractCompleted && unpaidBills[0].count === 0
        }
      },
      deletion_status: {
        can_delete: canDelete,
        blocking_reason: !canDelete ? (
          !currentMonthPaid ? 'Current month rent not paid' : 
          unpaidBills[0].count > 0 ? `${unpaidBills[0].count} unpaid bills remaining` : 
          'Unknown reason'
        ) : null,
        warnings: [
          ...(unpaidAmount > 0 ? [`₱${unpaidAmount.toLocaleString()} in unpaid bills`] : [])
        ]
      }
    })

  } catch (error) {
    console.error('Tenant deletion info error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 