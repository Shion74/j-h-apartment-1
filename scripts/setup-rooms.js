const { pool } = require('../lib/database');

async function setupRooms() {
  try {
    // Create branch
    const branchResult = await pool.query(
      'INSERT INTO branches (name, address) VALUES ($1, $2) RETURNING id',
      ['J & H apartment', 'Patin-ay, Prosperidad, Agusan Del Sur']
    );
    
    const branchId = branchResult.rows[0].id;
    console.log('Branch created successfully with ID:', branchId);

    // Create rooms
    const rooms = [1, 2, 3, 4, 5, 6, 7];
    for (const roomNumber of rooms) {
      await pool.query(
        'INSERT INTO rooms (room_number, branch_id, status, monthly_rent) VALUES ($1, $2, $3, $4)',
        [roomNumber.toString(), branchId, 'vacant', 3500.00]
      );
      console.log(`Room ${roomNumber} created successfully`);
    }

    console.log('All rooms created successfully');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

setupRooms(); 