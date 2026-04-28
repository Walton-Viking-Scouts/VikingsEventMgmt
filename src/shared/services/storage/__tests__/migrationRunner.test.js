/**
 * Migration runner tests.
 *
 * Backs the runner with better-sqlite3 in-memory and verifies idempotency,
 * version-tracking persistence, ordering, and uniqueness validation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrationRunner.js';
import { MIGRATIONS } from '../migrations/index.js';

let activeDb = null;

function makeAdapter(db) {
  return {
    execute: async (sql) => {
      db.exec(sql);
      return { changes: { changes: 0 } };
    },
    run: async (sql, values = []) => {
      const safe = (values || []).map(v => v === undefined ? null : v);
      const info = db.prepare(sql).run(...safe);
      return { changes: { changes: info.changes, lastId: Number(info.lastInsertRowid) } };
    },
    query: async (sql, values = []) => {
      const safe = (values || []).map(v => v === undefined ? null : v);
      const rows = db.prepare(sql).all(...safe);
      return { values: rows };
    },
  };
}

describe('migrationRunner', () => {
  let adapter;

  beforeEach(() => {
    activeDb = new Database(':memory:');
    activeDb.pragma('foreign_keys = OFF');
    adapter = makeAdapter(activeDb);
  });

  afterEach(() => {
    if (activeDb) {
      activeDb.close();
      activeDb = null;
    }
  });

  describe('Production migrations applied to a fresh DB', () => {
    it('applies all migrations in order and records versions', async () => {
      const result = await runMigrations(adapter, MIGRATIONS);

      const expectedVersions = MIGRATIONS.map(m => m.version).sort((a, b) => a - b);
      expect(result.applied).toEqual(expectedVersions);
      expect(result.skipped).toEqual([]);

      const recorded = activeDb
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all()
        .map(r => r.version);
      expect(recorded).toEqual(expectedVersions);
    });

    it('produces all expected core tables', async () => {
      await runMigrations(adapter, MIGRATIONS);
      const tables = new Set(
        activeDb.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'')
          .all()
          .map(t => t.name),
      );
      for (const required of [
        'sections', 'events', 'attendance', 'members', 'sync_status',
        'event_dashboard', 'sync_metadata', 'terms', 'flexi_lists',
        'flexi_structure', 'flexi_data', 'shared_event_metadata',
        'schema_migrations',
      ]) {
        expect(tables.has(required)).toBe(true);
      }
    });

    it('attendance table includes sectionid + isSharedSection on a fresh DB', async () => {
      await runMigrations(adapter, MIGRATIONS);
      const cols = new Set(
        activeDb.prepare('PRAGMA table_info(attendance)').all().map(c => c.name),
      );
      expect(cols.has('sectionid')).toBe(true);
      expect(cols.has('isSharedSection')).toBe(true);
    });
  });

  describe('Idempotency', () => {
    it('running twice applies pending migrations on the first call and skips all on the second', async () => {
      const first = await runMigrations(adapter, MIGRATIONS);
      const second = await runMigrations(adapter, MIGRATIONS);

      expect(first.applied.length).toBe(MIGRATIONS.length);
      expect(second.applied).toEqual([]);
      expect(second.skipped).toEqual(MIGRATIONS.map(m => m.version).sort((a, b) => a - b));
    });
  });

  describe('Pre-existing legacy schema (no schema_migrations table)', () => {
    it('treats an old DB as version 0 and applies every migration', async () => {
      // Simulate an old build that created attendance without the newer
      // columns, no schema_migrations table tracked.
      activeDb.exec(`
        CREATE TABLE attendance (
          eventid TEXT NOT NULL,
          scoutid INTEGER NOT NULL,
          attending TEXT,
          patrol TEXT,
          notes TEXT,
          PRIMARY KEY (eventid, scoutid)
        );
      `);

      const result = await runMigrations(adapter, MIGRATIONS);
      expect(result.applied).toEqual(MIGRATIONS.map(m => m.version).sort((a, b) => a - b));

      const cols = new Set(
        activeDb.prepare('PRAGMA table_info(attendance)').all().map(c => c.name),
      );
      expect(cols.has('sectionid')).toBe(true);
      expect(cols.has('isSharedSection')).toBe(true);
    });
  });

  describe('Ordering and registration validation', () => {
    it('applies migrations in version order even if registered out of order', async () => {
      const calls = [];
      const out = [
        { version: 3, name: 'third', up: async () => { calls.push(3); } },
        { version: 1, name: 'first', up: async () => { calls.push(1); } },
        { version: 2, name: 'second', up: async () => { calls.push(2); } },
      ];
      await runMigrations(adapter, out);
      expect(calls).toEqual([1, 2, 3]);
    });

    it('rejects duplicate versions', async () => {
      const dup = [
        { version: 1, name: 'a', up: async () => {} },
        { version: 1, name: 'b', up: async () => {} },
      ];
      await expect(runMigrations(adapter, dup)).rejects.toThrow(/Duplicate migration version/);
    });

    it('rejects non-positive or non-integer versions', async () => {
      await expect(runMigrations(adapter, [{ version: 0, name: 'zero', up: async () => {} }]))
        .rejects.toThrow(/invalid version/);
      await expect(runMigrations(adapter, [{ version: 1.5, name: 'frac', up: async () => {} }]))
        .rejects.toThrow(/invalid version/);
    });
  });

  describe('Partial application', () => {
    it('applies only pending versions when some are already recorded', async () => {
      // Pretend version 1 has already been applied previously.
      adapter.execute(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY, name TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      `);
      activeDb.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(1, 'manual_seed');

      const calls = [];
      const migrations = [
        { version: 1, name: 'one', up: async () => { calls.push(1); } },
        { version: 2, name: 'two', up: async () => { calls.push(2); } },
      ];

      const result = await runMigrations(adapter, migrations);
      expect(calls).toEqual([2]);
      expect(result.applied).toEqual([2]);
      expect(result.skipped).toEqual([1]);
    });
  });
});
