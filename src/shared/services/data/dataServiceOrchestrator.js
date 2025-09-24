import flexiRecordStructureService from './flexiRecordStructureService.js';
import dataTransformationService from './dataTransformationService.js';
import vikingEventStorageService from './vikingEventStorageService.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

/**
 * Data Service Orchestrator
 *
 * Coordinates operations between FlexiRecord structure, data transformation,
 * and Viking Event storage services. This orchestrator implements the dependency
 * injection pattern and provides high-level operations that require coordination
 * between multiple services.
 *
 * @example
 * import dataServiceOrchestrator from './dataServiceOrchestrator.js';
 *
 * const isVikingEvent = await dataServiceOrchestrator.isVikingEventManagementFlexiRecord(123);
 * const result = await dataServiceOrchestrator.processVikingEventFlexiRecordData(items, sectionId, flexiRecordId);
 * const history = await dataServiceOrchestrator.generateSignInOutHistory(memberId);
 */
class DataServiceOrchestrator {
  /**
   * Creates a new DataServiceOrchestrator instance
   *
   * @param {Object} [structureService=flexiRecordStructureService] - FlexiRecord structure service instance
   * @param {Object} [transformationService=dataTransformationService] - Data transformation service instance
   * @param {Object} [storageService=vikingEventStorageService] - Viking Event storage service instance
   */
  constructor(
    structureService = flexiRecordStructureService,
    transformationService = dataTransformationService,
    storageService = vikingEventStorageService,
  ) {
    this.structureService = structureService;
    this.transformationService = transformationService;
    this.storageService = storageService;
    this.VIKING_EVENT_STRUCTURE_NAME = 'Viking Event Mgmt';
  }

  /**
   * Checks if a FlexiRecord is a Viking Event Management record
   *
   * @param {number} flexiRecordId - The FlexiRecord ID to check
   * @returns {Promise<boolean>} True if the FlexiRecord is a Viking Event Management record
   *
   * @example
   * const isVikingEvent = await orchestrator.isVikingEventManagementFlexiRecord(123);
   */
  async isVikingEventManagementFlexiRecord(flexiRecordId) {
    try {
      logger.debug('Checking if FlexiRecord is Viking Event Mgmt', { flexiRecordId });

      const isVikingEvent = await this.structureService.isStructureOfType(
        flexiRecordId,
        this.VIKING_EVENT_STRUCTURE_NAME,
      );

      logger.debug('Structure check result', {
        flexiRecordId,
        isVikingEvent,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return isVikingEvent;
    } catch (err) {
      logger.error('Failed to check if FlexiRecord is Viking Event Mgmt', {
        error: err,
        flexiRecordId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return false;
    }
  }

  /**
   * Retrieves the Viking Event Management FlexiRecord structure
   *
   * @returns {Promise<Object|null>} The Viking Event structure object, or null if not found
   * @throws {Error} If retrieval operation fails
   */
  async getVikingEventStructure() {
    try {
      const structure = await this.structureService.getStructureByName(this.VIKING_EVENT_STRUCTURE_NAME);

      if (!structure) {
        logger.warn('Viking Event Mgmt structure not found', {}, LOG_CATEGORIES.DATA_SERVICE);
        return null;
      }

      logger.debug('Retrieved Viking Event structure', {
        structureId: structure.flexirecord_id,
        structureName: structure.name,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return structure;
    } catch (err) {
      logger.error('Failed to retrieve Viking Event structure', {
        error: err,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Gets field mappings for Viking Event Management FlexiRecord
   *
   * @returns {Promise<Object>} Field mapping object (flexiField -> vikingField)
   * @throws {Error} If field mapping generation fails
   */
  async getVikingEventFieldMappings() {
    try {
      const structure = await this.getVikingEventStructure();

      if (!structure) {
        logger.warn('No Viking Event structure found for field mapping', {}, LOG_CATEGORIES.DATA_SERVICE);
        return {};
      }

      const fieldMappings = await this.structureService.generateFieldMapping(structure);

      logger.debug('Generated Viking Event field mappings', {
        mappingCount: Object.keys(fieldMappings).length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return fieldMappings;
    } catch (err) {
      logger.error('Failed to get Viking Event field mappings', {
        error: err,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Processes and stores Viking Event FlexiRecord data from API
   *
   * @param {Array} apiItems - Array of FlexiRecord data items from API
   * @param {number} sectionId - Section ID for the records
   * @param {number} flexiRecordId - FlexiRecord ID
   * @returns {Promise<Object>} Processing result with success status, saved count, and total items
   * @throws {Error} If processing fails
   *
   * @example
   * const result = await orchestrator.processVikingEventFlexiRecordData(
   *   apiItems, 789, 123
   * );
   * // Returns: { success: true, savedCount: 25, totalItems: 30 }
   */
  async processVikingEventFlexiRecordData(apiItems, sectionId, flexiRecordId) {
    try {
      let savedCount = 0;
      const fieldMappings = await this.getVikingEventFieldMappings();

      for (const item of apiItems) {
        try {
          const mappedData = await this.transformationService.mapFlexiRecordToVikingEventData(
            item,
            sectionId,
            flexiRecordId,
            fieldMappings,
          );

          await this.storageService.saveVikingEventData(mappedData);
          savedCount++;
        } catch (err) {
          logger.error('Failed to process Viking Event data item', {
            error: err,
            flexiRecordId,
            sectionId,
            memberId: item.scoutid || item.member_id,
          }, LOG_CATEGORIES.DATA_SERVICE);
        }
      }

      logger.info('Processed Viking Event FlexiRecord data', {
        flexiRecordId,
        sectionId,
        savedCount,
        totalItems: apiItems.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return { success: true, savedCount, totalItems: apiItems.length };
    } catch (err) {
      logger.error('Failed to process Viking Event FlexiRecord data', {
        error: err,
        flexiRecordId,
        sectionId,
        itemCount: apiItems?.length || 0,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Retrieves Viking Event data formatted for FlexiRecord API compatibility
   *
   * @param {number[]} [flexiRecordIds] - Optional array of FlexiRecord IDs to filter by
   * @returns {Promise<Array>} Array of Viking Event records with FlexiRecord-compatible field names
   * @throws {Error} If retrieval or transformation fails
   */
  async getVikingEventDataForFlexiRecordAPI(flexiRecordIds) {
    try {
      const allVikingData = await this.storageService.getAllVikingEventData();

      // Filter by FlexiRecord IDs if provided
      const filteredData = flexiRecordIds && flexiRecordIds.length > 0
        ? allVikingData.filter(record => flexiRecordIds.includes(record.flexirecord_id))
        : allVikingData;

      const transformedData = this.transformationService.formatVikingEventDataForFlexiRecordAPI(filteredData);

      logger.debug('Retrieved Viking Event data for FlexiRecord API', {
        requestedIds: flexiRecordIds,
        totalRecords: allVikingData.length,
        filteredRecords: filteredData.length,
        dataCount: transformedData.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return transformedData;
    } catch (err) {
      logger.error('Failed to get Viking Event data for FlexiRecord API', {
        error: err,
        flexiRecordIds,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Generates sign-in/out history for a specific member
   *
   * @param {number} memberId - Member ID to generate history for
   * @returns {Promise<Array>} Sorted array of sign-in/out history objects
   * @throws {Error} If history generation fails
   */
  async generateSignInOutHistory(memberId) {
    try {
      const memberData = await this.storageService.getVikingEventDataByMemberId(memberId);
      const history = this.transformationService.generateSignInOutHistory(memberData);

      logger.debug('Generated sign in/out history', {
        memberId,
        historyCount: history.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return history;
    } catch (err) {
      logger.error('Failed to generate sign in/out history', {
        error: err,
        memberId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Gets all camp groups associated with a member
   *
   * @param {number} memberId - Member ID to get camp groups for
   * @returns {Promise<string[]>} Array of unique camp group names
   * @throws {Error} If retrieval fails
   */
  async getMemberCampGroups(memberId) {
    try {
      const campGroups = await this.storageService.getMemberCampGroups(memberId);

      logger.debug('Retrieved member camp groups via orchestrator', {
        memberId,
        campGroupCount: campGroups.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return campGroups;
    } catch (err) {
      logger.error('Failed to retrieve member camp groups via orchestrator', {
        error: err,
        memberId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Gets all member IDs associated with a camp group
   *
   * @param {string} campGroup - Camp group name to get members for
   * @returns {Promise<number[]>} Array of unique member IDs
   * @throws {Error} If retrieval fails
   */
  async getCampGroupMembers(campGroup) {
    try {
      const memberIds = await this.storageService.getCampGroupMembers(campGroup);

      logger.debug('Retrieved camp group members via orchestrator', {
        campGroup,
        memberCount: memberIds.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return memberIds;
    } catch (err) {
      logger.error('Failed to retrieve camp group members via orchestrator', {
        error: err,
        campGroup,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  /**
   * Clears all caches across all coordinated services
   */
  async clearAllCaches() {
    this.structureService.clearAllCache();
    this.storageService.invalidateCache();

    logger.info('Cleared all data service caches', {}, LOG_CATEGORIES.DATA_SERVICE);
  }

  /**
   * Clears cache entries related to a specific FlexiRecord
   *
   * @param {number} flexiRecordId - FlexiRecord ID to clear cache for
   */
  async clearCacheForFlexiRecord(flexiRecordId) {
    this.structureService.clearCacheForStructure(flexiRecordId);

    logger.debug('Cleared cache for FlexiRecord', {
      flexiRecordId,
    }, LOG_CATEGORIES.DATA_SERVICE);
  }

  /**
   * Clears cache entries related to a specific member
   *
   * @param {number} memberId - Member ID to clear cache for
   */
  async clearCacheForMember(memberId) {
    this.storageService.invalidateCacheForMember(memberId);

    logger.debug('Cleared cache for member', {
      memberId,
    }, LOG_CATEGORIES.DATA_SERVICE);
  }

  /**
   * Gets references to all injected service instances for testing or inspection
   *
   * @returns {Object} Object containing all service instances
   * @property {Object} structureService - FlexiRecord structure service
   * @property {Object} transformationService - Data transformation service
   * @property {Object} storageService - Viking Event storage service
   */
  getServiceInstances() {
    return {
      structureService: this.structureService,
      transformationService: this.transformationService,
      storageService: this.storageService,
    };
  }
}

export default new DataServiceOrchestrator();