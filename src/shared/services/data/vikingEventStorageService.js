import indexedDBService from '../storage/indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

/**
 * Viking Event Storage Service
 *
 * Handles all storage operations for Viking Event data including CRUD operations,
 * caching, and data retrieval with various filtering options. This service provides
 * a clean abstraction over the underlying IndexedDB storage layer.
 *
 * @example
 * import vikingEventStorageService from './vikingEventStorageService.js';
 *
 * await vikingEventStorageService.saveVikingEventData(mappedData);
 * const memberData = await vikingEventStorageService.getVikingEventDataByMemberId(123);
 * const campMembers = await vikingEventStorageService.getCampGroupMembers('Blue Group');
 */
class VikingEventStorageService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Saves Viking Event data to storage
   *
   * @param {Object} mappedData - Viking Event data object to save
   * @param {number} mappedData.member_id - Member ID
   * @param {number} mappedData.section_id - Section ID
   * @param {number} mappedData.flexirecord_id - FlexiRecord ID
   * @param {string} [mappedData.camp_group] - Camp group name
   * @returns {Promise<Object>} Save operation result
   * @throws {Error} If save operation fails
   */
  async saveVikingEventData(mappedData) {
    try {
      const result = await indexedDBService.saveVikingEventData(mappedData);

      this.invalidateCache();

      logger.info('Saved Viking Event data', {
        memberId: mappedData.member_id,
        sectionId: mappedData.section_id,
        flexiRecordId: mappedData.flexirecord_id,
        campGroup: mappedData.camp_group,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to save Viking Event data', {
        error: err,
        memberId: mappedData?.member_id,
        sectionId: mappedData?.section_id,
        flexiRecordId: mappedData?.flexirecord_id,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Retrieves all Viking Event data for a specific member
   *
   * @param {number} memberId - The member ID to retrieve data for
   * @returns {Promise<Array>} Array of Viking Event records for the member
   * @throws {Error} If retrieval operation fails
   *
   * @example
   * const memberRecords = await service.getVikingEventDataByMemberId(123);
   */
  async getVikingEventDataByMemberId(memberId) {
    try {
      const cacheKey = `member_${memberId}`;
      if (this.cache.has(cacheKey)) {
        logger.debug('Retrieved Viking Event data from cache', {
          memberId,
          recordCount: this.cache.get(cacheKey).length,
        }, LOG_CATEGORIES.DATA_SERVICE);
        return this.cache.get(cacheKey);
      }

      const result = await indexedDBService.getVikingEventDataByMemberId(memberId);
      this.cache.set(cacheKey, result);

      logger.debug('Retrieved Viking Event data by member ID', {
        memberId,
        recordCount: result.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to retrieve Viking Event data by member ID', {
        error: err,
        memberId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Retrieves all Viking Event data for a specific camp group
   *
   * @param {string} campGroup - The camp group name to retrieve data for
   * @returns {Promise<Array>} Array of Viking Event records for the camp group
   * @throws {Error} If retrieval operation fails
   *
   * @example
   * const groupRecords = await service.getVikingEventDataByCampGroup('Blue Group');
   */
  async getVikingEventDataByCampGroup(campGroup) {
    try {
      const cacheKey = `camp_${campGroup}`;
      if (this.cache.has(cacheKey)) {
        logger.debug('Retrieved Viking Event data from cache', {
          campGroup,
          recordCount: this.cache.get(cacheKey).length,
        }, LOG_CATEGORIES.DATA_SERVICE);
        return this.cache.get(cacheKey);
      }

      const result = await indexedDBService.getVikingEventDataByCampGroup(campGroup);
      this.cache.set(cacheKey, result);

      logger.debug('Retrieved Viking Event data by camp group', {
        campGroup,
        recordCount: result.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to retrieve Viking Event data by camp group', {
        error: err,
        campGroup,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Retrieves all Viking Event data from storage
   *
   * @returns {Promise<Array>} Array of all Viking Event records
   * @throws {Error} If retrieval operation fails
   */
  async getAllVikingEventData() {
    try {
      const cacheKey = 'all_data';
      if (this.cache.has(cacheKey)) {
        logger.debug('Retrieved all Viking Event data from cache', {
          recordCount: this.cache.get(cacheKey).length,
        }, LOG_CATEGORIES.DATA_SERVICE);
        return this.cache.get(cacheKey);
      }

      const result = await indexedDBService.getAllVikingEventData();
      this.cache.set(cacheKey, result);

      logger.debug('Retrieved all Viking Event data', {
        recordCount: result.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to retrieve all Viking Event data', {
        error: err,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Gets all unique camp groups that a member has been associated with
   *
   * @param {number} memberId - The member ID to get camp groups for
   * @returns {Promise<string[]>} Array of unique camp group names
   * @throws {Error} If retrieval operation fails
   */
  async getMemberCampGroups(memberId) {
    try {
      const memberData = await this.getVikingEventDataByMemberId(memberId);
      const campGroups = [...new Set(memberData
        .map(record => record.camp_group)
        .filter(group => group),
      )];

      logger.debug('Retrieved member camp groups', {
        memberId,
        campGroups: campGroups.length,
        uniqueCampGroups: campGroups,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return campGroups;
    } catch (err) {
      logger.error('Failed to retrieve member camp groups', {
        error: err,
        memberId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Gets all unique member IDs that have been in a specific camp group
   *
   * @param {string} campGroup - The camp group name to get members for
   * @returns {Promise<number[]>} Array of unique member IDs
   * @throws {Error} If retrieval operation fails
   */
  async getCampGroupMembers(campGroup) {
    try {
      const campData = await this.getVikingEventDataByCampGroup(campGroup);
      const memberIds = [...new Set(campData
        .map(record => record.member_id)
        .filter(id => id),
      )];

      logger.debug('Retrieved camp group members', {
        campGroup,
        memberCount: memberIds.length,
        uniqueMembers: memberIds,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return memberIds;
    } catch (err) {
      logger.error('Failed to retrieve camp group members', {
        error: err,
        campGroup,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Updates Viking Event data based on criteria
   *
   * @param {Object} criteria - Update criteria to match records
   * @param {Object} updateData - Data to update matching records with
   * @returns {Promise<Object>} Update operation result with count
   * @throws {Error} If update operation fails
   */
  async updateVikingEventData(criteria, updateData) {
    try {
      const result = await indexedDBService.updateVikingEventData(criteria, updateData);

      this.invalidateCache();

      logger.info('Updated Viking Event data', {
        criteria,
        updatedCount: result.updatedCount || 'unknown',
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to update Viking Event data', {
        error: err,
        criteria,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Deletes Viking Event data based on criteria
   *
   * @param {Object} criteria - Delete criteria to match records
   * @returns {Promise<Object>} Delete operation result with count
   * @throws {Error} If delete operation fails
   */
  async deleteVikingEventData(criteria) {
    try {
      const result = await indexedDBService.deleteVikingEventData(criteria);

      this.invalidateCache();

      logger.info('Deleted Viking Event data', {
        criteria,
        deletedCount: result.deletedCount || 'unknown',
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to delete Viking Event data', {
        error: err,
        criteria,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Clears all cached data
   */
  invalidateCache() {
    this.cache.clear();
    logger.debug('Cleared Viking Event storage cache', {}, LOG_CATEGORIES.DATA_SERVICE);
  }

  /**
   * Invalidates cache entries related to a specific member
   *
   * @param {number} memberId - Member ID to invalidate cache for
   */
  invalidateCacheForMember(memberId) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key === `member_${memberId}` || key === 'all_data') {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    logger.debug('Invalidated cache for member', {
      memberId,
      clearedKeys: keysToDelete.length,
    }, LOG_CATEGORIES.DATA_SERVICE);
  }

  /**
   * Invalidates cache entries related to a specific camp group
   *
   * @param {string} campGroup - Camp group to invalidate cache for
   */
  invalidateCacheForCampGroup(campGroup) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key === `camp_${campGroup}` || key === 'all_data') {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    logger.debug('Invalidated cache for camp group', {
      campGroup,
      clearedKeys: keysToDelete.length,
    }, LOG_CATEGORIES.DATA_SERVICE);
  }

  /**
   * Gets cache statistics for debugging and monitoring
   *
   * @returns {Object} Cache statistics including entry count and keys
   */
  getCacheStats() {
    const stats = {
      totalCacheEntries: this.cache.size,
      cacheKeys: Array.from(this.cache.keys()),
    };

    logger.debug('Viking Event storage cache stats', stats, LOG_CATEGORIES.DATA_SERVICE);
    return stats;
  }
}

export default new VikingEventStorageService();