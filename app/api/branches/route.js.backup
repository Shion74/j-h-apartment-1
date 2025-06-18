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

    // Get all branches with room count
    const [branches] = await pool.execute(`
      SELECT b.*, 
             COUNT(r.id) as total_rooms,
             COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
             COUNT(CASE WHEN r.status = 'vacant' THEN 1 END) as vacant_rooms
      FROM branches b
      LEFT JOIN rooms r ON b.id = r.branch_id
      GROUP BY b.id
      ORDER BY b.name
    `)

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
    const [existingBranches] = await pool.execute(
      'SELECT id FROM branches WHERE name = ?',
      [name]
    )

    if (existingBranches.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Branch name already exists' },
        { status: 400 }
      )
    }

    // Start transaction
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Insert new branch
      const [branchResult] = await connection.execute(`
        INSERT INTO branches (name, address, monthly_rent, water_rate, electricity_rate)
        VALUES (?, ?, ?, ?, ?)
      `, [name, address, parseFloat(monthly_rent), parseFloat(water_rate), parseFloat(electricity_rate)])

      const branchId = branchResult.insertId

      // Create rooms automatically
      const roomInserts = []
      for (let i = 1; i <= parseInt(room_count); i++) {
        const roomNumber = room_prefix ? `${room_prefix}${i.toString().padStart(2, '0')}` : i.toString()
        roomInserts.push([roomNumber, parseFloat(monthly_rent), branchId, 'vacant'])
      }

      // Batch insert rooms
      await connection.execute(`
        INSERT INTO rooms (room_number, monthly_rent, branch_id, status)
        VALUES ${roomInserts.map(() => '(?, ?, ?, ?)').join(', ')}
      `, roomInserts.flat())

      // Commit transaction
      await connection.commit()

      // Get the newly created branch with room count
      const [newBranch] = await pool.execute(`
        SELECT b.*, 
               COUNT(r.id) as total_rooms,
               COUNT(CASE WHEN r.status = 'occupied' THEN 1 END) as occupied_rooms,
               COUNT(CASE WHEN r.status = 'vacant' THEN 1 END) as vacant_rooms
        FROM branches b
        LEFT JOIN rooms r ON b.id = r.branch_id
        WHERE b.id = ?
        GROUP BY b.id
      `, [branchId])

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
      // Rollback transaction on error
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

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
    const [existing] = await pool.execute(
      'SELECT id FROM branches WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Branch not found' },
        { status: 404 }
      )
    }

    // Check if new branch name conflicts with other branches
    const [nameConflict] = await pool.execute(
      'SELECT id FROM branches WHERE name = ? AND id != ?',
      [name, id]
    )

    if (nameConflict.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Branch name already exists' },
        { status: 400 }
      )
    }

    // Update branch
    await pool.execute(`
      UPDATE branches 
      SET name = ?, address = ?, description = ?
      WHERE id = ?
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

    // Check if branch has rooms
    const [rooms] = await pool.execute(
      'SELECT COUNT(*) as room_count FROM rooms WHERE branch_id = ?',
      [id]
    )

    if (rooms[0].room_count > 0) {
      return NextResponse.json(
        { success: false, message: 'Cannot delete branch with existing rooms' },
        { status: 400 }
      )
    }

    // Delete branch
    const [result] = await pool.execute(
      'DELETE FROM branches WHERE id = ?',
      [id]
    )

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Branch not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Branch deleted successfully'
    })

  } catch (error) {
    console.error('Delete branch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 