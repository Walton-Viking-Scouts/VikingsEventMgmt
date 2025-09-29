import { describe, it, expect, vi, beforeEach } from 'vitest';
import dataLoadingService from '../dataLoadingService.js';

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
    getSections: vi.fn(),
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
});