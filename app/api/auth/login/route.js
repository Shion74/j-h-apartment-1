import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { generateToken, comparePassword } from '../../../../lib/auth'

export async function POST(request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Find user by username
    const rowsResult = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    )

    const rows = rowsResult.rows
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const user = rows[0]

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Generate JWT token
    const token = generateToken(user)

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token,
      user: userWithoutPassword
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 