import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dataLoadingService from '../dataLoadingService.js';

const mockLoadInitialReferenceData = vi.fn();
const mockLoadFlexiRecordData = vi.fn();
const mockLoadEventsForSections = vi.fn();
const mockSyncAllEventAttendance = vi.fn();
const mockRefreshAllEventAttendance = vi.fn();
const mockGetSections = vi.fn();

// Mock logger to prevent console spam
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

// Mock database service
vi.mock('../../storage/database.js', () => ({
  default: {
    getSections: () => mockGetSections(),
  },
}));

// Mock referenceDataService
vi.mock('../../referenceData/referenceDataService.js', () => ({
  loadInitialReferenceData: (token) => mockLoadInitialReferenceData(token),
  loadFlexiRecordData: (userRoles, token) => mockLoadFlexiRecordData(userRoles, token),
}));

// Mock eventsService
vi.mock('../eventsService.js', () => ({
  loadEventsForSections: (sections, token) => mockLoadEventsForSections(sections, token),
}));

// Mock eventDataLoader
vi.mock('../eventDataLoader.js', () => ({
  default: {
    syncAllEventAttendance: (forceRefresh) => mockSyncAllEventAttendance(forceRefresh),
    refreshAllEventAttendance: () => mockRefreshAllEventAttendance(),
  },
}));

describe('DataLoadingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLoadingStatus', () => {
    it('should return current loading state', () => {
      const status = dataLoadingService.getLoadingStatus();

      expect(status).toHaveProperty('isLoadingAll');
      expect(status).toHaveProperty('isRefreshing');
      expect(status).toHaveProperty('hasLoadAllPromise');
      expect(status).toHaveProperty('hasRefreshPromise');

      // Verify initial state
      expect(status.isLoadingAll).toBe(false);
      expect(status.isRefreshing).toBe(false);
      expect(status.hasLoadAllPromise).toBe(false);
      expect(status.hasRefreshPromise).toBe(false);
    });
  });

  describe('loadAllDataAfterAuth', () => {
    it('should handle missing token gracefully', async () => {
      const result = await dataLoadingService.loadAllDataAfterAuth(null);

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContain('No authentication token available');
      expect(result.results.reference).toBe(null);
      expect(result.results.events).toBe(null);
      expect(result.results.attendance).toBe(null);
    });

    it('should handle empty string token gracefully', async () => {
      const result = await dataLoadingService.loadAllDataAfterAuth('');

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContain('No authentication token available');
    });

    it('should handle undefined token gracefully', async () => {
      const result = await dataLoadingService.loadAllDataAfterAuth(undefined);

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContain('No authentication token available');
    });

    it('should return consistent result structure', async () => {
      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('hasErrors');
      expect(result).toHaveProperty('results');
      expect(result.results).toHaveProperty('reference');
      expect(result.results).toHaveProperty('events');
      expect(result.results).toHaveProperty('attendance');

      if (result.hasErrors) {
        expect(result).toHaveProperty('errors');
        expect(Array.isArray(result.errors)).toBe(true);
      }
    });
  });

  describe('refreshEventData', () => {
    it('should handle missing token gracefully', async () => {
      const result = await dataLoadingService.refreshEventData();

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContain('No authentication token available');
    });

    it('should handle null token gracefully', async () => {
      const result = await dataLoadingService.refreshEventData(null);

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContain('No authentication token available');
    });

    it('should return consistent result structure', async () => {
      const result = await dataLoadingService.refreshEventData('test-token');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('hasErrors');
      expect(result).toHaveProperty('results');

      if (result.hasErrors) {
        expect(result).toHaveProperty('errors');
        expect(Array.isArray(result.errors)).toBe(true);
      }
    });
  });

  describe('state management', () => {
    it('should track loading state during operations', async () => {
      // Start a load operation (this will fail due to missing mocks, but that's OK)
      const loadPromise = dataLoadingService.loadAllDataAfterAuth('test-token');

      // Check that loading state is tracked
      const statusDuringLoad = dataLoadingService.getLoadingStatus();
      expect(statusDuringLoad.isLoadingAll).toBe(true);
      expect(statusDuringLoad.hasLoadAllPromise).toBe(true);

      // Wait for completion
      await loadPromise;

      // Check that loading state is cleared
      const statusAfterLoad = dataLoadingService.getLoadingStatus();
      expect(statusAfterLoad.isLoadingAll).toBe(false);
      expect(statusAfterLoad.hasLoadAllPromise).toBe(false);
    });

    it('should track refresh state during operations', async () => {
      // Start a refresh operation
      const refreshPromise = dataLoadingService.refreshEventData('test-token');

      // Check that refresh state is tracked
      const statusDuringRefresh = dataLoadingService.getLoadingStatus();
      expect(statusDuringRefresh.isRefreshing).toBe(true);
      expect(statusDuringRefresh.hasRefreshPromise).toBe(true);

      // Wait for completion
      await refreshPromise;

      // Check that refresh state is cleared
      const statusAfterRefresh = dataLoadingService.getLoadingStatus();
      expect(statusAfterRefresh.isRefreshing).toBe(false);
      expect(statusAfterRefresh.hasRefreshPromise).toBe(false);
    });

    it('should handle concurrent loadAllDataAfterAuth calls gracefully', async () => {
      // Start first load
      const firstLoad = dataLoadingService.loadAllDataAfterAuth('test-token-1');

      // Check that state shows loading
      const statusDuringLoad = dataLoadingService.getLoadingStatus();
      expect(statusDuringLoad.isLoadingAll).toBe(true);

      // Start second load immediately - should not crash
      const secondLoad = dataLoadingService.loadAllDataAfterAuth('test-token-2');

      // Both should complete successfully
      const [firstResult, secondResult] = await Promise.all([firstLoad, secondLoad]);

      expect(firstResult).toHaveProperty('success');
      expect(secondResult).toHaveProperty('success');
    });

    it('should handle concurrent refreshEventData calls gracefully', async () => {
      // Start first refresh
      const firstRefresh = dataLoadingService.refreshEventData('test-token-1');

      // Check that state shows refreshing
      const statusDuringRefresh = dataLoadingService.getLoadingStatus();
      expect(statusDuringRefresh.isRefreshing).toBe(true);

      // Start second refresh immediately - should not crash
      const secondRefresh = dataLoadingService.refreshEventData('test-token-2');

      // Both should complete successfully
      const [firstResult, secondResult] = await Promise.all([firstRefresh, secondRefresh]);

      expect(firstResult).toHaveProperty('success');
      expect(secondResult).toHaveProperty('success');
    });
  });

  describe('orchestration sequence', () => {
    it('should call services in correct order: Reference → Events → Attendance → FlexiRecords', async () => {
      const callOrder = [];
      const userRoles = [{ sectionid: 1, name: 'Test Section' }];

      mockLoadInitialReferenceData.mockImplementation(async () => {
        callOrder.push('reference');
        return {
          success: true,
          results: { userRoles },
          summary: 'Reference data loaded',
          hasErrors: false,
          errors: [],
        };
      });

      mockLoadEventsForSections.mockImplementation(async () => {
        callOrder.push('events');
        return {
          success: true,
          results: [{ sectionid: 1, events: [{ eventid: 1, name: 'Event 1' }] }],
          summary: 'Events loaded',
          hasErrors: false,
          errors: [],
        };
      });

      mockSyncAllEventAttendance.mockImplementation(async () => {
        callOrder.push('attendance');
        return {
          success: true,
          message: 'Attendance synced',
          details: {},
        };
      });

      mockLoadFlexiRecordData.mockImplementation(async () => {
        callOrder.push('flexiRecords');
        return {
          success: true,
          summary: 'FlexiRecords loaded',
          hasErrors: false,
          errors: [],
        };
      });

      await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(callOrder).toEqual(['reference', 'events', 'attendance', 'flexiRecords']);
      expect(mockLoadInitialReferenceData).toHaveBeenCalledTimes(1);
      expect(mockLoadEventsForSections).toHaveBeenCalledTimes(1);
      expect(mockSyncAllEventAttendance).toHaveBeenCalledTimes(1);
      expect(mockLoadFlexiRecordData).toHaveBeenCalledTimes(1);
    });

    it('should pass correct parameters to each service', async () => {
      const token = 'test-auth-token';
      const userRoles = [
        { sectionid: 1, name: 'Section 1' },
        { sectionid: 2, name: 'Section 2' },
      ];

      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: { userRoles },
        summary: 'Reference loaded',
        hasErrors: false,
        errors: [],
      });

      mockLoadEventsForSections.mockResolvedValue({
        success: true,
        results: [{ sectionid: 1, events: [{ eventid: 1 }] }],
        summary: 'Events loaded',
        hasErrors: false,
        errors: [],
      });

      mockSyncAllEventAttendance.mockResolvedValue({
        success: true,
        message: 'Attendance synced',
      });

      mockLoadFlexiRecordData.mockResolvedValue({
        success: true,
        summary: 'FlexiRecords loaded',
        hasErrors: false,
        errors: [],
      });

      await dataLoadingService.loadAllDataAfterAuth(token);

      expect(mockLoadInitialReferenceData).toHaveBeenCalledWith(token);
      expect(mockLoadEventsForSections).toHaveBeenCalledWith(userRoles, token);
      expect(mockSyncAllEventAttendance).toHaveBeenCalledWith(false);
      expect(mockLoadFlexiRecordData).toHaveBeenCalledWith(userRoles, token);
    });

    it('should skip events and attendance if no userRoles from reference data', async () => {
      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: { userRoles: [] },
        summary: 'No sections',
        hasErrors: false,
        errors: [],
      });

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(mockLoadInitialReferenceData).toHaveBeenCalledTimes(1);
      expect(mockLoadEventsForSections).not.toHaveBeenCalled();
      expect(mockSyncAllEventAttendance).not.toHaveBeenCalled();
      expect(mockLoadFlexiRecordData).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should skip attendance if no events are loaded', async () => {
      const userRoles = [{ sectionid: 1, name: 'Test Section' }];

      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: { userRoles },
        summary: 'Reference loaded',
        hasErrors: false,
        errors: [],
      });

      mockLoadEventsForSections.mockResolvedValue({
        success: true,
        results: [{ sectionid: 1, events: [] }],
        summary: 'No events',
        hasErrors: false,
        errors: [],
      });

      mockLoadFlexiRecordData.mockResolvedValue({
        success: true,
        summary: 'FlexiRecords loaded',
        hasErrors: false,
        errors: [],
      });

      await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(mockLoadInitialReferenceData).toHaveBeenCalledTimes(1);
      expect(mockLoadEventsForSections).toHaveBeenCalledTimes(1);
      expect(mockSyncAllEventAttendance).not.toHaveBeenCalled();
      expect(mockLoadFlexiRecordData).toHaveBeenCalledTimes(1);
    });

    it('should invoke callbacks when provided', async () => {
      const onEventsLoaded = vi.fn();
      const onAttendanceLoaded = vi.fn();
      const userRoles = [{ sectionid: 1, name: 'Test Section' }];

      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: { userRoles },
        summary: 'Reference loaded',
        hasErrors: false,
        errors: [],
      });

      mockLoadEventsForSections.mockResolvedValue({
        success: true,
        results: [{ sectionid: 1, events: [{ eventid: 1 }] }],
        summary: 'Events loaded',
        hasErrors: false,
        errors: [],
      });

      mockSyncAllEventAttendance.mockResolvedValue({
        success: true,
        message: 'Attendance synced',
      });

      mockLoadFlexiRecordData.mockResolvedValue({
        success: true,
        summary: 'FlexiRecords loaded',
        hasErrors: false,
        errors: [],
      });

      await dataLoadingService.loadAllDataAfterAuth('test-token', {
        onEventsLoaded,
        onAttendanceLoaded,
      });

      expect(onEventsLoaded).toHaveBeenCalledTimes(1);
      expect(onAttendanceLoaded).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle reference data loading failure and stop cascade', async () => {
      const error = new Error('Reference data API error');
      mockLoadInitialReferenceData.mockRejectedValue(error);

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        type: 'reference',
        category: 'reference',
        message: 'Reference data API error',
      });
      expect(mockLoadEventsForSections).not.toHaveBeenCalled();
      expect(mockSyncAllEventAttendance).not.toHaveBeenCalled();
      expect(mockLoadFlexiRecordData).not.toHaveBeenCalled();
    });

    it('should continue to FlexiRecords even if events fail', async () => {
      const userRoles = [{ sectionid: 1, name: 'Test Section' }];

      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: { userRoles },
        summary: 'Reference loaded',
        hasErrors: false,
        errors: [],
      });

      mockLoadEventsForSections.mockRejectedValue(new Error('Events API error'));

      mockLoadFlexiRecordData.mockResolvedValue({
        success: true,
        summary: 'FlexiRecords loaded',
        hasErrors: false,
        errors: [],
      });

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.success).toBe(true);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContainEqual(expect.objectContaining({
        type: 'events',
        category: 'events',
      }));
      expect(mockLoadFlexiRecordData).toHaveBeenCalledTimes(1);
      expect(result.summary.successful).toBe(2);
    });

    it('should continue if attendance sync fails', async () => {
      const userRoles = [{ sectionid: 1, name: 'Test Section' }];

      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: { userRoles },
        summary: 'Reference loaded',
        hasErrors: false,
        errors: [],
      });

      mockLoadEventsForSections.mockResolvedValue({
        success: true,
        results: [{ sectionid: 1, events: [{ eventid: 1 }] }],
        summary: 'Events loaded',
        hasErrors: false,
        errors: [],
      });

      mockSyncAllEventAttendance.mockRejectedValue(new Error('Attendance API error'));

      mockLoadFlexiRecordData.mockResolvedValue({
        success: true,
        summary: 'FlexiRecords loaded',
        hasErrors: false,
        errors: [],
      });

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.success).toBe(true);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContainEqual(expect.objectContaining({
        type: 'attendance',
        category: 'attendance',
      }));
      expect(mockLoadFlexiRecordData).toHaveBeenCalledTimes(1);
      expect(result.summary.successful).toBe(3);
    });

    it('should handle partial success with service-level errors', async () => {
      const userRoles = [{ sectionid: 1, name: 'Test Section' }];

      mockLoadInitialReferenceData.mockResolvedValue({
        success: false,
        results: { userRoles },
        summary: 'Partial reference load',
        hasErrors: true,
        errors: [{ type: 'roles', message: 'Failed to load roles' }],
      });

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContainEqual(expect.objectContaining({
        category: 'reference',
      }));
    });

    it('should mark result as complete failure when all services fail', async () => {
      mockLoadInitialReferenceData.mockRejectedValue(new Error('Reference failed'));

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.summary.successful).toBe(0);
      expect(result.summary.failed).toBeGreaterThan(0);
    });

    it('should handle synchronous errors in service calls gracefully', async () => {
      mockLoadInitialReferenceData.mockImplementation(() => {
        throw new Error('Synchronous error in reference service');
      });

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.success).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        type: 'reference',
        category: 'reference',
        message: 'Synchronous error in reference service',
      });
    });
  });

  describe('refreshEventData', () => {
    it('should call services in correct order: Events → Attendance', async () => {
      const callOrder = [];
      const sections = [{ sectionid: 1, name: 'Test Section' }];

      mockGetSections.mockResolvedValue(sections);

      mockLoadEventsForSections.mockImplementation(async () => {
        callOrder.push('events');
        return {
          success: true,
          results: [{ sectionid: 1, events: [] }],
          summary: 'Events refreshed',
          hasErrors: false,
          errors: [],
        };
      });

      mockRefreshAllEventAttendance.mockImplementation(async () => {
        callOrder.push('attendance');
        return {
          success: true,
          message: 'Attendance refreshed',
        };
      });

      await dataLoadingService.refreshEventData('test-token');

      expect(callOrder).toEqual(['events', 'attendance']);
      expect(mockLoadEventsForSections).toHaveBeenCalledTimes(1);
      expect(mockRefreshAllEventAttendance).toHaveBeenCalledTimes(1);
    });

    it('should handle sections loading failure gracefully', async () => {
      mockGetSections.mockRejectedValue(new Error('Cache error'));

      mockRefreshAllEventAttendance.mockResolvedValue({
        success: true,
        message: 'Attendance refreshed',
      });

      const result = await dataLoadingService.refreshEventData('test-token');

      expect(result.hasErrors).toBe(true);
      expect(result.errors).toContainEqual(expect.objectContaining({
        category: 'cache',
      }));
      expect(mockLoadEventsForSections).not.toHaveBeenCalled();
      expect(mockRefreshAllEventAttendance).toHaveBeenCalledTimes(1);
    });

    it('should continue to attendance even if events refresh fails', async () => {
      const sections = [{ sectionid: 1 }];
      mockGetSections.mockResolvedValue(sections);
      mockLoadEventsForSections.mockRejectedValue(new Error('Events API error'));
      mockRefreshAllEventAttendance.mockResolvedValue({
        success: true,
        message: 'Attendance refreshed',
      });

      const result = await dataLoadingService.refreshEventData('test-token');

      expect(result.success).toBe(true);
      expect(result.hasErrors).toBe(true);
      expect(mockRefreshAllEventAttendance).toHaveBeenCalledTimes(1);
    });

    it('should return proper summary with partial failures', async () => {
      const sections = [{ sectionid: 1 }];
      mockGetSections.mockResolvedValue(sections);

      mockLoadEventsForSections.mockResolvedValue({
        success: true,
        results: [],
        summary: 'Events refreshed',
        hasErrors: false,
        errors: [],
      });

      mockRefreshAllEventAttendance.mockResolvedValue({
        success: false,
        message: 'Attendance refresh failed',
      });

      const result = await dataLoadingService.refreshEventData('test-token');

      expect(result.success).toBe(true);
      expect(result.hasErrors).toBe(true);
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(1);
      expect(result.summary.categories.events).toBe(true);
      expect(result.summary.categories.attendance).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty events array from successful events load', async () => {
      const userRoles = [{ sectionid: 1 }];

      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: { userRoles },
        summary: 'Reference loaded',
        hasErrors: false,
        errors: [],
      });

      mockLoadEventsForSections.mockResolvedValue({
        success: true,
        results: [],
        summary: 'No events found',
        hasErrors: false,
        errors: [],
      });

      mockLoadFlexiRecordData.mockResolvedValue({
        success: true,
        summary: 'FlexiRecords loaded',
        hasErrors: false,
        errors: [],
      });

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.success).toBe(true);
      expect(mockSyncAllEventAttendance).not.toHaveBeenCalled();
      expect(mockLoadFlexiRecordData).toHaveBeenCalledTimes(1);
    });

    it('should handle reference data with undefined userRoles', async () => {
      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: {},
        summary: 'Reference loaded but no roles',
        hasErrors: false,
        errors: [],
      });

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.success).toBe(true);
      expect(mockLoadEventsForSections).not.toHaveBeenCalled();
      expect(mockLoadFlexiRecordData).not.toHaveBeenCalled();
    });

    it('should include performance timing in results', async () => {
      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: { userRoles: [] },
        summary: 'Reference loaded',
        hasErrors: false,
        errors: [],
      });

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.summary).toHaveProperty('duration');
      expect(typeof result.summary.duration).toBe('number');
      expect(result.summary.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large userRoles array', async () => {
      const largeUserRoles = Array.from({ length: 100 }, (_, i) => ({
        sectionid: i,
        name: `Section ${i}`,
      }));

      mockLoadInitialReferenceData.mockResolvedValue({
        success: true,
        results: { userRoles: largeUserRoles },
        summary: 'Reference loaded',
        hasErrors: false,
        errors: [],
      });

      mockLoadEventsForSections.mockResolvedValue({
        success: true,
        results: [],
        summary: 'Events loaded',
        hasErrors: false,
        errors: [],
      });

      mockLoadFlexiRecordData.mockResolvedValue({
        success: true,
        summary: 'FlexiRecords loaded',
        hasErrors: false,
        errors: [],
      });

      const result = await dataLoadingService.loadAllDataAfterAuth('test-token');

      expect(result.success).toBe(true);
      expect(mockLoadEventsForSections).toHaveBeenCalledWith(largeUserRoles, 'test-token');
      expect(mockLoadFlexiRecordData).toHaveBeenCalledWith(largeUserRoles, 'test-token');
    });
  });
});