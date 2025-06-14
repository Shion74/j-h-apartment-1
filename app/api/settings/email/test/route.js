import { NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth'
import nodemailer from 'nodemailer'

export async function POST(request) {
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
    
    const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_from_name } = emailSettings

    if (!smtp_host || !smtp_port || !smtp_user || !smtp_password) {
      return NextResponse.json(
        { success: false, message: 'All SMTP settings are required for testing' },
        { status: 400 }
      )
    }

    // Create transporter with provided settings
    const transporter = nodemailer.createTransporter({
      host: smtp_host,
      port: parseInt(smtp_port),
      secure: parseInt(smtp_port) === 465, // true for 465, false for other ports
      auth: {
        user: smtp_user,
        pass: smtp_password,
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    })

    // Test the connection
    try {
      await transporter.verify()
      
      // If verification passes, try sending a test email
      const testEmail = {
        from: `"${smtp_from_name || 'J&H Apartment Management'}" <${smtp_from_email || smtp_user}>`,
        to: smtp_user, // Send test email to the SMTP user
        subject: 'J&H Apartment - Email Configuration Test',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Email Configuration Test</h2>
            <p>This is a test email to verify your SMTP configuration is working correctly.</p>
            <p><strong>Configuration Details:</strong></p>
            <ul>
              <li>SMTP Host: ${smtp_host}</li>
              <li>SMTP Port: ${smtp_port}</li>
              <li>From Email: ${smtp_from_email || smtp_user}</li>
              <li>From Name: ${smtp_from_name || 'J&H Apartment Management'}</li>
            </ul>
            <p>If you received this email, your email configuration is working properly!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">
              This email was sent from J&H Apartment Management System
            </p>
          </div>
        `
      }

      await transporter.sendMail(testEmail)

      return NextResponse.json({
        success: true,
        message: `Email connection test successful! A test email has been sent to ${smtp_user}`
      })

    } catch (emailError) {
      console.error('Email test error:', emailError)
      
      let errorMessage = 'Email connection test failed'
      
      if (emailError.code === 'EAUTH') {
        errorMessage = 'Authentication failed. Please check your username and password.'
      } else if (emailError.code === 'ECONNECTION') {
        errorMessage = 'Connection failed. Please check your SMTP host and port.'
      } else if (emailError.code === 'ESOCKET') {
        errorMessage = 'Socket error. Please check your network connection.'
      } else if (emailError.message) {
        errorMessage = `Email test failed: ${emailError.message}`
      }

      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Email test error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error during email test' },
      { status: 500 }
    )
  }
} 