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
}));

vi.mock('../../../../shared/services/storage/database.js', () => ({
  default: {
    getSections: vi.fn(),
    getFlexiData: vi.fn(),
    saveFlexiData: vi.fn(),
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
} from '../../../../shared/services/api/api/index.js';
import databaseService from '../../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../../shared/services/storage/currentActiveTermsService.js';
import {
  discoverRotaRecord,
  loadRota,
  writeSignup,
  writeSessionMeta,
} from '../rotaService.js';
import { SIGNUP_STATUS } from '../rotaEncoding.js';

const HOST_SECTION = { sectionid: 900, sectionname: 'Adults', section: 'adults' };
const OTHER_SECTION = { sectionid: 901, sectionname: 'Cubs', section: 'cubs' };
const TOKEN = 'tok';

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
    start: '2026-06-01',
    end: '2026-08-31',
    sections: [{ sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30' }],
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
  CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue({ currentTermId: 'T1' });
});

describe('discoverRotaRecord', () => {
  it('finds the rota record across the user sections', async () => {
    getFlexiRecords.mockImplementation(async (sectionId) =>
      sectionId === HOST_SECTION.sectionid
        ? { items: [{ name: 'Viking Water Rota 2026', extraid: 777 }] }
        : { items: [{ name: 'Viking Event Mgmt', extraid: 1 }] },
    );

    const result = await discoverRotaRecord(2026, TOKEN);
    expect(result).toEqual({ hostSection: HOST_SECTION, recordId: 777 });
  });

  it('returns null when no section has the record', async () => {
    getFlexiRecords.mockResolvedValue({ items: [] });
    expect(await discoverRotaRecord(2026, TOKEN)).toBeNull();
  });

  it('skips sections whose flexi list read fails', async () => {
    getFlexiRecords.mockImplementation(async (sectionId) => {
      if (sectionId === OTHER_SECTION.sectionid) {
        throw new Error('boom');
      }
      return { items: [{ name: 'Viking Water Rota 2026', extraid: 777 }] };
    });

    const result = await discoverRotaRecord(2026, TOKEN);
    expect(result?.recordId).toBe(777);
  });
});

describe('loadRota', () => {
  beforeEach(() => {
    getFlexiRecords.mockImplementation(async (sectionId) =>
      sectionId === HOST_SECTION.sectionid
        ? { items: [{ name: 'Viking Water Rota 2026', extraid: 777 }] }
        : { items: [] },
    );
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

    const rota = await loadRota(2026, TOKEN);

    expect(rota.recordId).toBe(777);
    expect(rota.termId).toBe('T1');
    expect(rota.config.cfg.start).toBe('2026-06-01');
    expect(rota.sessions).toHaveLength(1);
    expect(rota.sessions[0]).toMatchObject({
      fieldId: 'f_2',
      date: '2026-07-14',
      sectionId: '49097',
    });
    expect(rota.sessions[0].meta.act).toBe('Kayaking');
    expect(rota.sessions[0].signups).toEqual([
      { scoutid: '10', name: 'Simon Clark', status: 'I', at: '2026-07-02T10:00:00Z' },
    ]);
    expect(rota.members).toEqual([
      { scoutid: '10', name: 'Simon Clark' },
      { scoutid: '11', name: 'Alice Smith' },
    ]);
    expect(databaseService.saveFlexiData).toHaveBeenCalledWith(777, 900, 'T1', expect.any(Array));
    expect(rota.configFieldId).toBe('f_1');
    expect(rota.sectionNames).toEqual({ '900': 'Adults', '901': 'Cubs' });
  });

  it('returns a null config (not an error) when RotaConfig was never written', async () => {
    // Column exists but no row holds a value — the setup-not-finished state.
    getSingleFlexiRecord.mockResolvedValue(gridWith([
      { scoutid: 10, firstname: 'Simon', lastname: 'Clark', f_1: '', f_2: JSON.stringify({ s: 'I', sat: '2026-07-02T10:00:00Z' }) },
    ]));

    const rota = await loadRota(2026, TOKEN);
    expect(rota.config).toBeNull();
    expect(rota.sessions[0].signups).toHaveLength(1);
    expect(rota.configFieldId).toBe('f_1');
  });

  it('returns null when no rota record exists', async () => {
    getFlexiRecords.mockResolvedValue({ items: [] });
    expect(await loadRota(2026, TOKEN)).toBeNull();
  });

  it('throws when the record structure is missing RotaConfig', async () => {
    getFlexiStructure.mockResolvedValue({
      config: JSON.stringify([{ id: 'f_2', name: 'S_20260714_49097' }]),
    });
    getSingleFlexiRecord.mockResolvedValue(gridWith([]));

    await expect(loadRota(2026, TOKEN)).rejects.toThrow(/RotaConfig/);
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
