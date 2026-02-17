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
});