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

const RECORD = { sectionId: '49097', sectionName: 'Cubs', termId: '924956', seasonBucket: 'Summer 2026' };

const SESSIONS = [
  { date: '2026-06-02', sectionId: '49097', sectionName: 'Cubs', startTime: '18:15', endTime: '19:30', activity: 'Kayaking', title: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createOrCompleteRota', () => {
  it('builds a template with the config column plus one column per session, under the per-section record name', async () => {
    createOrCompleteFlexiRecord.mockResolvedValue({ success: true, flexirecordid: 777 });

    const result = await createOrCompleteRota({
      hostSection: HOST_SECTION,
      hostTermId: 'HT1',
      record: RECORD,
      sessions: SESSIONS,
      token: 'tok',
    });

    expect(result.flexirecordid).toBe(777);
    const { section, template, termId } = createOrCompleteFlexiRecord.mock.calls[0][0];
    expect(section).toBe(HOST_SECTION);
    // hostTermId drives the creation orchestrator's structure reads only —
    // it is never part of the record's name/identity.
    expect(termId).toBe('HT1');
    expect(template.name).toBe('Viking Water Rota Cubs Summer 2026 [49097.924956]');
    expect(template.fields).toEqual(['RotaConfig', 'S_20260602_49097']);
  });

  it('surfaces partial failure results untouched so callers can retry', async () => {
    const partial = { success: false, flexirecordid: 777, errors: [{ field: 'S_20260602_49097', error: 'boom' }] };
    createOrCompleteFlexiRecord.mockResolvedValue(partial);

    const result = await createOrCompleteRota({
      hostSection: HOST_SECTION,
      hostTermId: 'HT1',
      record: RECORD,
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
      sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30',
      start: '2026-06-01',
      end: '2026-08-31',
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
        cfg: { sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30' },
        token: 'tok',
      }),
    ).rejects.toThrow(/RotaConfig column not found/);
  });
});

describe('syncRotaWithProgramme', () => {
  const rota = {
    hostSection: HOST_SECTION,
    recordId: 777,
    termId: 'HT1',
    sectionId: '49097',
    planningTermId: '924956',
    seasonBucket: 'Summer 2026',
    config: {
      cfg: {
        sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30',
        start: '2026-06-01',
        end: '2026-08-31',
      },
    },
    sessions: [
      { fieldId: 'f_2', date: '2026-06-02', sectionId: '49097', meta: null, signups: [] },
      { fieldId: 'f_3', date: '2026-06-09', sectionId: '49097', meta: null, signups: [] },
    ],
  };

  it('fetches the programme under the record\'s own planning termId (not the section\'s current active term)', async () => {
    fetchProgrammeMeetings.mockResolvedValue([]);

    await syncRotaWithProgramme({ rota, token: 'tok' });

    expect(fetchProgrammeMeetings).toHaveBeenCalledWith('49097', '924956', 'tok');
    expect(CurrentActiveTermsService.getCurrentActiveTerm).not.toHaveBeenCalled();
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
    const { template, termId } = createOrCompleteFlexiRecord.mock.calls[0][0];
    // hostTermId (rota.termId), not the planning termId, drives the creation
    // orchestrator's structure reads.
    expect(termId).toBe('HT1');
    expect(template.name).toBe('Viking Water Rota Cubs Summer 2026 [49097.924956]');
    expect(template.fields).toEqual(['RotaConfig', 'S_20260616_49097']);
  });

  it('does nothing when the rota already matches', async () => {
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: null },
      { date: '2026-06-09', startTime: null, endTime: null, title: null },
    ]);

    const result = await syncRotaWithProgramme({ rota, token: 'tok' });

    expect(result).toEqual({
      added: 0,
      orphaned: [],
      errors: [],
      titlesUpdated: 0,
      titleWriteFailed: false,
      titlesSkippedNoIdentity: false,
      uncheckedSections: [],
      failedSections: [],
    });
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
    // Patch mode merges onto the LIVE winner re-fetched inside the lock — a
    // record that already has a plan config (guaranteed by syncRotaWithProgramme's
    // own guard above) has a real config cell here, not an empty one.
    const liveConfigCell = JSON.stringify({ v: 1, at: '2026-06-01T09:00:00Z', by: 'Setup', cfg: rota.config.cfg });
    getSingleFlexiRecord.mockResolvedValue({ items: [{ scoutid: 900, f_9: liveConfigCell }] });
    updateFlexiRecord.mockResolvedValue({ ok: true });

    const result = await syncRotaWithProgramme({ rota, token: 'tok', scoutid: 900, by: 'Simon Clark' });

    expect(result.added).toBe(0);
    expect(result.titlesUpdated).toBe(2);
    expect(result.titleWriteFailed).toBe(false);
    // One LWW config write carrying the real meeting titles for both sessions.
    expect(updateFlexiRecord).toHaveBeenCalledTimes(1);
    const written = JSON.parse(updateFlexiRecord.mock.calls[0][4]);
    expect(written.cfg.sessions).toEqual({
      S_20260602_49097: { pt: 'Cubs Kayaking' },
      S_20260609_49097: { pt: 'Cubs Canoe Trip' },
    });
  });

  it('preserves a session\'s existing config state (not-on-water flag) while adding its title', async () => {
    const rotaWithState = {
      ...rota,
      config: { cfg: { ...rota.config.cfg, sessions: { S_20260609_49097: { c: 1 } } } },
    };
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: 'Cubs Kayaking' },
      { date: '2026-06-09', startTime: null, endTime: null, title: 'Cubs Canoe Trip' },
    ]);
    getFlexiStructure.mockResolvedValue({
      config: JSON.stringify([{ id: 'f_9', name: 'RotaConfig' }]),
    });
    const liveConfigCell = JSON.stringify({ v: 1, at: '2026-06-01T09:00:00Z', by: 'Setup', cfg: rotaWithState.config.cfg });
    getSingleFlexiRecord.mockResolvedValue({ items: [{ scoutid: 900, f_9: liveConfigCell }] });
    updateFlexiRecord.mockResolvedValue({ ok: true });

    const result = await syncRotaWithProgramme({ rota: rotaWithState, token: 'tok', scoutid: 900, by: 'Simon Clark' });

    expect(result.titlesUpdated).toBe(2);
    const written = JSON.parse(updateFlexiRecord.mock.calls[0][4]);
    // The not-on-water flag survives the merge and the title is added.
    expect(written.cfg.sessions.S_20260609_49097).toEqual({ c: 1, pt: 'Cubs Canoe Trip' });
    expect(written.cfg.sessions.S_20260602_49097).toEqual({ pt: 'Cubs Kayaking' });
  });

  it('is a no-op when every matching session already carries the right title', async () => {
    const rotaWithTitles = {
      ...rota,
      config: {
        cfg: {
          ...rota.config.cfg,
          sessions: {
            S_20260602_49097: { pt: 'Cubs Kayaking' },
            S_20260609_49097: { pt: 'Cubs Canoe Trip' },
          },
        },
      },
    };
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: 'Cubs Kayaking' },
      { date: '2026-06-09', startTime: null, endTime: null, title: 'Cubs Canoe Trip' },
    ]);

    const result = await syncRotaWithProgramme({ rota: rotaWithTitles, token: 'tok', scoutid: 900, by: 'Simon Clark' });

    expect(result.titlesUpdated).toBe(0);
    expect(result.titleWriteFailed).toBe(false);
    expect(updateFlexiRecord).not.toHaveBeenCalled();
  });

  it('reports titleWriteFailed (not a false success) when the config write throws', async () => {
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: 'Cubs Kayaking' },
      { date: '2026-06-09', startTime: null, endTime: null, title: 'Cubs Canoe Trip' },
    ]);
    getFlexiStructure.mockResolvedValue({
      config: JSON.stringify([{ id: 'f_9', name: 'RotaConfig' }]),
    });
    getSingleFlexiRecord.mockResolvedValue({ items: [{ scoutid: 900, f_9: '' }] });
    updateFlexiRecord.mockRejectedValue(new Error('OSM write rejected'));

    const result = await syncRotaWithProgramme({ rota, token: 'tok', scoutid: 900, by: 'Simon Clark' });

    expect(result.titleWriteFailed).toBe(true);
    expect(result.titlesUpdated).toBe(0);
  });

  it('flags the backfill as skipped (no config write) without an editor identity', async () => {
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: 'Cubs Kayaking' },
      { date: '2026-06-09', startTime: null, endTime: null, title: 'Cubs Canoe Trip' },
    ]);

    const result = await syncRotaWithProgramme({ rota, token: 'tok' });

    expect(result.titlesSkippedNoIdentity).toBe(true);
    expect(result.titlesUpdated).toBe(0);
    expect(updateFlexiRecord).not.toHaveBeenCalled();
  });

  it('patch mode preserves a concurrent edit to the live cfg (regulars) while adding the title patch', async () => {
    fetchProgrammeMeetings.mockResolvedValue([
      { date: '2026-06-02', startTime: null, endTime: null, title: 'Cubs Kayaking' },
      { date: '2026-06-09', startTime: null, endTime: null, title: 'Cubs Canoe Trip' },
    ]);
    getFlexiStructure.mockResolvedValue({
      config: JSON.stringify([{ id: 'f_9', name: 'RotaConfig' }]),
    });
    // A concurrent editor (e.g. changed regulars) already landed a newer
    // RotaConfig candidate on the live grid, after `rota` (used here to
    // compute the title patch) was loaded — the sync write must not clobber it.
    const liveWinnerCell = JSON.stringify({
      v: 3, at: '2026-07-01T09:00:00Z', by: 'Other Leader',
      cfg: { ...rota.config.cfg, regulars: ['77'] },
    });
    getSingleFlexiRecord.mockResolvedValue({ items: [{ scoutid: 900, f_9: liveWinnerCell }] });
    updateFlexiRecord.mockResolvedValue({ ok: true });

    const result = await syncRotaWithProgramme({ rota, token: 'tok', scoutid: 900, by: 'Simon Clark' });

    expect(result.titlesUpdated).toBe(2);
    const written = JSON.parse(updateFlexiRecord.mock.calls[0][4]);
    expect(written.v).toBe(4);
    expect(written.cfg.regulars).toEqual(['77']);
    expect(written.cfg.sessions).toEqual({
      S_20260602_49097: { pt: 'Cubs Kayaking' },
      S_20260609_49097: { pt: 'Cubs Canoe Trip' },
    });
  });

  it('reports a failed programme fetch as a failed section and does not orphan its existing sessions', async () => {
    // A fetch error (e.g. expired token) is a real failure — its existing
    // sessions must NOT be orphaned.
    fetchProgrammeMeetings.mockRejectedValue(new Error('OSM 500'));

    const result = await syncRotaWithProgramme({ rota, token: 'tok' });

    expect(result.orphaned).toEqual([]);
    expect(result.failedSections).toEqual(['49097']);
    expect(result.uncheckedSections).toEqual([]);
    expect(result.added).toBe(0);
    expect(createOrCompleteFlexiRecord).not.toHaveBeenCalled();
  });

  it('throws without a plan config', async () => {
    await expect(syncRotaWithProgramme({ rota: { ...rota, config: null }, token: 'tok' })).rejects.toThrow(/config/);
  });
});

describe('activateWaterSession', () => {
  const rota = {
    hostSection: HOST_SECTION,
    recordId: 777,
    termId: 'HT1',
    sectionId: '49097',
    planningTermId: '924956',
    seasonBucket: 'Summer 2026',
    config: {
      cfg: { sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30' },
    },
  };

  beforeEach(() => {
    databaseService.getSections.mockResolvedValue([HOST_SECTION]);
    databaseService.getFlexiData.mockResolvedValue(null);
    databaseService.saveFlexiData.mockResolvedValue(undefined);
    databaseService.getMembers.mockResolvedValue([]);
    CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue({ currentTermId: 'HT1' });
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

    const { template, termId } = createOrCompleteFlexiRecord.mock.calls[0][0];
    expect(termId).toBe('HT1');
    expect(template.name).toBe('Viking Water Rota Cubs Summer 2026 [49097.924956]');

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

  it('falls back to the cached section name when the rota has no config yet', async () => {
    createOrCompleteFlexiRecord.mockResolvedValue({ success: true, flexirecordid: 777 });

    await activateWaterSession({
      rota: { ...rota, config: null, sectionNames: { '49097': 'Cubs' } },
      date: '2026-07-14',
      sectionId: '49097',
      fields: { act: 'Kayaking', st: '18:15', en: '19:30', k: 24, p: 3 },
      by: 'Simon Clark',
      scoutid: 10,
      token: 'tok',
    });

    const { template } = createOrCompleteFlexiRecord.mock.calls[0][0];
    expect(template.name).toBe('Viking Water Rota Cubs Summer 2026 [49097.924956]');
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
