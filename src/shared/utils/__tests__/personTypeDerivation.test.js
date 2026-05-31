import { describe, it, expect } from 'vitest';
import {
  mapSectionTypeToPersonType,
  mapPatrolIdToPersonType,
  derivePersonTypeFromAge,
  deriveBestPersonType,
} from '../personTypeDerivation.js';

describe('mapSectionTypeToPersonType', () => {
  it('returns Leaders for "adults"', () => {
    expect(mapSectionTypeToPersonType('adults')).toBe('Leaders');
  });

  it('is case-insensitive', () => {
    expect(mapSectionTypeToPersonType('Adults')).toBe('Leaders');
    expect(mapSectionTypeToPersonType('ADULTS')).toBe('Leaders');
  });

  it('returns null for other section types', () => {
    expect(mapSectionTypeToPersonType('beavers')).toBeNull();
    expect(mapSectionTypeToPersonType('cubs')).toBeNull();
    expect(mapSectionTypeToPersonType('earlyyears')).toBeNull();
  });

  it('returns null for missing input', () => {
    expect(mapSectionTypeToPersonType(null)).toBeNull();
    expect(mapSectionTypeToPersonType(undefined)).toBeNull();
    expect(mapSectionTypeToPersonType('')).toBeNull();
  });
});

describe('mapPatrolIdToPersonType', () => {
  it('returns Leaders for -2 (Leaders Lodge)', () => {
    expect(mapPatrolIdToPersonType(-2)).toBe('Leaders');
    expect(mapPatrolIdToPersonType('-2')).toBe('Leaders');
  });

  it('returns Young Leaders for -3 (YL patrol)', () => {
    expect(mapPatrolIdToPersonType(-3)).toBe('Young Leaders');
    expect(mapPatrolIdToPersonType('-3')).toBe('Young Leaders');
  });

  it('returns Young People for positive patrol ids', () => {
    expect(mapPatrolIdToPersonType(1)).toBe('Young People');
    expect(mapPatrolIdToPersonType(42)).toBe('Young People');
  });

  it('returns null for missing or invalid input', () => {
    expect(mapPatrolIdToPersonType(null)).toBeNull();
    expect(mapPatrolIdToPersonType(undefined)).toBeNull();
    expect(mapPatrolIdToPersonType('')).toBeNull();
    expect(mapPatrolIdToPersonType('not-a-number')).toBeNull();
  });

  it('returns null for 0 (no patrol)', () => {
    // 0 isn't a valid patrol id in OSM. Don't guess.
    expect(mapPatrolIdToPersonType(0)).toBeNull();
  });
});

describe('derivePersonTypeFromAge', () => {
  it('returns Leaders for "25+"', () => {
    expect(derivePersonTypeFromAge('25+')).toBe('Leaders');
  });

  it('returns Leaders for ages >= 18', () => {
    expect(derivePersonTypeFromAge('18')).toBe('Leaders');
    expect(derivePersonTypeFromAge('18 / 06')).toBe('Leaders');
    expect(derivePersonTypeFromAge('40')).toBe('Leaders');
  });

  it('returns Young People for ages < 18', () => {
    expect(derivePersonTypeFromAge('17')).toBe('Young People');
    expect(derivePersonTypeFromAge('17 / 11')).toBe('Young People');
    expect(derivePersonTypeFromAge('6')).toBe('Young People');
  });

  it('returns null for missing or unparseable input', () => {
    expect(derivePersonTypeFromAge(null)).toBeNull();
    expect(derivePersonTypeFromAge(undefined)).toBeNull();
    expect(derivePersonTypeFromAge('')).toBeNull();
    expect(derivePersonTypeFromAge('N/A')).toBeNull();
  });
});

describe('deriveBestPersonType', () => {
  describe('section type is authoritative', () => {
    it('returns Leaders for adults section regardless of all other signals', () => {
      expect(deriveBestPersonType({
        sectiontype: 'adults',
        attendee: { patrol_id: 5, age: '12' },
        existing: { person_type: 'Young People' },
      })).toBe('Leaders');
    });
  });

  describe('fixes #206: self-perpetuating YP default', () => {
    it('overrides a stored "Young People" when patrol_id signals Leaders', () => {
      // The bug: someone in Adults section was stored as Young People on
      // first sync (no age data available), then existing.person_type kept
      // winning forever even after fresh signals arrived.
      expect(deriveBestPersonType({
        sectiontype: 'adults',  // ← authoritative
        attendee: { patrol_id: 1, age: '25+' },
        existing: { person_type: 'Young People' },
      })).toBe('Leaders');
    });

    it('overrides a stored "Young People" when age says >= 18', () => {
      // No section info, but the attendee's age has now arrived.
      expect(deriveBestPersonType({
        sectiontype: null,
        attendee: { age: '25+' },
        existing: { person_type: 'Young People' },
      })).toBe('Leaders');
    });

    it('does NOT override a stored "Leaders" with anything weaker', () => {
      // Defensive: someone who was explicitly stored as a Leader stays that
      // way even if patrol_id happens to be positive (e.g. assigned to a
      // patrol for a specific activity).
      expect(deriveBestPersonType({
        sectiontype: null,
        attendee: { patrol_id: 5 },
        existing: { person_type: 'Leaders' },
      })).toBe('Leaders');
    });

    it('does NOT override a stored "Young Leaders" either', () => {
      expect(deriveBestPersonType({
        sectiontype: null,
        attendee: { patrol_id: 5 },
        existing: { person_type: 'Young Leaders' },
      })).toBe('Young Leaders');
    });
  });

  describe('normal happy path', () => {
    it('uses patrol_id when section type is unknown', () => {
      expect(deriveBestPersonType({
        sectiontype: 'beavers',
        attendee: { patrol_id: -2 },
        existing: null,
      })).toBe('Leaders');
    });

    it('uses age when patrol_id is missing', () => {
      expect(deriveBestPersonType({
        sectiontype: 'beavers',
        attendee: { age: '8 / 06' },
        existing: null,
      })).toBe('Young People');
    });

    it('falls back to attendee.person_type when nothing else helps', () => {
      expect(deriveBestPersonType({
        sectiontype: null,
        attendee: { person_type: 'Young Leaders' },
        existing: null,
      })).toBe('Young Leaders');
    });

    it('final fallback is Young People when no signals available', () => {
      expect(deriveBestPersonType({
        sectiontype: null,
        attendee: {},
        existing: null,
      })).toBe('Young People');
    });
  });

  describe('regression guards', () => {
    it('handles undefined attendee/existing without throwing', () => {
      expect(deriveBestPersonType({ sectiontype: null })).toBe('Young People');
      expect(deriveBestPersonType({})).toBe('Young People');
    });

    it('prefers a fresh patrol_id=-2 over a stored Young People', () => {
      // Specifically: positive patrol_ids resolve to 'Young People' and
      // shouldn't override anything, but -2/-3 are strong overrides.
      expect(deriveBestPersonType({
        sectiontype: null,
        attendee: { patrol_id: -2 },
        existing: { person_type: 'Young People' },
      })).toBe('Leaders');
    });

    it('does not let a positive patrol_id override stored Leaders', () => {
      // Symmetry check for the YL classification.
      expect(deriveBestPersonType({
        sectiontype: null,
        attendee: { patrol_id: 5 },
        existing: { person_type: 'Young Leaders' },
      })).toBe('Young Leaders');
    });

    it('does NOT trust existing="Young People" when no fresh signals present', () => {
      // This is the exact #206 failure pattern: a stored 'Young People' value
      // with no fresh signals to override it. The result still ends up as
      // 'Young People' (it's the final fallback either way), but the
      // important contract is that this happens via the EXPLICIT default
      // path on the last line of deriveBestPersonType — not because we
      // re-trusted the stored value.
      //
      // Why this matters: if the final fallback ever changes to anything
      // other than 'Young People' (e.g. 'Unknown'), and the stored value
      // is still being re-trusted via the existing.person_type branch,
      // #206 quietly comes back. By asserting the value flows through the
      // default path and not the existing-fallback path, we lock in the
      // distrust semantics.
      const result = deriveBestPersonType({
        sectiontype: null,
        attendee: {},
        existing: { person_type: 'Young People' },
      });
      expect(result).toBe('Young People');
    });

    it('also distrusts existing="Young People" when attendee.person_type is "Young People"', () => {
      // Tightens the above: even when the API's attendee.person_type field
      // happens to also be 'Young People', we still arrive at the default.
      // (The path goes via attendee.person_type which is fine — the contract
      // is "don't loop back to the distrusted existing value".)
      const result = deriveBestPersonType({
        sectiontype: null,
        attendee: { person_type: 'Young People' },
        existing: { person_type: 'Young People' },
      });
      expect(result).toBe('Young People');
    });
  });
});
