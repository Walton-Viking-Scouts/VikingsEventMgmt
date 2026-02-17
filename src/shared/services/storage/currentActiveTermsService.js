import { IndexedDBService } from './indexedDBService.js';
import { logger, LOG_CATEGORIES } from '../utils/logger.js';

/* global IDBKeyRange */

export class CurrentActiveTermsService {
  static async getCurrentActiveTerm(sectionId) {
    try {
      // Ensure consistent string typing for database key
      const normalizedSectionId = String(sectionId);

      // Use direct database access since this store uses keyPath: 'sectionId'
      const db = await IndexedDBService.getDB();
      const term = await db.get(IndexedDBService.STORES.CURRENT_ACTIVE_TERMS, normalizedSectionId);


      return term;
    } catch (error) {
      logger.error('Failed to get current active term', {
        sectionId,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      throw error;
    }
  }

  static async setCurrentActiveTerm(sectionId, termData) {
    try {
      const currentActiveTerm = {
        sectionId: String(sectionId),
        currentTermId: String(termData.currentTermId || termData.termid),
        termName: String(termData.termName || termData.name),
        startDate: String(termData.startDate || termData.startdate),
        endDate: String(termData.endDate || termData.enddate),
        lastUpdated: Date.now(),
      };

      // Use direct database access since this store uses keyPath: 'sectionId'
      const db = await IndexedDBService.getDB();
      await db.put(IndexedDBService.STORES.CURRENT_ACTIVE_TERMS, currentActiveTerm);

      // Removed excessive logging per user request

      return true;
    } catch (error) {
      logger.error('Failed to set current active term', {
        sectionId,
        termData,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      throw error;
    }
  }

  static async getAllCurrentActiveTerms() {
    try {
      const db = await IndexedDBService.getDB();

      if (!db) {
        logger.warn('Database not available for getAllCurrentActiveTerms');
        return [];
      }

      const allRecords = await db.getAll(IndexedDBService.STORES.CURRENT_ACTIVE_TERMS);
      const currentActiveTerms = allRecords.map(record => record.data || record);

      // Removed excessive logging per user request

      return currentActiveTerms;
    } catch (error) {
      logger.error('Failed to get all current active terms', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      throw error;
    }
  }

  static async getTermsUpdatedSince(timestamp) {
    try {
      const keyRange = typeof IDBKeyRange !== 'undefined'
        ? IDBKeyRange.lowerBound(timestamp)
        : { lower: timestamp, lowerOpen: false };

      const recentTerms = await IndexedDBService.getByIndex(
        IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
        'lastUpdated',
        keyRange,
      );

      logger.debug('Retrieved terms updated since timestamp', {
        timestamp,
        count: recentTerms.length,
      }, LOG_CATEGORIES.DATABASE);

      return recentTerms;
    } catch (error) {
      logger.error('Failed to get terms updated since timestamp', {
        timestamp,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      throw error;
    }
  }

  static async deleteCurrentActiveTerm(sectionId) {
    try {
      await IndexedDBService.delete(
        IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
        sectionId,
      );

      logger.info('Deleted current active term', {
        sectionId,
      }, LOG_CATEGORIES.DATABASE);

      return true;
    } catch (error) {
      logger.error('Failed to delete current active term', {
        sectionId,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      throw error;
    }
  }

  static async clearAllCurrentActiveTerms() {
    try {
      await IndexedDBService.clear(IndexedDBService.STORES.CURRENT_ACTIVE_TERMS);
      logger.info('Cleared all current active terms', {}, LOG_CATEGORIES.DATABASE);
      return true;
    } catch (error) {
      logger.error('Failed to clear all current active terms', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      throw error;
    }
  }

  static async getStoreStatistics() {
    try {
      const allTerms = await this.getAllCurrentActiveTerms();

      const stats = {
        totalTerms: allTerms.length,
        sections: allTerms.map(term => term.sectionId),
        oldestUpdate: allTerms.length > 0 ? Math.min(...allTerms.map(t => t.lastUpdated)) : null,
        newestUpdate: allTerms.length > 0 ? Math.max(...allTerms.map(t => t.lastUpdated)) : null,
        termDistribution: allTerms.reduce((acc, term) => {
          acc[term.currentTermId] = (acc[term.currentTermId] || 0) + 1;
          return acc;
        }, {}),
      };

      logger.debug('Current active terms statistics', stats, LOG_CATEGORIES.DATABASE);
      return stats;
    } catch (error) {
      logger.error('Failed to get store statistics', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      throw error;
    }
  }
}

export default CurrentActiveTermsService;