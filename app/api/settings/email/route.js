import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'

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

    // Get email settings from database
    const settingsResult = await pool.query(`
      SELECT setting_key, setting_value 
      FROM settings 
      WHERE setting_key IN (
        'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 
        'smtp_from_email', 'smtp_from_name'
      )
    `)

    const settings = settingsResult.rows

    // Format settings into object
    const emailSettings = {
      smtp_host: '',
      smtp_port: '587',
      smtp_user: '',
      smtp_password: '',
      smtp_from_email: 'admin@jhapartment.com',
      smtp_from_name: 'J&H Apartment Management'
    }

    settings.forEach(setting => {
      emailSettings[setting.setting_key] = setting.setting_value
    })

    return NextResponse.json({
      success: true,
      settings: emailSettings
    })

  } catch (error) {
    console.error('Email settings fetch error:', error)
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

    const emailSettings = await request.json()
    
    const validSettings = [
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 
      'smtp_from_email', 'smtp_from_name'
    ]

    // Start transaction
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      // Update each setting
      for (const [key, value] of Object.entries(emailSettings)) {
        if (validSettings.includes(key)) {
          await client.query(`
            INSERT INTO settings (setting_key, setting_value, description) 
            VALUES ($1, $2, $3)
            ON CONFLICT (setting_key) 
            DO UPDATE SET 
              setting_value = EXCLUDED.setting_value,
              updated_at = CURRENT_TIMESTAMP
          `, [
            key, 
            value || '', 
            getSettingDescription(key)
          ])
        }
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Email settings updated successfully'
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Email settings update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getSettingDescription(key) {
  const descriptions = {
    'smtp_host': 'SMTP server host for email notifications',
    'smtp_port': 'SMTP server port',
    'smtp_user': 'SMTP username for authentication',
    'smtp_password': 'SMTP password for authentication',
    'smtp_from_email': 'From email address for notifications',
    'smtp_from_name': 'From name for email notifications'
  }
  return descriptions[key] || ''
} 