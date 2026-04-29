import { describe, it, expect } from 'vitest';
import {
  dedupAttendanceForEventGroup,
  dedupAttendanceMapForEventGroup,
} from '../sharedEventAttendance.js';

const MONDAY = 63813;
const THURSDAY = 75317;
const WEDNESDAY = 99999;

const mondayEvent = { eventid: '1727576', sectionid: MONDAY, name: 'Pirate Camp' };
const thursdayEvent = { eventid: '1727583', sectionid: THURSDAY, name: 'Pirate Camp' };

describe('dedupAttendanceForEventGroup', () => {
  describe('shared event with full access (Pirate Camp scenario)', () => {
    const events = [mondayEvent, thursdayEvent];

    it('keeps own-section regular records', () => {
      const records = [
        { eventid: '1727576', scoutid: 1, sectionid: MONDAY, attending: 'No', isSharedSection: false },
        { eventid: '1727583', scoutid: 2, sectionid: THURSDAY, attending: 'Yes', isSharedSection: false },
      ];
      expect(dedupAttendanceForEventGroup(events, records)).toHaveLength(2);
    });

    it('keeps own-section shared records (Yes responses come back via shared API)', () => {
      const records = [
        { eventid: '1727576', scoutid: 10, sectionid: MONDAY, attending: 'Yes', isSharedSection: true },
      ];
      expect(dedupAttendanceForEventGroup(events, records)).toEqual(records);
    });

    it('drops cross-section shared records when the user has access to the person\'s own-section event', () => {
      const records = [
        { eventid: '1727576', scoutid: 20, sectionid: THURSDAY, attending: 'Yes', isSharedSection: true },
        { eventid: '1727583', scoutid: 20, sectionid: THURSDAY, attending: 'Yes', isSharedSection: false },
      ];
      const result = dedupAttendanceForEventGroup(events, records);
      expect(result).toHaveLength(1);
      expect(result[0].eventid).toBe('1727583');
    });

    it('does not inspect isSharedSection — drops a regular row on the wrong event the same as a shared row', () => {
      const records = [
        { eventid: '1727576', scoutid: 21, sectionid: THURSDAY, attending: 'Yes', isSharedSection: false },
        { eventid: '1727583', scoutid: 21, sectionid: THURSDAY, attending: 'Yes', isSharedSection: false },
      ];
      const result = dedupAttendanceForEventGroup(events, records);
      expect(result).toHaveLength(1);
      expect(result[0].eventid).toBe('1727583');
    });

    it('keeps both records when a scout has different sectionids across events (eventDataLoader.js:185 data shape)', () => {
      // Real-world data: scoutid 2216198 in IndexedDB has sectionid=Monday in
      // Monday's event (shared sync corrected it) and sectionid=Thursday in
      // Thursday's event (regular sync forced event.sectionid). Both records
      // pass `personSid === ownerSid` for their own event.
      const records = [
        { eventid: '1727576', scoutid: 2216198, sectionid: MONDAY,   attending: 'Yes', isSharedSection: true },
        { eventid: '1727583', scoutid: 2216198, sectionid: THURSDAY, attending: 'No',  isSharedSection: false },
      ];
      const result = dedupAttendanceForEventGroup(events, records);
      expect(result).toHaveLength(2);
    });

    it('drops the wrong-event record when a scout has the same sectionid on both events with different statuses', () => {
      // Same scout, same own-section, but the API returned them on both events
      // with different statuses. Their own-section event wins; the other is
      // dropped because the user has access to the scout's section directly.
      const records = [
        { eventid: '1727576', scoutid: 22, sectionid: MONDAY, attending: 'Yes', isSharedSection: true },
        { eventid: '1727583', scoutid: 22, sectionid: MONDAY, attending: 'No',  isSharedSection: true },
      ];
      const result = dedupAttendanceForEventGroup(events, records);
      expect(result).toHaveLength(1);
      expect(result[0].eventid).toBe('1727576');
      expect(result[0].attending).toBe('Yes');
    });

    it('reproduces the Pirate Camp counts after deduping cross-section duplicates', () => {
      const mondayNo = Array.from({ length: 12 }, (_, i) => ({
        eventid: '1727576', scoutid: 1000 + i, sectionid: MONDAY, attending: 'No', isSharedSection: false,
      }));
      const mondayYesShared = Array.from({ length: 8 }, (_, i) => ({
        eventid: '1727576', scoutid: 2000 + i, sectionid: MONDAY, attending: 'Yes', isSharedSection: true,
      }));
      const thursdayCrossInMondayEvent = Array.from({ length: 12 }, (_, i) => ({
        eventid: '1727576', scoutid: 3000 + i, sectionid: THURSDAY, attending: 'Yes', isSharedSection: true,
      }));
      const thursdayOwnEvent = [
        ...Array.from({ length: 12 }, (_, i) => ({
          eventid: '1727583', scoutid: 3000 + i, sectionid: THURSDAY, attending: 'Yes', isSharedSection: false,
        })),
        ...Array.from({ length: 9 }, (_, i) => ({
          eventid: '1727583', scoutid: 4000 + i, sectionid: THURSDAY, attending: 'No', isSharedSection: false,
        })),
      ];

      const all = [...mondayNo, ...mondayYesShared, ...thursdayCrossInMondayEvent, ...thursdayOwnEvent];
      const result = dedupAttendanceForEventGroup(events, all);

      const counts = (sid) => ({
        yes: result.filter(r => r.sectionid === sid && r.attending === 'Yes').length,
        no: result.filter(r => r.sectionid === sid && r.attending === 'No').length,
      });

      expect(counts(MONDAY)).toEqual({ yes: 8, no: 12 });
      expect(counts(THURSDAY)).toEqual({ yes: 12, no: 9 });
    });
  });

  describe('shared event with partial access (fallback)', () => {
    it('keeps shared cross-section records when the user has no event for that section', () => {
      const events = [mondayEvent];
      const records = [
        { eventid: '1727576', scoutid: 30, sectionid: MONDAY, attending: 'No', isSharedSection: false },
        { eventid: '1727576', scoutid: 31, sectionid: THURSDAY, attending: 'Yes', isSharedSection: true },
        { eventid: '1727576', scoutid: 32, sectionid: WEDNESDAY, attending: 'Yes', isSharedSection: true },
      ];
      const result = dedupAttendanceForEventGroup(events, records);
      expect(result).toHaveLength(3);
      expect(result.map(r => r.scoutid).sort()).toEqual([30, 31, 32]);
    });
  });

  describe('non-shared events (no-op)', () => {
    it('returns all records unchanged when each record\'s sectionid matches its event\'s owner', () => {
      const events = [mondayEvent];
      const records = [
        { eventid: '1727576', scoutid: 40, sectionid: MONDAY, attending: 'Yes', isSharedSection: false },
        { eventid: '1727576', scoutid: 41, sectionid: MONDAY, attending: 'No', isSharedSection: false },
      ];
      expect(dedupAttendanceForEventGroup(events, records)).toEqual(records);
    });
  });

  describe('edge cases', () => {
    it('returns records unchanged when events array is empty', () => {
      const records = [{ eventid: '1', scoutid: 50, sectionid: MONDAY, attending: 'Yes' }];
      expect(dedupAttendanceForEventGroup([], records)).toEqual(records);
    });

    it('returns empty array when records is empty', () => {
      expect(dedupAttendanceForEventGroup([mondayEvent], [])).toEqual([]);
    });

    it('handles null/undefined inputs without throwing', () => {
      expect(dedupAttendanceForEventGroup(null, null)).toEqual([]);
      expect(dedupAttendanceForEventGroup(undefined, undefined)).toEqual([]);
      expect(dedupAttendanceForEventGroup([mondayEvent], null)).toEqual([]);
    });

    it('coerces string sectionids to numbers when matching', () => {
      const events = [{ eventid: '1', sectionid: '63813' }];
      const records = [
        { eventid: '1', scoutid: 60, sectionid: 63813, attending: 'Yes', isSharedSection: false },
      ];
      expect(dedupAttendanceForEventGroup(events, records)).toHaveLength(1);
    });
  });
});

describe('dedupAttendanceMapForEventGroup', () => {
  it('regroups deduped records by eventid for downstream EventCard rendering', () => {
    const events = [mondayEvent, thursdayEvent];
    const attendanceByEventId = new Map([
      [mondayEvent.eventid, [
        { eventid: mondayEvent.eventid, scoutid: 100, sectionid: MONDAY, attending: 'No' },
        { eventid: mondayEvent.eventid, scoutid: 101, sectionid: THURSDAY, attending: 'Yes' },
      ]],
      [thursdayEvent.eventid, [
        { eventid: thursdayEvent.eventid, scoutid: 101, sectionid: THURSDAY, attending: 'Yes' },
      ]],
    ]);

    const result = dedupAttendanceMapForEventGroup(events, attendanceByEventId);

    expect(result.get(mondayEvent.eventid)).toHaveLength(1);
    expect(result.get(mondayEvent.eventid)[0].scoutid).toBe(100);
    expect(result.get(thursdayEvent.eventid)).toHaveLength(1);
    expect(result.get(thursdayEvent.eventid)[0].scoutid).toBe(101);
  });

  it('returns map keyed by String(eventid) so callers can do .get(String(event.eventid))', () => {
    const events = [{ eventid: 1727576, sectionid: MONDAY }];
    const attendanceByEventId = new Map([
      [1727576, [{ eventid: 1727576, scoutid: 110, sectionid: MONDAY, attending: 'Yes' }]],
    ]);

    const result = dedupAttendanceMapForEventGroup(events, attendanceByEventId);
    expect(result.get('1727576')).toHaveLength(1);
    expect(result.get(1727576)).toBeUndefined();
  });

  it('returns empty map when attendance map is missing entries for events in the group', () => {
    const events = [mondayEvent, thursdayEvent];
    const attendanceByEventId = new Map();

    const result = dedupAttendanceMapForEventGroup(events, attendanceByEventId);
    expect(result.size).toBe(0);
  });

  it('handles null/undefined inputs without throwing', () => {
    expect(dedupAttendanceMapForEventGroup(null, null).size).toBe(0);
    expect(dedupAttendanceMapForEventGroup(undefined, undefined).size).toBe(0);
    expect(dedupAttendanceMapForEventGroup([mondayEvent], undefined).size).toBe(0);
  });
});
