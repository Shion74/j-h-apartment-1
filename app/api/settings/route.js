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

    // Get all settings
    const settingsResult = await pool.query(`
      SELECT setting_key, setting_value, setting_type, description 
      FROM system_settings 
      ORDER BY setting_key
    `)

    const settings = settingsResult.rows
    // Format settings into object
    const settingsObj = {}
    settings.forEach(setting => {
      let value = setting.setting_value
      
      // Convert based on type
      if (setting.setting_type === 'number') {
        value = parseFloat(value)
      } else if (setting.setting_type === 'boolean') {
        value = value === 'true'
      }
      
      settingsObj[setting.setting_key] = {
        value,
        type: setting.setting_type,
        description: setting.description
      }
    })

    return NextResponse.json({
      success: true,
      settings: settingsObj
    })

  } catch (error) {
    console.error('Settings fetch error:', error)
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

    const { setting_key, setting_value, setting_type } = await request.json()

    if (!setting_key || setting_value === undefined) {
      return NextResponse.json(
        { success: false, message: 'Setting key and value are required' },
        { status: 400 }
      )
    }

    // Update or insert setting
    await pool.query(`
      INSERT INTO system_settings (setting_key, setting_value, setting_type) 
      VALUES ($1, $2, $1) RETURNING id
      ON DUPLICATE KEY UPDATE 
      setting_value = VALUES(setting_value),
      setting_type = VALUES(setting_type),
      updated_at = CURRENT_TIMESTAMP
    `, [setting_key, setting_value.toString(), setting_type || 'string'])

    return NextResponse.json({
      success: true,
      message: 'Setting updated successfully'
    })

  } catch (error) {
    console.error('Setting update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 