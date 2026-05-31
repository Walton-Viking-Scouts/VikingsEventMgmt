import { describe, it, expect } from 'vitest';
import { buildAttendanceTabSections, isYoungPerson, getNumericAge } from '../attendanceTabBuilder.js';

const record = (overrides = {}) => ({
  scoutid: '1', sectionid: 100, attending: 'Yes', ...overrides,
});

const memberDataFor = (entries) =>
  new Map(entries.map(([id, data]) => [String(id), data]));

describe('isYoungPerson', () => {
  it('treats missing age as YP (defensive — better to over-count YP than miss safeguarding)', () => {
    expect(isYoungPerson(null)).toBe(true);
    expect(isYoungPerson(undefined)).toBe(true);
    expect(isYoungPerson('')).toBe(true);
  });

  it('treats "25+" as adult', () => {
    expect(isYoungPerson('25+')).toBe(false);
  });

  it('parses "yrs / months" format from OSM', () => {
    expect(isYoungPerson('10 / 03')).toBe(true);
    expect(isYoungPerson('17 / 11')).toBe(true);
    expect(isYoungPerson('18 / 00')).toBe(false);
    expect(isYoungPerson('30 / 06')).toBe(false);
  });

  it('parses plain year strings', () => {
    expect(isYoungPerson('17')).toBe(true);
    expect(isYoungPerson('18')).toBe(false);
    expect(isYoungPerson('45')).toBe(false);
  });

  it('falls back to YP for unrecognised formats', () => {
    expect(isYoungPerson('N/A')).toBe(true);
  });
});

describe('getNumericAge', () => {
  it('returns months for sort comparison', () => {
    expect(getNumericAge('10 / 06')).toBe(126);
    expect(getNumericAge('17')).toBe(204);
  });

  it('returns 999 for 25+ so they sort to the end', () => {
    expect(getNumericAge('25+')).toBe(999);
  });

  it('returns 0 for missing age', () => {
    expect(getNumericAge(null)).toBe(0);
    expect(getNumericAge('N/A')).toBe(0);
  });
});

describe('buildAttendanceTabSections', () => {
  it('returns empty totals when no records match', () => {
    const result = buildAttendanceTabSections([], [], new Map());
    expect(result).toMatchObject({
      sections: [],
      totalYoungPeople: 0,
      totalAdults: 0,
      totalMembers: 0,
      useGrouped: false,
      sectionsByGroup: null,
    });
  });

  it('keys section cards by (groupname::sectionid) so same-named sections from different groups stay separate', () => {
    const result = buildAttendanceTabSections(
      [
        record({ scoutid: '1', sectionid: 100, sectionname: 'Beavers', groupname: '1st Walton' }),
        record({ scoutid: '2', sectionid: 200, sectionname: 'Beavers', groupname: 'Oatlands' }),
        record({ scoutid: '3', sectionid: 300, sectionname: 'Beavers', groupname: '1st Hersham' }),
      ],
      [],
      memberDataFor([
        ['1', { age: '10 / 06' }],
        ['2', { age: '11 / 01' }],
        ['3', { age: '9 / 11' }],
      ]),
    );

    expect(result.sections).toHaveLength(3);
    expect(result.useGrouped).toBe(true);
    expect(result.distinctGroupCount).toBe(3);
  });

  it('renders single-group events as a flat list (useGrouped=false)', () => {
    const result = buildAttendanceTabSections(
      [
        record({ scoutid: '1', sectionid: 100, sectionname: 'Beavers', groupname: '1st Walton' }),
        record({ scoutid: '2', sectionid: 200, sectionname: 'Cubs', groupname: '1st Walton' }),
      ],
      [],
      memberDataFor([['1', { age: '8' }], ['2', { age: '9' }]]),
    );

    expect(result.useGrouped).toBe(false);
    expect(result.sectionsByGroup).toBeNull();
    expect(result.sections).toHaveLength(2);
  });

  it('counts adults and young people separately by age (not person_type)', () => {
    const result = buildAttendanceTabSections(
      [
        record({ scoutid: '1', sectionid: 100, sectionname: 'Beavers' }),
        record({ scoutid: '2', sectionid: 100, sectionname: 'Beavers' }),
        record({ scoutid: '3', sectionid: 100, sectionname: 'Beavers' }),
      ],
      [],
      memberDataFor([
        ['1', { age: '8 / 06' }],
        ['2', { age: '30' }],
        ['3', { age: '25+' }],
      ]),
    );

    expect(result.totalYoungPeople).toBe(1);
    expect(result.totalAdults).toBe(2);
    expect(result.sections[0]).toMatchObject({ youngPeopleCount: 1, adultsCount: 2 });
  });

  it('sorts members within each section youngest-first', () => {
    const result = buildAttendanceTabSections(
      [
        record({ scoutid: '1', sectionid: 100, sectionname: 'Beavers' }),
        record({ scoutid: '2', sectionid: 100, sectionname: 'Beavers' }),
        record({ scoutid: '3', sectionid: 100, sectionname: 'Beavers' }),
      ],
      [],
      memberDataFor([
        ['1', { age: '10 / 06' }],
        ['2', { age: '7 / 02' }],
        ['3', { age: '25+' }],
      ]),
    );
    expect(result.sections[0].members.map(m => m.scoutid)).toEqual(['2', '1', '3']);
  });

  it('groups sections by groupname with Unknown group pinned last', () => {
    const result = buildAttendanceTabSections(
      [
        record({ scoutid: '1', sectionid: 100, sectionname: 'Beavers', groupname: 'Zebra Group' }),
        record({ scoutid: '2', sectionid: 200, sectionname: 'Beavers', groupname: 'Aardvark Group' }),
        record({ scoutid: '3', sectionid: 300, sectionname: 'Mystery', groupname: null }),
      ],
      [],
      memberDataFor([['1', { age: '8' }], ['2', { age: '8' }], ['3', { age: '8' }]]),
    );
    expect(result.sectionsByGroup.map(([g]) => g)).toEqual([
      'Aardvark Group',
      'Zebra Group',
      'Unknown group',
    ]);
  });

  it('prefers event.sectionname over the record\'s sectionname when both are present', () => {
    const result = buildAttendanceTabSections(
      [record({ scoutid: '1', sectionid: 100, sectionname: 'stale name' })],
      [{ sectionid: 100, sectionname: 'Beavers' }],
      memberDataFor([['1', { age: '10' }]]),
    );
    expect(result.sections[0].sectionname).toBe('Beavers');
  });

  it('survives records that reference a member not in the coreMembers map', () => {
    const result = buildAttendanceTabSections(
      [record({ scoutid: 'unknown', sectionid: 100, sectionname: 'Beavers', age: '11 / 06' })],
      [],
      new Map(),
    );
    expect(result.totalYoungPeople).toBe(1);
  });
});
