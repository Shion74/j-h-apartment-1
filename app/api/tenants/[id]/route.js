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

    // Get current tenant data
    const [currentTenant] = await pool.execute(
      'SELECT * FROM tenants WHERE id = ?',
      [id]
    )

    if (currentTenant.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    const current = currentTenant[0]

    // Build update query dynamically
    const updateFields = []
    const updateValues = []

    const allowedFields = [
      'name', 'mobile', 'email', 'address', 'room_id', 'rent_start',
      'initial_electric_reading', 'advance_payment', 'security_deposit',
      'advance_payment_status', 'security_deposit_status', 'contract_status'
    ]

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`)
        updateValues.push(updateData[field])
      }
    })

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid fields to update' },
        { status: 400 }
      )
    }

    updateValues.push(id)

    // Update tenant
    await pool.execute(
      `UPDATE tenants SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    )

    // Handle room status changes
    if (updateData.room_id !== undefined) {
      // Free up old room if it exists
      if (current.room_id) {
        await pool.execute(
          'UPDATE rooms SET status = ? WHERE id = ?',
          ['vacant', current.room_id]
        )
      }

      // Occupy new room if assigned
      if (updateData.room_id) {
        await pool.execute(
          'UPDATE rooms SET status = ? WHERE id = ?',
          ['occupied', updateData.room_id]
        )
      }
    }

    // Get updated tenant data
    const [updatedTenant] = await pool.execute(`
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

    return NextResponse.json({
      success: true,
      message: 'Tenant updated successfully',
      tenant: updatedTenant[0]
    })

  } catch (error) {
    console.error('Tenant update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
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
      notes = '', 
      final_electric_reading = 0,
      force_delete = false 
    } = body

    // Get complete tenant data before deletion
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

    // Calculate contract completion and deposit refunds
    const contractEndDate = new Date(tenantData.contract_end_date)
    const currentDate = new Date()
    const isContractCompleted = currentDate >= contractEndDate
    const isEarlyTermination = currentDate < contractEndDate

    const securityDepositAmount = parseFloat(tenantData.security_deposit || 0)
    const securityUsedForBills = parseFloat(tenantData.security_used_for_bills || 0)
    
    let securityDepositRefund = 0
    if (isContractCompleted && !hasUnpaidBills) {
      securityDepositRefund = Math.max(0, securityDepositAmount - securityUsedForBills)
    }

    // Use connection for transaction
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

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
          security_deposit_refund_amount,
          total_bills_paid, total_bills_unpaid,
          reason_for_leaving, notes, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantData.id, tenantData.name, tenantData.mobile, tenantData.email, tenantData.address,
        tenantData.room_id, tenantData.room_number, tenantData.branch_name,
        tenantData.rent_start, currentDate.toISOString().split('T')[0], 
        tenantData.contract_start_date, tenantData.contract_end_date,
        tenantData.contract_duration_months, isContractCompleted,
        tenantData.initial_electric_reading, final_electric_reading,
        tenantData.advance_payment, tenantData.security_deposit,
        tenantData.advance_payment_status, tenantData.security_deposit_status,
        securityDepositRefund,
        paidBills[0].total_amount, unpaidBills[0].total_amount,
        reason_for_leaving, notes, 'admin'
      ])

      // Record security deposit refund transaction if applicable
      if (securityDepositRefund > 0) {
        await connection.execute(`
          INSERT INTO deposit_transactions (
            tenant_id, transaction_type, amount, description, created_by
          ) VALUES (?, 'security_refund', ?, ?, 'system')
        `, [
          tenantData.id, 
          securityDepositRefund, 
          `Security deposit refund on tenant departure - Contract ${isContractCompleted ? 'completed' : 'terminated early'}`,
          'admin'
        ])
      }

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
        message: `Tenant "${tenantData.name}" moved to history successfully`,
        tenant_history: {
          id: tenantData.id,
          name: tenantData.name,
          room_freed: tenantData.room_id ? true : false,
          contract_completed: isContractCompleted,
          security_deposit_refund: securityDepositRefund,
          reason_for_leaving: reason_for_leaving,
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