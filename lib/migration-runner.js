const { pool } = require('./database')
const fs = require('fs')
const path = require('path')

class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(process.cwd(), 'migrations')
  }

  async ensureMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    await pool.query(query)
  }

  async getExecutedMigrations() {
    const result = await pool.query('SELECT name FROM migrations ORDER BY executed_at')
    return result.rows.map(row => row.name)
  }

  async getMigrationFiles() {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true })
      return []
    }

    const files = fs.readdirSync(this.migrationsPath)
    return files
      .filter(file => file.endsWith('.sql'))
      .sort()
  }

  async runMigration(filename) {
    const filePath = path.join(this.migrationsPath, filename)
    const sql = fs.readFileSync(filePath, 'utf8')
    
    console.log(`Running migration: ${filename}`)
    
    try {
      await pool.query('BEGIN')
      
      // Handle PostgreSQL dollar-quoted strings and multi-line blocks
      let statements = []
      let currentStatement = ''
      let inDollarQuote = false
      let dollarQuoteTag = ''
      
      const lines = sql.split('\n')
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('--')) {
          continue
        }
        
        currentStatement += line + '\n'
        
        // Check for dollar-quoted strings
        const dollarMatches = line.match(/\$([^$]*)\$/g)
        if (dollarMatches) {
          for (const match of dollarMatches) {
            if (!inDollarQuote) {
              inDollarQuote = true
              dollarQuoteTag = match
            } else if (match === dollarQuoteTag) {
              inDollarQuote = false
              dollarQuoteTag = ''
            }
          }
        }
        
        // If we're not in a dollar quote and line ends with semicolon, it's a complete statement
        if (!inDollarQuote && line.trim().endsWith(';')) {
          statements.push(currentStatement.trim())
          currentStatement = ''
        }
      }
      
      // Add any remaining statement
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim())
      }
      
      // Execute each statement
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.query(statement)
        }
      }
      
      // Record migration as executed
      await pool.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [filename]
      )
      
      await pool.query('COMMIT')
      console.log(`✅ Migration completed: ${filename}`)
      
    } catch (error) {
      await pool.query('ROLLBACK')
      console.error(`❌ Migration failed: ${filename}`, error)
      throw error
    }
  }

  async runPendingMigrations() {
    await this.ensureMigrationsTable()
    
    const executedMigrations = await this.getExecutedMigrations()
    const migrationFiles = await this.getMigrationFiles()
    
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    )
    
    if (pendingMigrations.length === 0) {
      console.log('📋 No pending migrations')
      return
    }
    
    console.log(`🔄 Running ${pendingMigrations.length} pending migrations...`)
    
    for (const migration of pendingMigrations) {
      await this.runMigration(migration)
    }
    
    console.log('✅ All migrations completed successfully')
  }

  async rollbackLastMigration() {
    const result = await pool.query(
      'SELECT name FROM migrations ORDER BY executed_at DESC LIMIT 1'
    )
    
    if (result.rows.length === 0) {
      console.log('No migrations to rollback')
      return
    }
    
    const migrationName = result.rows[0].name
    console.log(`Rolling back migration: ${migrationName}`)
    
    // Remove from migrations table
    await pool.query('DELETE FROM migrations WHERE name = $1', [migrationName])
    console.log(`Rollback completed: ${migrationName}`)
  }
}

module.exports = MigrationRunner 