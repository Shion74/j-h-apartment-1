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

    const { rate } = await request.json()

    if (!rate || parseFloat(rate) <= 0) {
      return NextResponse.json(
        { success: false, message: 'Valid electricity rate is required' },
        { status: 400 }
      )
    }

    // Update electricity rate setting
    await Setting.updateSetting('electric_rate_per_kwh', parseFloat(rate))

    return NextResponse.json({
      success: true,
      message: 'Electricity rate updated successfully'
    })

  } catch (error) {
    console.error('Error updating electricity rate:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update electricity rate' },
      { status: 500 }
    )
  }
} 