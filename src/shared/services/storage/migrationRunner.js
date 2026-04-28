/**
 * SQLite schema migration runner.
 *
 * Tracks applied migrations in a `schema_migrations` table and applies any
 * pending ones in version order. Idempotent — safe to call on every startup.
 *
 * Each migration must export an object with shape:
 *   { version: number, name: string, up: async (db) => Promise<void> }
 */

import logger, { LOG_CATEGORIES } from '../utils/logger.js';

const SCHEMA_MIGRATIONS_DDL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

/**
 * Apply pending migrations in version order. Skips already-applied versions.
 *
 * @param {Object} db - Capacitor SQLite connection (must support execute, run, query)
 * @param {Array<{version:number,name:string,up:Function}>} migrations
 * @returns {Promise<{applied:number[], skipped:number[]}>}
 */
export async function runMigrations(db, migrations) {
  await db.execute(SCHEMA_MIGRATIONS_DDL);

  const result = await db.query('SELECT version FROM schema_migrations');
  const applied = new Set((result.values || []).map(row => row.version));

  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  validateUniqueVersions(ordered);

  const appliedNow = [];
  const skipped = [];

  for (const migration of ordered) {
    if (applied.has(migration.version)) {
      skipped.push(migration.version);
      continue;
    }
    logger.info(`Applying migration ${migration.version}: ${migration.name}`, {}, LOG_CATEGORIES.DATABASE);
    await migration.up(db);
    await db.run(
      'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
      [migration.version, migration.name],
      false,
    );
    appliedNow.push(migration.version);
  }

  return { applied: appliedNow, skipped };
}

function validateUniqueVersions(migrations) {
  const seen = new Set();
  for (const m of migrations) {
    if (typeof m.version !== 'number' || !Number.isInteger(m.version) || m.version <= 0) {
      throw new Error(`Migration "${m.name}" has invalid version: ${m.version}`);
    }
    if (seen.has(m.version)) {
      throw new Error(`Duplicate migration version ${m.version} (name: "${m.name}")`);
    }
    seen.add(m.version);
  }
}
