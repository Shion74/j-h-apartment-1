import { NextResponse } from 'next/server'
import { pool } from '../../../../../lib/database'
import { requireAuth } from '../../../../../lib/auth'

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

    // Get penalty fee percentage setting
    const settingResult = await pool.query(`
      SELECT setting_value 
      FROM settings 
      WHERE setting_key = 'penalty_fee_percentage'
    `)
    
    const percentage = settingResult.rows.length > 0 
      ? parseFloat(settingResult.rows[0].setting_value) 
      : 1.00 // Default 1%

    return NextResponse.json({
      success: true,
      percentage
    })

  } catch (error) {
    console.error('Penalty fee percentage fetch error:', error)
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

    const { percentage } = await request.json()

    // Validate percentage
    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      return NextResponse.json(
        { success: false, message: 'Penalty fee percentage must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Update penalty fee percentage in database
    await pool.query(`
      INSERT INTO settings (setting_key, setting_value, description) 
      VALUES ($1, $2, $3)
      ON CONFLICT (setting_key) 
      DO UPDATE SET 
        setting_value = EXCLUDED.setting_value,
        updated_at = CURRENT_TIMESTAMP
    `, ['penalty_fee_percentage', percentage.toString(), 'Late payment penalty fee percentage'])

    return NextResponse.json({
      success: true,
      message: `Penalty fee percentage updated to ${percentage}%`
    })

  } catch (error) {
    console.error('Penalty fee percentage update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 