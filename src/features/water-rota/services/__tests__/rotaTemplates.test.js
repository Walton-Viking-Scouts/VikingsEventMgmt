import { describe, expect, it } from 'vitest';

import { guessActivityFromTitle, looksLikeWaterSession } from '../rotaTemplates.js';

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
