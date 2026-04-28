/**
 * Cross-backend parity tests.
 *
 * Same input fixture is run through both storage backends (IndexedDB on web,
 * SQLite on iOS native) and the outputs are asserted deep-equal. The point is
 * to catch any future drift where one path's saveMembers/getMembers produces
 * a different shape than the other — exactly the class of bug that caused
 * iOS detailed-attendance views to show no attendees prior to migration 003.
 *
 * Mode selection is via a module-level currentMode flag that the
 * Capacitor.isNativePlatform mock reads. Re-importing the database module
 * via vi.resetModules() rebuilds the singleton with the new platform.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let activeDb = null;
let currentMode = 'native';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => currentMode === 'native',
    getPlatform: () => (currentMode === 'native' ? 'ios' : 'web'),
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
      const safe = (values || []).map(v => v === undefined ? null : v);
      const info = activeDb.prepare(sql).run(...safe);
      return { changes: { changes: info.changes, lastId: Number(info.lastInsertRowid) } };
    },
    query: async (sql, values = []) => {
      const safe = (values || []).map(v => v === undefined ? null : v);
      const rows = activeDb.prepare(sql).all(...safe);
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
  return { CapacitorSQLite: {}, SQLiteConnection };
});

async function loadService(mode) {
  currentMode = mode;
  vi.resetModules();
  if (mode === 'native') {
    activeDb = new Database(':memory:');
    activeDb.pragma('foreign_keys = OFF');
  } else {
    activeDb = null;
    // Hard-reset the fake-indexeddb factory so each web run starts with a
    // pristine in-memory store. deleteDatabase() races with module-cache
    // resets in unpredictable ways; replacing the global is deterministic.
    const { default: FDBFactory } = await import('fake-indexeddb/lib/FDBFactory');
    globalThis.indexedDB = new FDBFactory();
  }
  const mod = await import('../database.js');
  return mod.default;
}

/**
 * Run save+get against one backend, return the output. Encapsulates a fresh
 * databaseService load per call so each backend's run is isolated.
 */
async function runRoundTrip(mode, sectionIds, members) {
  const ds = await loadService(mode);
  await ds.initialize();
  await ds.saveMembers(sectionIds, members);
  return ds.getMembers(sectionIds);
}

/**
 * Strip non-deterministic / storage-only fields before comparison. Neither
 * backend includes these in its public read shape today, but they could be
 * accidentally added in future and we want the parity contract to be about
 * the consumer-facing shape only.
 */
function normalizeForComparison(member) {
  // Field-stable sort for `sections` array (both backends preserve insertion
  // order, but if a future change uses different JS Map iteration, we don't
  // want a parity test to flake).
  const cloned = JSON.parse(JSON.stringify(member));
  if (Array.isArray(cloned.sections)) {
    cloned.sections.sort((a, b) => Number(a.sectionid) - Number(b.sectionid));
  }
  return cloned;
}

const FIXTURE_ALICE = {
  scoutid: 1001,
  firstname: 'Alice',
  lastname: 'Smith',
  date_of_birth: '2016-03-15',
  age: '8 / 02',
  age_years: 8,
  age_months: 2,
  yrs: '8',
  email: 'parent@example.com',
  photo_guid: 'guid-1001',
  has_photo: true,
  pic: false,
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
};

const FIXTURE_CHARLIE_NO_MEMBERSHIPS = {
  scoutid: 1002,
  firstname: 'Charlie',
  lastname: 'Brown',
  date_of_birth: '2014-07-22',
  age: '11 / 09',
  age_years: 11,
  age_months: 9,
  sectionid: 5,
  sectionname: 'Beavers Mon',
  section: 'beavers',
  person_type: 'Young People',
  patrol: 'Blue Lodge',
  patrol_id: 13,
  active: true,
};

const FIXTURE_DIANA_MULTI_SECTION = {
  scoutid: 1003,
  firstname: 'Diana',
  lastname: 'Adams',
  sectionMemberships: [
    {
      sectionid: 5,
      sectionname: 'Beavers Mon',
      section: 'beavers',
      person_type: 'Young People',
      patrol: 'Green Lodge',
      patrol_id: 14,
      active: true,
    },
    {
      sectionid: 7,
      sectionname: 'Cubs Tue',
      section: 'cubs',
      person_type: 'Young Leaders',
      patrol: null,
      patrol_id: null,
      active: true,
    },
  ],
};

describe('DatabaseService — Cross-backend parity (IndexedDB ≡ SQLite)', () => {
  afterEach(() => {
    if (activeDb) {
      activeDb.close();
      activeDb = null;
    }
    currentMode = 'native';
  });

  it('canonical member with full sectionMemberships produces identical output on both backends', async () => {
    const sqliteOut = (await runRoundTrip('native', [5], [FIXTURE_ALICE])).map(normalizeForComparison);
    const idbOut = (await runRoundTrip('web', [5], [FIXTURE_ALICE])).map(normalizeForComparison);

    expect(sqliteOut).toEqual(idbOut);
  });

  it('member without sectionMemberships (uses top-level fallback) produces identical output', async () => {
    const sqliteOut = (await runRoundTrip('native', [5], [FIXTURE_CHARLIE_NO_MEMBERSHIPS])).map(normalizeForComparison);
    const idbOut = (await runRoundTrip('web', [5], [FIXTURE_CHARLIE_NO_MEMBERSHIPS])).map(normalizeForComparison);

    expect(sqliteOut).toEqual(idbOut);
  });

  it('multi-section scout queried across both sections returns identical shape on both backends', async () => {
    const sqliteOut = (await runRoundTrip('native', [5, 7], [FIXTURE_DIANA_MULTI_SECTION])).map(normalizeForComparison);
    const idbOut = (await runRoundTrip('web', [5, 7], [FIXTURE_DIANA_MULTI_SECTION])).map(normalizeForComparison);

    expect(sqliteOut).toEqual(idbOut);
  });

  it('multi-member input preserves order and shape identically', async () => {
    const fixture = [FIXTURE_ALICE, FIXTURE_CHARLIE_NO_MEMBERSHIPS];
    const sqliteOut = (await runRoundTrip('native', [5], fixture)).map(normalizeForComparison);
    const idbOut = (await runRoundTrip('web', [5], fixture)).map(normalizeForComparison);

    expect(sqliteOut).toEqual(idbOut);
    // Sanity: two members back, sorted by lastname then firstname (Adams<Brown<Smith).
    expect(sqliteOut.map(m => m.scoutid)).toEqual([1002, 1001]);
  });

  it('member with _filterString camelCase variant produces identical output on both backends', async () => {
    // Both saveMembers paths coalesce member._filterString into filter_string
    // before storage. getMembers does not currently return filter_string in
    // its output shape — so the parity contract is "neither does, identically",
    // not "both populate it". If filter_string ever joins the read shape,
    // strengthen this test.
    const camelCaseMember = {
      ...FIXTURE_CHARLIE_NO_MEMBERSHIPS,
      scoutid: 9999,
      filter_string: undefined,
      _filterString: 'charlie via camelCase',
    };

    const sqliteOut = (await runRoundTrip('native', [5], [camelCaseMember])).map(normalizeForComparison);
    const idbOut = (await runRoundTrip('web', [5], [camelCaseMember])).map(normalizeForComparison);

    expect(sqliteOut).toEqual(idbOut);
  });

  it('member with pic=false (boolean) round-trips as false (not null) on both backends', async () => {
    const memberPicFalse = {
      ...FIXTURE_CHARLIE_NO_MEMBERSHIPS,
      scoutid: 9998,
      pic: false,
    };

    const sqliteOut = (await runRoundTrip('native', [5], [memberPicFalse])).map(normalizeForComparison);
    const idbOut = (await runRoundTrip('web', [5], [memberPicFalse])).map(normalizeForComparison);

    expect(sqliteOut).toEqual(idbOut);
    expect(sqliteOut[0].pic).toBe(false);
  });
});
