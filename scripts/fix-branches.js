const { pool } = require('../lib/database');

async function fixBranches() {
  try {
    // Get all branches
    const branchesResult = await pool.query('SELECT * FROM branches ORDER BY id');
    console.log('Current branches:', branchesResult.rows);

    if (branchesResult.rows.length > 1) {
      // Keep the branch with the lowest ID and move all rooms to it
      const keepBranch = branchesResult.rows[0];
      const deleteBranches = branchesResult.rows.slice(1);

      console.log(`Keeping branch with ID ${keepBranch.id}`);
      
      // Update all rooms to use the kept branch
      for (const branch of deleteBranches) {
        await pool.query(
          'UPDATE rooms SET branch_id = $1 WHERE branch_id = $2',
          [keepBranch.id, branch.id]
        );
        console.log(`Updated rooms from branch ${branch.id} to branch ${keepBranch.id}`);
        
        // Delete the duplicate branch
        await pool.query('DELETE FROM branches WHERE id = $1', [branch.id]);
        console.log(`Deleted duplicate branch with ID ${branch.id}`);
      }

      // Verify the fix
      const finalBranches = await pool.query('SELECT * FROM branches');
      const roomCount = await pool.query('SELECT COUNT(*) FROM rooms WHERE branch_id = $1', [keepBranch.id]);
      
      console.log('\nFinal state:');
      console.log('Remaining branch:', finalBranches.rows[0]);
      console.log('Total rooms:', roomCount.rows[0].count);
    } else {
      console.log('No duplicate branches found.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixBranches(); 