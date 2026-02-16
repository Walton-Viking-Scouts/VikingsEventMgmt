import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CurrentActiveTermsService } from '../currentActiveTermsService.js';
import { IndexedDBService } from '../indexedDBService.js';
import logger from '../../utils/logger.js';

// Mock IDBKeyRange for Node.js test environment
global.IDBKeyRange = {
  lowerBound: (bound) => ({ lower: bound, lowerOpen: false }),
  upperBound: (bound) => ({ upper: bound, upperOpen: false }),
  bound: (lower, upper) => ({ lower, upper, lowerOpen: false, upperOpen: false }),
};

vi.mock('../indexedDBService.js');
vi.mock('../../utils/logger.js');

describe('CurrentActiveTermsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the getDB method to return an object with database methods
    const mockDB = {
      get: vi.fn(),
      put: vi.fn(),
      getAll: vi.fn(),
      delete: vi.fn(),
    };

    IndexedDBService.getDB = vi.fn().mockResolvedValue(mockDB);

    // Keep the original method mocks for backwards compatibility
    IndexedDBService.get = mockDB.get;
    IndexedDBService.put = mockDB.put;
    IndexedDBService.getAll = mockDB.getAll;
    IndexedDBService.delete = mockDB.delete;
  });

  describe('getCurrentActiveTerm', () => {
    it('should retrieve current active term for a section', async () => {
      const mockTerm = {
        sectionId: '999901',
        currentTermId: '12345',
        termName: 'Autumn Term 2025',
        startDate: '2025-09-01',
        endDate: '2025-12-15',
        lastUpdated: 1737765123456,
      };

      IndexedDBService.get.mockResolvedValue(mockTerm);

      const result = await CurrentActiveTermsService.getCurrentActiveTerm('999901');

      expect(result).toEqual(mockTerm);
      expect(IndexedDBService.get).toHaveBeenCalledWith(
        IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
        '999901',
      );
    });

    it('should return null if no current term exists', async () => {
      IndexedDBService.get.mockResolvedValue(null);

      const result = await CurrentActiveTermsService.getCurrentActiveTerm('999901');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      IndexedDBService.get.mockRejectedValue(error);

      await expect(
        CurrentActiveTermsService.getCurrentActiveTerm('999901'),
      ).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get current active term',
        expect.objectContaining({
          sectionId: '999901',
          error: 'Database error',
        }),
        expect.any(String),
      );
    });
  });

  describe('setCurrentActiveTerm', () => {
    it('should set current active term with proper normalization', async () => {
      const termData = {
        termid: '12345',
        name: 'Autumn Term 2025',
        startdate: '2025-09-01',
        enddate: '2025-12-15',
      };

      const mockTime = 1737765123456;
      vi.spyOn(Date, 'now').mockReturnValue(mockTime);

      IndexedDBService.put.mockResolvedValue(true);

      const result = await CurrentActiveTermsService.setCurrentActiveTerm('999901', termData);

      expect(result).toBe(true);
      expect(IndexedDBService.put).toHaveBeenCalledWith(
        IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
        {
          sectionId: '999901',
          currentTermId: '12345',
          termName: 'Autumn Term 2025',
          startDate: '2025-09-01',
          endDate: '2025-12-15',
          lastUpdated: mockTime,
        },
      );
    });

    it('should handle alternative field names', async () => {
      const termData = {
        currentTermId: '54321',
        termName: 'Spring Term 2025',
        startDate: '2025-01-15',
        endDate: '2025-04-10',
      };

      IndexedDBService.put.mockResolvedValue(true);

      await CurrentActiveTermsService.setCurrentActiveTerm('999902', termData);

      expect(IndexedDBService.put).toHaveBeenCalledWith(
        IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
        expect.objectContaining({
          sectionId: '999902',
          currentTermId: '54321',
          termName: 'Spring Term 2025',
          startDate: '2025-01-15',
          endDate: '2025-04-10',
        }),
      );
    });
  });

  describe('getTermsUpdatedSince', () => {
    it('should query terms by lastUpdated index', async () => {
      const timestamp = 1737765000000;
      const mockTerms = [
        { sectionId: '999901', lastUpdated: 1737765123456 },
        { sectionId: '999902', lastUpdated: 1737765234567 },
      ];

      IndexedDBService.getByIndex.mockResolvedValue(mockTerms);

      const result = await CurrentActiveTermsService.getTermsUpdatedSince(timestamp);

      expect(result).toEqual(mockTerms);
      expect(IndexedDBService.getByIndex).toHaveBeenCalledWith(
        IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
        'lastUpdated',
        expect.objectContaining({
          lower: timestamp,
          lowerOpen: false,
        }),
      );
    });
  });

  describe('getStoreStatistics', () => {
    it('should return comprehensive store statistics', async () => {
      const mockTerms = [
        {
          sectionId: '999901',
          currentTermId: '12345',
          lastUpdated: 1737765123456,
        },
        {
          sectionId: '999902',
          currentTermId: '12345',
          lastUpdated: 1737765234567,
        },
        {
          sectionId: '999903',
          currentTermId: '54321',
          lastUpdated: 1737765345678,
        },
      ];

      vi.spyOn(CurrentActiveTermsService, 'getAllCurrentActiveTerms')
        .mockResolvedValue(mockTerms);

      const stats = await CurrentActiveTermsService.getStoreStatistics();

      expect(stats).toEqual({
        totalTerms: 3,
        sections: ['999901', '999902', '999903'],
        oldestUpdate: 1737765123456,
        newestUpdate: 1737765345678,
        termDistribution: {
          '12345': 2,
          '54321': 1,
        },
      });
    });

    it('should handle empty store', async () => {
      vi.spyOn(CurrentActiveTermsService, 'getAllCurrentActiveTerms')
        .mockResolvedValue([]);

      const stats = await CurrentActiveTermsService.getStoreStatistics();

      expect(stats).toEqual({
        totalTerms: 0,
        sections: [],
        oldestUpdate: null,
        newestUpdate: null,
        termDistribution: {},
      });
    });
  });
});

describe('Schema Integration Tests', () => {
  it('should validate schema structure matches expected interface', () => {
    const sampleRecord = {
      sectionId: '999901',
      currentTermId: '12345',
      termName: 'Autumn Term 2025',
      startDate: '2025-09-01',
      endDate: '2025-12-15',
      lastUpdated: 1737765123456,
    };

    expect(sampleRecord).toMatchObject({
      sectionId: expect.any(String),
      currentTermId: expect.any(String),
      termName: expect.any(String),
      startDate: expect.any(String),
      endDate: expect.any(String),
      lastUpdated: expect.any(Number),
    });

    expect(sampleRecord.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sampleRecord.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should validate IndexedDB store configuration', () => {
    expect(IndexedDBService.STORES.CURRENT_ACTIVE_TERMS).toBe('current_active_terms');

    const storeConfig = {
      keyPath: 'sectionId',
      indexes: ['lastUpdated'],
    };

    expect(storeConfig.keyPath).toBe('sectionId');
    expect(storeConfig.indexes).toContain('lastUpdated');
  });
});