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

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Room ID is required' },
        { status: 400 }
      )
    }

    // Get room with branch info
    const roomResult = await pool.query(`
      SELECT r.*, b.name as branch_name, b.address as branch_address,
             t.name as tenant_name, t.email as tenant_email, t.mobile as tenant_mobile,
             t.contract_start_date, t.contract_end_date
      FROM rooms r
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN tenants t ON r.id = t.room_id AND t.status = 'active'
      WHERE r.id = $1
    `, [id])

    const rooms = roomResult.rows
    if (rooms.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Room not found' },
        { status: 404 }
      )
    }

    const room = rooms[0]
    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        room_number: room.room_number,
        monthly_rent: parseFloat(room.monthly_rent) || 0,
        status: room.status,
        branch_id: room.branch_id,
        branch_name: room.branch_name,
        branch_address: room.branch_address,
        tenant: room.tenant_name ? {
          name: room.tenant_name,
          email: room.tenant_email,
          mobile: room.tenant_mobile,
          contract_start: room.contract_start_date,
          contract_end: room.contract_end_date
        } : null,
        created_at: room.created_at,
        updated_at: room.updated_at
      }
    })

  } catch (error) {
    console.error('Get room error:', error)
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
    const { room_number, monthly_rent, branch_id, status } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Room ID is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!room_number || !monthly_rent || !branch_id) {
      return NextResponse.json(
        { success: false, message: 'Room number, monthly rent, and branch are required' },
        { status: 400 }
      )
    }

    // Validate monthly rent
    if (isNaN(monthly_rent) || parseFloat(monthly_rent) <= 0) {
      return NextResponse.json(
        { success: false, message: 'Monthly rent must be a positive number' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['vacant', 'occupied', 'maintenance']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status. Must be: vacant, occupied, or maintenance' },
        { status: 400 }
      )
    }

    // Check if room exists
    const existingRoomsResult = await pool.query(
      'SELECT id FROM rooms WHERE id = $1',
      [id]
    )

    const existingRooms = existingRoomsResult.rows
    if (existingRooms.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Room not found' },
        { status: 404 }
      )
    }

    // Check if branch exists
    const branchesResult = await pool.query(
      'SELECT id FROM branches WHERE id = $1',
      [branch_id]
    )

    const branches = branchesResult.rows
    if (branches.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Branch not found' },
        { status: 404 }
      )
    }

    // Check if room number conflicts with other rooms in the same branch
    const roomConflictsResult = await pool.query(
      'SELECT id FROM rooms WHERE room_number = $1 AND branch_id = $2 AND id != $3',
      [room_number, branch_id, id]
    )

    const roomConflicts = roomConflictsResult.rows
    if (roomConflicts.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Room number already exists in this branch' },
        { status: 400 }
      )
    }

    // Update room
    await pool.query(`
      UPDATE rooms 
      SET room_number = $1, monthly_rent = $2, branch_id = $3, status = COALESCE($4, status), updated_at = NOW()
      WHERE id = $5
    `, [room_number, parseFloat(monthly_rent), branch_id, status, id])

    // Get updated room with branch info
    const updatedRoomResult = await pool.query(`
      SELECT r.*, b.name as branch_name, b.address as branch_address,
             t.name as tenant_name, t.email as tenant_email
      FROM rooms r
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN tenants t ON r.id = t.room_id AND t.status = 'active'
      WHERE r.id = $1
    `, [id])

    const updatedRoom = updatedRoomResult.rows[0]
    return NextResponse.json({
      success: true,
      message: 'Room updated successfully',
      room: {
        id: updatedRoom.id,
        room_number: updatedRoom.room_number,
        monthly_rent: parseFloat(updatedRoom.monthly_rent),
        status: updatedRoom.status,
        branch_id: updatedRoom.branch_id,
        branch_name: updatedRoom.branch_name,
        branch_address: updatedRoom.branch_address,
        tenant: updatedRoom.tenant_name ? {
          name: updatedRoom.tenant_name,
          email: updatedRoom.tenant_email
        } : null
      }
    })

  } catch (error) {
    console.error('Update room error:', error)
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

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Room ID is required' },
        { status: 400 }
      )
    }

    // Check if room has active tenants
    const tenantsResult = await pool.query(
      'SELECT COUNT(*) as tenant_count FROM tenants WHERE room_id = $1 AND status = $2',
      [id, 'active']
    )

    const tenants = tenantsResult.rows
    if (tenants[0].tenant_count > 0) {
      return NextResponse.json(
        { success: false, message: 'Cannot delete room with active tenants' },
        { status: 400 }
      )
    }

    // Delete room
    const result = await pool.query(
      'DELETE FROM rooms WHERE id = $1',
      [id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Room not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Room deleted successfully'
    })

  } catch (error) {
    console.error('Delete room error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 