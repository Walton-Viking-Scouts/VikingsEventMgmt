import { describe, it, expect, vi, beforeEach } from 'vitest';
import eventDataLoader from '../eventDataLoader.js';
import * as api from '../../api/api/events.js';
import * as tokenService from '../../auth/tokenService.js';
import databaseService from '../../storage/database.js';

vi.mock('../../api/api/events.js');
vi.mock('../../auth/tokenService.js');
vi.mock('../../storage/database.js');

describe('EventDataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventDataLoader.lastSyncTime = null;
  });

  describe('basic functionality', () => {
    it('should have correct initial state', () => {
      expect(eventDataLoader.isLoading).toBe(false);
      expect(eventDataLoader.lastSyncTime).toBe(null);
    });

    it('should return early if recently refreshed', async () => {
      eventDataLoader.lastSyncTime = Date.now() - 1000; // 1 second ago

      const result = await eventDataLoader.syncAllEventAttendance();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Recently synced');
    });

    it('should handle missing auth token gracefully', async () => {
      vi.mocked(tokenService.getToken).mockReturnValue(null);

      const result = await eventDataLoader.refreshAllEventAttendance();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Your session has expired. Please log in again to sync events.');
    });

    it('should handle no events found', async () => {
      vi.mocked(tokenService.getToken).mockReturnValue('valid-token');
      vi.mocked(databaseService.getSections).mockResolvedValue([]);

      const result = await eventDataLoader.refreshAllEventAttendance();

      expect(result.success).toBe(false);
      expect(result.message).toContain('No Scout events found to sync. Check that you have events scheduled in OSM.');
    });
  });

  describe('sync process', () => {
    it('should sync events successfully', async () => {
      const mockSections = [
        { sectionid: 1, sectionname: 'Beavers' },
      ];
      // Create event date within displayable range (within last week to 3 months from now)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const mockEvents = [
        {
          eventid: 'event1',
          name: 'Test Event',
          sectionid: 1,
          termid: 'term1',
          startdate: tomorrow.toISOString().split('T')[0], // Tomorrow's date
        },
      ];
      const mockAttendance = [
        { scoutid: 123, firstname: 'John', lastname: 'Doe', attending: 'Yes' },
      ];

      vi.mocked(tokenService.getToken).mockReturnValue('valid-token');
      vi.mocked(databaseService.getSections).mockResolvedValue(mockSections);
      vi.mocked(databaseService.getEvents).mockResolvedValue(mockEvents);
      vi.mocked(api.getEventAttendance).mockResolvedValue(mockAttendance);
      vi.mocked(databaseService.saveAttendance).mockResolvedValue();

      const result = await eventDataLoader.refreshAllEventAttendance();

      expect(result.success).toBe(true);
      expect(result.details.syncedEvents).toBe(1);
      expect(result.details.failedEvents).toBe(0);
      expect(api.getEventAttendance).toHaveBeenCalledWith(1, 'event1', 'term1', 'valid-token');
      expect(databaseService.saveAttendance).toHaveBeenCalledWith('event1', [
        {
          scoutid: 123,
          eventid: 'event1',
          sectionid: 1,
          attending: 'Yes',
          patrol: null,
          notes: null,
        },
      ]);
    });
  });

  describe('syncEventAttendance', () => {
    it('preserves record.sectionid when present', async () => {
      vi.mocked(api.getEventAttendance).mockResolvedValue([
        { scoutid: 1, sectionid: 99, attending: 'Yes' },
      ]);
      vi.mocked(databaseService.saveAttendance).mockResolvedValue();

      await eventDataLoader.syncEventAttendance({ eventid: 'E1', sectionid: 10, termid: 'T1' }, 'token');

      const savedRecords = vi.mocked(databaseService.saveAttendance).mock.calls[0][1];
      expect(savedRecords[0].sectionid).toBe(99);
    });

    it('falls back to event.sectionid when record.sectionid absent', async () => {
      vi.mocked(api.getEventAttendance).mockResolvedValue([
        { scoutid: 1, attending: 'Yes' },
      ]);
      vi.mocked(databaseService.saveAttendance).mockResolvedValue();

      await eventDataLoader.syncEventAttendance({ eventid: 'E1', sectionid: 10, termid: 'T1' }, 'token');

      const savedRecords = vi.mocked(databaseService.saveAttendance).mock.calls[0][1];
      expect(savedRecords[0].sectionid).toBe(10);
    });

    it('cross-section attendee preserves their section (Pirate Camp scenario)', async () => {
      vi.mocked(api.getEventAttendance).mockResolvedValue([
        { scoutid: 1, sectionid: 10, attending: 'Yes' },
        { scoutid: 2, sectionid: 99, attending: 'No' },
      ]);
      vi.mocked(databaseService.saveAttendance).mockResolvedValue();

      await eventDataLoader.syncEventAttendance({ eventid: 'E1', sectionid: 10, termid: 'T1' }, 'token');

      const savedRecords = vi.mocked(databaseService.saveAttendance).mock.calls[0][1];
      expect(savedRecords[0].sectionid).toBe(10);
      expect(savedRecords[1].sectionid).toBe(99);
    });

    it('uses ?? not ||: record.sectionid of 0 is preserved, not coerced to event.sectionid', async () => {
      vi.mocked(api.getEventAttendance).mockResolvedValue([
        { scoutid: 1, sectionid: 0, attending: 'Yes' },
      ]);
      vi.mocked(databaseService.saveAttendance).mockResolvedValue();

      await eventDataLoader.syncEventAttendance({ eventid: 'E1', sectionid: 10, termid: 'T1' }, 'token');

      const savedRecords = vi.mocked(databaseService.saveAttendance).mock.calls[0][1];
      expect(savedRecords[0].sectionid).toBe(0);
    });
  });

  describe('syncEventsAttendance (scoped)', () => {
    beforeEach(() => {
      vi.mocked(databaseService.saveAttendance).mockResolvedValue();
      vi.mocked(databaseService.saveSharedAttendance).mockResolvedValue();
      vi.mocked(databaseService.saveSharedEventMetadata).mockResolvedValue();
      vi.mocked(api.getSharedEventAttendance).mockResolvedValue({ items: [] });
      vi.mocked(api.createMemberSectionRecordsForSharedAttendees).mockResolvedValue();
    });

    it('returns success no-op for empty input without calling getToken', async () => {
      const result = await eventDataLoader.syncEventsAttendance([]);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Nothing to refresh.');
      expect(tokenService.getToken).not.toHaveBeenCalled();
      expect(api.getEventAttendance).not.toHaveBeenCalled();
    });

    it('does NOT iterate sections (anti-regression: stays scoped)', async () => {
      vi.mocked(tokenService.getToken).mockReturnValue('valid-token');
      vi.mocked(api.getEventAttendance).mockResolvedValue([]);

      await eventDataLoader.syncEventsAttendance([
        { eventid: 'E1', sectionid: 10, termid: 'T1' },
      ]);

      expect(databaseService.getSections).not.toHaveBeenCalled();
      expect(databaseService.getEvents).not.toHaveBeenCalled();
    });

    it('does NOT update lastSyncTime (preserves global cooldown contract)', async () => {
      vi.mocked(tokenService.getToken).mockReturnValue('valid-token');
      vi.mocked(api.getEventAttendance).mockResolvedValue([]);
      eventDataLoader.lastSyncTime = null;

      await eventDataLoader.syncEventsAttendance([
        { eventid: 'E1', sectionid: 10, termid: 'T1' },
      ]);

      expect(eventDataLoader.lastSyncTime).toBe(null);
    });

    it('aggregates partial failure: 1 of 3 fails => success=true, partial=true', async () => {
      vi.mocked(tokenService.getToken).mockReturnValue('valid-token');
      vi.mocked(api.getEventAttendance).mockImplementation((sectionid, eventid) => {
        if (eventid === 'E2') return Promise.reject(new Error('rate limited'));
        return Promise.resolve([]);
      });

      const result = await eventDataLoader.syncEventsAttendance([
        { eventid: 'E1', sectionid: 10, termid: 'T1', name: 'A' },
        { eventid: 'E2', sectionid: 11, termid: 'T1', name: 'B' },
        { eventid: 'E3', sectionid: 12, termid: 'T1', name: 'C' },
      ]);

      expect(result.success).toBe(true);
      expect(result.partial).toBe(true);
      expect(result.details.syncedEvents).toBe(2);
      expect(result.details.failedEvents).toBe(1);
      expect(result.details.errors).toHaveLength(1);
      expect(result.details.errors[0].eventId).toBe('E2');
    });

    it('all events fail => success=false', async () => {
      vi.mocked(tokenService.getToken).mockReturnValue('valid-token');
      vi.mocked(api.getEventAttendance).mockRejectedValue(new Error('500'));

      const result = await eventDataLoader.syncEventsAttendance([
        { eventid: 'E1', sectionid: 10, termid: 'T1', name: 'A' },
        { eventid: 'E2', sectionid: 11, termid: 'T1', name: 'B' },
      ]);

      expect(result.success).toBe(false);
      expect(result.details.syncedEvents).toBe(0);
      expect(result.details.failedEvents).toBe(2);
    });

    it('skips events missing required fields and reports skippedEvents count', async () => {
      vi.mocked(tokenService.getToken).mockReturnValue('valid-token');
      vi.mocked(api.getEventAttendance).mockResolvedValue([]);

      const result = await eventDataLoader.syncEventsAttendance([
        { eventid: 'E1', sectionid: 10, termid: 'T1' },
        { eventid: 'E2', sectionid: 11 },
      ]);

      expect(result.details.skippedEvents).toBe(1);
      expect(result.details.validEvents).toBe(1);
      expect(api.getEventAttendance).toHaveBeenCalledTimes(1);
    });

    it('handles missing auth token without throwing', async () => {
      vi.mocked(tokenService.getToken).mockReturnValue(null);

      const result = await eventDataLoader.syncEventsAttendance([
        { eventid: 'E1', sectionid: 10, termid: 'T1' },
      ]);

      expect(result.success).toBe(false);
      expect(result.message).toContain('session has expired');
      expect(api.getEventAttendance).not.toHaveBeenCalled();
    });
  });

  describe('syncSharedAttendance filtering', () => {
    beforeEach(() => {
      vi.mocked(databaseService.saveAttendance).mockResolvedValue();
      vi.mocked(databaseService.saveSharedAttendance).mockResolvedValue();
      vi.mocked(databaseService.saveSharedEventMetadata).mockResolvedValue();
      vi.mocked(api.createMemberSectionRecordsForSharedAttendees).mockResolvedValue();
    });

    it('skips getSharedEventAttendance for events with no shared metadata', async () => {
      vi.mocked(databaseService.getSharedEventMetadata).mockResolvedValue(null);

      const result = await eventDataLoader.syncSharedAttendance([
        { eventid: 'E1', sectionid: 10, termid: 'T1', name: 'A' },
        { eventid: 'E2', sectionid: 11, termid: 'T1', name: 'B' },
      ], 'token');

      expect(api.getSharedEventAttendance).not.toHaveBeenCalled();
      expect(result.skippedNonShared).toBe(2);
      expect(result.sharedEvents).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    it('only calls getSharedEventAttendance for events flagged isSharedEvent', async () => {
      vi.mocked(databaseService.getSharedEventMetadata).mockImplementation((eventId) => {
        if (eventId === 'E1') return Promise.resolve({ is_shared_event: 1 });
        return Promise.resolve(null);
      });
      vi.mocked(api.getSharedEventAttendance).mockResolvedValue({ items: [] });

      const result = await eventDataLoader.syncSharedAttendance([
        { eventid: 'E1', sectionid: 10, termid: 'T1', name: 'A' },
        { eventid: 'E2', sectionid: 11, termid: 'T1', name: 'B' },
      ], 'token');

      expect(api.getSharedEventAttendance).toHaveBeenCalledTimes(1);
      expect(api.getSharedEventAttendance).toHaveBeenCalledWith('E1', 10, 'token');
      expect(result.skippedNonShared).toBe(1);
      expect(result.sharedEvents).toBe(1);
    });

    it('aggregates per-event failures into errors[] without aborting the loop', async () => {
      vi.mocked(databaseService.getSharedEventMetadata).mockResolvedValue({ isSharedEvent: true });
      vi.mocked(api.getSharedEventAttendance).mockImplementation((eventId) => {
        if (eventId === 'E2') return Promise.reject(new Error('429 rate limited'));
        return Promise.resolve({ items: [] });
      });

      const result = await eventDataLoader.syncSharedAttendance([
        { eventid: 'E1', sectionid: 10, termid: 'T1', name: 'A' },
        { eventid: 'E2', sectionid: 11, termid: 'T1', name: 'B' },
        { eventid: 'E3', sectionid: 12, termid: 'T1', name: 'C' },
      ], 'token');

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].eventId).toBe('E2');
      expect(result.errors[0].error).toContain('429');
    });
  });
});