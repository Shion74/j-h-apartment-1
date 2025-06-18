import { NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth'

import User from '../../../../models/user.js'

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

    // Get user details
    const user = await User.findById(authResult.user.id)
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user
    })

  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 