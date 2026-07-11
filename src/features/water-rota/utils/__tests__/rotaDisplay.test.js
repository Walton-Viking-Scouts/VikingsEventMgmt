import { describe, expect, it } from 'vitest';

import {
  COVER_STATUS,
  coverStatus,
  coverStatusBgClass,
  resolveAllSessions,
  resolveSessionView,
  sectionChipClass,
} from '../rotaDisplay.js';

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

const CONFIG = {
  v: 1,
  at: '2026-06-01T09:00:00Z',
  by: 'Simon Clark',
  cfg: {
    start: '2026-06-01',
    end: '2026-08-31',
    sections: [{ sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30' }],
  },
};

function signup(scoutid, status) {
  return { scoutid: String(scoutid), name: `Person ${scoutid}`, status, at: null };
}

describe('coverStatus', () => {
  it('covers the four cover states', () => {
    expect(coverStatus({ confirmedCount: 3, backupCount: 0, needed: 3, cancelled: false })).toBe(COVER_STATUS.COVERED);
    expect(coverStatus({ confirmedCount: 2, backupCount: 1, needed: 3, cancelled: false })).toBe(COVER_STATUS.AT_RISK);
    expect(coverStatus({ confirmedCount: 1, backupCount: 1, needed: 3, cancelled: false })).toBe(COVER_STATUS.SHORT);
    expect(coverStatus({ confirmedCount: 0, backupCount: 0, needed: 3, cancelled: true })).toBe(COVER_STATUS.OFF);
  });

  it('treats a missing target as unset (not short)', () => {
    expect(coverStatus({ confirmedCount: 0, backupCount: 0, needed: null, cancelled: false })).toBe(COVER_STATUS.UNSET);
  });

  it('cancelled wins over everything', () => {
    expect(coverStatus({ confirmedCount: 5, backupCount: 0, needed: 3, cancelled: true })).toBe(COVER_STATUS.OFF);
  });

  it('over-cover and zero-target sessions are covered', () => {
    expect(coverStatus({ confirmedCount: 5, backupCount: 0, needed: 3, cancelled: false })).toBe(COVER_STATUS.COVERED);
    expect(coverStatus({ confirmedCount: 0, backupCount: 0, needed: 0, cancelled: false })).toBe(COVER_STATUS.COVERED);
  });
});

describe('resolveSessionView', () => {
  const baseSession = {
    fieldId: 'f_2',
    date: '2026-07-14',
    sectionId: '49097',
    meta: META,
    signups: [signup(1, 'I'), signup(2, 'B'), signup(3, 'I')],
  };

  it('resolves metadata, splits signups, and computes status', () => {
    const view = resolveSessionView(baseSession, CONFIG);
    expect(view.sectionName).toBe('Cubs');
    expect(view.activity).toBe('Kayaking');
    expect(view.kids).toBe(24);
    expect(view.needed).toBe(3);
    expect(view.confirmed).toHaveLength(2);
    expect(view.backups).toHaveLength(1);
    expect(view.status).toBe(COVER_STATUS.AT_RISK);
    expect(view.hasMeta).toBe(true);
  });

  it('defaults kids and needed from config section defaults, giving fresh sessions a live status', () => {
    const configWithDefaults = {
      ...CONFIG,
      cfg: {
        ...CONFIG.cfg,
        sections: [{ ...CONFIG.cfg.sections[0], k: 22, p: 2 }],
      },
    };
    const view = resolveSessionView({ ...baseSession, meta: null, signups: [] }, configWithDefaults);
    expect(view.kids).toBe(22);
    expect(view.needed).toBe(2);
    expect(view.status).toBe(COVER_STATUS.SHORT);
  });

  it('self-heals from config defaults when metadata is gone', () => {
    const view = resolveSessionView({ ...baseSession, meta: null, signups: [] }, CONFIG);
    expect(view.activity).toBe('Kayaking');
    expect(view.startTime).toBe('18:15');
    expect(view.needed).toBeNull();
    expect(view.status).toBe(COVER_STATUS.UNSET);
    expect(view.hasMeta).toBe(false);
  });

  it('survives a missing config entirely', () => {
    const view = resolveSessionView({ ...baseSession, meta: null, signups: [] }, null);
    expect(view.sectionName).toBe('Section 49097');
    expect(view.activity).toBe('');
    expect(view.status).toBe(COVER_STATUS.UNSET);
  });

  it('reproduces the missing-config bug: id name + needs-setup even with signups', () => {
    // Rota whose RotaConfig cell was never written (setup did not finish): the
    // session column and its signups exist, but there is no config and no meta.
    const view = resolveSessionView(
      { ...baseSession, meta: null, signups: [signup(1, 'I'), signup(2, 'I')] },
      null,
    );
    expect(view.sectionName).toBe('Section 49097');
    expect(view.hasMeta).toBe(false);
    expect(view.needed).toBeNull();
    expect(view.status).toBe(COVER_STATUS.UNSET);
    // signups themselves survive — the bug is display, not data loss
    expect(view.confirmed).toHaveLength(2);
  });

  it('falls back to cached section names when config is missing', () => {
    const view = resolveSessionView(
      { ...baseSession, meta: null, signups: [] },
      null,
      { '49097': 'Tuesday Cubs' },
    );
    expect(view.sectionName).toBe('Tuesday Cubs');
  });

  it('flags not-on-water sessions', () => {
    const view = resolveSessionView({ ...baseSession, meta: { ...META, c: 1 } }, CONFIG);
    expect(view.cancelled).toBe(true);
    expect(view.status).toBe(COVER_STATUS.OFF);
  });
});

describe('resolveAllSessions', () => {
  it('sorts by date then section name', () => {
    const rota = {
      config: CONFIG,
      sessions: [
        { fieldId: 'f_3', date: '2026-07-21', sectionId: '49097', meta: null, signups: [] },
        { fieldId: 'f_2', date: '2026-07-14', sectionId: '49097', meta: null, signups: [] },
      ],
    };
    expect(resolveAllSessions(rota).map((s) => s.fieldId)).toEqual(['f_2', 'f_3']);
  });
});

describe('style helpers', () => {
  it('maps section names and statuses to classes', () => {
    expect(sectionChipClass('Monday Cubs')).toContain('forest-green');
    expect(sectionChipClass('Scouts')).toContain('navy');
    expect(sectionChipClass('Unknown')).toContain('purple');
    expect(coverStatusBgClass(COVER_STATUS.COVERED)).toBe('bg-scout-green');
    expect(coverStatusBgClass(COVER_STATUS.AT_RISK)).toBe('bg-scout-orange');
    expect(coverStatusBgClass(COVER_STATUS.SHORT)).toBe('bg-scout-red');
    expect(coverStatusBgClass(COVER_STATUS.OFF)).toBe('bg-gray-300');
  });
});
