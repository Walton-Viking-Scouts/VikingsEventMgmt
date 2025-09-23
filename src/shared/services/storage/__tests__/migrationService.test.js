import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MigrationService from '../migrationService.js';
import IndexedDBService from '../indexedDBService.js';
import { safeGetItem, safeSetItem } from '../../../utils/storageUtils.js';

// Mock the dependencies
vi.mock('../indexedDBService.js');
vi.mock('../../../utils/storageUtils.js');

// Mock localStorage
const localStorageMock = {
  length: 0,
  key: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('MigrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getMigrationStatus', () => {
    it('should return default status when no migration status exists', async () => {
      safeGetItem.mockReturnValue(null);

      const status = await MigrationService.getMigrationStatus();

      expect(status).toBeDefined();
      expect(status).not.toBeNull();
      expect(status[MigrationService.PHASES.PHASE_1_CACHE]).toBe('pending');
      expect(status.lastUpdated).toBeNull();
    });

    it('should return existing migration status', async () => {
      const mockStatus = {
        [MigrationService.PHASES.PHASE_1_CACHE]: 'completed',
        lastUpdated: Date.now(),
      };
      safeGetItem.mockReturnValue(mockStatus);

      const status = await MigrationService.getMigrationStatus();

      expect(status).toEqual(mockStatus);
    });
  });

  describe('scanLocalStorageForPhase', () => {
    it('should find Phase 1 cache keys', async () => {
      // Mock localStorage content
      localStorageMock.length = 3;
      localStorageMock.key
        .mockReturnValueOnce('viking_last_sync')
        .mockReturnValueOnce('viking_attendance_cache_time_123')
        .mockReturnValueOnce('some_other_key');

      safeGetItem.mockImplementation((key) => {
        if (key === 'viking_last_sync') {
          return '1234567890';
        }
        if (key === 'viking_attendance_cache_time_123') {
          return '987654321';
        }
        return null;
      });

      const results = await MigrationService.scanLocalStorageForPhase(
        MigrationService.PHASES.PHASE_1_CACHE,
      );

      expect(results).toHaveLength(2);
      expect(results[0].key).toBe('viking_last_sync');
      expect(results[0].store).toBe(IndexedDBService.STORES.CACHE_DATA);
      expect(results[1].key).toBe('viking_attendance_cache_time_123');
    });

    it('should find Phase 2 configuration keys', async () => {
      localStorageMock.length = 2;
      localStorageMock.key
        .mockReturnValueOnce('viking_sections_offline')
        .mockReturnValueOnce('viking_terms_offline');

      safeGetItem
        .mockImplementation((key) => {
          if (key === 'viking_sections_offline') {
            return [{ sectionid: 123, name: 'Test Section' }];
          }
          if (key === 'viking_terms_offline') {
            return { terms: 'test terms' };
          }
          return null;
        });

      const results = await MigrationService.scanLocalStorageForPhase(
        MigrationService.PHASES.PHASE_2_CONFIG,
      );

      expect(results).toHaveLength(2);

      const storeTypes = results.map(r => r.store);
      expect(storeTypes).toContain(IndexedDBService.STORES.SECTIONS);
      expect(storeTypes).toContain(IndexedDBService.STORES.TERMS);
    });

    it('should extract IDs from complex keys', async () => {
      localStorageMock.length = 1;
      localStorageMock.key.mockReturnValueOnce('viking_events_12345_offline');

      safeGetItem.mockImplementation((key) => {
        if (key === 'viking_events_12345_offline') {
          return [{ eventid: '999', name: 'Test Event' }];
        }
        return null;
      });

      const results = await MigrationService.scanLocalStorageForPhase(
        MigrationService.PHASES.PHASE_4_EVENTS,
      );

      expect(results).toHaveLength(1);
      expect(results[0].extractedIds).toEqual(['12345']);
    });
  });

  describe('migratePhase', () => {
    it('should successfully migrate Phase 1 data', async () => {
      // Mock localStorage scan
      localStorageMock.length = 1;
      localStorageMock.key.mockReturnValueOnce('viking_last_sync');

      safeGetItem.mockImplementation((key) => {
        if (key === 'viking_migration_status') {
          return null; // Default status
        }
        if (key === 'viking_last_sync') {
          return '1234567890';
        }
        return null;
      });

      // Mock IndexedDB success
      IndexedDBService.set.mockResolvedValue(true);

      // Mock status updates
      safeSetItem.mockReturnValue(true);

      const result = await MigrationService.migratePhase(
        MigrationService.PHASES.PHASE_1_CACHE,
      );

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(IndexedDBService.set).toHaveBeenCalledWith(
        IndexedDBService.STORES.CACHE_DATA,
        'viking_last_sync',
        '1234567890',
        expect.objectContaining({
          originalKey: 'viking_last_sync',
          type: 'sync',
          phase: MigrationService.PHASES.PHASE_1_CACHE,
        }),
      );
    });

    it('should handle migration errors gracefully', async () => {
      localStorageMock.length = 1;
      localStorageMock.key.mockReturnValueOnce('viking_last_sync');

      safeGetItem.mockImplementation((key) => {
        if (key === 'viking_migration_status') {
          return null; // Default status
        }
        if (key === 'viking_last_sync') {
          return '1234567890';
        }
        return null;
      });

      // Mock IndexedDB failure
      IndexedDBService.set.mockRejectedValue(new Error('IndexedDB error'));
      safeSetItem.mockReturnValue(true);

      const result = await MigrationService.migratePhase(
        MigrationService.PHASES.PHASE_1_CACHE,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('IndexedDB error');
    });

    it('should set correct status when no keys found', async () => {
      localStorageMock.length = 0;

      safeGetItem.mockImplementation((key) => {
        if (key === 'viking_migration_status') {
          return null; // Default status
        }
        return null;
      });

      safeSetItem.mockReturnValue(true);

      const result = await MigrationService.migratePhase(
        MigrationService.PHASES.PHASE_1_CACHE,
      );

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0);
    });
  });

  describe('cleanupLocalStorageForPhase', () => {
    it('should cleanup localStorage after successful migration', async () => {
      // Mock localStorage scan
      localStorageMock.length = 1;
      localStorageMock.key.mockReturnValueOnce('viking_last_sync');

      // Mock safeGetItem to handle different keys
      safeGetItem.mockImplementation((key) => {
        if (key === 'viking_migration_status') {
          return {
            [MigrationService.PHASES.PHASE_1_CACHE]: 'completed',
          };
        }
        if (key === 'viking_last_sync') {
          return '1234567890';
        }
        return null;
      });

      // Mock IndexedDB has the data
      IndexedDBService.get.mockResolvedValue('1234567890');

      const result = await MigrationService.cleanupLocalStorageForPhase(
        MigrationService.PHASES.PHASE_1_CACHE,
      );

      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(1);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('viking_last_sync');
    });

    it('should not cleanup if migration not completed', async () => {
      safeGetItem.mockImplementation((key) => {
        if (key === 'viking_migration_status') {
          return {
            [MigrationService.PHASES.PHASE_1_CACHE]: 'pending',
          };
        }
        return null;
      });

      await expect(
        MigrationService.cleanupLocalStorageForPhase(MigrationService.PHASES.PHASE_1_CACHE),
      ).rejects.toThrow('Cannot cleanup localStorage');
    });

    it('should skip cleanup if data not found in IndexedDB', async () => {
      localStorageMock.length = 1;
      localStorageMock.key.mockReturnValueOnce('viking_last_sync');

      safeGetItem.mockImplementation((key) => {
        if (key === 'viking_migration_status') {
          return {
            [MigrationService.PHASES.PHASE_1_CACHE]: 'completed',
          };
        }
        if (key === 'viking_last_sync') {
          return '1234567890';
        }
        return null;
      });

      // Mock IndexedDB doesn't have the data
      IndexedDBService.get.mockResolvedValue(null);

      const result = await MigrationService.cleanupLocalStorageForPhase(
        MigrationService.PHASES.PHASE_1_CACHE,
      );

      expect(result.cleanedCount).toBe(0);
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('rollbackPhase', () => {
    it('should rollback migration successfully', async () => {
      // Mock IndexedDB data
      IndexedDBService.getAllKeys.mockResolvedValue(['viking_last_sync']);
      IndexedDBService.get.mockResolvedValue({
        data: '1234567890',
        phase: MigrationService.PHASES.PHASE_1_CACHE,
      });
      IndexedDBService.delete.mockResolvedValue(true);

      // Mock localStorage restore
      safeSetItem.mockReturnValue(true);

      const result = await MigrationService.rollbackPhase(
        MigrationService.PHASES.PHASE_1_CACHE,
      );

      expect(result.success).toBe(true);
      expect(result.rolledBackCount).toBe(1);
      expect(safeSetItem).toHaveBeenCalledWith('viking_last_sync', {
        data: '1234567890',
        phase: MigrationService.PHASES.PHASE_1_CACHE,
      });
      expect(IndexedDBService.delete).toHaveBeenCalledWith(
        IndexedDBService.STORES.CACHE_DATA,
        'viking_last_sync',
      );
    });
  });
});