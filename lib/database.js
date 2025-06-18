import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'

// Supabase client
const supabaseUrl = 'https://qalxoheykkdfqsakvcad.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbHhvaGV5a2tkZnFzYWt2Y2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MjI4ODAsImV4cCI6MjA2NTQ5ODg4MH0.i-Mc45-v-j14QLidCt73idarVbvEMzVVWwtDM1ROCWA'
const supabase = createClient(supabaseUrl, supabaseKey)

// PostgreSQL connection pool
const pool = new Pool({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.qalxoheykkdfqsakvcad',
  password: process.env.SUPABASE_DB_PASSWORD || 'E$rNc9z?Wtpgq&%',
  ssl: { rejectUnauthorized: false }
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