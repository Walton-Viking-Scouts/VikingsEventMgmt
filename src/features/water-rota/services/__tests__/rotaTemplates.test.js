import { describe, expect, it } from 'vitest';

import { guessActivityFromTitle } from '../rotaTemplates.js';

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
});
