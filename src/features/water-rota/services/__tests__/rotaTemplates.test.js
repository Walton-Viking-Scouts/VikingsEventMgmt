import { describe, expect, it } from 'vitest';

import {
  buildRotaRecordName,
  guessActivityFromTitle,
  looksLikeWaterSession,
  parseRotaRecordName,
  seasonBucketForRange,
} from '../rotaTemplates.js';

describe('guessActivityFromTitle', () => {
  it('matches preset names inside meeting titles', () => {
    expect(guessActivityFromTitle('Kayaking')).toBe('Kayaking');
    expect(guessActivityFromTitle('Cubs Kayaking session')).toBe('Kayaking');
    expect(guessActivityFromTitle('Evening Canoeing')).toBe('Canoeing');
    expect(guessActivityFromTitle('Paddleboarding on the lake')).toBe('Paddleboarding');
    expect(guessActivityFromTitle('Powerboats')).toBe('Powerboats');
  });

  it('handles singular and spelling variants', () => {
    expect(guessActivityFromTitle('Kayak night')).toBe('Kayaking');
    expect(guessActivityFromTitle('Canoe trip')).toBe('Canoeing');
    expect(guessActivityFromTitle('SUP taster')).toBe('Paddleboarding');
    expect(guessActivityFromTitle('Power boat handling')).toBe('Powerboats');
    expect(guessActivityFromTitle('Safety boat cover')).toBe('Powerboats');
  });

  it('is case-insensitive', () => {
    expect(guessActivityFromTitle('KAYAKING')).toBe('Kayaking');
  });

  it('returns null when nothing matches or the title is empty', () => {
    expect(guessActivityFromTitle('Camp planning')).toBeNull();
    expect(guessActivityFromTitle('')).toBeNull();
    expect(guessActivityFromTitle(null)).toBeNull();
    expect(guessActivityFromTitle(undefined)).toBeNull();
  });

  // Regression against real OSM programme titles pulled from the live account.
  it('maps real meeting titles to the right preset', () => {
    expect(guessActivityFromTitle('Powerboating - Tim & Simon')).toBe('Powerboats');
    expect(guessActivityFromTitle('Power boating 5/5/26')).toBe('Powerboats');
    expect(guessActivityFromTitle('Summer 4 - power boats')).toBe('Powerboats');
    expect(guessActivityFromTitle('Summer 5 _ paddle boards')).toBe('Paddleboarding');
    expect(guessActivityFromTitle('Summer 8 - Kayaks')).toBe('Kayaking');
    expect(guessActivityFromTitle('Kayaking/Shooting')).toBe('Kayaking');
    // Generic water sessions carry no specific activity → section default
    expect(guessActivityFromTitle('River session')).toBeNull();
    expect(guessActivityFromTitle('Water Safety / Prep')).toBeNull();
  });
});

describe('looksLikeWaterSession', () => {
  it('detects real water nights from their titles', () => {
    for (const title of [
      'Powerboating - Tim & Simon', 'Water Safety and ???', 'River session',
      'Prep for going on the water', 'Boat and water safety + Ceilidh - YLs',
      'River Preparation', 'Kayaking', 'Summer 5 _ paddle boards', 'Summer 8 - Kayaks',
    ]) {
      expect(looksLikeWaterSession(title), title).toBe(true);
    }
  });

  it('rejects non-water programme meetings', () => {
    for (const title of [
      'Mini Olympics', 'Litter pick & chip run', 'Model plane building',
      'Personal Challenge Badge', 'St. Georges Day celebrations', 'Nature Walk',
      'Summer 6', 'Teeth', 'Welcome Back',
    ]) {
      expect(looksLikeWaterSession(title), title).toBe(false);
    }
  });

  it('does not false-match on loose substrings (season/throw/grow)', () => {
    for (const title of ['Season opener', 'Throw and catch', 'Growing plants', 'Brownies visit']) {
      expect(looksLikeWaterSession(title), title).toBe(false);
    }
  });

  it('handles empty/missing titles', () => {
    expect(looksLikeWaterSession('')).toBe(false);
    expect(looksLikeWaterSession(null)).toBe(false);
    expect(looksLikeWaterSession(undefined)).toBe(false);
  });
});

describe('buildRotaRecordName / parseRotaRecordName', () => {
  it('round-trips a record identity', () => {
    const identity = { sectionName: 'Scouts', seasonBucket: 'Summer 2026', sectionId: '49097', termId: '924956' };
    const name = buildRotaRecordName(identity);
    expect(name).toBe('Viking Water Rota Scouts Summer 2026 [49097.924956]');
    expect(parseRotaRecordName(name)).toEqual(identity);
  });

  it('round-trips section names with spaces and digits', () => {
    const identity = { sectionName: '1st Walton Scouts', seasonBucket: 'Autumn 2026', sectionId: '49099', termId: '900001' };
    expect(parseRotaRecordName(buildRotaRecordName(identity))).toEqual(identity);
  });

  it('extracts both ids and the season bucket from the two-part bracket', () => {
    const parsed = parseRotaRecordName('Viking Water Rota Adults Spring 2027 [11107.901823]');
    expect(parsed).toEqual({ sectionName: 'Adults', seasonBucket: 'Spring 2027', sectionId: '11107', termId: '901823' });
  });

  it('returns null for the retired year-model name', () => {
    expect(parseRotaRecordName('Viking Water Rota 2026')).toBeNull();
  });

  it('returns null for the retired three-part-bracket shape', () => {
    expect(parseRotaRecordName('Viking Water Rota Scouts Summer 2026 [49097.924956.1]')).toBeNull();
  });

  it('returns null for junk input', () => {
    expect(parseRotaRecordName('Viking Event Mgmt')).toBeNull();
    expect(parseRotaRecordName('')).toBeNull();
    expect(parseRotaRecordName(null)).toBeNull();
    expect(parseRotaRecordName(undefined)).toBeNull();
  });
});

describe('seasonBucketForRange', () => {
  it('buckets all eight live Summer-2026 term variants to "Summer 2026"', () => {
    const ranges = [
      ['2026-04-01', '2026-07-17'],
      ['2026-04-01', '2026-07-24'],
      ['2026-04-02', '2026-07-24'],
      ['2026-04-06', '2026-08-31'],
      ['2026-04-07', '2026-08-31'],
      ['2026-04-08', '2026-08-31'],
      ['2026-04-12', '2026-08-31'],
      ['2026-04-01', '2026-08-31'],
    ];
    for (const [start, end] of ranges) {
      expect(seasonBucketForRange(start, end), `${start}..${end}`).toBe('Summer 2026');
    }
  });

  it('buckets a Jan-Mar term to Spring', () => {
    expect(seasonBucketForRange('2026-01-06', '2026-03-27')).toBe('Spring 2026');
  });

  it('buckets a Sep-Dec term to Autumn', () => {
    expect(seasonBucketForRange('2026-09-01', '2026-12-18')).toBe('Autumn 2026');
  });

  it('buckets a Dec-Feb straddling term to Spring of the later year', () => {
    expect(seasonBucketForRange('2025-12-01', '2026-02-15')).toBe('Spring 2026');
  });

  it('is UTC-deterministic regardless of the runner\'s local timezone', () => {
    // Midnight-ISO boundaries would flip a day in a non-UTC-aware implementation.
    expect(seasonBucketForRange('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe('Spring 2026');
  });
});
