import { pool } from '../lib/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanData() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'clean-tenant-data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Get a client from the pool
    const client = await pool.connect();
    
    try {
      // Execute the SQL script
      console.log('Starting data cleanup...');
      const result = await client.query(sql);
      
      // Log the verification results
      const verificationResult = result[result.length - 1].rows[0];
      console.log('\nCleanup verification:');
      console.log('-------------------');
      for (const [key, value] of Object.entries(verificationResult)) {
        console.log(`${key}: ${value}`);
      }
      
      console.log('\nData cleanup completed successfully!');
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('Error during data cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanData(); 