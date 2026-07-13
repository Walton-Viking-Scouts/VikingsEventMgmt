import { describe, it, expect } from 'vitest';

import { buildSessionOverrides, mergeSectionConfig } from '../rotaSetupPlan.js';

describe('buildSessionOverrides', () => {
  const sectionDefaults = [{ sid: '49097', act: 'Kayaking', st: '18:15', en: '19:30' }];

  it('stores the programme title on an on-water session, above section defaults', () => {
    const overrides = buildSessionOverrides(
      [{
        date: '2026-07-14',
        sectionId: '49097',
        onWater: true,
        title: 'Bell boats',
        // matches the section defaults, so only the title is an override
        activity: 'Kayaking',
        startTime: '18:15',
        endTime: '19:30',
      }],
      sectionDefaults,
    );
    expect(overrides.S_20260714_49097).toEqual({ pt: 'Bell boats' });
  });

  it('keeps act/time overrides alongside the title when they differ from the defaults', () => {
    const overrides = buildSessionOverrides(
      [{
        date: '2026-07-14',
        sectionId: '49097',
        onWater: true,
        title: 'Powerboat night',
        activity: 'Powerboats',
        startTime: '18:00',
        endTime: '19:00',
      }],
      sectionDefaults,
    );
    expect(overrides.S_20260714_49097).toEqual({
      pt: 'Powerboat night',
      act: 'Powerboats',
      st: '18:00',
      en: '19:00',
    });
  });

  it('stores the title on a not-on-water week alongside the c:1 flag', () => {
    const overrides = buildSessionOverrides(
      [{ date: '2026-07-14', sectionId: '49097', onWater: false, title: 'Craft Night' }],
      sectionDefaults,
    );
    expect(overrides.S_20260714_49097).toEqual({ c: 1, pt: 'Craft Night' });
  });

  it('omits pt when the meeting has no title', () => {
    const overrides = buildSessionOverrides(
      [{ date: '2026-07-14', sectionId: '49097', onWater: false, title: null }],
      sectionDefaults,
    );
    expect(overrides.S_20260714_49097).toEqual({ c: 1 });
  });
});

describe('mergeSectionConfig', () => {
  const base = {
    start: '2026-06-01',
    end: '2026-07-31',
    sections: [
      { sid: '10', sname: 'Beavers', act: 'Kayaking' },
      { sid: '20', sname: 'Cubs', act: 'Canoeing' },
    ],
    sessions: {
      S_20260603_10: { pt: 'Beavers night' },
      S_20260605_20: { pt: 'Cubs night', c: 1 },
    },
  };

  it('rewrites only the touched section and preserves the others', () => {
    // Beavers leader re-runs setup; Cubs must be untouched.
    const patch = {
      start: '2026-06-08',
      end: '2026-07-31',
      sections: [{ sid: '10', sname: 'Beavers', act: 'Canoeing' }],
      sessions: { S_20260610_10: { pt: 'Beavers new' } },
    };
    const merged = mergeSectionConfig(base, patch);

    // Cubs section + its session survive intact
    expect(merged.sections).toContainEqual({ sid: '20', sname: 'Cubs', act: 'Canoeing' });
    expect(merged.sessions.S_20260605_20).toEqual({ pt: 'Cubs night', c: 1 });
    // Beavers is replaced: new defaults, old session dropped, new session added
    expect(merged.sections.find((s) => s.sid === '10')).toEqual({ sid: '10', sname: 'Beavers', act: 'Canoeing' });
    expect(merged.sessions.S_20260603_10).toBeUndefined();
    expect(merged.sessions.S_20260610_10).toEqual({ pt: 'Beavers new' });
  });

  it('unions the date range so a section extends it, never truncates', () => {
    const merged = mergeSectionConfig(base, {
      start: '2026-05-15', end: '2026-08-31', sections: [{ sid: '10' }], sessions: {},
    });
    expect(merged.start).toBe('2026-05-15');
    expect(merged.end).toBe('2026-08-31');
  });

  it('keeps the base range when the patch range sits inside it', () => {
    const merged = mergeSectionConfig(base, {
      start: '2026-06-10', end: '2026-07-10', sections: [{ sid: '10' }], sessions: {},
    });
    expect(merged.start).toBe('2026-06-01');
    expect(merged.end).toBe('2026-07-31');
  });

  it('acts as a plain write when the base config is empty (first setup)', () => {
    const patch = {
      start: '2026-06-01', end: '2026-07-31',
      sections: [{ sid: '10', sname: 'Beavers' }],
      sessions: { S_20260603_10: { pt: 'x' } },
    };
    const merged = mergeSectionConfig({}, patch);
    expect(merged.sections).toEqual([{ sid: '10', sname: 'Beavers' }]);
    expect(merged.sessions).toEqual({ S_20260603_10: { pt: 'x' } });
    expect(merged.start).toBe('2026-06-01');
    expect(merged.end).toBe('2026-07-31');
  });
});
