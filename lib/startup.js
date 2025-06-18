const MigrationRunner = require('./migration-runner')

async function runStartupMigrations() {
  try {
    console.log('🔄 Checking for pending database migrations...')
    const runner = new MigrationRunner()
    await runner.runPendingMigrations()
  } catch (error) {
    console.error('❌ Migration error during startup:', error)
    // Don't exit the process, just log the error
    // The app should still start even if migrations fail
  }
}

module.exports = { runStartupMigrations } 