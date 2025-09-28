import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchSectionEvents,
  fetchEventAttendance,
  groupEventsByName,
  buildEventCard,
  filterEventsByDateRange,
  expandSharedEvents,
} from '../eventDashboardHelpers.js';

// Mock external dependencies - cache-only implementation
vi.mock('../../services/storage/database.js', () => ({
  default: {
    getEvents: vi.fn(),
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
    COMPONENT: 'component',
  },
}));

// Import mocked modules for assertions
import databaseService from '../../services/storage/database.js';
import logger from '../../services/utils/logger.js';

describe('EventDashboard Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchSectionEvents', () => {
    const mockSection = {
      sectionid: 1,
      sectionname: 'Beavers',
    };

    const mockCachedEvents = [
      {
        eventid: 101,
        name: 'Camp Weekend',
        startdate: '2024-02-15',
        termid: 'term-123',
      },
      {
        eventid: 102,
        name: 'Badge Workshop',
        startdate: '2024-02-20',
        termid: 'term-123',
      },
    ];

    it('should load events from cache only', async () => {
      databaseService.getEvents.mockResolvedValue(mockCachedEvents);

      const result = await fetchSectionEvents(mockSection);

      expect(databaseService.getEvents).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        eventid: 101,
        sectionid: 1,
        sectionname: 'Beavers',
        termid: 'term-123',
      });
    });

    it('should handle null/undefined cache gracefully', async () => {
      databaseService.getEvents.mockResolvedValue(null);

      const result = await fetchSectionEvents(mockSection);

      expect(databaseService.getEvents).toHaveBeenCalledWith(1);
      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database failure');
      databaseService.getEvents.mockRejectedValue(error);

      const result = await fetchSectionEvents(mockSection);

      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching events for section {sectionId}',
        {
          error,
          sectionId: 1,
          sectionName: 'Beavers',
        },
        'component',
      );

      expect(result).toEqual([]);
    });

    it('should skip sections with invalid IDs', async () => {
      const invalidSection = {
        sectionid: null,
        sectionname: 'Invalid Section',
      };

      const result = await fetchSectionEvents(invalidSection);

      expect(databaseService.getEvents).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should enrich events with section data', async () => {
      const eventsWithoutSectionData = [
        {
          eventid: 101,
          name: 'Camp Weekend',
          startdate: '2024-02-15',
          termid: 'existing-term',
        },
      ];

      databaseService.getEvents.mockResolvedValue(eventsWithoutSectionData);

      const result = await fetchSectionEvents(mockSection);

      expect(result[0]).toMatchObject({
        eventid: 101,
        sectionid: 1,
        sectionname: 'Beavers',
        termid: 'existing-term', // Preserved from cache
      });
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

    it('should load attendance from cache only', async () => {
      databaseService.getAttendance.mockResolvedValue(mockAttendanceData);

      const result = await fetchEventAttendance(mockEvent);

      expect(databaseService.getAttendance).toHaveBeenCalledWith(101);
      expect(result).toEqual(mockAttendanceData);
    });

    it('should handle array format attendance data', async () => {
      databaseService.getAttendance.mockResolvedValue(mockAttendanceData);

      const result = await fetchEventAttendance(mockEvent);

      expect(result).toEqual(mockAttendanceData);
    });

    it('should handle object format attendance data (shared events)', async () => {
      const objectFormatData = {
        items: mockAttendanceData,
        metadata: { shared: true },
      };
      databaseService.getAttendance.mockResolvedValue(objectFormatData);

      const result = await fetchEventAttendance(mockEvent);

      expect(result).toEqual(mockAttendanceData);
    });

    it('should handle null/undefined cache gracefully', async () => {
      databaseService.getAttendance.mockResolvedValue(null);

      const result = await fetchEventAttendance(mockEvent);

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database failure');
      databaseService.getAttendance.mockRejectedValue(error);

      const result = await fetchEventAttendance(mockEvent);

      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching attendance from cache',
        {
          error: error.message,
          eventId: 101,
          eventName: 'Camp Weekend',
        },
        'component',
      );

      expect(result).toEqual([]);
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
    const startDate = new Date('2024-02-10');
    const endDate = new Date('2024-03-10');

    it('should filter events to include only those within date range', () => {
      const events = [
        { eventid: 1, startdate: '2024-02-05' }, // Too old
        { eventid: 2, startdate: '2024-02-12' }, // Within range
        { eventid: 3, startdate: '2024-02-15' }, // Within range
        { eventid: 4, startdate: '2024-03-15' }, // Too future
      ];

      const result = filterEventsByDateRange(events, startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result.map(e => e.eventid)).toEqual([2, 3]);
    });

    it('should handle empty array', () => {
      const result = filterEventsByDateRange([], startDate, endDate);
      expect(result).toEqual([]);
    });

    it('should include events exactly at the boundary', () => {
      const events = [
        { eventid: 1, startdate: '2024-02-10T00:00:00.000Z' }, // Exactly at start boundary
        { eventid: 2, startdate: '2024-03-10T00:00:00.000Z' }, // Exactly at end boundary
      ];

      const result = filterEventsByDateRange(events, startDate, endDate);
      expect(result).toHaveLength(2);
    });

    it('should handle invalid dates gracefully', () => {
      const events = [
        { eventid: 1, startdate: 'invalid-date' },
        { eventid: 2, startdate: '2024-02-15' },
      ];

      const result = filterEventsByDateRange(events, startDate, endDate);

      // Invalid date should be filtered out, valid one should remain
      expect(result).toHaveLength(1);
      expect(result[0].eventid).toBe(2);
    });
  });

  describe('expandSharedEvents', () => {
    it('should return events unchanged in cache-only mode', () => {
      const events = [
        { eventid: 1, name: 'Event 1' },
        { eventid: 2, name: 'Event 2' },
      ];
      const attendanceMap = new Map();

      const result = expandSharedEvents(events, attendanceMap);

      expect(result).toEqual(events);
      expect(result).toBe(events); // Should return the same reference
    });

    it('should handle empty events array', () => {
      const result = expandSharedEvents([]);
      expect(result).toEqual([]);
    });
  });
});