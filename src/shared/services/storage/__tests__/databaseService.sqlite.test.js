/**
 * SQLite (iOS code path) integration tests for DatabaseService.
 *
 * Backs the @capacitor-community/sqlite plugin with better-sqlite3 in-memory
 * so we can exercise the real SQL the app runs on iOS. Catches schema drift,
 * INSERT-vs-UPSERT mistakes, and write/read round-trip regressions without
 * needing a device.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let activeDb = null;

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
  },
}));

vi.mock('@capacitor-community/sqlite', () => {
  const makeConnection = () => ({
    open: async () => {},
    close: async () => {},
    execute: async (sql) => {
      activeDb.exec(sql);
      return { changes: { changes: 0 } };
    },
    run: async (sql, values = []) => {
      const safeValues = (values || []).map(v => v === undefined ? null : v);
      const stmt = activeDb.prepare(sql);
      const info = stmt.run(...safeValues);
      return { changes: { changes: info.changes, lastId: Number(info.lastInsertRowid) } };
    },
    query: async (sql, values = []) => {
      const safeValues = (values || []).map(v => v === undefined ? null : v);
      const stmt = activeDb.prepare(sql);
      const rows = stmt.all(...safeValues);
      return { values: rows };
    },
  });

  function SQLiteConnection() {
    return {
      checkConnectionsConsistency: async () => ({ result: true }),
      isConnection: async () => ({ result: false }),
      retrieveConnection: async () => makeConnection(),
      createConnection: async () => makeConnection(),
    };
  }

  return {
    CapacitorSQLite: {},
    SQLiteConnection,
  };
});

async function loadFreshDatabaseService() {
  vi.resetModules();
  const mod = await import('../database.js');
  return mod.default;
}

describe('DatabaseService — SQLite (iOS code path)', () => {
  beforeEach(() => {
    activeDb = new Database(':memory:');
    // Match @capacitor-community/sqlite production default — foreign keys
    // are NOT enforced. better-sqlite3 enables them by default; turn off so
    // tests reflect real iOS behaviour.
    activeDb.pragma('foreign_keys = OFF');
  });

  afterEach(() => {
    if (activeDb) {
      activeDb.close();
      activeDb = null;
    }
  });

  describe('Fresh install schema', () => {
    it('creates all expected tables', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const tables = activeDb
        .prepare('SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name')
        .all()
        .map(t => t.name);

      for (const required of ['sections', 'events', 'attendance', 'members', 'sync_status']) {
        expect(tables).toContain(required);
      }
    });

    it('attendance table has every column the code references', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const cols = new Set(
        activeDb.prepare('PRAGMA table_info(attendance)').all().map(c => c.name),
      );

      for (const required of [
        'eventid', 'scoutid', 'sectionid', 'attending',
        'patrol', 'notes', 'isSharedSection',
      ]) {
        expect(cols.has(required)).toBe(true);
      }
    });
  });

  describe('Schema drift regression (production bug 2026-04-28)', () => {
    /**
     * Reproduces the exact failure mode from production:
     * - User installed an older build that created `attendance` without
     *   `sectionid` and `isSharedSection` columns.
     * - Newer build's INSERT references both columns.
     * - `CREATE TABLE IF NOT EXISTS` does NOT alter existing tables, so the
     *   columns stayed missing → all attendance writes failed silently with
     *   "table attendance has no column named sectionid".
     */
    function preCreateOldAttendanceTable() {
      activeDb.exec(`
        CREATE TABLE attendance (
          eventid TEXT NOT NULL,
          scoutid INTEGER NOT NULL,
          attending TEXT,
          patrol TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (eventid, scoutid)
        );
      `);
    }

    it('detects and adds missing sectionid + isSharedSection columns on init', async () => {
      preCreateOldAttendanceTable();

      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const cols = new Set(
        activeDb.prepare('PRAGMA table_info(attendance)').all().map(c => c.name),
      );
      expect(cols.has('sectionid')).toBe(true);
      expect(cols.has('isSharedSection')).toBe(true);
    });

    it('saveAttendance succeeds against a pre-existing old-schema table after migration', async () => {
      preCreateOldAttendanceTable();

      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const records = [
        { scoutid: 1, eventid: '100', sectionid: 5, attending: 'Yes', patrol: 'Eagle', notes: null },
        { scoutid: 2, eventid: '100', sectionid: 5, attending: 'No', patrol: 'Hawk', notes: null },
      ];

      await expect(databaseService.saveAttendance('100', records)).resolves.toBeUndefined();

      const stored = activeDb.prepare('SELECT * FROM attendance ORDER BY scoutid').all();
      expect(stored.length).toBe(2);
      expect(stored[0].sectionid).toBe(5);
      expect(stored[0].isSharedSection).toBe(0);
    });

    it('saveSharedAttendance survives DELETE WHERE isSharedSection = 1 against migrated old table', async () => {
      preCreateOldAttendanceTable();

      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      // Calling without throwing is the assertion — the production failure
      // was "no such column: isSharedSection" on the DELETE filter.
      const records = [
        { scoutid: 99, eventid: '100', sectionid: 7, attending: 'Yes', patrol: null, notes: null, isSharedSection: true },
      ];
      await expect(databaseService.saveSharedAttendance('100', records)).resolves.toBeUndefined();

      const stored = activeDb.prepare('SELECT * FROM attendance').all();
      expect(stored.length).toBe(1);
      expect(stored[0].isSharedSection).toBe(1);
    });
  });

  describe('Save + read round-trip', () => {
    it('saveAttendance + getAttendance preserves core fields', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const records = [
        { scoutid: 1, eventid: '100', sectionid: 5, attending: 'Yes', patrol: 'Eagle', notes: 'late' },
        { scoutid: 2, eventid: '100', sectionid: 5, attending: 'No', patrol: 'Hawk', notes: null },
      ];

      await databaseService.saveAttendance('100', records);
      const got = await databaseService.getAttendance('100');

      expect(got.length).toBe(2);
      expect(got.find(r => r.scoutid === 1)?.attending).toBe('Yes');
      expect(got.find(r => r.scoutid === 1)?.notes).toBe('late');
      expect(got.find(r => r.scoutid === 2)?.attending).toBe('No');
    });

    it('saveSections + getSections round-trips correctly', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveSections([
        { sectionid: 1, sectionname: 'Beavers Mon', sectiontype: 'beavers' },
        { sectionid: 2, sectionname: 'Cubs Tue', sectiontype: 'cubs' },
      ]);

      const got = await databaseService.getSections();
      expect(got.length).toBe(2);
      expect(got.map(s => s.sectionname).sort()).toEqual(['Beavers Mon', 'Cubs Tue']);
    });

    it('saveEvents + getEvents scopes to sectionId', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveEvents(5, [
        { eventid: '100', name: 'Camp', startdate: '2026-05-01', termid: 't1' },
        { eventid: '101', name: 'Hike', startdate: '2026-05-08', termid: 't1' },
      ]);
      await databaseService.saveEvents(7, [
        { eventid: '200', name: 'Other section camp', startdate: '2026-06-01', termid: 't1' },
      ]);

      const sec5 = await databaseService.getEvents(5);
      const sec7 = await databaseService.getEvents(7);

      expect(sec5.length).toBe(2);
      expect(sec7.length).toBe(1);
      expect(sec7[0].name).toBe('Other section camp');
    });
  });

  describe('Duplicate input handling (INSERT OR REPLACE / UPSERT)', () => {
    it('saveSections survives duplicate sectionid in input array', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      // Plain INSERT would throw UNIQUE constraint on second row; INSERT OR
      // REPLACE matches IndexedDB put() upsert semantics.
      await expect(databaseService.saveSections([
        { sectionid: 1, sectionname: 'First', sectiontype: 'beavers' },
        { sectionid: 1, sectionname: 'Duplicate', sectiontype: 'beavers' },
      ])).resolves.toBeUndefined();

      const stored = activeDb.prepare('SELECT * FROM sections').all();
      expect(stored.length).toBe(1);
      expect(stored[0].sectionname).toBe('Duplicate');
    });

    it('saveAttendance survives duplicate (eventid, scoutid) in input array', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await expect(databaseService.saveAttendance('100', [
        { scoutid: 1, eventid: '100', sectionid: 5, attending: 'Yes', patrol: 'Eagle' },
        { scoutid: 1, eventid: '100', sectionid: 5, attending: 'No', patrol: 'Eagle' },
      ])).resolves.toBeUndefined();

      const stored = activeDb.prepare('SELECT * FROM attendance').all();
      expect(stored.length).toBe(1);
      expect(stored[0].attending).toBe('No');
    });
  });
});
