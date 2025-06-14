import { NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth'

const Branch = require('../../../../../models/branch')

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
    const body = await request.json()
    const { monthly_rent, water_rate, electricity_rate, sync_rooms = false } = body

    // Validate required fields
    if (!monthly_rent || !water_rate || !electricity_rate) {
      return NextResponse.json(
        { success: false, message: 'Monthly rent, water rate, and electricity rate are required' },
        { status: 400 }
      )
    }

    // Validate rates are positive numbers
    if (monthly_rent <= 0 || water_rate <= 0 || electricity_rate <= 0) {
      return NextResponse.json(
        { success: false, message: 'All rates must be positive numbers' },
        { status: 400 }
      )
    }

    // Check if branch exists
    const existingBranch = await Branch.findById(id)
    if (!existingBranch) {
      return NextResponse.json(
        { success: false, message: 'Branch not found' },
        { status: 404 }
      )
    }

    // Update branch rates
    await Branch.updateRates(id, {
      monthly_rent: parseFloat(monthly_rent),
      water_rate: parseFloat(water_rate),
      electricity_rate: parseFloat(electricity_rate)
    })

    // Optionally sync all rooms in branch to use the new monthly rent
    if (sync_rooms) {
      await Branch.syncRoomRates(id)
    }

    // Get updated branch data
    const updatedBranch = await Branch.findById(id)

    return NextResponse.json({
      success: true,
      message: sync_rooms 
        ? 'Branch rates updated and all rooms synced successfully'
        : 'Branch rates updated successfully',
      branch: updatedBranch
    })

  } catch (error) {
    console.error('Error updating branch rates:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update branch rates' },
      { status: 500 }
    )
  }
} 