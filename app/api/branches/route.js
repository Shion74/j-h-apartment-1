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

    // Get all branches with room count and rates
    const branchesResult = await pool.query(`
      SELECT b.id, b.name, b.address, b.description,
             COALESCE(b.monthly_rent, 3500.00) as monthly_rent,
             COALESCE(b.water_rate, 200.00) as water_rate,
             COALESCE(b.electricity_rate, 12.00) as electricity_rate,
             b.created_at, b.updated_at,
             COUNT(r.id) as total_rooms,
             COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
             COUNT(CASE WHEN r.status = 'vacant' THEN 1 END) as vacant_rooms
      FROM branches b
      LEFT JOIN rooms r ON b.id = r.branch_id
      GROUP BY b.id, b.name, b.address, b.description, b.monthly_rent, b.water_rate, b.electricity_rate, b.created_at, b.updated_at
      ORDER BY b.name
    `)

    const branches = branchesResult.rows

    return NextResponse.json({
      success: true,
      branches: branches.map(branch => ({
        ...branch,
        total_rooms: parseInt(branch.total_rooms) || 0,
        occupied_rooms: parseInt(branch.occupied_rooms) || 0,
        vacant_rooms: parseInt(branch.vacant_rooms) || 0,
        occupancy_rate: branch.total_rooms > 0 
          ? Math.round((branch.occupied_rooms / branch.total_rooms) * 100) 
          : 0
      }))
    })

  } catch (error) {
    console.error('Get branches error:', error)
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

    const { 
      name, 
      address, 
      monthly_rent, 
      water_rate, 
      electricity_rate, 
      room_count,
      room_prefix = ''
    } = await request.json()

    // Validate required fields
    if (!name || !address || !monthly_rent || !water_rate || !electricity_rate || !room_count) {
      return NextResponse.json(
        { success: false, message: 'All fields are required: name, address, monthly_rent, water_rate, electricity_rate, room_count' },
        { status: 400 }
      )
    }

    // Validate numeric fields
    if (isNaN(monthly_rent) || monthly_rent <= 0) {
      return NextResponse.json(
        { success: false, message: 'Monthly rent must be a positive number' },
        { status: 400 }
      )
    }

    if (isNaN(water_rate) || water_rate <= 0) {
      return NextResponse.json(
        { success: false, message: 'Water rate must be a positive number' },
        { status: 400 }
      )
    }

    if (isNaN(electricity_rate) || electricity_rate <= 0) {
      return NextResponse.json(
        { success: false, message: 'Electricity rate must be a positive number' },
        { status: 400 }
      )
    }

    if (isNaN(room_count) || room_count <= 0 || room_count > 100) {
      return NextResponse.json(
        { success: false, message: 'Room count must be a positive number between 1 and 100' },
        { status: 400 }
      )
    }

    // Check if branch name already exists
    const existingBranchesResult = await pool.query(
      'SELECT id FROM branches WHERE name = $1',
      [name]
    )

    const existingBranches = existingBranchesResult.rows
    if (existingBranches.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Branch name already exists' },
        { status: 400 }
      )
    }

    // Insert new branch with rates
    const branchResult = await pool.query(`
      INSERT INTO branches (name, address, description, monthly_rent, water_rate, electricity_rate)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [name, address, '', parseFloat(monthly_rent), parseFloat(water_rate), parseFloat(electricity_rate)])

    const branchId = branchResult.rows[0].id

    // Create rooms automatically
    for (let i = 1; i <= parseInt(room_count); i++) {
      const roomNumber = room_prefix ? `${room_prefix}${i.toString().padStart(2, '0')}` : i.toString()
      await pool.query(`
        INSERT INTO rooms (room_number, monthly_rent, branch_id, status)
        VALUES ($1, $2, $3, $4)
      `, [roomNumber, parseFloat(monthly_rent), branchId, 'vacant'])
    }

    // Get the newly created branch with room count and rates
    const newBranchResult = await pool.query(`
      SELECT b.id, b.name, b.address, b.description,
             b.monthly_rent, b.water_rate, b.electricity_rate,
             b.created_at, b.updated_at,
             COUNT(r.id) as total_rooms,
             COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
             COUNT(CASE WHEN r.status = 'vacant' THEN 1 END) as vacant_rooms
      FROM branches b
      LEFT JOIN rooms r ON b.id = r.branch_id
      WHERE b.id = $1
      GROUP BY b.id, b.name, b.address, b.description, b.monthly_rent, b.water_rate, b.electricity_rate, b.created_at, b.updated_at
    `, [branchId])

    const newBranch = newBranchResult.rows

    return NextResponse.json({
      success: true,
      message: `Branch created successfully with ${room_count} rooms`,
      branch: {
        ...newBranch[0],
        total_rooms: parseInt(newBranch[0].total_rooms) || 0,
        occupied_rooms: parseInt(newBranch[0].occupied_rooms) || 0,
        vacant_rooms: parseInt(newBranch[0].vacant_rooms) || 0,
        occupancy_rate: 0
      }
    })

  } catch (error) {
    console.error('Create branch error:', error)
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

    const { id, name, address, description } = await request.json()

    // Validate required fields
    if (!id || !name || !address) {
      return NextResponse.json(
        { success: false, message: 'ID, branch name and address are required' },
        { status: 400 }
      )
    }

    // Check if branch exists
    const existingResult = await pool.query(
      'SELECT id FROM branches WHERE id = $1',
      [id]
    )

    const existing = existingResult.rows
    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Branch not found' },
        { status: 404 }
      )
    }

    // Check if new branch name conflicts with other branches
    const nameConflictResult = await pool.query(
      'SELECT id FROM branches WHERE name = $1 AND id != $2',
      [name, id]
    )

    const nameConflict = nameConflictResult.rows
    if (nameConflict.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Branch name already exists' },
        { status: 400 }
      )
    }

    // Update branch
    await pool.query(`
      UPDATE branches 
      SET name = $1, address = $2, description = $3
      WHERE id = $4
    `, [name, address, description || null, id])

    return NextResponse.json({
      success: true,
      message: 'Branch updated successfully',
      branch: {
        id,
        name,
        address,
        description
      }
    })

  } catch (error) {
    console.error('Update branch error:', error)
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
        { success: false, message: 'Branch ID is required' },
        { status: 400 }
      )
    }

    // Check if branch exists and has occupied rooms
    const occupiedRoomsResult = await pool.query(
      'SELECT COUNT(*) as occupied_count FROM rooms WHERE branch_id = $1 AND status = $2',
      [id, 'occupied']
    )

    if (occupiedRoomsResult.rows[0].occupied_count > 0) {
      return NextResponse.json(
        { success: false, message: 'Cannot delete branch with occupied rooms' },
        { status: 400 }
      )
    }

    // Start transaction
    await pool.query('BEGIN')

    try {
      // Delete all rooms in the branch
      await pool.query(
        'DELETE FROM rooms WHERE branch_id = $1',
        [id]
      )

      // Delete the branch
      const deleteResult = await pool.query(
        'DELETE FROM branches WHERE id = $1',
        [id]
      )

      if (deleteResult.rowCount === 0) {
        await pool.query('ROLLBACK')
        return NextResponse.json(
          { success: false, message: 'Branch not found' },
          { status: 404 }
        )
      }

      await pool.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Branch and all its rooms deleted successfully'
      })

    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Delete branch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 