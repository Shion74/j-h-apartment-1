import { NextResponse } from 'next/server'
import { pool, testConnection } from '../../../lib/database'

export async function GET() {
  try {
    console.log('Testing database connection...')
    
    // Test basic connection
    const connectionTest = await testConnection()
    
    // Test a simple query
    const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version')
    const dbInfo = result.rows[0]
    
    // Test tenants table
    const tenantsTest = await pool.query('SELECT COUNT(*) as tenant_count FROM tenants')
    const tenantCount = tenantsTest.rows[0].tenant_count
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      connectionTest,
      dbInfo: {
        currentTime: dbInfo.current_time,
        postgresVersion: dbInfo.postgres_version,
        tenantCount: tenantCount
      },
      environment: {
        hasSupabaseKey: !!process.env.SUPABASE_KEY,
        hasDbPassword: !!process.env.SUPABASE_DB_PASSWORD,
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    })
  } catch (error) {
    console.error('Database test failed:', error)
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      environment: {
        hasSupabaseKey: !!process.env.SUPABASE_KEY,
        hasDbPassword: !!process.env.SUPABASE_DB_PASSWORD,
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    }, { status: 500 })
  }
} 