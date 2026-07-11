import { describe, expect, it } from 'vitest';

import {
  ROTA_CONFIG_COLUMN,
  SIGNUP_STATUS,
  buildSessionColumnName,
  encodeConfig,
  encodeSessionMeta,
  encodeSignup,
  mergeLwwConfig,
  mergeSessionColumn,
  parseSessionCell,
  parseSessionColumnName,
} from '../rotaEncoding.js';

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

describe('session column names', () => {
  it('round-trips date and section id', () => {
    const name = buildSessionColumnName('2026-07-14', '49097');
    expect(name).toBe('S_20260714_49097');
    expect(parseSessionColumnName(name)).toEqual({ date: '2026-07-14', sectionId: '49097' });
  });

  it('rejects non-session columns', () => {
    expect(parseSessionColumnName(ROTA_CONFIG_COLUMN)).toBeNull();
    expect(parseSessionColumnName('S_2026714_49097')).toBeNull();
    expect(parseSessionColumnName('DOB')).toBeNull();
    expect(parseSessionColumnName(undefined)).toBeNull();
  });
});

describe('parseSessionCell', () => {
  it('treats empty, corrupt, and non-object values as empty cells', () => {
    expect(parseSessionCell('')).toBeNull();
    expect(parseSessionCell(null)).toBeNull();
    expect(parseSessionCell('not json')).toBeNull();
    expect(parseSessionCell('[1,2]')).toBeNull();
    expect(parseSessionCell('"just a string"')).toBeNull();
  });

  it('rejects cells with invalid signup status', () => {
    expect(parseSessionCell(JSON.stringify({ s: 'X' }))).toBeNull();
  });

  it('keeps unknown fields for forward compatibility', () => {
    const raw = JSON.stringify({ s: 'I', sat: '2026-07-01T10:00:00Z', future: 'field' });
    expect(parseSessionCell(raw)).toMatchObject({ s: 'I', future: 'field' });
  });
});

describe('mergeLwwConfig', () => {
  it('returns null when no rows have valid config', () => {
    expect(mergeLwwConfig([])).toBeNull();
    expect(mergeLwwConfig([null, '', 'garbage'])).toBeNull();
  });

  it('picks the highest version regardless of row order', () => {
    const v1 = JSON.stringify(CONFIG);
    const v2 = JSON.stringify({ ...CONFIG, v: 2, at: '2026-05-01T00:00:00Z', by: 'Other Leader' });
    expect(mergeLwwConfig([v2, v1]).v).toBe(2);
    expect(mergeLwwConfig([v1, v2]).v).toBe(2);
  });

  it('breaks version ties by timestamp', () => {
    const older = JSON.stringify({ ...CONFIG, at: '2026-06-01T09:00:00Z', by: 'Older' });
    const newer = JSON.stringify({ ...CONFIG, at: '2026-06-01T09:00:01Z', by: 'Newer' });
    expect(mergeLwwConfig([older, newer]).by).toBe('Newer');
    expect(mergeLwwConfig([newer, older]).by).toBe('Newer');
  });

  it('ignores corrupt rows while merging valid ones', () => {
    expect(mergeLwwConfig(['{bad', JSON.stringify(CONFIG)]).v).toBe(1);
  });
});

describe('mergeSessionColumn', () => {
  it('collects signups and the winning metadata across rows', () => {
    const rows = [
      {
        scoutid: 1,
        name: 'Alice',
        value: JSON.stringify({ s: 'I', sat: '2026-07-02T10:00:00Z', m: META }),
      },
      {
        scoutid: 2,
        name: 'Bob',
        value: JSON.stringify({
          s: 'B',
          sat: '2026-07-01T10:00:00Z',
          m: { ...META, v: 2, at: '2026-07-03T10:00:00Z', act: 'Rafting' },
        }),
      },
      { scoutid: 3, name: 'Cara', value: '' },
    ];

    const { meta, signups } = mergeSessionColumn(rows);
    expect(meta.v).toBe(2);
    expect(meta.act).toBe('Rafting');
    expect(signups).toEqual([
      { scoutid: '2', name: 'Bob', status: 'B', at: '2026-07-01T10:00:00Z' },
      { scoutid: '1', name: 'Alice', status: 'I', at: '2026-07-02T10:00:00Z' },
    ]);
  });

  it('returns null meta and no signups for an untouched column', () => {
    expect(mergeSessionColumn([{ scoutid: 1, name: 'Alice', value: null }])).toEqual({
      meta: null,
      signups: [],
    });
  });
});

describe('encodeSignup', () => {
  it('writes signup into an empty cell', () => {
    const raw = encodeSignup('', SIGNUP_STATUS.IN, '2026-07-02T10:00:00Z');
    expect(JSON.parse(raw)).toEqual({ s: 'I', sat: '2026-07-02T10:00:00Z' });
  });

  it('preserves an existing metadata candidate when signing up', () => {
    const existing = JSON.stringify({ m: META });
    const raw = encodeSignup(existing, SIGNUP_STATUS.BACKUP, '2026-07-02T10:00:00Z');
    expect(JSON.parse(raw)).toEqual({ s: 'B', sat: '2026-07-02T10:00:00Z', m: META });
  });

  it('withdrawing clears signup but keeps metadata', () => {
    const existing = JSON.stringify({ s: 'I', sat: '2026-07-02T10:00:00Z', m: META });
    const raw = encodeSignup(existing, null, '2026-07-03T10:00:00Z');
    expect(JSON.parse(raw)).toEqual({ m: META });
  });

  it('withdrawing from a signup-only cell empties it', () => {
    const existing = JSON.stringify({ s: 'I', sat: '2026-07-02T10:00:00Z' });
    expect(encodeSignup(existing, null, '2026-07-03T10:00:00Z')).toBe('');
  });

  it('overwrites a corrupt cell rather than propagating it', () => {
    const raw = encodeSignup('{corrupt', SIGNUP_STATUS.IN, '2026-07-02T10:00:00Z');
    expect(JSON.parse(raw)).toEqual({ s: 'I', sat: '2026-07-02T10:00:00Z' });
  });
});

describe('encodeSessionMeta', () => {
  it('preserves the editor\'s own signup when writing metadata', () => {
    const existing = JSON.stringify({ s: 'I', sat: '2026-07-02T10:00:00Z' });
    const raw = encodeSessionMeta(existing, { ...META, v: 2 });
    const cell = JSON.parse(raw);
    expect(cell.s).toBe('I');
    expect(cell.m.v).toBe(2);
  });

  it('rejects invalid metadata instead of storing it', () => {
    expect(() => encodeSessionMeta('', { ...META, st: '6pm' })).toThrow();
    expect(() => encodeSessionMeta('', { ...META, k: -1 })).toThrow();
  });
});

describe('encodeConfig', () => {
  it('round-trips through mergeLwwConfig', () => {
    const raw = encodeConfig(CONFIG);
    expect(mergeLwwConfig([raw])).toEqual(CONFIG);
  });

  it('rejects config without sections', () => {
    expect(() => encodeConfig({ ...CONFIG, cfg: { start: '2026-06-01', end: '2026-08-31' } })).toThrow();
  });

  it('accepts optional per-section kids/permits defaults', () => {
    const cfg = {
      ...CONFIG,
      cfg: {
        ...CONFIG.cfg,
        sections: [{ ...CONFIG.cfg.sections[0], k: 22, p: 2 }],
      },
    };
    expect(mergeLwwConfig([encodeConfig(cfg)]).cfg.sections[0]).toMatchObject({ k: 22, p: 2 });
  });
});
