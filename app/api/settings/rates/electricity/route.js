import { NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth'
import Setting from '../../../../../models/setting.js'

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
    console.log('Electricity rate update request:', { rate })

    if (!rate || parseFloat(rate) <= 0) {
      console.log('Invalid rate provided:', rate)
      return NextResponse.json(
        { success: false, message: 'Valid electricity rate is required' },
        { status: 400 }
      )
    }

    const numericRate = parseFloat(rate)
    console.log('Parsed rate:', numericRate)

    // Get current value before update
    const currentValue = await Setting.getValue('electric_rate_per_kwh')
    console.log('Current electricity rate before update:', currentValue)

    // Update electricity rate setting
    const updateResult = await Setting.updateValue('electric_rate_per_kwh', numericRate)
    console.log('Update result:', updateResult)

    // Verify the update by checking the new value
    const newValue = await Setting.getValue('electric_rate_per_kwh')
    console.log('New electricity rate after update:', newValue)

    if (newValue !== numericRate) {
      console.error('Rate update failed - values dont match:', { expected: numericRate, actual: newValue })
      return NextResponse.json(
        { success: false, message: 'Rate update verification failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Electricity rate updated successfully',
      data: {
        previous_rate: currentValue,
        new_rate: newValue
      }
    })

  } catch (error) {
    console.error('Error updating electricity rate:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update electricity rate' },
      { status: 500 }
    )
  }
} 