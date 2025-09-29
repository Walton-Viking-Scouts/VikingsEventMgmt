import { describe, it, expect, vi, beforeEach } from 'vitest';
import dataLoadingService from '../dataLoadingService.js';
import databaseService from '../../storage/database.js';

// Mock all dependencies
vi.mock('../../../services/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  LOG_CATEGORIES: {
    DATA_SERVICE: 'data-service',
    ERROR: 'error',
  },
}));

// Mock the referenceDataService
const mockLoadInitialReferenceData = vi.fn();
vi.mock('../../referenceData/referenceDataService.js', () => ({
  loadInitialReferenceData: mockLoadInitialReferenceData,
}));

// Mock the eventsService
const mockLoadEventsForSections = vi.fn();
vi.mock('./eventsService.js', () => ({
  loadEventsForSections: mockLoadEventsForSections,
}));

// Mock the eventSyncService
const mockSyncAllEventAttendance = vi.fn();
const mockRefreshAllEventAttendance = vi.fn();
vi.mock('./eventSyncService.js', () => ({
  default: {
    syncAllEventAttendance: mockSyncAllEventAttendance,
    refreshAllEventAttendance: mockRefreshAllEventAttendance,
  },
}));

// Mock database service
vi.mock('../../storage/database.js', () => ({
  default: {
    getSections: vi.fn(),
  },
}));

describe('DataLoadingService', () => {
  const mockToken = 'test-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadAllDataAfterAuth', () => {
    it('should successfully orchestrate all data loading phases', async () => {
      // Setup successful mock responses
      const mockReferenceResult = {
        success: true,
        summary: { total: 4, successful: 4, failed: 0 },
        results: {
          userRoles: [
            { sectionid: 1, sectionname: 'Beavers' },
            { sectionid: 2, sectionname: 'Cubs' }
          ]
        }
      };

      const mockEventsResult = {
        success: true,
        summary: { total: 2, successful: 2, failed: 0 },
        results: [
          {
            sectionId: 1,
            events: [{ eventid: 101, name: 'Camp' }]
          }
        ]
      };

      const mockAttendanceResult = {
        success: true,
        message: 'Attendance synced',
        details: { syncedEvents: 1, totalEvents: 1 }
      };

      mockLoadInitialReferenceData.mockResolvedValue(mockReferenceResult);
      mockLoadEventsForSections.mockResolvedValue(mockEventsResult);
      mockSyncAllEventAttendance.mockResolvedValue(mockAttendanceResult);

      // Execute the orchestrator
      const result = await dataLoadingService.loadAllDataAfterAuth(mockToken);

      // Verify the orchestration sequence
      expect(mockLoadInitialReferenceData).toHaveBeenCalledWith(mockToken);
      expect(mockLoadEventsForSections).toHaveBeenCalledWith(
        mockReferenceResult.results.userRoles,
        mockToken
      );
      expect(mockSyncAllEventAttendance).toHaveBeenCalledWith(false);

      // Verify the final result
      expect(result.success).toBe(true);
      expect(result.hasErrors).toBe(false);
      expect(result.results.reference).toEqual(mockReferenceResult);
      expect(result.results.events).toEqual(mockEventsResult);
      expect(result.results.attendance).toEqual(mockAttendanceResult);
    });

    it('should handle missing token gracefully', async () => {
      const result = await dataLoadingService.loadAllDataAfterAuth(null);

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContain('No authentication token available');
      expect(mockLoadInitialReferenceData).not.toHaveBeenCalled();
    });

    it('should continue with partial success when reference data fails', async () => {
      // Reference data fails, but we should still try events and attendance
      mockLoadInitialReferenceData.mockRejectedValue(new Error('Reference data failed'));

      const result = await dataLoadingService.loadAllDataAfterAuth(mockToken);

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors.some(e => e.category === 'reference')).toBe(true);
      expect(mockLoadInitialReferenceData).toHaveBeenCalledWith(mockToken);
    });

    it('should skip events loading when no userRoles available', async () => {
      const mockReferenceResult = {
        success: true,
        results: { userRoles: [] } // No sections
      };

      mockLoadInitialReferenceData.mockResolvedValue(mockReferenceResult);

      const result = await dataLoadingService.loadAllDataAfterAuth(mockToken);

      expect(mockLoadEventsForSections).not.toHaveBeenCalled();
      expect(mockSyncAllEventAttendance).not.toHaveBeenCalled();
      expect(result.success).toBe(true); // Still success with just reference data
    });

    it('should skip attendance loading when no events available', async () => {
      const mockReferenceResult = {
        success: true,
        results: {
          userRoles: [{ sectionid: 1, sectionname: 'Beavers' }]
        }
      };

      const mockEventsResult = {
        success: true,
        results: [{ sectionId: 1, events: [] }] // No events
      };

      mockLoadInitialReferenceData.mockResolvedValue(mockReferenceResult);
      mockLoadEventsForSections.mockResolvedValue(mockEventsResult);

      const result = await dataLoadingService.loadAllDataAfterAuth(mockToken);

      expect(mockSyncAllEventAttendance).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('refreshEventData', () => {
    it('should refresh events and attendance successfully', async () => {
      const mockSections = [
        { sectionid: 1, sectionname: 'Beavers' }
      ];

      const mockEventsResult = {
        success: true,
        summary: { total: 1, successful: 1, failed: 0 }
      };

      const mockAttendanceResult = {
        success: true,
        message: 'Refresh completed',
        details: { syncedEvents: 1, totalEvents: 1 }
      };

      databaseService.getSections.mockResolvedValue(mockSections);
      mockLoadEventsForSections.mockResolvedValue(mockEventsResult);
      mockRefreshAllEventAttendance.mockResolvedValue(mockAttendanceResult);

      const result = await dataLoadingService.refreshEventData(mockToken);

      expect(databaseService.getSections).toHaveBeenCalled();
      expect(mockLoadEventsForSections).toHaveBeenCalledWith(mockSections, mockToken);
      expect(mockRefreshAllEventAttendance).toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.hasErrors).toBe(false);
    });

    it('should handle missing token in refresh', async () => {
      const result = await dataLoadingService.refreshEventData();

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContain('No authentication token available');
    });

    it('should handle sections retrieval failure gracefully', async () => {
      databaseService.getSections.mockRejectedValue(new Error('Database error'));
      mockRefreshAllEventAttendance.mockResolvedValue({ success: true });

      const result = await dataLoadingService.refreshEventData(mockToken);

      // Should still try attendance refresh even if sections fail
      expect(mockRefreshAllEventAttendance).toHaveBeenCalled();
      expect(result.hasErrors).toBe(true);
    });
  });

  describe('getLoadingStatus', () => {
    it('should return current loading state', () => {
      const status = dataLoadingService.getLoadingStatus();

      expect(status).toHaveProperty('isLoadingAll');
      expect(status).toHaveProperty('isRefreshing');
      expect(status).toHaveProperty('hasLoadAllPromise');
      expect(status).toHaveProperty('hasRefreshPromise');
    });
  });
});