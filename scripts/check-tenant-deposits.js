const { pool } = require('../lib/database');

async function checkTenantDeposits() {
  try {
    // Get tenant info
    const tenantResult = await pool.query(`
      SELECT t.*, r.room_number 
      FROM tenants t 
      LEFT JOIN rooms r ON t.room_id = r.id 
      WHERE t.id = 1
    `);
    
    if (tenantResult.rows.length > 0) {
      console.log('\nTenant Info:');
      console.log('-----------');
      console.log(tenantResult.rows[0]);
    } else {
      console.log('No tenant found with ID 1');
    }

    // Get deposit records
    const depositsResult = await pool.query(`
      SELECT * FROM tenant_deposits 
      WHERE tenant_id = 1 
      ORDER BY deposit_type, created_at
    `);

    console.log('\nDeposit Records:');
    console.log('---------------');
    console.log(depositsResult.rows);

    // Get deposit transactions
    const transactionsResult = await pool.query(`
      SELECT * FROM deposit_transactions 
      WHERE tenant_id = 1 
      ORDER BY created_at
    `);

    console.log('\nDeposit Transactions:');
    console.log('-------------------');
    console.log(transactionsResult.rows);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTenantDeposits(); 