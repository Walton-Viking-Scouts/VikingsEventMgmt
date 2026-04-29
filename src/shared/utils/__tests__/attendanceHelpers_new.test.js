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
  LOG_CATEGORIES: { DATA_SERVICE: 'data-service', DATABASE: 'database', STORAGE: 'storage', APP: 'app' },
}));

import databaseService from '../../services/storage/database.js';
import logger from '../../services/utils/logger.js';
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

describe('loadAllAttendanceFromDatabase — per-event failure handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs a warn with eventid + error when a single event fails to load', async () => {
    // Two events; one rejects, one resolves. The rejecter must be logged
    // with enough context (eventid, eventname, error message) for an operator
    // to investigate. The resolver's records still surface.
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockResolvedValue([
      { eventid: 'E1', name: 'Good Event',    startdate: '01/01/2026', sectionname: 'Monday Squirrels' },
      { eventid: 'E2', name: 'Broken Event',  startdate: '02/01/2026', sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getAttendance.mockImplementation(async (eventid) => {
      if (eventid === 'E2') throw new Error('IndexedDB transaction aborted');
      return [{ eventid, scoutid: 100, sectionid: MONDAY, attending: 'Yes' }];
    });

    const result = await loadAllAttendanceFromDatabase();

    expect(result).toHaveLength(1);
    expect(result[0].eventid).toBe('E1');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [message, context] = logger.warn.mock.calls[0];
    expect(message).toMatch(/Failed to load attendance/);
    expect(context.failedCount).toBe(1);
    expect(context.totalEvents).toBe(2);
    expect(context.sampleFailures[0]).toMatchObject({
      eventid: 'E2',
      eventname: 'Broken Event',
      error: 'IndexedDB transaction aborted',
    });
  });

  it('does not log a warn when all events load successfully', async () => {
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockResolvedValue([
      { eventid: 'E1', name: 'A', startdate: '01/01/2026', sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getAttendance.mockResolvedValue([
      { eventid: 'E1', scoutid: 1, sectionid: MONDAY, attending: 'Yes' },
    ]);

    await loadAllAttendanceFromDatabase();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns [] gracefully when every event fails (no top-level throw)', async () => {
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockResolvedValue([
      { eventid: 'E1', name: 'A', startdate: '01/01/2026', sectionname: 'Monday Squirrels' },
      { eventid: 'E2', name: 'B', startdate: '02/01/2026', sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getAttendance.mockRejectedValue(new Error('DB unavailable'));

    const result = await loadAllAttendanceFromDatabase();
    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][1].failedCount).toBe(2);
  });

  it('caps the sampleFailures log payload at 3 entries even when more events fail', async () => {
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        eventid: `E${i}`, name: `Event ${i}`, startdate: '01/01/2026', sectionname: 'Monday Squirrels',
      })),
    );
    databaseService.getAttendance.mockRejectedValue(new Error('boom'));

    await loadAllAttendanceFromDatabase();

    const context = logger.warn.mock.calls[0][1];
    expect(context.failedCount).toBe(5);
    expect(context.sampleFailures).toHaveLength(3);
  });

  it('logs failedEventCount in the debug summary even on the happy path', async () => {
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockResolvedValue([
      { eventid: 'E1', name: 'A', startdate: '01/01/2026', sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getAttendance.mockResolvedValue([
      { eventid: 'E1', scoutid: 1, sectionid: MONDAY, attending: 'Yes' },
    ]);

    await loadAllAttendanceFromDatabase();
    expect(logger.debug).toHaveBeenCalled();
    const [, ctx] = logger.debug.mock.calls[0];
    expect(ctx.failedEventCount).toBe(0);
    expect(ctx.recordCount).toBe(1);
  });

  it('captures the first failures in event-iteration order in sampleFailures', async () => {
    // Locks in that sampleFailures preserves Promise.allSettled's input order
    // — operators get the FIRST failed events for debugging, not random ones.
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        eventid: `E${i}`, name: `Event ${i}`, startdate: '01/01/2026', sectionname: 'Monday Squirrels',
      })),
    );
    // Only E2 and E4 fail; E0/E1/E3 succeed.
    databaseService.getAttendance.mockImplementation(async (eventid) => {
      if (eventid === 'E2' || eventid === 'E4') throw new Error(`fail ${eventid}`);
      return [{ eventid, scoutid: 1, sectionid: MONDAY, attending: 'Yes' }];
    });

    await loadAllAttendanceFromDatabase();
    const ctx = logger.warn.mock.calls[0][1];
    expect(ctx.sampleFailures.map(f => f.eventid)).toEqual(['E2', 'E4']);
    expect(ctx.sampleFailures.map(f => f.error)).toEqual(['fail E2', 'fail E4']);
  });
});

describe('loadAllAttendanceFromDatabase — top-level failure handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns [] and logs error when getSections rejects', async () => {
    databaseService.getSections.mockRejectedValue(new Error('IDB closed'));

    const result = await loadAllAttendanceFromDatabase();

    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    const [message, context] = logger.error.mock.calls[0];
    expect(message).toMatch(/Failed to load sections\/events/);
    expect(context.error).toBe('IDB closed');
  });

  it('returns [] and logs error when getEvents rejects mid-iteration', async () => {
    // Two sections; getEvents resolves for the first then rejects for the second.
    // Outer catch must fire — otherwise we'd silently produce a half-loaded
    // attendance set, which is the opposite of this PR's intent.
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
      { sectionid: THURSDAY, sectionname: 'Thursday Squirrels' },
    ]);
    databaseService.getEvents.mockImplementation(async (sid) => {
      if (sid === MONDAY) return [{ eventid: 'E1', name: 'A', startdate: '01/01/2026', sectionname: 'Monday Squirrels' }];
      throw new Error('Section events fetch failed');
    });

    const result = await loadAllAttendanceFromDatabase();

    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][1].error).toBe('Section events fetch failed');
  });
});

describe('loadAllAttendanceFromDatabase — rejection-reason formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupSingleEventThatRejectsWith(rejection) {
    databaseService.getSections.mockResolvedValue([
      { sectionid: MONDAY, sectionname: 'Monday Squirrels' },
    ]);
    databaseService.getEvents.mockResolvedValue([
      { eventid: 'E1', name: 'A', startdate: '01/01/2026', sectionname: 'Monday Squirrels' },
    ]);
    // Throwing a non-Error from an async function causes the promise to reject
    // with that exact value (string, null, plain object, etc.).
    databaseService.getAttendance.mockImplementation(async () => {
      throw rejection;
    });
  }

  it('uses .message for Error rejections', async () => {
    setupSingleEventThatRejectsWith(new Error('IndexedDB transaction aborted'));
    await loadAllAttendanceFromDatabase();
    expect(logger.warn.mock.calls[0][1].sampleFailures[0].error)
      .toBe('IndexedDB transaction aborted');
  });

  it('uses the string itself for string rejections', async () => {
    setupSingleEventThatRejectsWith('legacy string rejection');
    await loadAllAttendanceFromDatabase();
    expect(logger.warn.mock.calls[0][1].sampleFailures[0].error)
      .toBe('legacy string rejection');
  });

  it('produces an informative log when reason is undefined', async () => {
    setupSingleEventThatRejectsWith(undefined);
    await loadAllAttendanceFromDatabase();
    // String(undefined) would log just "undefined" which is uninformative.
    // Operators should see this came from a rejection with no value attached.
    expect(logger.warn.mock.calls[0][1].sampleFailures[0].error)
      .toBe('rejected with undefined');
  });

  it('produces an informative log when reason is null', async () => {
    setupSingleEventThatRejectsWith(null);
    await loadAllAttendanceFromDatabase();
    expect(logger.warn.mock.calls[0][1].sampleFailures[0].error)
      .toBe('rejected with null');
  });

  it('falls back to String() for plain-object rejections', async () => {
    setupSingleEventThatRejectsWith({ code: 'EBOOM' });
    await loadAllAttendanceFromDatabase();
    expect(logger.warn.mock.calls[0][1].sampleFailures[0].error)
      .toBe('[object Object]');
  });

  it('uses .message when a plain object exposes one (DOMException-shaped rejection)', async () => {
    setupSingleEventThatRejectsWith({ message: 'AbortError', name: 'DOMException' });
    await loadAllAttendanceFromDatabase();
    expect(logger.warn.mock.calls[0][1].sampleFailures[0].error).toBe('AbortError');
  });
});
