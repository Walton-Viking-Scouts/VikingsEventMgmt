import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/storage/database.js', () => ({
  default: {
    getSections: vi.fn(),
    getEvents: vi.fn(),
    getAttendance: vi.fn(),
    getEventById: vi.fn(),
  },
}));

vi.mock('../../services/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  LOG_CATEGORIES: { DATA_SERVICE: 'data_service' },
}));

import databaseService from '../../services/storage/database.js';
import { loadAllAttendanceFromDatabase } from '../attendanceHelpers_new.js';

const MONDAY = 63813;
const THURSDAY = 75317;

describe('loadAllAttendanceFromDatabase — sectionname enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the record\'s actual section name (not the event-owner\'s) for cross-section attendees', async () => {
    // The bug this guards against: a Monday-owned event holds attendance rows
    // for both Monday Squirrels (the owner section) and Thursday Squirrels
    // (cross-section invitees via the OSM shared-event mechanism). Before the
    // fix, all rows were stamped with the event owner's section name, putting
    // Thursday people under "Monday Squirrels" on the dashboard.
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
      { sectionid: THURSDAY, sectionname: 'Thursday Squirrels' },
    ]);
    databaseService.getEvents.mockImplementation(async (sid) => {
      if (sid === MONDAY) return [{ eventid: '1727576', name: 'Pirate Camp', startdate: '05/09/2026', sectionname: 'Monday Squirrels' }];
      if (sid === THURSDAY) return [];
      return [];
    });
    databaseService.getAttendance.mockResolvedValue([
      { eventid: '1727576', scoutid: 1, sectionid: MONDAY,   attending: 'No',  isSharedSection: false },
      { eventid: '1727576', scoutid: 2, sectionid: THURSDAY, attending: 'Yes', isSharedSection: true },
    ]);

    const result = await loadAllAttendanceFromDatabase();

    const monday = result.find(r => r.scoutid === 1);
    const thursdayCrossInvitee = result.find(r => r.scoutid === 2);
    expect(monday.sectionname).toBe('Monday Squirrels');
    expect(thursdayCrossInvitee.sectionname).toBe('Thursday Squirrels');
  });

  it('falls back to event.sectionname when the record\'s sectionid isn\'t in the sections store', async () => {
    // Stale data: a record references a section that no longer exists in cache.
    // We fall back to the event-owner's section name rather than null so the
    // record still has a usable label.
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockImplementation(async (sid) => {
      if (sid === MONDAY) return [{ eventid: '1727576', name: 'Pirate Camp', startdate: '05/09/2026', sectionname: 'Monday Squirrels' }];
      return [];
    });
    databaseService.getAttendance.mockResolvedValue([
      { eventid: '1727576', scoutid: 3, sectionid: 999999, attending: 'Yes', isSharedSection: true },
    ]);

    const result = await loadAllAttendanceFromDatabase();
    expect(result[0].sectionname).toBe('Monday Squirrels');
  });

  it('falls back to null when neither the sections store nor the event provides a name', async () => {
    // Section exists in the store (so getEvents is iterated) but its sectionid
    // doesn't match the record's, AND the event row has no sectionname either.
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockImplementation(async () => [
      { eventid: '1727576', name: 'Pirate Camp', startdate: '05/09/2026', sectionname: undefined },
    ]);
    databaseService.getAttendance.mockResolvedValue([
      { eventid: '1727576', scoutid: 4, sectionid: 999999, attending: 'Yes' },
    ]);

    const result = await loadAllAttendanceFromDatabase();
    expect(result[0].sectionname).toBeNull();
  });

  it('always uses the record sectionid for the lookup, even when the record happens to be on its own-section event', async () => {
    // Sanity check: the sections-store join also handles the common (non-shared)
    // case correctly — Monday person on Monday's event still labelled Monday.
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockImplementation(async () => [
      { eventid: '1727576', name: 'Pirate Camp', startdate: '05/09/2026', sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getAttendance.mockResolvedValue([
      { eventid: '1727576', scoutid: 5, sectionid: MONDAY, attending: 'Yes' },
    ]);

    const result = await loadAllAttendanceFromDatabase();
    expect(result[0].sectionname).toBe('Monday Squirrels');
  });
});
