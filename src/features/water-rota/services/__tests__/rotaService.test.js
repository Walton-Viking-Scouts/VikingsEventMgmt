import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../shared/services/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { API: 'API', APP: 'APP', ERROR: 'ERROR', DATABASE: 'DATABASE' },
}));

vi.mock('../../../../shared/services/api/api/index.js', () => ({
  getFlexiRecords: vi.fn(),
  getFlexiStructure: vi.fn(),
  getSingleFlexiRecord: vi.fn(),
  updateFlexiRecord: vi.fn(),
  multiUpdateFlexiRecord: vi.fn(),
}));

vi.mock('../../../../shared/services/storage/database.js', () => ({
  default: {
    getSections: vi.fn(),
    getFlexiData: vi.fn(),
    saveFlexiData: vi.fn(),
    getMembers: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/storage/currentActiveTermsService.js', () => ({
  CurrentActiveTermsService: { getCurrentActiveTerm: vi.fn() },
}));

import {
  getFlexiRecords,
  getFlexiStructure,
  getSingleFlexiRecord,
  updateFlexiRecord,
  multiUpdateFlexiRecord,
} from '../../../../shared/services/api/api/index.js';
import databaseService from '../../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../../shared/services/storage/currentActiveTermsService.js';
import {
  assembleGroupConfig,
  assembleRotaGroup,
  assignSignup,
  discoverRotaRecords,
  findHostSection,
  loadRota,
  loadRotaGroup,
  prefillRegulars,
  writeSessionMeta,
  writeSignup,
} from '../rotaService.js';
import { SIGNUP_STATUS } from '../rotaEncoding.js';

const HOST_SECTION = { sectionid: 900, sectionname: 'Adults', section: 'adults' };
const OTHER_SECTION = { sectionid: 901, sectionname: 'Cubs', section: 'cubs' };
const TOKEN = 'tok';

const DESCRIPTOR = {
  sectionName: 'Cubs',
  seasonBucket: 'Summer 2026',
  sectionId: '49097',
  termId: '924956',
  recordId: 777,
  hostSection: HOST_SECTION,
};

const STRUCTURE = {
  config: JSON.stringify([
    { id: 'f_1', name: 'RotaConfig' },
    { id: 'f_2', name: 'S_20260714_49097' },
  ]),
};

const CONFIG_CELL = JSON.stringify({
  v: 1,
  at: '2026-06-01T09:00:00Z',
  by: 'Simon Clark',
  cfg: {
    sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30',
    start: '2026-06-01',
    end: '2026-08-31',
  },
});

const META = {
  v: 1,
  at: '2026-07-01T10:00:00Z',
  by: 'Simon Clark',
  act: 'Kayaking',
  st: '18:15',
  en: '19:30',
  k: 24,
  p: 3,
  c: 0,
};

function gridWith(items) {
  return { identifier: 'scoutid', items };
}

beforeEach(() => {
  vi.clearAllMocks();
  databaseService.getSections.mockResolvedValue([OTHER_SECTION, HOST_SECTION]);
  databaseService.getFlexiData.mockResolvedValue(null);
  databaseService.saveFlexiData.mockResolvedValue(undefined);
  databaseService.getMembers.mockResolvedValue([]);
  CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue({ currentTermId: 'T1' });
});

describe('findHostSection', () => {
  it('finds the Adults section by name', () => {
    expect(findHostSection([OTHER_SECTION, HOST_SECTION])).toBe(HOST_SECTION);
  });

  it('returns null when no section looks like Adults', () => {
    expect(findHostSection([OTHER_SECTION])).toBeNull();
    expect(findHostSection([])).toBeNull();
    expect(findHostSection(undefined)).toBeNull();
  });
});

describe('discoverRotaRecords', () => {
  it('makes ONE getFlexiRecords call on the host section when Adults exists', async () => {
    getFlexiRecords.mockResolvedValue({
      items: [{ name: 'Viking Water Rota Cubs Summer 2026 [49097.924956]', extraid: 777 }],
    });

    const result = await discoverRotaRecords(TOKEN);

    expect(getFlexiRecords).toHaveBeenCalledTimes(1);
    expect(getFlexiRecords).toHaveBeenCalledWith(HOST_SECTION.sectionid, TOKEN, 'n', false, 0);
    expect(result).toEqual([{
      sectionName: 'Cubs', seasonBucket: 'Summer 2026', sectionId: '49097', termId: '924956',
      recordId: 777, hostSection: HOST_SECTION,
    }]);
  });

  it('falls back to scanning every section when no Adults section is visible', async () => {
    databaseService.getSections.mockResolvedValue([OTHER_SECTION]);
    getFlexiRecords.mockResolvedValue({
      items: [{ name: 'Viking Water Rota Cubs Summer 2026 [49097.924956]', extraid: 777 }],
    });

    const result = await discoverRotaRecords(TOKEN);

    expect(getFlexiRecords).toHaveBeenCalledWith(OTHER_SECTION.sectionid, TOKEN, 'n', false, 0);
    expect(result).toHaveLength(1);
  });

  it('ignores non-rota names', async () => {
    getFlexiRecords.mockResolvedValue({
      items: [{ name: 'Viking Event Mgmt', extraid: 1 }, { name: 'Viking Water Rota 2026', extraid: 2 }],
    });

    expect(await discoverRotaRecords(TOKEN)).toEqual([]);
  });

  it('dedupes same-identity duplicates by NUMERIC lowest extraid', async () => {
    getFlexiRecords.mockResolvedValue({
      items: [
        { name: 'Viking Water Rota Cubs Summer 2026 [49097.924956]', extraid: 10 },
        { name: 'Viking Water Rota Cubs Summer 2026 [49097.924956]', extraid: 9 },
      ],
    });

    const result = await discoverRotaRecords(TOKEN);
    expect(result).toHaveLength(1);
    expect(result[0].recordId).toBe(9);
  });

  it('threads priority into the flexi-list read', async () => {
    getFlexiRecords.mockResolvedValue({ items: [] });
    await discoverRotaRecords(TOKEN, 5);
    expect(getFlexiRecords).toHaveBeenCalledWith(expect.anything(), TOKEN, 'n', false, 5);
  });
});

describe('loadRota', () => {
  beforeEach(() => {
    getFlexiStructure.mockResolvedValue(STRUCTURE);
  });

  it('decodes config, sessions, signups, and members from the grid', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      {
        scoutid: 10,
        firstname: 'Simon',
        lastname: 'Clark',
        f_1: CONFIG_CELL,
        f_2: JSON.stringify({ s: 'I', sat: '2026-07-02T10:00:00Z', m: META }),
      },
      { scoutid: 11, firstname: 'Alice', lastname: 'Smith', f_1: '', f_2: '' },
    ]));

    const rota = await loadRota(DESCRIPTOR, TOKEN);

    expect(rota.recordId).toBe(777);
    expect(rota.termId).toBe('T1');
    expect(rota.sectionId).toBe('49097');
    expect(rota.planningTermId).toBe('924956');
    expect(rota.seasonBucket).toBe('Summer 2026');
    expect(rota.config.cfg.start).toBe('2026-06-01');
    expect(rota.sessions).toHaveLength(1);
    expect(rota.sessions[0]).toMatchObject({
      fieldId: 'f_2',
      date: '2026-07-14',
      sectionId: '49097',
    });
    expect(rota.sessions[0].meta.act).toBe('Kayaking');
    expect(rota.sessions[0].signups).toEqual([
      { scoutid: '10', name: 'Simon Clark', status: 'I', at: '2026-07-02T10:00:00Z', photo_guid: null },
    ]);
    expect(rota.members).toEqual([
      { scoutid: '10', name: 'Simon Clark', photo_guid: null },
      { scoutid: '11', name: 'Alice Smith', photo_guid: null },
    ]);
    expect(databaseService.saveFlexiData).toHaveBeenCalledWith(777, 900, 'T1', expect.any(Array));
    expect(rota.configFieldId).toBe('f_1');
    expect(rota.sectionNames).toEqual({ '900': 'Adults', '901': 'Cubs' });
  });

  it('resolves the host read-termid once and threads it consistently into every read/cache call', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 10, firstname: 'Simon', lastname: 'Clark', f_1: CONFIG_CELL, f_2: '' },
    ]));

    await loadRota(DESCRIPTOR, TOKEN);

    expect(CurrentActiveTermsService.getCurrentActiveTerm).toHaveBeenCalledWith(HOST_SECTION.sectionid);
    expect(getFlexiStructure).toHaveBeenCalledWith(777, 900, 'T1', TOKEN, false, 0);
    expect(getSingleFlexiRecord).toHaveBeenCalledWith(777, 900, 'T1', TOKEN, 0);
    expect(databaseService.saveFlexiData).toHaveBeenCalledWith(777, 900, 'T1', expect.any(Array));
  });

  it('errors cleanly when no host term is cached', async () => {
    CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue(null);
    await expect(loadRota(DESCRIPTOR, TOKEN)).rejects.toThrow(/No active term/);
    expect(getFlexiStructure).not.toHaveBeenCalled();
  });

  it('threads the priority option into every flexi read (deep-link fast path)', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 10, firstname: 'Simon', lastname: 'Clark', f_1: CONFIG_CELL, f_2: '' },
    ]));

    await loadRota(DESCRIPTOR, TOKEN, { priority: 5 });

    expect(getFlexiStructure).toHaveBeenLastCalledWith(777, 900, 'T1', TOKEN, false, 5);
    expect(getSingleFlexiRecord).toHaveBeenLastCalledWith(777, 900, 'T1', TOKEN, 5);
  });

  it('defaults the read priority to 0 when the option is omitted', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 10, firstname: 'Simon', lastname: 'Clark', f_1: CONFIG_CELL, f_2: '' },
    ]));

    await loadRota(DESCRIPTOR, TOKEN);

    expect(getFlexiStructure).toHaveBeenLastCalledWith(777, 900, 'T1', TOKEN, false, 0);
    expect(getSingleFlexiRecord).toHaveBeenLastCalledWith(777, 900, 'T1', TOKEN, 0);
  });

  it('enriches members and signups with photo_guid from getMembers', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      {
        scoutid: 10,
        firstname: 'Simon',
        lastname: 'Clark',
        f_1: CONFIG_CELL,
        f_2: JSON.stringify({ s: 'I', sat: '2026-07-02T10:00:00Z', m: META }),
      },
      { scoutid: 11, firstname: 'Alice', lastname: 'Smith', f_1: '', f_2: '' },
    ]));
    databaseService.getMembers.mockResolvedValue([
      { scoutid: 10, photo_guid: 'abc-123' },
      { scoutid: 11, photo_guid: 'def-456' },
    ]);

    const rota = await loadRota(DESCRIPTOR, TOKEN);

    expect(databaseService.getMembers).toHaveBeenCalledWith([900]);
    expect(rota.members).toEqual([
      { scoutid: '10', name: 'Simon Clark', photo_guid: 'abc-123' },
      { scoutid: '11', name: 'Alice Smith', photo_guid: 'def-456' },
    ]);
    expect(rota.sessions[0].signups).toEqual([
      { scoutid: '10', name: 'Simon Clark', status: 'I', at: '2026-07-02T10:00:00Z', photo_guid: 'abc-123' },
    ]);
  });

  it('synthesizes config-only sessions for not-on-water weeks (no column)', async () => {
    const configWithOff = JSON.stringify({
      v: 1, at: '2026-06-01T09:00:00Z', by: 'Simon Clark',
      cfg: {
        sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30',
        start: '2026-06-01', end: '2026-08-31',
        sessions: { S_20260721_49097: { c: 1 } },
      },
    });
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 10, firstname: 'Simon', lastname: 'Clark', f_1: configWithOff, f_2: '' },
    ]));

    const rota = await loadRota(DESCRIPTOR, TOKEN);
    // f_2 column session (14 Jul) + config-only not-on-water session (21 Jul)
    expect(rota.sessions).toHaveLength(2);
    const configOnly = rota.sessions.find((s) => s.fieldId === null);
    expect(configOnly).toMatchObject({ date: '2026-07-21', sectionId: '49097' });
  });

  it('returns a null config (not an error) when RotaConfig was never written', async () => {
    // Column exists but no row holds a value — the setup-not-finished state.
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 10, firstname: 'Simon', lastname: 'Clark', f_1: '', f_2: JSON.stringify({ s: 'I', sat: '2026-07-02T10:00:00Z' }) },
    ]));

    const rota = await loadRota(DESCRIPTOR, TOKEN);
    expect(rota.config).toBeNull();
    expect(rota.sessions[0].signups).toHaveLength(1);
    expect(rota.configFieldId).toBe('f_1');
  });

  it('throws when the record structure is missing RotaConfig', async () => {
    getFlexiStructure.mockResolvedValue({
      config: JSON.stringify([{ id: 'f_2', name: 'S_20260714_49097' }]),
    });
    getSingleFlexiRecord.mockResolvedValue(gridWith([]));

    await expect(loadRota(DESCRIPTOR, TOKEN)).rejects.toThrow(/RotaConfig/);
  });
});

describe('assembleGroupConfig', () => {
  it('aggregates N records into sections[] and a merged sessions{} map', () => {
    const records = [
      { config: { cfg: { sid: '10', sname: 'Beavers', act: 'Kayaking', st: '18:00', en: '19:00', start: '2026-06-01', end: '2026-07-31', sessions: { S_20260603_10: { pt: 'x' } } } } },
      { config: { cfg: { sid: '20', sname: 'Cubs', act: 'Canoeing', st: '18:15', en: '19:30', start: '2026-05-15', end: '2026-08-31', sessions: { S_20260605_20: { pt: 'y' } } } } },
    ];

    const assembled = assembleGroupConfig(records);
    expect(assembled.cfg.sections).toEqual([
      { sid: '10', sname: 'Beavers', act: 'Kayaking', st: '18:00', en: '19:00', k: undefined, p: undefined, regulars: [] },
      { sid: '20', sname: 'Cubs', act: 'Canoeing', st: '18:15', en: '19:30', k: undefined, p: undefined, regulars: [] },
    ]);
    expect(assembled.cfg.sessions).toEqual({ S_20260603_10: { pt: 'x' }, S_20260605_20: { pt: 'y' } });
    expect(assembled.cfg.start).toBe('2026-05-15');
    expect(assembled.cfg.end).toBe('2026-08-31');
  });

  it('skips configless records', () => {
    const records = [
      { config: null },
      { config: { cfg: { sid: '20', sname: 'Cubs', act: 'Canoeing', st: '18:15', en: '19:30' } } },
    ];
    expect(assembleGroupConfig(records).cfg.sections).toHaveLength(1);
  });

  it('returns null when every record is configless', () => {
    expect(assembleGroupConfig([{ config: null }, { config: null }])).toBeNull();
  });
});

describe('assembleRotaGroup', () => {
  it('gives every aggregated session a record back-reference and takes members from the first record', () => {
    const recordA = {
      hostSection: HOST_SECTION,
      config: { cfg: { sid: '10', sname: 'Beavers', act: 'Kayaking', st: '18:00', en: '19:00' } },
      sessions: [{ fieldId: 'f_2', date: '2026-06-03', sectionId: '10' }],
      members: [{ scoutid: '1', name: 'A' }],
      sectionNames: { 10: 'Beavers' },
    };
    const recordB = {
      hostSection: HOST_SECTION,
      config: null,
      sessions: [{ fieldId: 'f_3', date: '2026-06-05', sectionId: '20' }],
      members: [{ scoutid: '1', name: 'A' }],
      sectionNames: { 10: 'Beavers', 20: 'Cubs' },
    };

    const group = assembleRotaGroup('Summer 2026', [recordA, recordB]);
    expect(group.seasonBucket).toBe('Summer 2026');
    expect(group.hostSection).toBe(HOST_SECTION);
    expect(group.records).toEqual([recordA, recordB]);
    expect(group.sessions).toEqual([
      { fieldId: 'f_2', date: '2026-06-03', sectionId: '10', record: recordA },
      { fieldId: 'f_3', date: '2026-06-05', sectionId: '20', record: recordB },
    ]);
    expect(group.members).toEqual([{ scoutid: '1', name: 'A' }]);
    expect(group.config.cfg.sections).toHaveLength(1);
  });
});

describe('loadRotaGroup', () => {
  beforeEach(() => {
    getFlexiStructure.mockResolvedValue(STRUCTURE);
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 10, firstname: 'Simon', lastname: 'Clark', f_1: CONFIG_CELL, f_2: '' },
    ]));
  });

  it('filters discovered records by season bucket and aggregates them', async () => {
    getFlexiRecords.mockResolvedValue({
      items: [
        { name: 'Viking Water Rota Cubs Summer 2026 [49097.924956]', extraid: 777 },
        { name: 'Viking Water Rota Scouts Autumn 2026 [49099.900001]', extraid: 778 },
      ],
    });

    const group = await loadRotaGroup('Summer 2026', TOKEN);
    expect(group.seasonBucket).toBe('Summer 2026');
    expect(group.records).toHaveLength(1);
    expect(group.records[0].recordId).toBe(777);
  });

  it('returns null when the bucket has no records', async () => {
    getFlexiRecords.mockResolvedValue({ items: [] });
    expect(await loadRotaGroup('Summer 2026', TOKEN)).toBeNull();
  });

  it('fails the whole group load when a single record read fails', async () => {
    getFlexiRecords.mockResolvedValue({
      items: [
        { name: 'Viking Water Rota Cubs Summer 2026 [49097.924956]', extraid: 777 },
        { name: 'Viking Water Rota Scouts Summer 2026 [49099.900001]', extraid: 778 },
      ],
    });
    getFlexiStructure.mockImplementation(async (recordId) => {
      if (recordId === 778) {
        throw new Error('boom');
      }
      return STRUCTURE;
    });

    await expect(loadRotaGroup('Summer 2026', TOKEN)).rejects.toThrow(/boom/);
  });
});

describe('writeSignup', () => {
  const rota = { hostSection: HOST_SECTION, recordId: 777, termId: 'T1' };

  it('re-fetches live, preserves own metadata, writes one cell, patches cache', async () => {
    const ownCell = JSON.stringify({ m: META });
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 10, firstname: 'Simon', lastname: 'Clark', f_2: ownCell },
    ]));
    updateFlexiRecord.mockResolvedValue({ ok: true });
    databaseService.getFlexiData.mockResolvedValue({
      items: [{ scoutid: 10, f_2: ownCell }],
    });

    await writeSignup({ rota, fieldId: 'f_2', scoutid: 10, status: SIGNUP_STATUS.IN, token: TOKEN });

    expect(updateFlexiRecord).toHaveBeenCalledTimes(1);
    const [sectionid, scoutid, recordId, columnid, value, termid, section] =
      updateFlexiRecord.mock.calls[0];
    expect([sectionid, scoutid, recordId, columnid, termid, section]).toEqual([
      900, 10, 777, 'f_2', 'T1', 'adults',
    ]);
    const written = JSON.parse(value);
    expect(written.s).toBe('I');
    expect(written.m).toEqual(META);

    const [, , , savedItems] = databaseService.saveFlexiData.mock.calls.at(-1);
    expect(savedItems[0].f_2).toBe(value);
  });

  it('throws when the caller has no row in the host section', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([{ scoutid: 99, f_2: '' }]));

    await expect(
      writeSignup({ rota, fieldId: 'f_2', scoutid: 10, status: SIGNUP_STATUS.IN, token: TOKEN }),
    ).rejects.toThrow(/member row/);
    expect(updateFlexiRecord).not.toHaveBeenCalled();
  });

  it('rejects invalid statuses without touching the network', async () => {
    await expect(
      writeSignup({ rota, fieldId: 'f_2', scoutid: 10, status: 'X', token: TOKEN }),
    ).rejects.toThrow(/Invalid signup status/);
    expect(getSingleFlexiRecord).not.toHaveBeenCalled();
  });

  it('propagates write failures (offline / permission)', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([{ scoutid: 10, f_2: '' }]));
    const offline = new Error('writeSignup: cannot send write - offline');
    offline.code = 'WRITE_UNAVAILABLE';
    updateFlexiRecord.mockRejectedValue(offline);

    await expect(
      writeSignup({ rota, fieldId: 'f_2', scoutid: 10, status: SIGNUP_STATUS.IN, token: TOKEN }),
    ).rejects.toThrow(/offline/);
  });

  it('throws when OSM returns HTTP 200 with a failure body', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([{ scoutid: 10, f_2: '' }]));
    updateFlexiRecord.mockResolvedValue({ ok: false, message: 'no write permission' });

    await expect(
      writeSignup({ rota, fieldId: 'f_2', scoutid: 10, status: SIGNUP_STATUS.IN, token: TOKEN }),
    ).rejects.toThrow(/no write permission/);
  });

  it('does not treat a no-op result:0 response as failure', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([{ scoutid: 10, f_2: '' }]));
    updateFlexiRecord.mockResolvedValue({ result: 0, items: [] });
    databaseService.getFlexiData.mockResolvedValue({ items: [{ scoutid: 10, f_2: '' }] });

    await expect(
      writeSignup({ rota, fieldId: 'f_2', scoutid: 10, status: SIGNUP_STATUS.IN, token: TOKEN }),
    ).resolves.toBeUndefined();
  });

  it('serializes concurrent writes through the lock', async () => {
    const order = [];
    getSingleFlexiRecord.mockImplementation(async () => {
      order.push('fetch');
      return gridWith([{ scoutid: 10, f_2: '' }]);
    });
    updateFlexiRecord.mockImplementation(async () => {
      order.push('update');
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true };
    });

    await Promise.all([
      writeSignup({ rota, fieldId: 'f_2', scoutid: 10, status: SIGNUP_STATUS.IN, token: TOKEN }),
      writeSignup({ rota, fieldId: 'f_2', scoutid: 10, status: SIGNUP_STATUS.BACKUP, token: TOKEN }),
    ]);

    expect(order).toEqual(['fetch', 'update', 'fetch', 'update']);
  });

  it('routes a write to the session\'s owning record and the lock still serializes across records', async () => {
    // Aggregated sessions carry a `record` back-reference (assembleRotaGroup);
    // callers pass session.record as the `rota` argument so the write lands
    // on the record that actually owns the column.
    const recordA = { hostSection: HOST_SECTION, recordId: 777, termId: 'T1' };
    const recordB = { hostSection: HOST_SECTION, recordId: 888, termId: 'T1' };
    const sessionA = { fieldId: 'f_2', record: recordA };
    const sessionB = { fieldId: 'f_2', record: recordB };

    const order = [];
    getSingleFlexiRecord.mockImplementation(async (recordId) => {
      order.push(`fetch-${recordId}`);
      return gridWith([{ scoutid: 10, f_2: '' }]);
    });
    updateFlexiRecord.mockImplementation(async (_sectionid, _scoutid, recordId) => {
      order.push(`update-${recordId}`);
      return { ok: true };
    });

    await Promise.all([
      writeSignup({ rota: sessionA.record, fieldId: sessionA.fieldId, scoutid: 10, status: SIGNUP_STATUS.IN, token: TOKEN }),
      writeSignup({ rota: sessionB.record, fieldId: sessionB.fieldId, scoutid: 10, status: SIGNUP_STATUS.IN, token: TOKEN }),
    ]);

    expect(updateFlexiRecord.mock.calls.map((call) => call[2])).toEqual(expect.arrayContaining([777, 888]));
    // The module-level lock is per-module, not per-record — it serializes
    // even though the two writes target different records.
    expect(order).toEqual(['fetch-777', 'update-777', 'fetch-888', 'update-888']);
  });
});

describe('assignSignup', () => {
  const rota = { hostSection: HOST_SECTION, recordId: 777, termId: 'T1' };

  it('drives the own-cell write path for another member', async () => {
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 11, firstname: 'Alice', lastname: 'Smith', f_2: '' },
    ]));
    updateFlexiRecord.mockResolvedValue({ ok: true });
    databaseService.getFlexiData.mockResolvedValue({ items: [{ scoutid: 11, f_2: '' }] });

    await assignSignup({ rota, fieldId: 'f_2', scoutid: 11, status: SIGNUP_STATUS.IN, token: TOKEN });

    expect(updateFlexiRecord).toHaveBeenCalledTimes(1);
    const [sectionid, scoutid, recordId, columnid, value] = updateFlexiRecord.mock.calls[0];
    expect([sectionid, scoutid, recordId, columnid]).toEqual([900, 11, 777, 'f_2']);
    expect(JSON.parse(value).s).toBe('I');
  });
});

describe('writeSessionMeta', () => {
  const rota = { hostSection: HOST_SECTION, recordId: 777, termId: 'T1' };

  it('bumps the version above the live column winner and preserves own signup', async () => {
    const ownCell = JSON.stringify({ s: 'B', sat: '2026-07-01T08:00:00Z' });
    const rivalCell = JSON.stringify({ m: { ...META, v: 5, by: 'Rival Leader' } });
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 10, f_2: ownCell },
      { scoutid: 11, f_2: rivalCell },
    ]));
    updateFlexiRecord.mockResolvedValue({ ok: true });

    await writeSessionMeta({
      rota,
      fieldId: 'f_2',
      scoutid: 10,
      by: 'Simon Clark',
      fields: { act: 'Rafting', st: '18:00', en: '19:15', k: 20, p: 2, c: 0 },
      token: TOKEN,
    });

    const written = JSON.parse(updateFlexiRecord.mock.calls[0][4]);
    expect(written.m.v).toBe(6);
    expect(written.m.act).toBe('Rafting');
    expect(written.m.by).toBe('Simon Clark');
    expect(written.s).toBe('B');
    expect(written.sat).toBe('2026-07-01T08:00:00Z');
  });
});

describe('prefillRegulars', () => {
  const rota = {
    hostSection: HOST_SECTION,
    recordId: 777,
    termId: 'T1',
    sessions: [
      { fieldId: 'f_2', sectionId: '49097' },
      { fieldId: 'f_3', sectionId: '49097' },
      { fieldId: 'f_4', sectionId: '49099' },
      { fieldId: null, sectionId: '49097' }, // config-only not-on-water → skipped
    ],
  };

  it('writes one multiUpdate per on-water session with the section regulars', async () => {
    multiUpdateFlexiRecord.mockResolvedValue({ ok: true });

    const result = await prefillRegulars({
      rota,
      regularsBySection: { '49097': ['10', '11'], '49099': ['12'] },
      token: TOKEN,
    });

    expect(result.filled).toBe(3);
    expect(result.errors).toEqual([]);
    // f_2, f_3 (Cubs) get [10,11]; f_4 (Scouts) gets [12]; null skipped
    expect(multiUpdateFlexiRecord).toHaveBeenCalledTimes(3);
    const [sectionid, scouts, value, column, recordId] = multiUpdateFlexiRecord.mock.calls[0];
    expect([sectionid, column, recordId]).toEqual([900, 'f_2', 777]);
    expect(scouts).toEqual(['10', '11']);
    expect(JSON.parse(value)).toMatchObject({ s: 'I' });
  });

  it('skips sessions whose section has no regulars', async () => {
    multiUpdateFlexiRecord.mockResolvedValue({ ok: true });
    const result = await prefillRegulars({
      rota,
      regularsBySection: { '49097': ['10'] },
      token: TOKEN,
    });
    // only f_2 and f_3 (Cubs); f_4 (Scouts, no regulars) skipped
    expect(result.filled).toBe(2);
    expect(multiUpdateFlexiRecord).toHaveBeenCalledTimes(2);
  });

  it('collects per-session errors and continues', async () => {
    multiUpdateFlexiRecord
      .mockResolvedValueOnce({ ok: false, message: 'denied' })
      .mockResolvedValue({ ok: true });
    const result = await prefillRegulars({
      rota,
      regularsBySection: { '49097': ['10'], '49099': ['12'] },
      token: TOKEN,
    });
    expect(result.filled).toBe(2);
    expect(result.errors).toEqual([{ fieldId: 'f_2', error: 'denied' }]);
  });

  it('can target a specific subset of sessions (e.g. newly synced)', async () => {
    multiUpdateFlexiRecord.mockResolvedValue({ ok: true });
    await prefillRegulars({
      rota,
      regularsBySection: { '49097': ['10'] },
      token: TOKEN,
      sessions: [{ fieldId: 'f_9', sectionId: '49097' }],
    });
    expect(multiUpdateFlexiRecord).toHaveBeenCalledTimes(1);
    expect(multiUpdateFlexiRecord.mock.calls[0][3]).toBe('f_9');
  });

  it('throttles 300ms between successive multi-update calls', async () => {
    vi.useFakeTimers();
    try {
      multiUpdateFlexiRecord.mockResolvedValue({ ok: true });
      const promise = prefillRegulars({
        rota,
        regularsBySection: { '49097': ['10', '11'], '49099': ['12'] },
        token: TOKEN,
      });

      // First call fires without any throttle delay.
      await vi.advanceTimersByTimeAsync(0);
      expect(multiUpdateFlexiRecord).toHaveBeenCalledTimes(1);

      // Second call is held back until the 300ms throttle elapses.
      await vi.advanceTimersByTimeAsync(299);
      expect(multiUpdateFlexiRecord).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(multiUpdateFlexiRecord).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(300);
      const result = await promise;
      expect(multiUpdateFlexiRecord).toHaveBeenCalledTimes(3);
      expect(result.filled).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
