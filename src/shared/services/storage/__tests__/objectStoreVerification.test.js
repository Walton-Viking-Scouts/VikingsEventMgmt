import { describe, it, expect, vi } from 'vitest';
import { IndexedDBService } from '../indexedDBService.js';

// Mock Sentry and Logger
vi.mock('../../utils/sentry.js', () => ({
  sentryUtils: {
    captureException: vi.fn(),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LOG_CATEGORIES: {
    DATABASE: 'DATABASE',
    ERROR: 'ERROR',
  },
}));

// Mock IndexedDB with actual upgrade logic testing
vi.mock('idb', () => ({
  openDB: vi.fn((name, version, config) => {
    // Create a mock DB with store tracking
    const mockDB = {
      name,
      version,
      _stores: new Map(),
      _indexes: new Map(),

      objectStoreNames: {
        contains: function(storeName) {
          return mockDB._stores.has(storeName);
        },
      },

      deleteObjectStore: function(storeName) {
        mockDB._stores.delete(storeName);
      },

      createObjectStore: function(name, options) {
        const store = {
          name,
          options,
          _indexes: new Map(),
          createIndex: function(indexName, keyPath, indexOptions) {
            store._indexes.set(indexName, { keyPath, options: indexOptions });
            // Track globally for test access
            mockDB._indexes.set(`${name}.${indexName}`, { keyPath, options: indexOptions });
          },
        };
        mockDB._stores.set(name, store);
        return store;
      },

      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    // Execute upgrade logic if provided to test actual implementation
    if (config && config.upgrade) {
      try {
        // Simulate upgrade from version 0 (fresh database) to test all stores
        config.upgrade(mockDB, 0, version, {});

        // Store the mock DB globally for test access
        global.__testMockDB = mockDB;
      } catch (error) {
        console.warn('Mock upgrade failed:', error.message);
      }
    }

    return Promise.resolve(mockDB);
  }),
}));

describe('Object Store Creation Verification', () => {
  it('should verify current_active_terms object store is created correctly', async () => {
    // Trigger database initialization to run upgrade logic
    try {
      await IndexedDBService.get(IndexedDBService.STORES.CURRENT_ACTIVE_TERMS, 'test-key');
    } catch (error) {
      // Expected to fail in test environment, but upgrade should have run
    }

    // Access the mock database created during initialization
    const mockDB = global.__testMockDB;
    expect(mockDB).toBeDefined();

    // Verify current_active_terms store was created
    expect(mockDB._stores.has('current_active_terms')).toBe(true);

    const store = mockDB._stores.get('current_active_terms');
    expect(store.name).toBe('current_active_terms');
    expect(store.options.keyPath).toBe('sectionId');

    // Verify lastUpdated index was created
    expect(mockDB._indexes.has('current_active_terms.lastUpdated')).toBe(true);

    const index = mockDB._indexes.get('current_active_terms.lastUpdated');
    expect(index.keyPath).toBe('lastUpdated');
    expect(index.options.unique).toBe(false);
  });

  it('should verify database uses correct name and version', async () => {
    const { openDB } = await import('idb');

    // Trigger database opening
    try {
      await IndexedDBService.get('test_store', 'test_key');
    } catch (error) {
      // Ignore error, we just want to verify openDB was called
    }

    expect(openDB).toHaveBeenCalledWith(
      'vikings-eventmgmt',
      7,
      expect.objectContaining({
        upgrade: expect.any(Function),
      }),
    );
  });

  it('should verify all expected object stores are created', async () => {
    // Trigger database initialization
    try {
      await IndexedDBService.get('cache_data', 'test');
    } catch (error) {
      // Ignore
    }

    const mockDB = global.__testMockDB;
    expect(mockDB).toBeDefined();

    // Verify all expected stores are created
    const expectedStores = [
      'cache_data',
      'sections',
      'startup_data',
      'terms',
      'current_active_terms', // This is our new store
      'flexi_lists',
      'flexi_structure',
      'flexi_data',
      'events',
      'attendance',
      'shared_event_metadata',
      'core_members',
      'member_section',
    ];

    expectedStores.forEach(storeName => {
      expect(mockDB._stores.has(storeName)).toBe(true);
    });

    // Verify our store is specifically present and correctly configured
    const currentActiveTermsStore = mockDB._stores.get('current_active_terms');
    expect(currentActiveTermsStore).toBeDefined();
    expect(currentActiveTermsStore.options.keyPath).toBe('sectionId');
    expect(currentActiveTermsStore._indexes.has('lastUpdated')).toBe(true);
  });

  it('should verify IndexedDBService constants include CURRENT_ACTIVE_TERMS', () => {
    expect(IndexedDBService.STORES.CURRENT_ACTIVE_TERMS).toBe('current_active_terms');

    // Verify it's included in the complete set of store constants
    const expectedStores = [
      'CACHE_DATA',
      'SECTIONS',
      'STARTUP_DATA',
      'TERMS',
      'CURRENT_ACTIVE_TERMS',
      'FLEXI_LISTS',
      'FLEXI_STRUCTURE',
      'FLEXI_DATA',
      'EVENTS',
      'ATTENDANCE',
      'SHARED_EVENT_METADATA',
      'CORE_MEMBERS',
      'MEMBER_SECTION',
    ];

    expectedStores.forEach(storeConstant => {
      expect(IndexedDBService.STORES).toHaveProperty(storeConstant);
    });
  });
});