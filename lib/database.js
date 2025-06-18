import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'

// Supabase client
const supabaseUrl = 'https://qalxoheykkdfqsakvcad.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbHhvaGV5a2tkZnFzYWt2Y2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MjI4ODAsImV4cCI6MjA2NTQ5ODg4MH0.i-Mc45-v-j14QLidCt73idarVbvEMzVVWwtDM1ROCWA'
const supabase = createClient(supabaseUrl, supabaseKey)

// Database connection string for Vercel serverless
const connectionString = `postgresql://postgres.qalxoheykkdfqsakvcad:${process.env.SUPABASE_DB_PASSWORD || 'E$rNc9z?Wtpgq&%'}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`

// PostgreSQL connection pool optimized for serverless
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // Serverless optimizations
  max: 1, // Limit concurrent connections for serverless
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 10000,
  acquireTimeoutMillis: 10000,
})

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL database connection successful');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export { pool, supabase, testConnection }; 