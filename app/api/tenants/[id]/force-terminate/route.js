import { NextResponse } from 'next/server'
import { pool } from '../../../../../lib/database'
import { requireAuth } from '../../../../../lib/auth'

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
    const { notes = 'Force terminated' } = await request.json()

    // Get tenant data
    const tenantResult = await pool.query(`
      SELECT 
        t.*,
        r.room_number,
        r.id as room_id
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      WHERE t.id = $1
    `, [id])

    if (tenantResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    const tenant = tenantResult.rows[0]
    const roomId = tenant.room_id

    // Begin transaction
    await pool.query('BEGIN')

    try {
      // 1. Archive the tenant to tenant_history
      await pool.query(`
        INSERT INTO tenant_history (
          original_tenant_id, name, email, phone, address, emergency_contact,
          emergency_phone, room_id, room_number, rent_start, rent_end, monthly_rent,
          advance_payment, security_deposit, contract_duration_months,
          contract_start_date, contract_end_date, move_out_date, reason_for_leaving,
          completed_cycles, contract_completed, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, false, $21
        )
      `, [
        id,
        tenant.name,
        tenant.email,
        tenant.phone,
        tenant.address || '',
        tenant.emergency_contact || '',
        tenant.emergency_phone || '',
        tenant.room_id,
        tenant.room_number,
        tenant.rent_start,
        tenant.rent_end,
        tenant.monthly_rent,
        tenant.advance_payment || 0,
        tenant.security_deposit || 0,
        tenant.contract_duration_months || 0,
        tenant.contract_start_date,
        tenant.contract_end_date,
        new Date(), // Current date as move-out date
        'force_termination',
        tenant.completed_cycles || 0,
        notes
      ])

      // 2. Update room status to available
      await pool.query(`
        UPDATE rooms
        SET status = 'available', tenant_id = NULL
        WHERE id = $1
      `, [roomId])

      // 3. Delete the tenant from active tenants
      await pool.query(`
        DELETE FROM tenants
        WHERE id = $1
      `, [id])

      // 4. Archive any deposit records
      await pool.query(`
        UPDATE tenant_deposits
        SET status = 'archived', notes = CONCAT(COALESCE(notes, ''), ' Force terminated on ', NOW()::date)
        WHERE tenant_id = $1
      `, [id])

      // Commit transaction
      await pool.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Tenant has been force terminated and archived',
        tenant_id: id,
        room_id: roomId
      })
    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK')
      console.error('Error during force termination:', error)
      throw error
    }
  } catch (error) {
    console.error('Force termination error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to force terminate tenant' },
      { status: 500 }
    )
  }
} 