/**
 * Migration runner.
 *
 * How it works:
 *  1. Ensures a `schema_migrations` tracking table exists.
 *  2. Reads every *.sql file from the migrations/ directory, sorted by name.
 *  3. Skips files that are already recorded in schema_migrations.
 *  4. Applies new migrations inside a transaction and records them.
 *
 * To add a new migration:
 *   Create backend/src/db/migrations/NNN_description.sql
 *   The next server start will pick it up automatically.
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function runMigrations(db) {
  // Bootstrap: tracking table (not versioned itself — always safe to run)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((r) => r.version)
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic = 001 < 002 < 003 ...

  const applyMigration = db.transaction((file, sql) => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      file,
      new Date().toISOString()
    );
  });

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    applyMigration(file, sql);
    console.log(`✅ Migration applied: ${file}`);
    count++;
  }

  if (count === 0) {
    console.log('✅ Database schema is up to date.');
  }
}

module.exports = { runMigrations };
