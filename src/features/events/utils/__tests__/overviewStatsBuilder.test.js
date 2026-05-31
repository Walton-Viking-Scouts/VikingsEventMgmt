import { describe, it, expect } from 'vitest';
import { buildOverviewStats } from '../overviewStatsBuilder.js';

const yp = (overrides = {}) => ({
  scoutid: 'A', sectionid: 100, sectionname: 'Beavers',
  person_type: 'Young People',
  yes: 0, no: 0, invited: 0, notInvited: 0,
  ...overrides,
});
const leader = (overrides = {}) => yp({ person_type: 'Leaders', ...overrides });
const yl = (overrides = {}) => yp({ person_type: 'Young Leaders', ...overrides });

const eventForSection = (sectionid, sectionname) => ({ sectionid, sectionname });

describe('buildOverviewStats', () => {
  it('returns empty shape when there are no attendees', () => {
    expect(buildOverviewStats([], [])).toEqual({ sections: [], totals: null });
    expect(buildOverviewStats(null, [])).toEqual({ sections: [], totals: null });
  });

  it('accumulates per-section yes/no/invited/notInvited by role, with running totals', () => {
    const result = buildOverviewStats(
      [
        yp({ scoutid: '1', yes: 1 }),
        yp({ scoutid: '2', yes: 1 }),
        leader({ scoutid: '3', yes: 1 }),
        yl({ scoutid: '4', invited: 1 }),
      ],
      [eventForSection(100, 'Beavers')],
    );

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toMatchObject({
      name: 'Beavers',
      yes: { yp: 2, yl: 0, l: 1, total: 3 },
      invited: { yp: 0, yl: 1, l: 0, total: 1 },
    });
    expect(result.totals.yes.total).toBe(3);
    expect(result.totals.invited.yl).toBe(1);
  });

  it('skips members with unknown person_type rather than throwing', () => {
    const result = buildOverviewStats(
      [
        yp({ scoutid: '1', yes: 1 }),
        { scoutid: '2', sectionid: 100, sectionname: 'Beavers', person_type: '???', yes: 99 },
      ],
      [eventForSection(100, 'Beavers')],
    );
    expect(result.sections[0].yes.total).toBe(1);
  });

  it('uses event.sectionname over member.sectionname when both are present', () => {
    const result = buildOverviewStats(
      [yp({ sectionid: 100, sectionname: 'stale name', yes: 1 })],
      [eventForSection(100, 'Beavers')],
    );
    expect(result.sections[0].name).toBe('Beavers');
  });

  it('falls back to "Unknown Section" when nothing has a section name', () => {
    const result = buildOverviewStats(
      [yp({ sectionid: 999, sectionname: undefined, yes: 1 })],
      [],
    );
    expect(result.sections[0].name).toBe('Unknown Section');
  });

  describe('grouped output (>= 2 distinct groupnames)', () => {
    const districtData = () => [
      yp({ scoutid: '1', sectionid: 100, sectionname: 'Thursday Beavers', groupname: '1st Walton', yes: 1 }),
      yp({ scoutid: '2', sectionid: 200, sectionname: 'Beavers', groupname: 'Oatlands', yes: 1 }),
      yp({ scoutid: '3', sectionid: 300, sectionname: 'Beavers', groupname: '1st Hersham', yes: 1 }),
    ];

    it('emits a groups array sorted alphabetically', () => {
      const result = buildOverviewStats(districtData(), []);
      expect(result.groups.map(g => g.groupname)).toEqual([
        '1st Hersham',
        '1st Walton',
        'Oatlands',
      ]);
    });

    it('computes per-group subtotals', () => {
      const result = buildOverviewStats(
        [
          yp({ scoutid: '1', sectionid: 100, sectionname: 'Thursday Beavers', groupname: '1st Walton', yes: 3 }),
          leader({ scoutid: '2', sectionid: 100, sectionname: 'Thursday Beavers', groupname: '1st Walton', yes: 1 }),
          yp({ scoutid: '3', sectionid: 200, sectionname: 'Beavers', groupname: 'Oatlands', yes: 5 }),
        ],
        [],
      );
      const walton = result.groups.find(g => g.groupname === '1st Walton');
      expect(walton.subtotal.yes).toEqual({ yp: 3, yl: 0, l: 1, total: 4 });
      const oatlands = result.groups.find(g => g.groupname === 'Oatlands');
      expect(oatlands.subtotal.yes).toEqual({ yp: 5, yl: 0, l: 0, total: 5 });
    });

    it('pins "Unknown group" to the end when some sections lack groupname', () => {
      const result = buildOverviewStats(
        [
          yp({ scoutid: '1', sectionid: 100, groupname: 'Zebra Group', yes: 1 }),
          yp({ scoutid: '2', sectionid: 200, groupname: null, yes: 1 }),
          yp({ scoutid: '3', sectionid: 300, groupname: 'Aardvark Group', yes: 1 }),
        ],
        [],
      );
      expect(result.groups.map(g => g.groupname)).toEqual([
        'Aardvark Group',
        'Zebra Group',
        'Unknown group',
      ]);
    });

    it('falls back to the flat shape when only one group is present', () => {
      const result = buildOverviewStats(
        [
          yp({ scoutid: '1', sectionid: 100, groupname: '1st Walton', yes: 1 }),
          yp({ scoutid: '2', sectionid: 200, groupname: '1st Walton', yes: 1 }),
        ],
        [],
      );
      expect(result.groups).toBeUndefined();
    });

    it('upgrades a section\'s groupname when a later member of that section carries one', () => {
      // Defends against a real bug: first record arrives with no group context,
      // the section entry caches null, then a later record (with groupname
      // populated from shared metadata enrichment) is silently ignored.
      const result = buildOverviewStats(
        [
          yp({ scoutid: '1', sectionid: 100, groupname: null, yes: 1 }),
          yp({ scoutid: '2', sectionid: 100, groupname: '1st Walton', yes: 1 }),
          yp({ scoutid: '3', sectionid: 200, groupname: 'Oatlands', yes: 1 }),
        ],
        [],
      );
      const walton = result.groups.find(g => g.groupname === '1st Walton');
      expect(walton).toBeDefined();
      expect(walton.sections[0].groupname).toBe('1st Walton');
    });
  });
});
