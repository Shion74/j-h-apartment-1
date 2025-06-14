import { NextResponse } from 'next/server'
import { pool } from '../../../../../../lib/database'
import { requireAuth } from '../../../../../../lib/auth'

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

    const { tenantId } = params

    // Get tenant deposit information
    const [tenantRows] = await pool.execute(
      'SELECT advance_payment, security_deposit, deposit_status FROM tenants WHERE id = ?',
      [tenantId]
    )

    if (tenantRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    const tenant = tenantRows[0]

    // Calculate advance payment balance
    const [advanceUsage] = await pool.execute(`
      SELECT COALESCE(SUM(amount), 0) as used_amount
      FROM deposit_transactions 
      WHERE tenant_id = ? AND transaction_type = 'advance_payment' AND type = 'usage'
    `, [tenantId])

    // Calculate security deposit balance  
    const [securityUsage] = await pool.execute(`
      SELECT COALESCE(SUM(amount), 0) as used_amount
      FROM deposit_transactions 
      WHERE tenant_id = ? AND transaction_type = 'security_deposit' AND type = 'usage'
    `, [tenantId])

    const advanceTotal = parseFloat(tenant.advance_payment) || 0
    const securityTotal = parseFloat(tenant.security_deposit) || 0
    const advanceUsed = parseFloat(advanceUsage[0].used_amount) || 0
    const securityUsed = parseFloat(securityUsage[0].used_amount) || 0

    const balance = {
      advance_payment: {
        total: advanceTotal,
        used: advanceUsed,
        available: Math.max(0, advanceTotal - advanceUsed),
        status: tenant.deposit_status || 'pending'
      },
      security_deposit: {
        total: securityTotal,
        used: securityUsed,
        available: Math.max(0, securityTotal - securityUsed),
        status: tenant.deposit_status || 'pending'
      }
    }

    return NextResponse.json({
      success: true,
      balance
    })

  } catch (error) {
    console.error('Deposit balance fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 