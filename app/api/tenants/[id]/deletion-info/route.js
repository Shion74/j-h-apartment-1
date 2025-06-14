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
    const [tenant] = await pool.execute(`
      SELECT 
        t.*,
        r.room_number,
        r.monthly_rent,
        b.name as branch_name,
        b.address as branch_address
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE t.id = ?
    `, [id])

    if (tenant.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    const tenantData = tenant[0]

    // Check current month payment status
    const [currentMonthPayment] = await pool.execute(`
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN 'paid'
          ELSE 'unpaid'
        END as payment_status
      FROM bills 
      WHERE tenant_id = ? 
        AND status = 'paid'
        AND (
          (rent_from <= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND rent_to >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) OR
          (rent_from <= LAST_DAY(CURDATE()) AND rent_to >= LAST_DAY(CURDATE())) OR
          (rent_from >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND rent_to <= LAST_DAY(CURDATE()))
        )
    `, [id])

    // Get unpaid bills
    const [unpaidBills] = await pool.execute(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM bills 
      WHERE tenant_id = ? AND status = 'unpaid'
    `, [id])

    // Get paid bills total
    const [paidBills] = await pool.execute(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM bills 
      WHERE tenant_id = ? AND status = 'paid'
    `, [id])

    // Check if contract is completed
    const contractEndDate = new Date(tenantData.contract_end_date)
    const currentDate = new Date()
    const isContractCompleted = currentDate >= contractEndDate
    const isEarlyTermination = currentDate < contractEndDate

    // Calculate deposit refund
    const securityDepositAmount = parseFloat(tenantData.security_deposit || 0)
    const securityUsedForBills = parseFloat(tenantData.security_used_for_bills || 0)
    const unpaidAmount = parseFloat(unpaidBills[0].total_amount || 0)
    
    let securityDepositRefund = 0
    if (isContractCompleted && unpaidBills[0].count === 0) {
      securityDepositRefund = Math.max(0, securityDepositAmount - securityUsedForBills)
    }

    // Advance payment handling
    const advancePaymentAmount = parseFloat(tenantData.advance_payment || 0)
    const advanceUsedForBills = parseFloat(tenantData.advance_used_for_bills || 0)
    const advancePaymentBalance = Math.max(0, advancePaymentAmount - advanceUsedForBills)

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
        rent_start: tenantData.rent_start
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
          refundable: false // Advance payment is never refunded
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
          ...(isEarlyTermination ? [`Contract ends in ${daysRemaining} days - early termination`] : []),
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