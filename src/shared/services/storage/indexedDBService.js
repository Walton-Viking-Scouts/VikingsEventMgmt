import { openDB } from 'idb';
import { sentryUtils } from '../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { isDemoMode } from '../../../config/demoMode.js';

const getDatabaseName = () => isDemoMode() ? 'vikings-eventmgmt-demo' : 'vikings-eventmgmt';
const DATABASE_VERSION = 5;

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
  CORE_MEMBERS: 'core_members',
  MEMBER_SECTION: 'member_section',
};

let dbPromise = null;
let currentDatabaseName = null;

function getDB() {
  const dbName = getDatabaseName();

  if (currentDatabaseName && currentDatabaseName !== dbName) {
    dbPromise = null;
    currentDatabaseName = null;
  }

  if (!dbPromise) {
    currentDatabaseName = dbName;
    dbPromise = openDB(dbName, DATABASE_VERSION, {
      upgrade(db, oldVersion, newVersion, _transaction) {
        logger.info('IndexedDB upgrade started', {
          dbName,
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

        // Core Members & Member-Section (Phase 5 - Dual Store Architecture)
        if (!db.objectStoreNames.contains(STORES.CORE_MEMBERS)) {
          const coreMembersStore = db.createObjectStore(STORES.CORE_MEMBERS, { keyPath: 'scoutid' });
          coreMembersStore.createIndex('lastname', 'lastname', { unique: false });
          coreMembersStore.createIndex('firstname', 'firstname', { unique: false });
          coreMembersStore.createIndex('updated_at', 'updated_at', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.MEMBER_SECTION)) {
          const memberSectionStore = db.createObjectStore(STORES.MEMBER_SECTION, { keyPath: ['scoutid', 'sectionid'] });
          memberSectionStore.createIndex('scoutid', 'scoutid', { unique: false });
          memberSectionStore.createIndex('sectionid', 'sectionid', { unique: false });
          memberSectionStore.createIndex('person_type', 'person_type', { unique: false });
        }

        if (oldVersion < 5) {
          logger.info('IndexedDB v5 upgrade: schema infrastructure for data normalization', {
            dbName,
          }, LOG_CATEGORIES.DATABASE);
        }

        logger.info('IndexedDB upgrade completed', {
          dbName,
          version: newVersion,
          stores: Array.from(db.objectStoreNames),
        }, LOG_CATEGORIES.DATABASE);
      },
      blocked() {
        logger.warn('IndexedDB opening blocked by another connection', {
          dbName,
        }, LOG_CATEGORIES.DATABASE);
      },
      blocking() {
        logger.warn('IndexedDB blocking another connection', {
          dbName,
        }, LOG_CATEGORIES.DATABASE);
      },
      terminated() {
        logger.error('IndexedDB connection terminated unexpectedly', {
          dbName,
        }, LOG_CATEGORIES.DATABASE);
        dbPromise = null;
        currentDatabaseName = null;
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

  static async upsertCoreMember(memberData) {
    try {
      if (!memberData?.scoutid) {
        throw new Error('scoutid is required for core member');
      }

      const db = await getDB();
      const tx = db.transaction(STORES.CORE_MEMBERS, 'readwrite');
      const store = tx.objectStore(STORES.CORE_MEMBERS);

      const existing = await store.get(memberData.scoutid) || {};
      const merged = {
        ...existing,
        ...memberData,
        updated_at: Date.now(),
      };

      await store.put(merged);
      await tx.done;

      return merged;
    } catch (error) {
      logger.error('IndexedDB upsertCoreMember failed', {
        scoutid: memberData?.scoutid,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_upsert_core_member',
          store: STORES.CORE_MEMBERS,
        },
        contexts: {
          indexedDB: {
            scoutid: memberData?.scoutid,
            operation: 'upsertCoreMember',
          },
        },
      });

      throw error;
    }
  }

  static async getCoreMember(scoutid) {
    try {
      const db = await getDB();
      const result = await db.get(STORES.CORE_MEMBERS, scoutid);

      return result || null;
    } catch (error) {
      logger.error('IndexedDB getCoreMember failed', {
        scoutid,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get_core_member',
          store: STORES.CORE_MEMBERS,
        },
        contexts: {
          indexedDB: {
            scoutid,
            operation: 'getCoreMember',
          },
        },
      });

      throw error;
    }
  }

  static async getAllCoreMembers() {
    try {
      const db = await getDB();
      const results = await db.getAll(STORES.CORE_MEMBERS);

      return results || [];
    } catch (error) {
      logger.error('IndexedDB getAllCoreMembers failed', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get_all_core_members',
          store: STORES.CORE_MEMBERS,
        },
        contexts: {
          indexedDB: {
            operation: 'getAllCoreMembers',
          },
        },
      });

      throw error;
    }
  }

  static async deleteCoreMember(scoutid) {
    try {
      const db = await getDB();
      await db.delete(STORES.CORE_MEMBERS, scoutid);

      return true;
    } catch (error) {
      logger.error('IndexedDB deleteCoreMember failed', {
        scoutid,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_delete_core_member',
          store: STORES.CORE_MEMBERS,
        },
        contexts: {
          indexedDB: {
            scoutid,
            operation: 'deleteCoreMember',
          },
        },
      });

      throw error;
    }
  }

  static async bulkUpsertCoreMembers(members) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORES.CORE_MEMBERS, 'readwrite');
      const store = tx.objectStore(STORES.CORE_MEMBERS);

      const timestamp = Date.now();

      for (const memberData of members) {
        if (!memberData?.scoutid) {
          throw new Error('scoutid is required for core member');
        }
        const existing = await store.get(memberData.scoutid) || {};
        const merged = {
          ...existing,
          ...memberData,
          updated_at: timestamp,
        };
        await store.put(merged);
      }

      await tx.done;

      return members.length;
    } catch (error) {
      logger.error('IndexedDB bulkUpsertCoreMembers failed', {
        count: members?.length,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_bulk_upsert_core_members',
          store: STORES.CORE_MEMBERS,
        },
        contexts: {
          indexedDB: {
            count: members?.length,
            operation: 'bulkUpsertCoreMembers',
          },
        },
      });

      throw error;
    }
  }

  static async upsertMemberSection(sectionData) {
    try {
      if (!sectionData?.scoutid || !sectionData?.sectionid) {
        throw new Error('scoutid and sectionid are required for member section');
      }

      const db = await getDB();
      const record = {
        ...sectionData,
        updated_at: Date.now(),
      };

      await db.put(STORES.MEMBER_SECTION, record);

      return record;
    } catch (error) {
      logger.error('IndexedDB upsertMemberSection failed', {
        scoutid: sectionData?.scoutid,
        sectionid: sectionData?.sectionid,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_upsert_member_section',
          store: STORES.MEMBER_SECTION,
        },
        contexts: {
          indexedDB: {
            scoutid: sectionData?.scoutid,
            sectionid: sectionData?.sectionid,
            operation: 'upsertMemberSection',
          },
        },
      });

      throw error;
    }
  }

  static async getMemberSection(scoutid, sectionid) {
    try {
      const db = await getDB();
      const result = await db.get(STORES.MEMBER_SECTION, [scoutid, sectionid]);

      return result || null;
    } catch (error) {
      logger.error('IndexedDB getMemberSection failed', {
        scoutid,
        sectionid,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get_member_section',
          store: STORES.MEMBER_SECTION,
        },
        contexts: {
          indexedDB: {
            scoutid,
            sectionid,
            operation: 'getMemberSection',
          },
        },
      });

      throw error;
    }
  }

  static async getMemberSectionsByScout(scoutid) {
    try {
      const db = await getDB();
      const results = await db.getAllFromIndex(STORES.MEMBER_SECTION, 'scoutid', scoutid);

      return results || [];
    } catch (error) {
      logger.error('IndexedDB getMemberSectionsByScout failed', {
        scoutid,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get_member_sections_by_scout',
          store: STORES.MEMBER_SECTION,
        },
        contexts: {
          indexedDB: {
            scoutid,
            operation: 'getMemberSectionsByScout',
          },
        },
      });

      throw error;
    }
  }

  static async getMemberSectionsBySection(sectionid) {
    try {
      const db = await getDB();
      const results = await db.getAllFromIndex(STORES.MEMBER_SECTION, 'sectionid', sectionid);

      return results || [];
    } catch (error) {
      logger.error('IndexedDB getMemberSectionsBySection failed', {
        sectionid,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get_member_sections_by_section',
          store: STORES.MEMBER_SECTION,
        },
        contexts: {
          indexedDB: {
            sectionid,
            operation: 'getMemberSectionsBySection',
          },
        },
      });

      throw error;
    }
  }

  static async deleteMemberSection(scoutid, sectionid) {
    try {
      const db = await getDB();
      await db.delete(STORES.MEMBER_SECTION, [scoutid, sectionid]);

      return true;
    } catch (error) {
      logger.error('IndexedDB deleteMemberSection failed', {
        scoutid,
        sectionid,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_delete_member_section',
          store: STORES.MEMBER_SECTION,
        },
        contexts: {
          indexedDB: {
            scoutid,
            sectionid,
            operation: 'deleteMemberSection',
          },
        },
      });

      throw error;
    }
  }

  static async bulkUpsertMemberSections(sections) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORES.MEMBER_SECTION, 'readwrite');
      const store = tx.objectStore(STORES.MEMBER_SECTION);

      const timestamp = Date.now();

      for (const sectionData of sections) {
        if (!sectionData?.scoutid || !sectionData?.sectionid) {
          throw new Error('scoutid and sectionid are required for member section');
        }
        const record = {
          ...sectionData,
          updated_at: timestamp,
        };
        await store.put(record);
      }

      await tx.done;

      return sections.length;
    } catch (error) {
      logger.error('IndexedDB bulkUpsertMemberSections failed', {
        count: sections?.length,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_bulk_upsert_member_sections',
          store: STORES.MEMBER_SECTION,
        },
        contexts: {
          indexedDB: {
            count: sections?.length,
            operation: 'bulkUpsertMemberSections',
          },
        },
      });

      throw error;
    }
  }

  static async bulkGetCoreMembers(scoutids) {
    try {
      if (!Array.isArray(scoutids) || scoutids.length === 0) {
        return [];
      }

      const db = await getDB();
      const results = await Promise.all(
        scoutids.map(scoutid => db.get(STORES.CORE_MEMBERS, scoutid)),
      );

      return results.filter(result => result !== undefined);
    } catch (error) {
      logger.error('IndexedDB bulkGetCoreMembers failed', {
        count: scoutids?.length,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_bulk_get_core_members',
          store: STORES.CORE_MEMBERS,
        },
        contexts: {
          indexedDB: {
            count: scoutids?.length,
            operation: 'bulkGetCoreMembers',
          },
        },
      });

      throw error;
    }
  }

  static async getMemberSectionsByScoutIds(scoutids, sectionid) {
    try {
      if (!Array.isArray(scoutids) || scoutids.length === 0) {
        return [];
      }

      const db = await getDB();
      const results = await Promise.all(
        scoutids.map(scoutid => db.get(STORES.MEMBER_SECTION, [scoutid, sectionid])),
      );

      return results.filter(result => result !== undefined);
    } catch (error) {
      logger.error('IndexedDB getMemberSectionsByScoutIds failed', {
        count: scoutids?.length,
        sectionid,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get_member_sections_by_scout_ids',
          store: STORES.MEMBER_SECTION,
        },
        contexts: {
          indexedDB: {
            count: scoutids?.length,
            sectionid,
            operation: 'getMemberSectionsByScoutIds',
          },
        },
      });

      throw error;
    }
  }

  static async getAllMemberSectionsForScouts(scoutids) {
    try {
      if (!Array.isArray(scoutids) || scoutids.length === 0) {
        return [];
      }

      const db = await getDB();
      const tx = db.transaction(STORES.MEMBER_SECTION, 'readonly');
      const store = tx.objectStore(STORES.MEMBER_SECTION);
      const index = store.index('scoutid');

      const allSections = [];
      for (const scoutid of scoutids) {
        const sections = await index.getAll(scoutid);
        allSections.push(...sections);
      }

      await tx.done;
      return allSections;
    } catch (error) {
      logger.error('IndexedDB getAllMemberSectionsForScouts failed', {
        count: scoutids?.length,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'indexeddb_get_all_member_sections_for_scouts',
          store: STORES.MEMBER_SECTION,
        },
        contexts: {
          indexedDB: {
            count: scoutids?.length,
            operation: 'getAllMemberSectionsForScouts',
          },
        },
      });

      throw error;
    }
  }
}

export { getDB };
export default IndexedDBService;