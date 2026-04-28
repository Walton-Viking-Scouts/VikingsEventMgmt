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

      for (const required of ['sections', 'events', 'attendance', 'core_members', 'member_section', 'sync_status']) {
        expect(tables).toContain(required);
      }
      expect(tables).not.toContain('members');
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

    it('saveEvents survives duplicate eventid in input array', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await expect(databaseService.saveEvents(5, [
        { eventid: '100', name: 'First', startdate: '2026-05-01', termid: 't1' },
        { eventid: '100', name: 'Duplicate', startdate: '2026-05-08', termid: 't1' },
      ])).resolves.toBeUndefined();

      const stored = activeDb.prepare('SELECT * FROM events').all();
      expect(stored.length).toBe(1);
      expect(stored[0].name).toBe('Duplicate');
      expect(stored[0].startdate).toBe('2026-05-08');
    });

    it('saveTerms survives duplicate termid in input array', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await expect(databaseService.saveTerms(5, [
        { termid: 't1', name: 'First', startdate: '2026-01-01', enddate: '2026-04-01' },
        { termid: 't1', name: 'Duplicate', startdate: '2026-05-01', enddate: '2026-08-01' },
      ])).resolves.toBeUndefined();

      const stored = activeDb.prepare('SELECT * FROM terms').all();
      expect(stored.length).toBe(1);
      expect(stored[0].name).toBe('Duplicate');
      expect(stored[0].startdate).toBe('2026-05-01');
    });

    it('saveFlexiData survives duplicate (extraid, sectionid, termid, scoutid) PK in input array', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await expect(databaseService.saveFlexiData('extra1', 5, 't1', [
        { scoutid: '1001', firstname: 'Alice', lastname: 'Smith', f_1: 'first-value' },
        { scoutid: '1001', firstname: 'Alice', lastname: 'Smith', f_1: 'duplicate-value' },
      ])).resolves.toBeUndefined();

      const stored = activeDb.prepare('SELECT * FROM flexi_data').all();
      expect(stored.length).toBe(1);
      const data = JSON.parse(stored[0].data);
      expect(data.f_1).toBe('duplicate-value');
    });
  });

  describe('Schema validation on iOS path', () => {
    it('saveEvents drops invalid records via schema validation on iOS path', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await expect(databaseService.saveEvents(5, [
        { eventid: '100', name: 'Valid Event', startdate: '2026-05-01', termid: 't1' },
        { eventid: '101', startdate: '2026-05-08', termid: 't1' },
        { eventid: '102', name: 'Another Valid', startdate: '2026-05-15', termid: 't1' },
      ])).resolves.toBeUndefined();

      const stored = activeDb.prepare('SELECT * FROM events ORDER BY eventid').all();
      expect(stored.length).toBe(2);
      expect(stored.map(e => e.eventid).sort()).toEqual(['100', '102']);
      expect(stored.find(e => e.eventid === '101')).toBeUndefined();
    });

    it('saveTerms drops invalid records via schema validation on iOS path', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await expect(databaseService.saveTerms(5, [
        { termid: 't1', name: 'Spring Term', startdate: '2026-01-01', enddate: '2026-04-01' },
        { termid: 't2', startdate: '2026-05-01', enddate: '2026-08-01' },
        { termid: 't3', name: 'Autumn Term', startdate: '2026-09-01', enddate: '2026-12-01' },
      ])).resolves.toBeUndefined();

      const stored = activeDb.prepare('SELECT * FROM terms ORDER BY termid').all();
      expect(stored.length).toBe(2);
      expect(stored.map(t => t.termid).sort()).toEqual(['t1', 't3']);
      expect(stored.find(t => t.termid === 't2')).toBeUndefined();
    });
  });

  describe('Migration 003 — members dual-store schema', () => {
    it('fresh install creates core_members + member_section, drops members', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const tables = new Set(
        activeDb.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'').all().map(t => t.name),
      );
      expect(tables.has('core_members')).toBe(true);
      expect(tables.has('member_section')).toBe(true);
      expect(tables.has('members')).toBe(false);
    });

    it('core_members has all expected columns', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const cols = new Set(
        activeDb.prepare('PRAGMA table_info(core_members)').all().map(c => c.name),
      );
      for (const required of [
        'scoutid', 'firstname', 'lastname', 'date_of_birth', 'age', 'age_years', 'age_months',
        'yrs', 'photo_guid', 'has_photo', 'pic', 'email', 'contact_groups', 'custom_data',
        'flattened_fields', 'read_only', 'filter_string', 'updated_at',
      ]) {
        expect(cols.has(required)).toBe(true);
      }
    });

    it('member_section has all expected columns', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const cols = new Set(
        activeDb.prepare('PRAGMA table_info(member_section)').all().map(c => c.name),
      );
      for (const required of [
        'scoutid', 'sectionid', 'sectionname', 'section', 'person_type',
        'patrol', 'patrol_id', 'started', 'joined', 'end_date', 'active',
        'patrol_role_level', 'patrol_role_level_label', 'updated_at',
      ]) {
        expect(cols.has(required)).toBe(true);
      }
    });

    it('upgrade path: pre-existing members table is dropped', async () => {
      activeDb.exec(`
        CREATE TABLE members (
          scoutid INTEGER PRIMARY KEY,
          firstname TEXT,
          lastname TEXT
        );
      `);
      activeDb.prepare('INSERT INTO members (scoutid, firstname, lastname) VALUES (?, ?, ?)')
        .run(999, 'Old', 'Schema');

      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const tables = new Set(
        activeDb.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'').all().map(t => t.name),
      );
      expect(tables.has('members')).toBe(false);
      expect(tables.has('core_members')).toBe(true);
      expect(tables.has('member_section')).toBe(true);
    });

    it('idempotency: applying migrations twice does not error', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      // Force re-import + re-run by clearing init flag and re-running migrations
      // Simpler: just call initialize() twice (it short-circuits) and verify
      // the migration wouldn't bork if re-applied. Actually re-run migrations
      // directly via the runner to confirm no-op behaviour.
      const { runMigrations } = await import('../migrationRunner.js');
      const { MIGRATIONS } = await import('../migrations/index.js');

      const adapter = {
        execute: async (sql) => activeDb.exec(sql),
        run: async (sql, values = []) => {
          const safeValues = (values || []).map(v => v === undefined ? null : v);
          const stmt = activeDb.prepare(sql);
          const info = stmt.run(...safeValues);
          return { changes: { changes: info.changes } };
        },
        query: async (sql, values = []) => {
          const safeValues = (values || []).map(v => v === undefined ? null : v);
          const stmt = activeDb.prepare(sql);
          return { values: stmt.all(...safeValues) };
        },
      };

      await expect(runMigrations(adapter, MIGRATIONS)).resolves.toBeDefined();
    });
  });

  describe('saveMembers + getMembers round-trip', () => {
    const FIXTURE_MEMBERS = [
      {
        scoutid: 1001,
        firstname: 'Alice', lastname: 'Smith',
        date_of_birth: '2016-03-15',
        age: '8 / 02',
        age_years: 8, age_months: 2, yrs: '8',
        email: 'parent@example.com',
        photo_guid: 'guid-1001', has_photo: true, pic: false,
        contact_groups: { primary_contact_1__first_name: 'Bob' },
        custom_data: { dietary: 'none' },
        read_only: ['locked-field'],
        filter_string: 'alice smith',
        sectionid: 5,
        sectionname: 'Beavers Mon',
        section: 'beavers',
        person_type: 'Young People',
        patrol: 'Red Lodge',
        patrol_id: 12,
        active: true,
        sectionMemberships: [
          {
            sectionid: 5,
            sectionname: 'Beavers Mon',
            section: 'beavers',
            person_type: 'Young People',
            patrol: 'Red Lodge',
            patrol_id: 12,
            active: true,
            started: '2022-09-01',
            joined: '2022-09-01',
            end_date: null,
            patrol_role_level: 0,
            patrol_role_level_label: 'YP',
          },
        ],
        custom__overflow_field: 'overflow-value',
      },
      {
        scoutid: 1002,
        firstname: 'Charlie', lastname: 'Brown',
        date_of_birth: '2014-07-22',
        age: '11 / 09',
        age_years: 11, age_months: 9,
        sectionid: 5,
        sectionname: 'Beavers Mon',
        section: 'beavers',
        person_type: 'Young People',
        patrol: 'Blue Lodge',
        patrol_id: 13,
        active: true,
      },
    ];

    it('round-trip preserves core identity fields', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveMembers([5], FIXTURE_MEMBERS);
      const got = await databaseService.getMembers([5]);

      expect(got.length).toBe(2);
      const alice = got.find(m => m.scoutid === 1001);
      expect(alice.firstname).toBe('Alice');
      expect(alice.lastname).toBe('Smith');
      expect(alice.date_of_birth).toBe('2016-03-15');
      expect(alice.email).toBe('parent@example.com');
      expect(alice.age_years).toBe(8);
      expect(alice.age_months).toBe(2);
      expect(alice.yrs).toBe('8');
    });

    it('returns sections array with person_type (the bug fix)', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveMembers([5], FIXTURE_MEMBERS);
      const got = await databaseService.getMembers([5]);

      const alice = got.find(m => m.scoutid === 1001);
      expect(Array.isArray(alice.sections)).toBe(true);
      expect(alice.sections.length).toBe(1);
      expect(alice.sections[0].person_type).toBe('Young People');
      expect(alice.sections[0].sectionid).toBe(5);
      expect(alice.sections[0].sectionname).toBe('Beavers Mon');
    });

    it('sets person_type directly on member', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveMembers([5], FIXTURE_MEMBERS);
      const got = await databaseService.getMembers([5]);

      const alice = got.find(m => m.scoutid === 1001);
      expect(alice.person_type).toBe('Young People');
      expect(alice.patrol).toBe('Red Lodge');
      expect(alice.patrol_id).toBe(12);
    });

    it('parses JSON blobs back to objects', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveMembers([5], FIXTURE_MEMBERS);
      const got = await databaseService.getMembers([5]);

      const alice = got.find(m => m.scoutid === 1001);
      expect(typeof alice.contact_groups).toBe('object');
      expect(alice.contact_groups.primary_contact_1__first_name).toBe('Bob');
      expect(typeof alice.custom_data).toBe('object');
      expect(alice.custom_data.dietary).toBe('none');
      expect(Array.isArray(alice.read_only)).toBe(true);
      expect(alice.read_only).toContain('locked-field');
    });

    it('spreads flattened_fields onto member (unknown field preserved)', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveMembers([5], FIXTURE_MEMBERS);
      const got = await databaseService.getMembers([5]);

      const alice = got.find(m => m.scoutid === 1001);
      expect(alice.custom__overflow_field).toBe('overflow-value');
    });

    it('returns member_id alias', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveMembers([5], FIXTURE_MEMBERS);
      const got = await databaseService.getMembers([5]);

      const alice = got.find(m => m.scoutid === 1001);
      expect(alice.member_id).toBe(1001);
    });

    it('returns dateofbirth alias', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveMembers([5], FIXTURE_MEMBERS);
      const got = await databaseService.getMembers([5]);

      const alice = got.find(m => m.scoutid === 1001);
      expect(alice.dateofbirth).toBe('2016-03-15');
    });

    it('sorts by lastname, firstname', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const members = [
        { scoutid: 10, firstname: 'Zach', lastname: 'Adams', sectionid: 5 },
        { scoutid: 11, firstname: 'Anna', lastname: 'Zephyr', sectionid: 5 },
        { scoutid: 12, firstname: 'Bob', lastname: 'Adams', sectionid: 5 },
      ];

      await databaseService.saveMembers([5], members);
      const got = await databaseService.getMembers([5]);

      expect(got.map(m => `${m.lastname},${m.firstname}`)).toEqual([
        'Adams,Bob',
        'Adams,Zach',
        'Zephyr,Anna',
      ]);
    });

    it('cleans up member_section for re-synced sections (core_members survives)', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      await databaseService.saveMembers([5], FIXTURE_MEMBERS);

      const updatedFixture = [
        {
          scoutid: 1001,
          firstname: 'Alice', lastname: 'Smith',
          date_of_birth: '2016-03-15',
          sectionid: 5,
          sectionname: 'Beavers Mon',
          section: 'beavers',
          person_type: 'Young People',
          patrol: 'Green Lodge',
          patrol_id: 99,
          active: true,
        },
      ];
      await databaseService.saveMembers([5], updatedFixture);

      const sectionRows = activeDb.prepare('SELECT * FROM member_section').all();
      const aliceSections = sectionRows.filter(r => r.scoutid === 1001);
      expect(aliceSections.length).toBe(1);
      expect(aliceSections[0].patrol).toBe('Green Lodge');
      expect(aliceSections[0].patrol_id).toBe(99);

      const charlieSections = sectionRows.filter(r => r.scoutid === 1002);
      expect(charlieSections.length).toBe(0);

      const coreRows = activeDb.prepare('SELECT * FROM core_members').all();
      expect(coreRows.find(r => r.scoutid === 1001)).toBeDefined();
      expect(coreRows.find(r => r.scoutid === 1002)).toBeDefined();
    });

    it('scout in multiple sections appears once per query, with correct per-section data', async () => {
      const databaseService = await loadFreshDatabaseService();
      await databaseService.initialize();

      const multiSectionMember = {
        scoutid: 2001,
        firstname: 'Multi', lastname: 'Section',
        sectionid: 5,
        sectionMemberships: [
          {
            sectionid: 5,
            sectionname: 'Beavers Mon',
            section: 'beavers',
            person_type: 'Young People',
            patrol: 'Red Lodge',
            patrol_id: 12,
            active: true,
          },
          {
            sectionid: 7,
            sectionname: 'Cubs Tue',
            section: 'cubs',
            person_type: 'Leaders',
            patrol: 'Leaders',
            patrol_id: -2,
            active: true,
          },
        ],
      };

      await databaseService.saveMembers([5, 7], [multiSectionMember]);

      const sec5 = await databaseService.getMembers([5]);
      const sec7 = await databaseService.getMembers([7]);
      const both = await databaseService.getMembers([5, 7]);

      expect(sec5.length).toBe(1);
      expect(sec5[0].person_type).toBe('Young People');

      expect(sec7.length).toBe(1);
      expect(sec7[0].person_type).toBe('Leaders');

      expect(both.length).toBe(1);
      expect(both[0].sections.length).toBe(2);
      const sectionIds = both[0].sections.map(s => s.sectionid).sort();
      expect(sectionIds).toEqual([5, 7]);
    });
  });
});
