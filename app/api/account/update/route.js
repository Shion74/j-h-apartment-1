import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'
import bcrypt from 'bcrypt'

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

    const { username, email, currentPassword, newPassword } = await request.json()
    const userId = authResult.user.id

    if (!username) {
      return NextResponse.json(
        { success: false, message: 'Username is required' },
        { status: 400 }
      )
    }

    // Start transaction
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      // Get current user data
      const currentUserResult = await client.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      )

      if (currentUserResult.rows.length === 0) {
        await client.query('ROLLBACK')
        client.release()
        return NextResponse.json(
          { success: false, message: 'User not found' },
          { status: 404 }
        )
      }

      const user = currentUserResult.rows[0]

      // If changing password, verify current password
      if (newPassword) {
        if (!currentPassword) {
          await client.query('ROLLBACK')
          client.release()
          return NextResponse.json(
            { success: false, message: 'Current password is required to change password' },
            { status: 400 }
          )
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
        if (!isCurrentPasswordValid) {
          await client.query('ROLLBACK')
          client.release()
          return NextResponse.json(
            { success: false, message: 'Current password is incorrect' },
            { status: 400 }
          )
        }
      }

      // Check if username is already taken by another user
      if (username !== user.username) {
        const existingUserResult = await client.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, userId]
        )

        if (existingUserResult.rows.length > 0) {
          await client.query('ROLLBACK')
          client.release()
          return NextResponse.json(
            { success: false, message: 'Username is already taken' },
            { status: 400 }
          )
        }
      }

      // Check if email column exists
      const columnsResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email'
      `)

      let updateQuery = 'UPDATE users SET username = $1'
      let updateParams = [username]
      let paramCount = 1

      // Add email to update if column exists
      if (columnsResult.rows.length > 0) {
        updateQuery += `, email = $${++paramCount}`
        updateParams.push(email || null)
      } else {
        // Add email column if it doesn't exist
        await client.query(
          'ALTER TABLE users ADD COLUMN email VARCHAR(255)'
        )
        updateQuery += `, email = $${++paramCount}`
        updateParams.push(email || null)
      }

      // Add password to update if provided
      if (newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        updateQuery += `, password = $${++paramCount}`
        updateParams.push(hashedPassword)
      }

      updateQuery += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${++paramCount}`
      updateParams.push(userId)

      // Update user
      await client.query(updateQuery, updateParams)

      // Commit transaction
      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Account updated successfully',
        user: {
          id: userId,
          username: username,
          email: email || null,
          role: user.role
        }
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Account update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 