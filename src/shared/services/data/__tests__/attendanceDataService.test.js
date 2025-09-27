import { describe, it, expect, vi, beforeEach } from 'vitest';
import attendanceDataService from '../attendanceDataService.js';

vi.mock('../../api/api.js', () => ({
  getEventAttendance: vi.fn(),
}));

vi.mock('../../auth/tokenService.js', () => ({
  getToken: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LOG_CATEGORIES: {
    DATA_SERVICE: 'data_service',
  },
}));

import databaseService from '../../storage/database.js';

describe('AttendanceDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attendanceDataService.clearCache();
    localStorage.clear();
  });

  it('should initialize with empty cache', () => {
    expect(attendanceDataService.getLastFetchTime()).toBeNull();
  });

  it('should return cached data when available', async () => {
    attendanceDataService.attendanceCache = [
      { scoutid: '123', eventid: 'event1', firstname: 'John' },
    ];
    attendanceDataService.lastFetchTime = Date.now();

    const result = await attendanceDataService.getAttendanceData();

    expect(result).toHaveLength(1);
    expect(result[0].firstname).toBe('John');
  });

  it('should clear cache correctly', () => {
    attendanceDataService.attendanceCache = [{ test: 'data' }];
    attendanceDataService.lastFetchTime = Date.now();

    attendanceDataService.clearCache();

    expect(attendanceDataService.attendanceCache).toHaveLength(0);
    expect(attendanceDataService.getLastFetchTime()).toBeNull();
  });

  it('should find cached events correctly', () => {
    localStorage.setItem('viking_events_123_456_offline', JSON.stringify([
      { sectionid: 123, eventid: 'event1', termid: 456, name: 'Test Event' },
    ]));

    const events = attendanceDataService.getCachedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventid).toBe('event1');
  });

  it('should handle force refresh with token and cached events', async () => {
    const { getToken } = await import('../../auth/tokenService.js');
    const { getEventAttendance } = await import('../../api/api.js');

    getToken.mockReturnValue('test-token');
    getEventAttendance.mockResolvedValue([
      { scoutid: '123', firstname: 'John' },
    ]);

    // Mock database service to return sections and events
    databaseService.getSections = vi.fn().mockResolvedValue([
      { sectionid: 123, sectionname: 'Test Section' },
    ]);
    databaseService.getEvents = vi.fn().mockResolvedValue([
      { sectionid: 123, eventid: 'event1', termid: 456, name: 'Test Event' },
    ]);

    localStorage.setItem('viking_events_123_456_offline', JSON.stringify([
      { sectionid: 123, eventid: 'event1', termid: 456, name: 'Test Event' },
    ]));

    const result = await attendanceDataService.refreshAttendanceData();

    expect(getEventAttendance).toHaveBeenCalledWith(123, 'event1', 456, 'test-token');
    expect(result).toHaveLength(1);
    expect(result[0].firstname).toBe('John');
    expect(result[0].eventname).toBe('Test Event');
    expect(attendanceDataService.getLastFetchTime()).not.toBeNull();
  });

  it('should handle missing token gracefully', async () => {
    const { getToken } = await import('../../auth/tokenService.js');
    getToken.mockReturnValue(null);

    await expect(attendanceDataService.refreshAttendanceData()).rejects.toThrow(
      'Your session has expired. Please log in again to continue.',
    );
  });
});