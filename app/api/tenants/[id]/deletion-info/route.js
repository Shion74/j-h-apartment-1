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

    // Get last bill info for billing calculations
    const lastBillResult = await pool.query(`
      SELECT electric_present_reading, rent_to, rent_from
      FROM bills 
      WHERE tenant_id = $1
      ORDER BY rent_to DESC 
      LIMIT 1
    `, [id])

    const lastBill = lastBillResult.rows
    const lastElectricReading = lastBill.length > 0 ? parseFloat(lastBill[0].electric_present_reading || 0) : 0
    const lastBillEndDate = lastBill.length > 0 ? lastBill[0].rent_to : null
    
    // Calculate the next billing period start date (day after last bill ended)
    let nextBillStartDate = null
    if (lastBillEndDate) {
      const endDate = new Date(lastBillEndDate)
      nextBillStartDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000) // Add 1 day
    } else {
      // If no bills exist, use rent_start date
      nextBillStartDate = new Date(tenantData.rent_start)
    }

    // Check if contract is completed
    const contractEndDate = new Date(tenantData.contract_end_date)
    const currentDate = new Date()
    const isContractCompleted = currentDate >= contractEndDate
    const isEarlyTermination = currentDate < contractEndDate

    // Calculate deposit refund
    const securityDepositAmount = parseFloat(tenantData.security_deposit || 0)
    const securityUsedForBills = parseFloat(tenantData.security_used_for_bills || 0)
    const unpaidBills = unpaidBillsResult.rows
    const paidBills = paidBillsResult.rows
    const currentMonthPayment = currentMonthPaymentResult.rows
    
    const unpaidAmount = parseFloat(unpaidBills[0].total_amount || 0)
    
    let securityDepositRefund = 0
    if (isContractCompleted && unpaidBills[0].count === 0) {
      securityDepositRefund = Math.max(0, securityDepositAmount - securityUsedForBills)
    }

    // Advance payment handling
    const advancePaymentAmount = parseFloat(tenantData.advance_payment || 0)
    const advanceUsedForBills = parseFloat(tenantData.advance_used_for_bills || 0)
    const advancePaymentBalance = Math.max(0, advancePaymentAmount - advanceUsedForBills)
    
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
        last_bill_end_date: lastBillEndDate,
        next_bill_start_date: nextBillStartDate ? nextBillStartDate.toISOString().split('T')[0] : null
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
          used_for_bills: advanceUsedForBills,
          remaining_balance: advancePaymentBalance,
          status: tenantData.advance_payment_status,
          can_use_for_last_month: canUseAdvancePaymentForLastMonth,
          refundable_on_early_termination: isEarlyTermination && advancePaymentBalance > 0,
          business_rule: isEarlyTermination ?
            'Advance payment will be refunded on early termination' : 
            'Advance payment can be used for last month rent on contract completion'
        },
        security_deposit: {
          original_amount: securityDepositAmount,
          used_for_bills: securityUsedForBills,
          remaining_balance: Math.max(0, securityDepositAmount - securityUsedForBills),
          refund_amount: securityDepositRefund,
          status: tenantData.security_deposit_status,
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
          ...(isEarlyTermination ? [
            `Contract ends in ${daysRemaining} days - early termination`,
            `Advance payment (₱${advancePaymentBalance.toLocaleString()}) will be refunded`,
            `Security deposit will be kept (business rule for early termination)`
          ] : []),
          ...(isContractCompleted && canUseAdvancePaymentForLastMonth ? [
            `Advance payment (₱${advancePaymentBalance.toLocaleString()}) can be used for last month rent`
          ] : []),
          ...(unpaidAmount > 0 ? [`₱${unpaidAmount.toLocaleString()} in unpaid bills`] : []),
          ...(securityDepositRefund > 0 ? [`₱${securityDepositRefund.toLocaleString()} security deposit refund due`] : [])
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