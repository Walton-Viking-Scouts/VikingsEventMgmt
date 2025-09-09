import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchSectionEvents,
  fetchEventAttendance,
  groupEventsByName,
  buildEventCard,
  filterEventsByDateRange,
} from '../eventDashboardHelpers.js';

// Mock external dependencies
vi.mock('../../services/api/api.js', () => ({
  fetchMostRecentTermId: vi.fn(),
  getEvents: vi.fn(),
  getEventAttendance: vi.fn(),
  getEventSummary: vi.fn(),
  getEventSharingStatus: vi.fn(),
}));

vi.mock('../../services/storage/database.js', () => ({
  default: {
    saveEvents: vi.fn(),
    getEvents: vi.fn(),
    saveAttendance: vi.fn(),
    getAttendance: vi.fn(),
  },
}));

vi.mock('../../services/utils/logger.js', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  LOG_CATEGORIES: {
    API: 'api',
    COMPONENT: 'component',
  },
}));

vi.mock('../../config/demoMode.js', () => ({
  isDemoMode: vi.fn(() => false),
}));

// Import mocked modules for assertions
import { fetchMostRecentTermId, getEvents, getEventAttendance, getEventSummary, getEventSharingStatus } from '../../services/api/api.js';
import databaseService from '../../services/storage/database.js';
import logger from '../../services/utils/logger.js';

describe('EventDashboard Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock setTimeout to resolve immediately in tests
    vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      callback();
      return 123; // Return a fake timer ID
    });

    // Setup default mocks for new API functions
    getEventSummary.mockResolvedValue(null);
    getEventSharingStatus.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchSectionEvents', () => {
    const mockSection = {
      sectionid: 1,
      sectionname: 'Beavers',
    };

    const mockApiEvents = [
      {
        eventid: 101,
        name: 'Camp Weekend',
        startdate: '2024-02-15',
      },
      {
        eventid: 102,
        name: 'Badge Workshop',
        startdate: '2024-02-20',
      },
    ];

    it('should fetch events from API when token provided', async () => {
      const token = 'mock-token';
      const termId = 'term-123';

      fetchMostRecentTermId.mockResolvedValue(termId);
      getEvents.mockResolvedValue(mockApiEvents);
      databaseService.saveEvents.mockResolvedValue();

      const result = await fetchSectionEvents(mockSection, token);

      expect(fetchMostRecentTermId).toHaveBeenCalledWith(1, token);
      expect(getEvents).toHaveBeenCalledWith(1, termId, token);
      expect(databaseService.saveEvents).toHaveBeenCalledWith(1, [
        {
          ...mockApiEvents[0],
          sectionid: 1,
          sectionname: 'Beavers',
          termid: termId,
        },
        {
          ...mockApiEvents[1],
          sectionid: 1,
          sectionname: 'Beavers',
          termid: termId,
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        eventid: 101,
        sectionid: 1,
        sectionname: 'Beavers',
        termid: termId,
      });
    });

    it('should load from cache when no token provided', async () => {
      const cachedEvents = [
        {
          eventid: 201,
          name: 'Cached Event',
          startdate: '2024-02-25',
          termid: 'term-456',
        },
      ];

      databaseService.getEvents.mockResolvedValue(cachedEvents);

      const result = await fetchSectionEvents(mockSection, null);

      expect(databaseService.getEvents).toHaveBeenCalledWith(1);
      expect(fetchMostRecentTermId).not.toHaveBeenCalled();
      expect(getEvents).not.toHaveBeenCalled();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        eventid: 201,
        sectionname: 'Beavers',
        termid: 'term-456',
      });
    });

    it('should handle API failures gracefully', async () => {
      const token = 'mock-token';
      const error = new Error('API failure');

      fetchMostRecentTermId.mockRejectedValue(error);

      const result = await fetchSectionEvents(mockSection, token);

      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching events for section {sectionId}',
        {
          error,
          sectionId: 1,
          sectionName: 'Beavers',
        },
        'api',
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when no termId found', async () => {
      const token = 'mock-token';

      fetchMostRecentTermId.mockResolvedValue(null);

      const result = await fetchSectionEvents(mockSection, token);

      expect(getEvents).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle invalid API response', async () => {
      const token = 'mock-token';
      const termId = 'term-123';

      fetchMostRecentTermId.mockResolvedValue(termId);
      getEvents.mockResolvedValue(null); // Invalid response

      const result = await fetchSectionEvents(mockSection, token);

      expect(result).toEqual([]);
    });

    it('should make API calls when token provided', async () => {
      const token = 'mock-token';
      const termId = 'term-123';

      fetchMostRecentTermId.mockResolvedValue(termId);
      getEvents.mockResolvedValue([]);

      await fetchSectionEvents(mockSection, token);

      // Verify API calls were made (rate limiting handled by queue)
      expect(fetchMostRecentTermId).toHaveBeenCalledWith(1, token);
      expect(getEvents).toHaveBeenCalledWith(1, termId, token);
    });
  });

  describe('fetchEventAttendance', () => {
    const mockEvent = {
      eventid: 101,
      name: 'Camp Weekend',
      sectionid: 1,
      termid: 'term-123',
    };

    const mockAttendanceData = [
      { scoutid: 1, attended: true },
      { scoutid: 2, attended: false },
    ];

    it('should fetch attendance from API when token provided', async () => {
      const token = 'mock-token';

      getEventAttendance.mockResolvedValue(mockAttendanceData);
      databaseService.saveAttendance.mockResolvedValue();

      const result = await fetchEventAttendance(mockEvent, token, []);

      expect(getEventAttendance).toHaveBeenCalledWith(1, 101, 'term-123', token);
      expect(databaseService.saveAttendance).toHaveBeenCalledWith(101, mockAttendanceData);
      expect(result).toEqual(mockAttendanceData);
    });

    it('should resolve missing termId from API', async () => {
      const token = 'mock-token';
      const eventWithoutTerm = { ...mockEvent, termid: null };

      fetchMostRecentTermId.mockResolvedValue('resolved-term');
      getEventAttendance.mockResolvedValue(mockAttendanceData);

      const result = await fetchEventAttendance(eventWithoutTerm, token, []);

      expect(fetchMostRecentTermId).toHaveBeenCalledWith(1, token);
      expect(getEventAttendance).toHaveBeenCalledWith(1, 101, 'resolved-term', token);
      expect(result).toEqual(mockAttendanceData);
    });

    it('should load from cache when no token provided', async () => {
      databaseService.getAttendance.mockResolvedValue(mockAttendanceData);

      const result = await fetchEventAttendance(mockEvent, null, []);

      expect(databaseService.getAttendance).toHaveBeenCalledWith(101);
      expect(getEventAttendance).not.toHaveBeenCalled();
      expect(result).toEqual(mockAttendanceData);
    });

    it('should handle API failures gracefully', async () => {
      const token = 'mock-token';
      const error = new Error('API failure');

      getEventAttendance.mockRejectedValue(error);

      const result = await fetchEventAttendance(mockEvent, token, []);

      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching attendance for event {eventId}',
        {
          error,
          eventId: 101,
          eventName: 'Camp Weekend',
          sectionId: 1,
        },
        'api',
      );

      expect(result).toEqual([]);
    });

    it('should return null when no termId can be resolved', async () => {
      const token = 'mock-token';
      const eventWithoutTerm = { ...mockEvent, termid: null };

      fetchMostRecentTermId.mockResolvedValue(null);

      const result = await fetchEventAttendance(eventWithoutTerm, token, []);

      expect(getEventAttendance).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should make API calls when token provided', async () => {
      const token = 'mock-token';

      getEventAttendance.mockResolvedValue([]);

      await fetchEventAttendance(mockEvent, token);

      // Verify API calls were made (rate limiting handled by queue)
      expect(getEventAttendance).toHaveBeenCalledWith(1, 101, 'term-123', token);
    });
  });

  describe('groupEventsByName', () => {
    it('should group events by name correctly', () => {
      const events = [
        { eventid: 1, name: 'Camp Weekend', startdate: '2024-02-15' },
        { eventid: 2, name: 'Badge Workshop', startdate: '2024-02-20' },
        { eventid: 3, name: 'Camp Weekend', startdate: '2024-03-15' },
        { eventid: 4, name: 'Badge Workshop', startdate: '2024-03-20' },
      ];

      const result = groupEventsByName(events);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      
      expect(result.get('Camp Weekend')).toHaveLength(2);
      expect(result.get('Camp Weekend')).toEqual([
        expect.objectContaining({ eventid: 1 }),
        expect.objectContaining({ eventid: 3 }),
      ]);

      expect(result.get('Badge Workshop')).toHaveLength(2);
      expect(result.get('Badge Workshop')).toEqual([
        expect.objectContaining({ eventid: 2 }),
        expect.objectContaining({ eventid: 4 }),
      ]);
    });

    it('should handle empty array', () => {
      const result = groupEventsByName([]);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle single event', () => {
      const events = [{ eventid: 1, name: 'Single Event', startdate: '2024-02-15' }];
      const result = groupEventsByName(events);

      expect(result.size).toBe(1);
      expect(result.get('Single Event')).toHaveLength(1);
    });

    it('should handle events with same name', () => {
      const events = [
        { eventid: 1, name: 'Same Name', startdate: '2024-02-15' },
        { eventid: 2, name: 'Same Name', startdate: '2024-02-20' },
        { eventid: 3, name: 'Same Name', startdate: '2024-02-25' },
      ];

      const result = groupEventsByName(events);

      expect(result.size).toBe(1);
      expect(result.get('Same Name')).toHaveLength(3);
    });
  });

  describe('buildEventCard', () => {
    it('should create card with correct structure', () => {
      const eventName = 'Camp Weekend';
      const events = [
        {
          eventid: 2,
          name: 'Camp Weekend',
          startdate: '2024-02-20',
          sectionname: 'Cubs',
        },
        {
          eventid: 1,
          name: 'Camp Weekend',
          startdate: '2024-02-15',
          sectionname: 'Beavers',
        },
      ];

      const result = buildEventCard(eventName, events);

      expect(result).toMatchObject({
        id: 'Camp Weekend-1', // Uses earliest event ID
        name: 'Camp Weekend',
        events: expect.any(Array),
        earliestDate: new Date('2024-02-15'),
        sections: ['Beavers', 'Cubs'],
      });
    });

    it('should sort events by date', () => {
      const eventName = 'Workshop';
      const events = [
        { eventid: 3, startdate: '2024-02-25', sectionname: 'Cubs' },
        { eventid: 1, startdate: '2024-02-15', sectionname: 'Beavers' },
        { eventid: 2, startdate: '2024-02-20', sectionname: 'Scouts' },
      ];

      const result = buildEventCard(eventName, events);

      expect(result.events[0].eventid).toBe(1); // Earliest date
      expect(result.events[1].eventid).toBe(2);
      expect(result.events[2].eventid).toBe(3); // Latest date
    });

    it('should extract unique sections', () => {
      const eventName = 'Multi-Section Event';
      const events = [
        { eventid: 1, startdate: '2024-02-15', sectionname: 'Beavers' },
        { eventid: 2, startdate: '2024-02-16', sectionname: 'Cubs' },
        { eventid: 3, startdate: '2024-02-17', sectionname: 'Beavers' }, // Duplicate
        { eventid: 4, startdate: '2024-02-18', sectionname: 'Scouts' },
      ];

      const result = buildEventCard(eventName, events);

      expect(result.sections).toEqual(['Beavers', 'Cubs', 'Scouts']);
      expect(result.sections).toHaveLength(3); // No duplicates
    });

    it('should handle single event', () => {
      const eventName = 'Single Event';
      const events = [
        { eventid: 1, startdate: '2024-02-15', sectionname: 'Beavers' },
      ];

      const result = buildEventCard(eventName, events);

      expect(result).toMatchObject({
        id: 'Single Event-1',
        name: 'Single Event',
        events: [events[0]],
        earliestDate: new Date('2024-02-15'),
        sections: ['Beavers'],
      });
    });
  });

  describe('filterEventsByDateRange', () => {
    const oneWeekAgo = new Date('2024-02-10');

    it('should filter events to include only those within date range', () => {
      const events = [
        { eventid: 1, startdate: '2024-02-05' }, // Too old
        { eventid: 2, startdate: '2024-02-12' }, // Within range
        { eventid: 3, startdate: '2024-02-15' }, // Within range
        { eventid: 4, startdate: '2024-03-01' }, // Future (within range)
      ];

      const result = filterEventsByDateRange(events, oneWeekAgo);

      expect(result).toHaveLength(3);
      expect(result.map(e => e.eventid)).toEqual([2, 3, 4]);
    });

    it('should handle empty array', () => {
      const result = filterEventsByDateRange([], oneWeekAgo);
      expect(result).toEqual([]);
    });

    it('should include events exactly at the boundary', () => {
      const events = [
        { eventid: 1, startdate: '2024-02-10T00:00:00.000Z' }, // Exactly at boundary
      ];

      const result = filterEventsByDateRange(events, oneWeekAgo);
      expect(result).toHaveLength(1);
    });

    it('should handle invalid dates gracefully', () => {
      const events = [
        { eventid: 1, startdate: 'invalid-date' },
        { eventid: 2, startdate: '2024-02-15' },
      ];

      const result = filterEventsByDateRange(events, oneWeekAgo);
      
      // Invalid date should be filtered out, valid one should remain
      expect(result).toHaveLength(1);
      expect(result[0].eventid).toBe(2);
    });
  });
});