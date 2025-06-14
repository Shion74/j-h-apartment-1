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
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Get current user data
      const [currentUser] = await connection.execute(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      )

      if (currentUser.length === 0) {
        await connection.rollback()
        connection.release()
        return NextResponse.json(
          { success: false, message: 'User not found' },
          { status: 404 }
        )
      }

      const user = currentUser[0]

      // If changing password, verify current password
      if (newPassword) {
        if (!currentPassword) {
          await connection.rollback()
          connection.release()
          return NextResponse.json(
            { success: false, message: 'Current password is required to change password' },
            { status: 400 }
          )
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
        if (!isCurrentPasswordValid) {
          await connection.rollback()
          connection.release()
          return NextResponse.json(
            { success: false, message: 'Current password is incorrect' },
            { status: 400 }
          )
        }
      }

      // Check if username is already taken by another user
      if (username !== user.username) {
        const [existingUser] = await connection.execute(
          'SELECT id FROM users WHERE username = ? AND id != ?',
          [username, userId]
        )

        if (existingUser.length > 0) {
          await connection.rollback()
          connection.release()
          return NextResponse.json(
            { success: false, message: 'Username is already taken' },
            { status: 400 }
          )
        }
      }

      // First, check if email column exists
      const [columns] = await connection.execute(
        "SHOW COLUMNS FROM users LIKE 'email'"
      )

      let updateQuery = 'UPDATE users SET username = ?'
      let updateParams = [username]

      // Add email to update if column exists
      if (columns.length > 0) {
        updateQuery += ', email = ?'
        updateParams.push(email || null)
      } else {
        // Add email column if it doesn't exist
        await connection.execute(
          'ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER password'
        )
        updateQuery += ', email = ?'
        updateParams.push(email || null)
      }

      // Add password to update if provided
      if (newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        updateQuery += ', password = ?'
        updateParams.push(hashedPassword)
      }

      updateQuery += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      updateParams.push(userId)

      // Update user
      await connection.execute(updateQuery, updateParams)

      // Commit transaction
      await connection.commit()
      connection.release()

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
      await connection.rollback()
      connection.release()
      throw error
    }

  } catch (error) {
    console.error('Account update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 