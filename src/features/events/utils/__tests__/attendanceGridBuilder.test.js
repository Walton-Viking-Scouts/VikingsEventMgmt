import { describe, it, expect } from 'vitest';
import { buildAttendanceGridImpl } from '../attendanceGridBuilder.js';

const yes = (overrides = {}) => ({ scoutid: 'A', attending: 'Yes', sectionname: 'Beavers', ...overrides });
const no = (overrides = {}) => ({ scoutid: 'B', attending: 'No', sectionname: 'Beavers', ...overrides });
const invited = (overrides = {}) => ({ scoutid: 'C', attending: 'Invited', sectionname: 'Beavers', ...overrides });
const notInvited = (overrides = {}) => ({ scoutid: 'D', attending: '', sectionname: 'Beavers', ...overrides });

describe('buildAttendanceGridImpl', () => {
  describe('single-group (flat shape)', () => {
    it('returns flat shape when no group info is present', () => {
      const events = [{
        sectionname: 'Beavers',
        attendanceData: [
          yes({ scoutid: '1' }),
          yes({ scoutid: '2' }),
          no({ scoutid: '3' }),
          invited({ scoutid: '4' }),
          notInvited({ scoutid: '5' }),
        ],
      }];

      const grid = buildAttendanceGridImpl(events);

      expect(grid._grouped).toBeUndefined();
      expect(grid.Beavers).toEqual({ attending: 2, notAttending: 1, invited: 1, notInvited: 1 });
      expect(grid._totals).toEqual({ attending: 2, notAttending: 1, invited: 1, notInvited: 1 });
    });

    it('returns flat shape when all sections belong to the same group', () => {
      const events = [{
        sectionname: 'Wed Beavers',
        attendanceData: [
          yes({ scoutid: '1', sectionname: 'Wed Beavers', groupname: '1st Walton' }),
          yes({ scoutid: '2', sectionname: 'Thu Beavers', groupname: '1st Walton' }),
        ],
      }];

      const grid = buildAttendanceGridImpl(events);

      expect(grid._grouped).toBeUndefined();
      expect(grid['Wed Beavers']).toEqual({ attending: 1, notAttending: 0, invited: 0, notInvited: 0 });
      expect(grid['Thu Beavers']).toEqual({ attending: 1, notAttending: 0, invited: 0, notInvited: 0 });
    });

    it('deduplicates scouts in grand totals across multiple events', () => {
      const events = [
        { sectionname: 'Beavers', attendanceData: [yes({ scoutid: '1' })] },
        { sectionname: 'Beavers', attendanceData: [yes({ scoutid: '1' })] },
      ];

      const grid = buildAttendanceGridImpl(events);

      expect(grid._totals.attending).toBe(1);
    });
  });

  describe('multi-group (grouped shape)', () => {
    const districtEventData = () => [{
      sectionname: 'Thursday Beavers',
      attendanceData: [
        yes({ scoutid: '1', sectionname: 'Thursday Beavers', groupname: '1st Walton on Thames' }),
        yes({ scoutid: '2', sectionname: 'Thursday Beavers', groupname: '1st Walton on Thames' }),
        no({ scoutid: '3', sectionname: 'Thursday Beavers', groupname: '1st Walton on Thames' }),
        yes({ scoutid: 'synthetic-10', sectionname: 'Beavers', groupname: 'Oatlands' }),
        invited({ scoutid: 'synthetic-11', sectionname: 'Beavers', groupname: 'Oatlands' }),
        yes({ scoutid: 'synthetic-20', sectionname: 'Beavers', groupname: 'Walton-on-Thames' }),
      ],
    }];

    it('returns grouped shape when >=2 distinct groups are present', () => {
      const grid = buildAttendanceGridImpl(districtEventData());

      expect(grid._grouped).toBe(true);
      expect(grid.groups).toHaveLength(3);
      expect(grid.groups.map(g => g.groupname)).toEqual([
        '1st Walton on Thames',
        'Oatlands',
        'Walton-on-Thames',
      ]);
    });

    it('does NOT collide same-named sections across groups', () => {
      const grid = buildAttendanceGridImpl(districtEventData());

      const oatlands = grid.groups.find(g => g.groupname === 'Oatlands');
      const walton = grid.groups.find(g => g.groupname === 'Walton-on-Thames');

      expect(oatlands.sections).toEqual([
        { sectionname: 'Beavers', attending: 1, notAttending: 0, invited: 1, notInvited: 0 },
      ]);
      expect(walton.sections).toEqual([
        { sectionname: 'Beavers', attending: 1, notAttending: 0, invited: 0, notInvited: 0 },
      ]);
    });

    it('computes correct subtotals per group', () => {
      const grid = buildAttendanceGridImpl(districtEventData());

      const own = grid.groups.find(g => g.groupname === '1st Walton on Thames');
      expect(own.subtotal).toEqual({ attending: 2, notAttending: 1, invited: 0, notInvited: 0 });

      const oatlands = grid.groups.find(g => g.groupname === 'Oatlands');
      expect(oatlands.subtotal).toEqual({ attending: 1, notAttending: 0, invited: 1, notInvited: 0 });
    });

    it('computes deduplicated grand totals', () => {
      const grid = buildAttendanceGridImpl(districtEventData());

      expect(grid._totals).toEqual({ attending: 4, notAttending: 1, invited: 1, notInvited: 0 });
    });

    it('pins Unknown group last when some sections lack groupname', () => {
      const events = [{
        sectionname: 'Beavers',
        attendanceData: [
          yes({ scoutid: '1', sectionname: 'Beavers', groupname: 'Zebra Group' }),
          yes({ scoutid: '2', sectionname: 'Mystery', groupname: null }),
          yes({ scoutid: '3', sectionname: 'Beavers', groupname: 'Aardvark Group' }),
        ],
      }];

      const grid = buildAttendanceGridImpl(events);

      expect(grid._grouped).toBe(true);
      expect(grid.groups.map(g => g.groupname)).toEqual([
        'Aardvark Group',
        'Zebra Group',
        'Unknown group',
      ]);
    });
  });

  describe('shared event with mixed real + synthetic data', () => {
    it('uses real data over synthetic copies for accessible sections', () => {
      const events = [{
        sectionname: 'Thursday Beavers',
        attendanceData: [
          yes({ scoutid: '1', sectionname: 'Thursday Beavers', groupname: '1st Walton' }),
          yes({ scoutid: '2', sectionname: 'Thursday Beavers', groupname: '1st Walton' }),
          no({ scoutid: '3', sectionname: 'Thursday Beavers', groupname: '1st Walton' }),
          yes({ scoutid: 'synthetic-1', sectionname: 'Thursday Beavers', groupname: '1st Walton' }),
          yes({ scoutid: 'synthetic-2', sectionname: 'Thursday Beavers', groupname: '1st Walton' }),
          yes({ scoutid: 'synthetic-100', sectionname: 'Beavers', groupname: 'Oatlands' }),
        ],
      }];

      const grid = buildAttendanceGridImpl(events);

      const own = grid.groups.find(g => g.groupname === '1st Walton');
      expect(own.sections[0]).toEqual({
        sectionname: 'Thursday Beavers',
        attending: 2, notAttending: 1, invited: 0, notInvited: 0,
      });
    });
  });

  describe('edge cases', () => {
    it('handles events with no attendance data', () => {
      const grid = buildAttendanceGridImpl([{ sectionname: 'Empty', attendanceData: [] }]);

      expect(grid._totals).toEqual({ attending: 0, notAttending: 0, invited: 0, notInvited: 0 });
    });

    it('skips records with null or "null" section names', () => {
      const events = [{
        sectionname: 'Beavers',
        attendanceData: [
          yes({ scoutid: '1', sectionname: null }),
          yes({ scoutid: '2', sectionname: 'null' }),
          yes({ scoutid: '3', sectionname: 'Beavers' }),
        ],
      }];

      const grid = buildAttendanceGridImpl(events);

      expect(grid.Beavers).toEqual({ attending: 2, notAttending: 0, invited: 0, notInvited: 0 });
    });
  });
});
