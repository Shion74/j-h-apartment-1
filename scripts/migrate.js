#!/usr/bin/env node

const MigrationRunner = require('../lib/migration-runner')

async function main() {
  const command = process.argv[2]
  const runner = new MigrationRunner()

  try {
    switch (command) {
      case 'up':
        await runner.runPendingMigrations()
        break
      case 'rollback':
        await runner.rollbackLastMigration()
        break
      case 'status':
        await runner.ensureMigrationsTable()
        const executed = await runner.getExecutedMigrations()
        const files = await runner.getMigrationFiles()
        const pending = files.filter(file => !executed.includes(file))
        
        console.log(`📊 Migration Status:`)
        console.log(`   Executed: ${executed.length}`)
        console.log(`   Pending: ${pending.length}`)
        if (pending.length > 0) {
          console.log(`   Next to run: ${pending[0]}`)
        }
        break
      default:
        console.log(`
Usage: node scripts/migrate.js <command>

Commands:
  up       - Run all pending migrations
  rollback - Rollback the last migration
  status   - Show migration status
        `)
    }
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

main() 