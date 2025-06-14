import { NextResponse } from 'next/server'
import { pool } from '../../../lib/database'
import { requireAuth } from '../../../lib/auth'

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

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')
    const status = searchParams.get('status')

    let query = `
      SELECT r.*, b.name as branch_name, b.address as branch_address,
             t.name as tenant_name, t.email as tenant_email, t.mobile as tenant_mobile,
             t.contract_start_date, t.contract_end_date
      FROM rooms r
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN tenants t ON r.id = t.room_id AND t.contract_status = 'active'
    `
    
    const params = []
    const conditions = []

    if (branchId) {
      conditions.push('r.branch_id = ?')
      params.push(branchId)
    }

    if (status) {
      conditions.push('r.status = ?')
      params.push(status)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY b.name, r.room_number'

    const [rooms] = await pool.execute(query, params)

    return NextResponse.json({
      success: true,
      rooms: rooms.map(room => ({
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
      }))
    })

  } catch (error) {
    console.error('Get rooms error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
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

    const { room_number, monthly_rent, branch_id } = await request.json()

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

    // Check if branch exists
    const [branches] = await pool.execute(
      'SELECT id FROM branches WHERE id = ?',
      [branch_id]
    )

    if (branches.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Branch not found' },
        { status: 404 }
      )
    }

    // Check if room number already exists in the branch
    const [existingRooms] = await pool.execute(
      'SELECT id FROM rooms WHERE room_number = ? AND branch_id = ?',
      [room_number, branch_id]
    )

    if (existingRooms.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Room number already exists in this branch' },
        { status: 400 }
      )
    }

    // Insert new room
    const [result] = await pool.execute(`
      INSERT INTO rooms (room_number, monthly_rent, branch_id, status)
      VALUES (?, ?, ?, 'vacant')
    `, [room_number, parseFloat(monthly_rent), branch_id])

    // Get the newly created room with branch info
    const [newRoom] = await pool.execute(`
      SELECT r.*, b.name as branch_name, b.address as branch_address
      FROM rooms r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.id = ?
    `, [result.insertId])

    return NextResponse.json({
      success: true,
      message: 'Room created successfully',
      room: {
        id: newRoom[0].id,
        room_number: newRoom[0].room_number,
        monthly_rent: parseFloat(newRoom[0].monthly_rent),
        status: newRoom[0].status,
        branch_id: newRoom[0].branch_id,
        branch_name: newRoom[0].branch_name,
        branch_address: newRoom[0].branch_address,
        tenant: null
      }
    })

  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { id, room_number, monthly_rent, branch_id, status } = await request.json()

    // Validate required fields
    if (!id || !room_number || !monthly_rent || !branch_id) {
      return NextResponse.json(
        { success: false, message: 'ID, room number, monthly rent, and branch are required' },
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
    const [existingRooms] = await pool.execute(
      'SELECT id FROM rooms WHERE id = ?',
      [id]
    )

    if (existingRooms.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Room not found' },
        { status: 404 }
      )
    }

    // Check if branch exists
    const [branches] = await pool.execute(
      'SELECT id FROM branches WHERE id = ?',
      [branch_id]
    )

    if (branches.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Branch not found' },
        { status: 404 }
      )
    }

    // Check if room number conflicts with other rooms in the same branch
    const [roomConflicts] = await pool.execute(
      'SELECT id FROM rooms WHERE room_number = ? AND branch_id = ? AND id != ?',
      [room_number, branch_id, id]
    )

    if (roomConflicts.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Room number already exists in this branch' },
        { status: 400 }
      )
    }

    // Update room
    await pool.execute(`
      UPDATE rooms 
      SET room_number = ?, monthly_rent = ?, branch_id = ?, status = COALESCE(?, status)
      WHERE id = ?
    `, [room_number, parseFloat(monthly_rent), branch_id, status, id])

    // Get updated room with branch info
    const [updatedRoom] = await pool.execute(`
      SELECT r.*, b.name as branch_name, b.address as branch_address,
             t.name as tenant_name, t.email as tenant_email
      FROM rooms r
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN tenants t ON r.id = t.room_id AND t.contract_status = 'active'
      WHERE r.id = ?
    `, [id])

    return NextResponse.json({
      success: true,
      message: 'Room updated successfully',
      room: {
        id: updatedRoom[0].id,
        room_number: updatedRoom[0].room_number,
        monthly_rent: parseFloat(updatedRoom[0].monthly_rent),
        status: updatedRoom[0].status,
        branch_id: updatedRoom[0].branch_id,
        branch_name: updatedRoom[0].branch_name,
        branch_address: updatedRoom[0].branch_address,
        tenant: updatedRoom[0].tenant_name ? {
          name: updatedRoom[0].tenant_name,
          email: updatedRoom[0].tenant_email
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

export async function DELETE(request) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Room ID is required' },
        { status: 400 }
      )
    }

    // Check if room has active tenants
    const [tenants] = await pool.execute(
      'SELECT COUNT(*) as tenant_count FROM tenants WHERE room_id = ? AND contract_status = "active"',
      [id]
    )

    if (tenants[0].tenant_count > 0) {
      return NextResponse.json(
        { success: false, message: 'Cannot delete room with active tenants' },
        { status: 400 }
      )
    }

    // Delete room
    const [result] = await pool.execute(
      'DELETE FROM rooms WHERE id = ?',
      [id]
    )

    if (result.affectedRows === 0) {
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