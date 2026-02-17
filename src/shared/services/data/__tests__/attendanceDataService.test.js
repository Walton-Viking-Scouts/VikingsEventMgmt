import { describe, it, expect, vi, beforeEach } from 'vitest';
import attendanceDataService from '../attendanceDataService.js';

vi.mock('../../api/api/events.js', () => ({
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
  });

  it('should initialize with no last fetch time', () => {
    expect(attendanceDataService.getLastFetchTime()).toBeNull();
  });

  it('should return data from IndexedDB when available', async () => {
    databaseService.getSections = vi.fn().mockResolvedValue([
      { sectionid: 123, sectionname: 'Test Section' },
    ]);
    databaseService.getEvents = vi.fn().mockResolvedValue([
      { sectionid: 123, eventid: 'event1', name: 'Test Event', startdate: '2026-01-01', sectionname: 'Test Section' },
    ]);
    databaseService.getAttendance = vi.fn().mockResolvedValue([
      { scoutid: '123', eventid: 'event1', sectionid: 123, attending: 'Yes' },
    ]);

    const result = await attendanceDataService.getAttendanceData();

    expect(result).toHaveLength(1);
    expect(result[0].eventname).toBe('Test Event');
    expect(result[0].attending).toBe('Yes');
  });

  it('should clear last fetch time correctly', () => {
    attendanceDataService.lastFetchTime = Date.now();

    attendanceDataService.clearCache();

    expect(attendanceDataService.getLastFetchTime()).toBeNull();
  });

  it('should handle force refresh with token and cached events', async () => {
    const { getToken } = await import('../../auth/tokenService.js');
    const { getEventAttendance } = await import('../../api/api/events.js');

    getToken.mockReturnValue('test-token');
    getEventAttendance.mockResolvedValue([
      { scoutid: '123', firstname: 'John' },
    ]);

    databaseService.getSections = vi.fn().mockResolvedValue([
      { sectionid: 123, sectionname: 'Test Section' },
    ]);
    databaseService.getEvents = vi.fn().mockResolvedValue([
      { sectionid: 123, eventid: 'event1', termid: 456, name: 'Test Event', startdate: '2026-01-01', sectionname: 'Test Section' },
    ]);
    databaseService.saveAttendance = vi.fn().mockResolvedValue();

    const result = await attendanceDataService.refreshAttendanceData();

    expect(getEventAttendance).toHaveBeenCalledWith(123, 'event1', 456, 'test-token');
    expect(result).toHaveLength(1);
    expect(result[0].firstname).toBe('John');
    expect(result[0].eventname).toBe('Test Event');
    expect(databaseService.saveAttendance).toHaveBeenCalled();
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
