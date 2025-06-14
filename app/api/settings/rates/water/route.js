import { NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth'

const Setting = require('../../../../../models/setting')

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

    const { amount } = await request.json()

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { success: false, message: 'Valid water amount is required' },
        { status: 400 }
      )
    }

    // Update water amount setting
    await Setting.updateSetting('water_fixed_amount', parseFloat(amount))

    return NextResponse.json({
      success: true,
      message: 'Water amount updated successfully'
    })

  } catch (error) {
    console.error('Error updating water amount:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update water amount' },
      { status: 500 }
    )
  }
} 