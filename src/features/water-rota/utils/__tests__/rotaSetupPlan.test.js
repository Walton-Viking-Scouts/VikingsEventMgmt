import { describe, it, expect } from 'vitest';

import { buildSessionOverrides } from '../rotaSetupPlan.js';

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
