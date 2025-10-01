import { safeGetItem, safeSetItem } from '../../utils/storageUtils.js';
import IndexedDBService from './indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

export class UnifiedStorageService {

  static async get(key) {
    if (this.shouldUseIndexedDB(key)) {
      const store = this.getStoreForKey(key);
      if (store) {
        try {
          const data = await IndexedDBService.get(store, key);
          if (data !== null) {
            return data;
          }
        } catch (error) {
          logger.warn('UnifiedStorage: IndexedDB get failed, falling back to localStorage', {
            key,
            store,
            error: error.message,
          }, LOG_CATEGORIES.DATABASE);
          return safeGetItem(key);
        }
      }
    }

    const data = safeGetItem(key);
    logger.debug('UnifiedStorage: Retrieved from localStorage', {
      key,
      hasData: !!data,
    }, LOG_CATEGORIES.DATABASE);

    return data;
  }

  static async set(key, value) {
    if (this.shouldUseIndexedDB(key)) {
      const store = this.getStoreForKey(key);
      if (store) {
        try {
          await IndexedDBService.set(store, key, value, {
            type: this.getTypeForKey(key),
            updatedAt: Date.now(),
          });

          return true;
        } catch (error) {
          logger.warn('UnifiedStorage: IndexedDB set failed, falling back to localStorage', {
            key,
            store,
            error: error.message,
          }, LOG_CATEGORIES.DATABASE);
          return safeSetItem(key, value);
        }
      }
    }

    const success = safeSetItem(key, value);
    logger.debug('UnifiedStorage: Saved to localStorage', {
      key,
      success,
    }, LOG_CATEGORIES.DATABASE);

    return success;
  }

  static async remove(key) {
    let indexedDBSuccess = false;
    let localStorageSuccess = false;

    if (this.shouldUseIndexedDB(key)) {
      const store = this.getStoreForKey(key);
      if (store) {
        try {
          await IndexedDBService.delete(store, key);
          indexedDBSuccess = true;
          logger.debug('UnifiedStorage: Removed from IndexedDB', {
            key,
            store,
          }, LOG_CATEGORIES.DATABASE);
        } catch (error) {
          logger.warn('UnifiedStorage: IndexedDB delete failed', {
            key,
            store,
            error: error.message,
          }, LOG_CATEGORIES.DATABASE);
        }
      }
    }

    try {
      localStorage.removeItem(key);
      localStorageSuccess = true;
      logger.debug('UnifiedStorage: Removed from localStorage', {
        key,
      }, LOG_CATEGORIES.DATABASE);
    } catch (error) {
      logger.error('UnifiedStorage: Failed to remove from localStorage', {
        key,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
    }

    return indexedDBSuccess || localStorageSuccess;
  }

  static shouldUseIndexedDB(key) {
    // Keys that should stay in localStorage
    if (key === 'viking_current_view' || key === 'user_preferences') {
      return false;
    }

    // Non-viking keys stay in localStorage
    if (!key.startsWith('viking_')) {
      return false;
    }

    // All other viking_* keys use IndexedDB
    // (Cache & Sync, Configuration, Flexi System, Events, Members)
    return (
      // Cache & Sync
      key === 'viking_last_sync' ||
      key.startsWith('viking_attendance_cache_time_') ||
      // Configuration
      key === 'viking_sections_offline' ||
      key === 'viking_startup_data_offline' ||
      key === 'viking_terms_offline' ||
      key === 'viking_current_active_terms' ||
      // Flexi System
      key.match(/^viking_flexi_lists_.+_offline$/) ||
      key.match(/^viking_flexi_structure_.+_offline$/) ||
      key.match(/^viking_flexi_data_.+_offline$/) ||
      // Events
      key.match(/^viking_events_.+_offline$/) ||
      key.match(/^viking_attendance_.+_offline$/) ||
      key.match(/^viking_shared_attendance_.+_offline$/) ||
      key.startsWith('viking_shared_metadata_') ||
      // Members
      key === 'viking_members_comprehensive_offline'
    );
  }

  static getStoreForKey(key) {
    // Phase 1: Cache & Sync
    if (key === 'viking_last_sync' ||
        key.startsWith('viking_attendance_cache_time_')) {
      return IndexedDBService.STORES.CACHE_DATA;
    }

    // Phase 2: Configuration
    if (key === 'viking_sections_offline') {
      return IndexedDBService.STORES.SECTIONS;
    }
    if (key === 'viking_startup_data_offline') {
      return IndexedDBService.STORES.STARTUP_DATA;
    }
    if (key === 'viking_terms_offline') {
      return IndexedDBService.STORES.TERMS;
    }
    if (key === 'viking_current_active_terms') {
      return IndexedDBService.STORES.CURRENT_ACTIVE_TERMS;
    }

    // Phase 3: Flexi System
    if (key.match(/^viking_flexi_lists_.+_offline$/)) {
      return IndexedDBService.STORES.FLEXI_LISTS;
    }
    if (key.match(/^viking_flexi_structure_.+_offline$/)) {
      return IndexedDBService.STORES.FLEXI_STRUCTURE;
    }
    if (key.match(/^viking_flexi_data_.+_offline$/)) {
      return IndexedDBService.STORES.FLEXI_DATA;
    }

    // Phase 4: Events
    if (key.match(/^viking_events_.+_offline$/)) {
      return IndexedDBService.STORES.EVENTS;
    }
    if (key.match(/^viking_attendance_.+_offline$/)) {
      return IndexedDBService.STORES.ATTENDANCE;
    }
    if (key.match(/^viking_shared_attendance_.+_offline$/)) {
      return IndexedDBService.STORES.SHARED_ATTENDANCE;
    }
    if (key.startsWith('viking_shared_metadata_')) {
      return IndexedDBService.STORES.SHARED_ATTENDANCE;
    }

    // Phase 5: Members
    if (key === 'viking_members_comprehensive_offline') {
      return IndexedDBService.STORES.MEMBERS;
    }

    return null;
  }

  static getTypeForKey(key) {
    if (key === 'viking_last_sync') return 'sync';
    if (key.startsWith('viking_attendance_cache_time_')) return 'cache';
    if (key.startsWith('viking_shared_metadata_')) return 'metadata';
    if (key.endsWith('_offline')) return 'data';
    return 'unknown';
  }

  // Convenience methods that maintain backward compatibility with existing code
  static async getCacheData(key) {
    return this.get(key);
  }

  static async setCacheData(key, value) {
    return this.set(key, value);
  }

  static async getEvents(sectionId) {
    return this.get(`viking_events_${sectionId}_offline`);
  }

  static async setEvents(sectionId, events) {
    return this.set(`viking_events_${sectionId}_offline`, events);
  }

  static async getAttendance(eventId) {
    return this.get(`viking_attendance_${eventId}_offline`);
  }

  static async setAttendance(eventId, attendance) {
    return this.set(`viking_attendance_${eventId}_offline`, attendance);
  }

  static async getMembers() {
    return this.get('viking_members_comprehensive_offline');
  }

  static async setMembers(members) {
    return this.set('viking_members_comprehensive_offline', members);
  }

  static async getSections() {
    return this.get('viking_sections_offline');
  }

  static async setSections(sections) {
    return this.set('viking_sections_offline', sections);
  }

  static async getFlexiData(recordId, sectionId, termId) {
    return this.get(`viking_flexi_data_${recordId}_${sectionId}_${termId}_offline`);
  }

  static async setFlexiData(recordId, sectionId, termId, data) {
    return this.set(`viking_flexi_data_${recordId}_${sectionId}_${termId}_offline`, data);
  }

  static async getLastSync() {
    return this.get('viking_last_sync');
  }

  static async setLastSync(timestamp) {
    return this.set('viking_last_sync', timestamp);
  }

  // Storage information methods
  static async getStorageReport() {
    try {
      // Count localStorage keys
      const localStorageInfo = {
        totalKeys: localStorage.length,
        vikingKeys: [],
        localStorageVikingKeys: [],
        indexedDBVikingKeys: [],
      };

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('viking_') || key.startsWith('demo_viking_'))) {
          localStorageInfo.vikingKeys.push(key);
          if (this.shouldUseIndexedDB(key)) {
            localStorageInfo.indexedDBVikingKeys.push(key);
          } else {
            localStorageInfo.localStorageVikingKeys.push(key);
          }
        }
      }

      return {
        localStorage: localStorageInfo,
        routing: {
          indexedDBKeys: localStorageInfo.indexedDBVikingKeys.length,
          localStorageKeys: localStorageInfo.localStorageVikingKeys.length,
          totalVikingKeys: localStorageInfo.vikingKeys.length,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to generate storage report', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);

      throw error;
    }
  }
}

export default UnifiedStorageService;