import { describe, it, expect } from 'vitest';
import { groupNoConsentMembersBySection } from '../photoConsentGallery.js';

const member = (overrides = {}) => ({
  scoutid: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  sectionid: 100,
  sectionname: 'Beavers',
  person_type: 'Young People',
  'consents__photographs': 'No',
  ...overrides,
});

describe('groupNoConsentMembersBySection', () => {
  it('excludes members with explicit Yes photo consent', () => {
    const members = [member({ 'consents__photographs': 'Yes' })];
    expect(groupNoConsentMembersBySection(members)).toEqual([]);
  });

  it('includes members with No, blank, or missing photo consent', () => {
    const members = [
      member({ scoutid: 1, 'consents__photographs': 'No' }),
      member({ scoutid: 2, 'consents__photographs': '' }),
      member({ scoutid: 3, consents__photographs: undefined }),
    ];
    const result = groupNoConsentMembersBySection(members);
    expect(result).toHaveLength(1);
    expect(result[0].members).toHaveLength(3);
  });

  it('groups matching members by section', () => {
    const members = [
      member({ scoutid: 1, sectionid: 100, sectionname: 'Beavers' }),
      member({ scoutid: 2, sectionid: 200, sectionname: 'Cubs' }),
    ];
    const result = groupNoConsentMembersBySection(members);
    expect(result.map((s) => s.sectionname)).toEqual(['Beavers', 'Cubs']);
    expect(result[0].members).toHaveLength(1);
    expect(result[1].members).toHaveLength(1);
  });

  it('omits sections with no matching members', () => {
    const members = [
      member({ scoutid: 1, sectionid: 100, sectionname: 'Beavers', 'consents__photographs': 'Yes' }),
      member({ scoutid: 2, sectionid: 200, sectionname: 'Cubs', 'consents__photographs': 'No' }),
    ];
    const result = groupNoConsentMembersBySection(members);
    expect(result.map((s) => s.sectionname)).toEqual(['Cubs']);
  });

  it('excludes adults (person_type Leaders) when hideAdults is true', () => {
    const members = [
      member({ scoutid: 1, person_type: 'Young People' }),
      member({ scoutid: 2, person_type: 'Leaders' }),
    ];
    const result = groupNoConsentMembersBySection(members, { hideAdults: true });
    expect(result[0].members).toHaveLength(1);
    expect(result[0].members[0].scoutid).toBe(1);
  });

  it('includes adults when hideAdults is false (default)', () => {
    const members = [
      member({ scoutid: 1, person_type: 'Young People' }),
      member({ scoutid: 2, person_type: 'Leaders' }),
    ];
    const result = groupNoConsentMembersBySection(members);
    expect(result[0].members).toHaveLength(2);
  });

  it('sorts members within a section alphabetically by name', () => {
    const members = [
      member({ scoutid: 1, firstname: 'Zack', lastname: 'Zebra' }),
      member({ scoutid: 2, firstname: 'Amy', lastname: 'Ant' }),
    ];
    const result = groupNoConsentMembersBySection(members);
    expect(result[0].members.map((m) => m.firstname)).toEqual(['Amy', 'Zack']);
  });

  it('returns an empty array for no members', () => {
    expect(groupNoConsentMembersBySection([])).toEqual([]);
    expect(groupNoConsentMembersBySection(undefined)).toEqual([]);
  });
});
