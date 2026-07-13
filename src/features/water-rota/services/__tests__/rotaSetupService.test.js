import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../shared/services/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { API: 'API', APP: 'APP', ERROR: 'ERROR' },
}));

vi.mock('../../../flexi-records/services/flexiRecordCreationService.js', () => ({
  createOrCompleteFlexiRecord: vi.fn(),
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
    getFlexiData: vi.fn().mockResolvedValue(null),
    saveFlexiData: vi.fn(),
    getMembers: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/storage/currentActiveTermsService.js', () => ({
  CurrentActiveTermsService: { getCurrentActiveTerm: vi.fn() },
}));

vi.mock('../programmeService.js', () => ({
  fetchProgrammeMeetings: vi.fn(),
}));

import { createOrCompleteFlexiRecord } from '../../../flexi-records/services/flexiRecordCreationService.js';
import {
  getFlexiRecords,
  getFlexiStructure,
  getSingleFlexiRecord,
  updateFlexiRecord,
} from '../../../../shared/services/api/api/index.js';
import databaseService from '../../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../../shared/services/storage/currentActiveTermsService.js';
import { fetchProgrammeMeetings } from '../programmeService.js';
import {
  activateWaterSession,
  createOrCompleteRota,
  diffSessions,
  syncRotaWithProgramme,
  writeRotaConfig,
} from '../rotaSetupService.js';

const HOST_SECTION = { sectionid: 900, sectionname: 'Adults', section: 'adults' };

const SESSIONS = [
  { date: '2026-06-02', sectionId: '49097', sectionName: 'Cubs', startTime: '18:15', endTime: '19:30', activity: 'Kayaking', title: null },
  { date: '2026-06-05', sectionId: '49099', sectionName: 'Scouts', startTime: '19:00', endTime: '20:30', activity: 'Bell boats', title: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createOrCompleteRota', () => {
  it('builds a template with the config column plus one column per session', async () => {
    createOrCompleteFlexiRecord.mockResolvedValue({ success: true, flexirecordid: 777 });

    const result = await createOrCompleteRota({
      hostSection: HOST_SECTION,
      year: 2026,
      termId: 'T1',
      sessions: SESSIONS,
      token: 'tok',
    });

    expect(result.flexirecordid).toBe(777);
    const { section, template, termId } = createOrCompleteFlexiRecord.mock.calls[0][0];
    expect(section).toBe(HOST_SECTION);
    expect(termId).toBe('T1');
    expect(template.name).toBe('Viking Water Rota 2026');
    expect(template.fields).toEqual(['RotaConfig', 'S_20260602_49097', 'S_20260605_49099']);
  });

  it('surfaces partial failure results untouched so callers can retry', async () => {
    const partial = { success: false, flexirecordid: 777, errors: [{ field: 'S_20260605_49099', error: 'boom' }] };
    createOrCompleteFlexiRecord.mockResolvedValue(partial);

    const result = await createOrCompleteRota({
      hostSection: HOST_SECTION,
      year: 2026,
      termId: 'T1',
      sessions: SESSIONS,
      token: 'tok',
    });

    expect(result).toBe(partial);
  });
});

describe('writeRotaConfig', () => {
  it('resolves the RotaConfig field id and writes the LWW config candidate', async () => {
    getFlexiStructure.mockResolvedValue({
      config: JSON.stringify([{ id: 'f_9', name: 'RotaConfig' }]),
    });
    getSingleFlexiRecord.mockResolvedValue({
      items: [{ scoutid: 10, f_9: '' }],
    });
    updateFlexiRecord.mockResolvedValue({ ok: true });

    const cfg = {
      start: '2026-06-01',
      end: '2026-08-31',
      sections: [{ sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30' }],
    };

    await writeRotaConfig({
      hostSection: HOST_SECTION,
      recordId: 777,
      termId: 'T1',
      scoutid: 10,
      by: 'Simon Clark',
      cfg,
      token: 'tok',
    });

    expect(getFlexiStructure).toHaveBeenCalledWith(777, 900, 'T1', 'tok', true);
    const [, , , columnid, value] = updateFlexiRecord.mock.calls[0];
    expect(columnid).toBe('f_9');
    const written = JSON.parse(value);
    expect(written.v).toBe(1);
    expect(written.cfg).toEqual(cfg);
  });

  it('throws when the record has no RotaConfig column', async () => {
    getFlexiStructure.mockResolvedValue({
      config: JSON.stringify([{ id: 'f_2', name: 'S_20260714_49097' }]),
    });

    await expect(
      writeRotaConfig({
        hostSection: HOST_SECTION,
        recordId: 777,
        termId: 'T1',
        scoutid: 10,
        by: 'Simon Clark',
        cfg: { start: '2026-06-01', end: '2026-08-31', sections: [] },
        token: 'tok',
      }),
    ).rejects.toThrow(/RotaConfig column not found/);
  });
});

describe('syncRotaWithProgramme', () => {
  const rota = {
    year: 2026,
    hostSection: HOST_SECTION,
    recordId: 777,
    termId: 'T1',
    config: {
      cfg: {
        start: '2026-06-01',
        end: '2026-08-31',
        sections: [{ sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30' }],
      },
    },
    sessions: [
      { fieldId: 'f_2', date: '2026-06-02', sectionId: '49097', meta: null, signups: [] },
      { fieldId: 'f_3', date: '2026-06-09', sectionId: '49097', meta: null, signups: [] },
    ],
  };

  beforeEach(() => {
    CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue({ currentTermId: 'T1' });
  });

  it('appends columns for new meetings and reports vanished ones', async () => {
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: null },
      { date: '2026-06-16', startTime: null, endTime: null, title: null },
    ]);
    createOrCompleteFlexiRecord.mockResolvedValue({ success: true, flexirecordid: 777, errors: [] });

    const result = await syncRotaWithProgramme({ rota, token: 'tok' });

    expect(result.added).toBe(1);
    expect(result.orphaned.map((column) => column.date)).toEqual(['2026-06-09']);
    const { template } = createOrCompleteFlexiRecord.mock.calls[0][0];
    expect(template.fields).toEqual(['RotaConfig', 'S_20260616_49097']);
  });

  it('does nothing when the rota already matches', async () => {
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: null },
      { date: '2026-06-09', startTime: null, endTime: null, title: null },
    ]);

    const result = await syncRotaWithProgramme({ rota, token: 'tok' });

    expect(result).toEqual({ added: 0, orphaned: [], errors: [], titlesUpdated: 0, uncheckedSections: [], failedSections: [] });
    expect(createOrCompleteFlexiRecord).not.toHaveBeenCalled();
  });

  it('backfills programme titles onto matching sessions when given an editor identity', async () => {
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: 'Cubs Kayaking' },
      { date: '2026-06-09', startTime: null, endTime: null, title: 'Cubs Canoe Trip' },
    ]);
    getFlexiStructure.mockResolvedValue({
      config: JSON.stringify([{ id: 'f_9', name: 'RotaConfig' }]),
    });
    getSingleFlexiRecord.mockResolvedValue({ items: [{ scoutid: 900, f_9: '' }] });
    updateFlexiRecord.mockResolvedValue({ ok: true });

    const result = await syncRotaWithProgramme({ rota, token: 'tok', scoutid: 900, by: 'Simon Clark' });

    expect(result.added).toBe(0);
    expect(result.titlesUpdated).toBe(2);
    // One LWW config write carrying the real meeting titles for both sessions.
    expect(updateFlexiRecord).toHaveBeenCalledTimes(1);
    const written = JSON.parse(updateFlexiRecord.mock.calls[0][4]);
    expect(written.cfg.sessions).toEqual({
      S_20260602_49097: { pt: 'Cubs Kayaking' },
      S_20260609_49097: { pt: 'Cubs Canoe Trip' },
    });
  });

  it('skips the title backfill (no config write) without an editor identity', async () => {
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: 'Cubs Kayaking' },
      { date: '2026-06-09', startTime: null, endTime: null, title: 'Cubs Canoe Trip' },
    ]);

    const result = await syncRotaWithProgramme({ rota, token: 'tok' });

    expect(result.titlesUpdated).toBe(0);
    expect(updateFlexiRecord).not.toHaveBeenCalled();
  });

  it('reports a section whose programme fetch fails as failed (not unchecked) and does not orphan it', async () => {
    // A fetch error (e.g. expired token) is a real failure — its existing
    // sessions must NOT be orphaned, and it must be distinguishable from the
    // benign no-active-term case so the caller can raise an error.
    fetchProgrammeMeetings.mockRejectedValue(new Error('OSM 500'));

    const result = await syncRotaWithProgramme({ rota, token: 'tok' });

    expect(result.orphaned).toEqual([]);
    expect(result.failedSections).toEqual(['49097']);
    expect(result.uncheckedSections).toEqual([]);
    expect(result.added).toBe(0);
    expect(createOrCompleteFlexiRecord).not.toHaveBeenCalled();
  });

  it('flags a section with no active term as unchecked (not failed) and does not orphan it', async () => {
    CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue({ currentTermId: null });

    const result = await syncRotaWithProgramme({ rota, token: 'tok' });

    expect(result.orphaned).toEqual([]);
    expect(result.uncheckedSections).toEqual(['49097']);
    expect(result.failedSections).toEqual([]);
  });

  it('throws without a plan config', async () => {
    await expect(syncRotaWithProgramme({ rota: { ...rota, config: null }, token: 'tok' })).rejects.toThrow(/config/);
  });
});

describe('activateWaterSession', () => {
  const rota = { year: 2026, hostSection: HOST_SECTION, recordId: 777, termId: 'T1' };

  beforeEach(() => {
    databaseService.getSections.mockResolvedValue([HOST_SECTION]);
    databaseService.getFlexiData.mockResolvedValue(null);
    databaseService.saveFlexiData.mockResolvedValue(undefined);
    databaseService.getMembers.mockResolvedValue([]);
    CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue({ currentTermId: 'T1' });
    getFlexiRecords.mockResolvedValue({ items: [{ name: 'Viking Water Rota 2026', extraid: 777 }] });
    getFlexiStructure.mockResolvedValue({
      config: JSON.stringify([
        { id: 'f_1', name: 'RotaConfig' },
        { id: 'f_2', name: 'S_20260714_49097' },
      ]),
    });
    getSingleFlexiRecord.mockResolvedValue({
      identifier: 'scoutid',
      items: [{ scoutid: 10, firstname: 'Simon', lastname: 'Clark', f_1: '', f_2: '' }],
    });
    updateFlexiRecord.mockResolvedValue({ ok: true });
  });

  it('creates the column, writes cleared not-on-water meta, and returns the reloaded rota', async () => {
    createOrCompleteFlexiRecord.mockResolvedValue({ success: true, flexirecordid: 777 });

    const result = await activateWaterSession({
      rota,
      date: '2026-07-14',
      sectionId: '49097',
      fields: { act: 'Kayaking', st: '18:15', en: '19:30', k: 24, p: 3 },
      by: 'Simon Clark',
      scoutid: 10,
      token: 'tok',
    });

    const [, , , columnid, value] = updateFlexiRecord.mock.calls[0];
    expect(columnid).toBe('f_2');
    const written = JSON.parse(value);
    expect(written.m.c).toBe(0);
    expect(written.m.act).toBe('Kayaking');

    expect(result.recordId).toBe(777);
    expect(result.sessions.find((s) => s.fieldId === 'f_2')).toMatchObject({
      date: '2026-07-14',
      sectionId: '49097',
    });

    expect(
      getFlexiStructure.mock.calls.some((call) => call[4] === true),
    ).toBe(true);
  });

  it('throws when the column could not be created', async () => {
    createOrCompleteFlexiRecord.mockResolvedValue({ success: false, errors: [{ error: 'boom' }] });

    await expect(
      activateWaterSession({
        rota,
        date: '2026-07-14',
        sectionId: '49097',
        fields: { act: 'Kayaking', st: '18:15', en: '19:30', k: 24, p: 3 },
        by: 'Simon Clark',
        scoutid: 10,
        token: 'tok',
      }),
    ).rejects.toThrow(/boom/);
    expect(updateFlexiRecord).not.toHaveBeenCalled();
  });

  it('throws when the reloaded rota has no matching session column', async () => {
    createOrCompleteFlexiRecord.mockResolvedValue({ success: true, flexirecordid: 777 });

    await expect(
      activateWaterSession({
        rota,
        date: '2026-07-21',
        sectionId: '49097',
        fields: { act: 'Kayaking', st: '18:15', en: '19:30', k: 24, p: 3 },
        by: 'Simon Clark',
        scoutid: 10,
        token: 'tok',
      }),
    ).rejects.toThrow(/could not be confirmed/);
    expect(updateFlexiRecord).not.toHaveBeenCalled();
  });
});

describe('diffSessions', () => {
  const existing = [
    { fieldId: 'f_2', date: '2026-06-02', sectionId: '49097' },
    { fieldId: 'f_3', date: '2026-06-09', sectionId: '49097' },
  ];

  it('identifies new descriptors and orphaned columns', () => {
    const descriptors = [
      { date: '2026-06-02', sectionId: '49097' },
      { date: '2026-06-16', sectionId: '49097' },
    ];

    const { toAdd, orphaned } = diffSessions(existing, descriptors);
    expect(toAdd.map((d) => d.date)).toEqual(['2026-06-16']);
    expect(orphaned.map((c) => c.date)).toEqual(['2026-06-09']);
  });

  it('returns empty diffs when everything matches', () => {
    const descriptors = [
      { date: '2026-06-02', sectionId: '49097' },
      { date: '2026-06-09', sectionId: '49097' },
    ];
    expect(diffSessions(existing, descriptors)).toEqual({ toAdd: [], orphaned: [] });
  });

  it('handles empty inputs', () => {
    expect(diffSessions([], [])).toEqual({ toAdd: [], orphaned: [] });
    expect(diffSessions(undefined, undefined)).toEqual({ toAdd: [], orphaned: [] });
  });
});
