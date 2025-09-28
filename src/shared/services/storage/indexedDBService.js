import { openDB } from 'idb';
import { sentryUtils } from '../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

const DATABASE_NAME = 'vikings-eventmgmt';
const DATABASE_VERSION = 3;

const STORES = {
  CACHE_DATA: 'cache_data',
  SECTIONS: 'sections',
  STARTUP_DATA: 'startup_data',
  TERMS: 'terms',
  CURRENT_ACTIVE_TERMS: 'current_active_terms',
  FLEXI_LISTS: 'flexi_lists',
  FLEXI_STRUCTURE: 'flexi_structure',
  FLEXI_DATA: 'flexi_data',
  EVENTS: 'events',
  ATTENDANCE: 'attendance',
  SHARED_ATTENDANCE: 'shared_attendance',
  MEMBERS: 'members',
};

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(db, oldVersion, newVersion, _transaction) {
        logger.info('IndexedDB upgrade started', {
          dbName: DATABASE_NAME,
          oldVersion,
          newVersion,
        }, LOG_CATEGORIES.DATABASE);

        // Cache & Sync data (Phase 1)
        if (!db.objectStoreNames.contains(STORES.CACHE_DATA)) {
          const cacheStore = db.createObjectStore(STORES.CACHE_DATA, { keyPath: 'key' });
          cacheStore.createIndex('type', 'type', { unique: false });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Configuration data (Phase 2)
        if (!db.objectStoreNames.contains(STORES.SECTIONS)) {
          const sectionsStore = db.createObjectStore(STORES.SECTIONS, { keyPath: 'key' });
          sectionsStore.createIndex('sectionId', 'data.sectionid', { unique: false });
          sectionsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.STARTUP_DATA)) {
          const startupDataStore = db.createObjectStore(STORES.STARTUP_DATA, { keyPath: 'key' });
          startupDataStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.TERMS)) {
          const termsStore = db.createObjectStore(STORES.TERMS, { keyPath: 'key' });
          termsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.CURRENT_ACTIVE_TERMS)) {
          const currentActiveTermsStore = db.createObjectStore(STORES.CURRENT_ACTIVE_TERMS, { keyPath: 'sectionId' });
          currentActiveTermsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        // Flexi system (Phase 3)
        if (!db.objectStoreNames.contains(STORES.FLEXI_LISTS)) {
          const flexiListsStore = db.createObjectStore(STORES.FLEXI_LISTS, { keyPath: 'key' });
          flexiListsStore.createIndex('sectionId', 'sectionId', { unique: false });
        }


        if (!db.objectStoreNames.contains(STORES.FLEXI_STRUCTURE)) {
          const flexiStructureStore = db.createObjectStore(STORES.FLEXI_STRUCTURE, { keyPath: 'key' });
          flexiStructureStore.createIndex('recordId', 'recordId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.FLEXI_DATA)) {
          const flexiDataStore = db.createObjectStore(STORES.FLEXI_DATA, { keyPath: 'key' });
          flexiDataStore.createIndex('recordId', 'recordId', { unique: false });
          flexiDataStore.createIndex('sectionId', 'sectionId', { unique: false });
        }

        // Event system (Phase 4)
        if (!db.objectStoreNames.contains(STORES.EVENTS)) {
          const eventsStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'key' });
          eventsStore.createIndex('sectionId', 'sectionId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.ATTENDANCE)) {
          const attendanceStore = db.createObjectStore(STORES.ATTENDANCE, { keyPath: 'key' });
          attendanceStore.createIndex('eventId', 'eventId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SHARED_ATTENDANCE)) {
          const sharedAttendanceStore = db.createObjectStore(STORES.SHARED_ATTENDANCE, { keyPath: 'key' });
          sharedAttendanceStore.createIndex('eventId', 'eventId', { unique: false });
        }

        // Members (Phase 5)
        if (!db.objectStoreNames.contains(STORES.MEMBERS)) {
          const membersStore = db.createObjectStore(STORES.MEMBERS, { keyPath: 'key' });
          membersStore.createIndex('sectionId', 'sectionId', { unique: false });
        }

        logger.info('IndexedDB upgrade completed', {
          dbName: DATABASE_NAME,
          version: newVersion,
          stores: Array.from(db.objectStoreNames),
        }, LOG_CATEGORIES.DATABASE);
      },
      blocked() {
        logger.warn('IndexedDB opening blocked by another connection', {
          dbName: DATABASE_NAME,
        }, LOG_CATEGORIES.DATABASE);
      },
      blocking() {
        logger.warn('IndexedDB blocking another connection', {
          dbName: DATABASE_NAME,
        }, LOG_CATEGORIES.DATABASE);
      },
      terminated() {
        logger.error('IndexedDB connection terminated unexpectedly', {
          dbName: DATABASE_NAME,
        }, LOG_CATEGORIES.DATABASE);
        dbPromise = null; // Reset so next call reopens
      },
    });
  }
  return dbPromise;
}

export class IndexedDBService {
  static STORES = STORES;

  /**
   * Get the database instance for advanced operations
   * @returns {Promise<IDBDatabase>} Database instance
   */
  static async getDB() {
    return await getDB();
  }

  static async get(storeName, key) {
    try {
      const db = await getDB();
      const result = await db.get(storeName, key);

      if (result) {

        return result.data;
      }

      return null;
    } catch (error) {
      logger.error('IndexedDB get failed', {
        storeName,
        key,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get',
          store: storeName,
        },
        contexts: {
          indexedDB: {
            storeName,
            key,
            operation: 'get',
          },
        },
      });

      throw error;
    }
  }

  static async set(storeName, key, data, metadata = {}) {
    try {
      const db = await getDB();
      const record = {
        key,
        data,
        timestamp: Date.now(),
        _cacheTimestamp: Date.now(),
        ...metadata,
      };

      await db.put(storeName, record);


      return true;
    } catch (error) {
      logger.error('IndexedDB set failed', {
        storeName,
        key,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_set',
          store: storeName,
        },
        contexts: {
          indexedDB: {
            storeName,
            key,
            operation: 'set',
          },
        },
      });

      throw error;
    }
  }

  static async delete(storeName, key) {
    try {
      const db = await getDB();
      await db.delete(storeName, key);


      return true;
    } catch (error) {
      logger.error('IndexedDB delete failed', {
        storeName,
        key,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_delete',
          store: storeName,
        },
        contexts: {
          indexedDB: {
            storeName,
            key,
            operation: 'delete',
          },
        },
      });

      throw error;
    }
  }

  static async clear(storeName) {
    try {
      const db = await getDB();
      await db.clear(storeName);

      logger.info('IndexedDB store cleared', {
        storeName,
      }, LOG_CATEGORIES.DATABASE);

      return true;
    } catch (error) {
      logger.error('IndexedDB clear failed', {
        storeName,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_clear',
          store: storeName,
        },
        contexts: {
          indexedDB: {
            storeName,
            operation: 'clear',
          },
        },
      });

      throw error;
    }
  }

  static async getAllKeys(storeName) {
    try {
      const db = await getDB();
      const keys = await db.getAllKeys(storeName);


      return keys;
    } catch (error) {
      logger.error('IndexedDB getAllKeys failed', {
        storeName,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get_all_keys',
          store: storeName,
        },
        contexts: {
          indexedDB: {
            storeName,
            operation: 'getAllKeys',
          },
        },
      });

      throw error;
    }
  }

  static async getByIndex(storeName, indexName, indexValue) {
    try {
      const db = await getDB();
      const results = (await db.getAllFromIndex(storeName, indexName, indexValue)) || [];
      return results.map(result => result.data);
    } catch (error) {
      logger.error('IndexedDB getByIndex failed', {
        storeName,
        indexName,
        indexValue,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get_by_index',
          store: storeName,
        },
        contexts: {
          indexedDB: {
            storeName,
            indexName,
            indexValue,
            operation: 'getByIndex',
          },
        },
      });

      throw error;
    }
  }

  static async getStoreInfo() {
    try {
      const db = await getDB();
      const storeInfo = {};

      for (const storeName of Object.values(STORES)) {
        if (db.objectStoreNames.contains(storeName)) {
          const keys = await db.getAllKeys(storeName);
          storeInfo[storeName] = {
            exists: true,
            keyCount: keys.length,
            keys: keys.slice(0, 10), // First 10 keys for debugging
          };
        } else {
          storeInfo[storeName] = {
            exists: false,
            keyCount: 0,
            keys: [],
          };
        }
      }

      return storeInfo;
    } catch (error) {
      logger.error('IndexedDB getStoreInfo failed', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      throw error;
    }
  }
}

export { getDB };
export default IndexedDBService;