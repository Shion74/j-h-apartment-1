import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    // With JWT tokens, logout is handled client-side by removing the token
    // This endpoint exists for consistency and potential future server-side logout logic
    
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 