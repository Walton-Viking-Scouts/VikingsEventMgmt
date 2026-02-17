import { Capacitor } from '@capacitor/core';
import databaseService from './storage/database.js';
import logger, { LOG_CATEGORIES } from './utils/logger.js';
import { isDemoMode } from '../../config/demoMode.js';
import { getFlexiRecords, getFlexiStructure, getSingleFlexiRecord } from './api/api/flexiRecords.js';
import dataServiceOrchestrator from './data/dataServiceOrchestrator.js';

class FlexiRecordDataService {
  constructor(orchestrator = dataServiceOrchestrator) {
    this.orchestrator = orchestrator;
    this.isNative = Capacitor.isNativePlatform();
    this.isInitialized = false;
  }

  /**
   * Initializes the FlexiRecord data service and underlying database service.
   * No-ops if already initialized.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    await databaseService.initialize();
    this.isInitialized = true;

    logger.info('FlexiRecord data service initialized', {
      platform: this.isNative ? 'native' : 'web',
      demoMode: isDemoMode(),
    }, LOG_CATEGORIES.STORAGE);
  }

  /**
   * Checks whether a given FlexiRecord ID corresponds to a Viking Event Management record.
   *
   * @param {number|string} flexiRecordId - The FlexiRecord ID to check
   * @returns {Promise<boolean>} True if the record is a Viking Event Mgmt record
   */
  async isVikingEventManagementFlexiRecord(flexiRecordId) {
    try {
      logger.debug('Checking if FlexiRecord is Viking Event Mgmt', { flexiRecordId }, LOG_CATEGORIES.DATA_SERVICE);

      const structures = await this.getFlexiRecordStructures([Number(flexiRecordId)]);
      logger.debug('Retrieved structures for Viking Event check', {
        flexiRecordId,
        structureCount: structures.length,
        structures: structures.map(s => ({ id: s.flexirecord_id, name: s.name })),
      }, LOG_CATEGORIES.DATA_SERVICE);

      if (structures.length === 0) {
        logger.debug('No structures found, returning false', { flexiRecordId }, LOG_CATEGORIES.DATA_SERVICE);
        return false;
      }

      const structure = structures[0];
      const isVikingEvent = structure.name === 'Viking Event Mgmt';

      logger.debug('Checked if FlexiRecord is Viking Event Mgmt', {
        flexiRecordId,
        structureName: structure.name,
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
   * Fetches FlexiRecord lists from the API and stores them via DatabaseService.
   *
   * @param {number} sectionId - Section identifier
   * @param {string} termId - Term identifier
   * @param {string} token - API authentication token
   * @returns {Promise<{success: boolean, listCount: number}>}
   */
  async fetchAndStoreFlexiRecordLists(sectionId, termId, token) {
    await this.initialize();

    const _sectionInfo = await this.getSectionInfo(sectionId);

    const apiData = await getFlexiRecords(sectionId, token, 'n', true);

    if (!apiData?.items || !Array.isArray(apiData.items)) {
      throw new Error('Invalid API response: missing FlexiRecord items array');
    }

    const flexiRecordLists = this.normalizeFlexiRecordLists(apiData.items, sectionId, termId, _sectionInfo);

    await this.storeFlexiRecordLists(sectionId, flexiRecordLists);

    logger.info('FlexiRecord lists fetched and stored successfully', {
      sectionId,
      listCount: flexiRecordLists.length,
    }, LOG_CATEGORIES.STORAGE);

    return { success: true, listCount: flexiRecordLists.length };
  }

  /**
   * Fetches a FlexiRecord structure from the API, normalizes it, and stores via DatabaseService.
   *
   * @param {number} flexiRecordId - The FlexiRecord ID
   * @param {number} sectionId - Section identifier
   * @param {string} termId - Term identifier
   * @param {string} token - API authentication token
   * @returns {Promise<{success: boolean, structure: Object}>}
   */
  async fetchAndStoreFlexiRecordStructure(flexiRecordId, sectionId, termId, token) {
    await this.initialize();

    const apiData = await getFlexiStructure(flexiRecordId, sectionId, termId, token, true);

    if (!apiData) {
      throw new Error('Invalid API response: missing FlexiRecord structure data');
    }

    const normalizedStructure = this.normalizeFlexiRecordStructure(apiData, flexiRecordId);

    await this.storeFlexiRecordStructure(normalizedStructure);

    logger.info('FlexiRecord structure fetched and stored successfully', {
      flexiRecordId,
      structureName: apiData.name,
    }, LOG_CATEGORIES.STORAGE);

    return { success: true, structure: normalizedStructure };
  }

  /**
   * Fetches FlexiRecord data from the API and processes it.
   * Viking Event records are processed via the orchestrator; other records are logged but not stored.
   *
   * @param {number} flexiRecordId - The FlexiRecord ID
   * @param {number} sectionId - Section identifier
   * @param {string} termId - Term identifier
   * @param {string} token - API authentication token
   * @returns {Promise<{success: boolean, dataCount: number}>}
   */
  async fetchAndStoreFlexiRecordData(flexiRecordId, sectionId, termId, token) {
    await this.initialize();

    const _sectionInfo = await this.getSectionInfo(sectionId);

    const apiData = await getSingleFlexiRecord(flexiRecordId, sectionId, termId, token);

    if (!apiData?.items || !Array.isArray(apiData.items)) {
      throw new Error('Invalid API response: missing FlexiRecord data items array');
    }

    const isVikingEvent = await this.isVikingEventManagementFlexiRecord(flexiRecordId);

    if (isVikingEvent) {
      const result = await this.orchestrator.processVikingEventFlexiRecordData(
        apiData.items,
        sectionId,
        flexiRecordId,
      );

      logger.info('Viking Event FlexiRecord data fetched and stored via orchestrator', {
        flexiRecordId,
        sectionId,
        savedCount: result.savedCount,
        totalItems: result.totalItems,
      }, LOG_CATEGORIES.STORAGE);

      return { success: true, dataCount: result.savedCount };
    } else {
      logger.info('FlexiRecord data fetched but not stored (only Viking Event Mgmt records are stored)', {
        flexiRecordId,
        sectionId,
        dataCount: apiData.items.length,
      }, LOG_CATEGORIES.STORAGE);

      return { success: true, dataCount: 0 };
    }
  }

  /**
   * Retrieves section info from DatabaseService.
   *
   * @param {number} sectionId - Section identifier
   * @returns {Promise<{sectionname: string, section: string|null, sectionType: string|null}>}
   */
  async getSectionInfo(sectionId) {
    try {
      const sections = await databaseService.getSections();
      const section = sections.find(s => s.sectionid === sectionId);
      return {
        sectionname: section?.sectionname || `Section ${sectionId}`,
        section: section?.section || null,
        sectionType: section?.sectionType || null,
      };
    } catch (error) {
      logger.warn('Could not lookup section info', {
        sectionId,
        error: error.message,
      }, LOG_CATEGORIES.STORAGE);
      return {
        sectionname: `Section ${sectionId}`,
        section: null,
        sectionType: null,
      };
    }
  }

  /**
   * Normalizes raw API FlexiRecord list items into the storage format.
   *
   * @param {Object[]} items - Raw API items
   * @param {number} sectionId - Section identifier
   * @param {string} termId - Term identifier
   * @param {Object} sectionInfo - Section metadata
   * @returns {Object[]} Normalized flexi record list objects
   */
  normalizeFlexiRecordLists(items, sectionId, termId, sectionInfo) {
    const flexiRecordLists = [];

    for (const item of items) {
      const flexiRecordList = {
        ...item,
        section_id: Number(sectionId),
        term_id: termId,
        sectionname: sectionInfo.sectionname,
        flexirecord_id: item.extraid || item.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      flexiRecordLists.push(flexiRecordList);
    }

    return flexiRecordLists;
  }

  /**
   * Normalizes raw API FlexiRecord structure data into the storage format.
   *
   * @param {Object} apiData - Raw API structure data
   * @param {number} flexiRecordId - The FlexiRecord ID
   * @returns {Object} Normalized structure object
   */
  normalizeFlexiRecordStructure(apiData, flexiRecordId) {
    return {
      ...apiData,
      flexirecord_id: Number(flexiRecordId),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Normalizes raw API FlexiRecord data items into the storage format.
   *
   * @param {Object[]} items - Raw API data items
   * @param {number} flexiRecordId - The FlexiRecord ID
   * @param {number} sectionId - Section identifier
   * @param {Object} sectionInfo - Section metadata
   * @returns {Object[]} Normalized flexi record data objects
   */
  normalizeFlexiRecordData(items, flexiRecordId, sectionId, sectionInfo) {
    const flexiRecordData = [];

    for (const item of items) {
      const memberId = item.scoutid || item.member_id;

      if (!memberId) {
        logger.warn('FlexiRecord data skipped - no valid member ID', {
          itemKeys: Object.keys(item),
          hasScoutId: !!item.scoutid,
          hasMemberId: !!item.member_id,
        }, LOG_CATEGORIES.STORAGE);
        continue;
      }

      const flexiRecordDataItem = {
        ...item,
        flexirecord_id: Number(flexiRecordId),
        member_id: Number(memberId),
        section_id: Number(sectionId),
        sectionname: sectionInfo.sectionname,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      flexiRecordData.push(flexiRecordDataItem);
    }

    return flexiRecordData;
  }

  /**
   * Stores flexi record lists, structures, and data via DatabaseService.
   *
   * @param {Object[]} flexiRecordLists - Normalized list objects
   * @param {Object[]} flexiRecordStructures - Normalized structure objects
   * @param {Object[]} _flexiRecordData - Normalized data objects (unused -- Viking Event data goes through orchestrator)
   * @returns {Promise<void>}
   */
  async storeData(flexiRecordLists, flexiRecordStructures, _flexiRecordData) {
    if (Array.isArray(flexiRecordLists) && flexiRecordLists.length) {
      const bySectionId = new Map();
      for (const list of flexiRecordLists) {
        const sid = Number(list.section_id || list.sectionid);
        if (!bySectionId.has(sid)) bySectionId.set(sid, []);
        bySectionId.get(sid).push(list);
      }
      for (const [sectionId, lists] of bySectionId) {
        await databaseService.saveFlexiLists(sectionId, lists);
      }
    }
    if (Array.isArray(flexiRecordStructures) && flexiRecordStructures.length) {
      for (const s of flexiRecordStructures) {
        const recordId = s.extraid || s.flexirecord_id;
        await databaseService.saveFlexiStructure(recordId, s);
      }
    }
  }

  /**
   * Stores flexi record lists via DatabaseService.
   *
   * @param {number} sectionId - Section identifier for the lists
   * @param {Object[]} flexiRecordLists - Normalized list objects
   * @returns {Promise<void>}
   */
  async storeFlexiRecordLists(sectionId, flexiRecordLists) {
    await databaseService.saveFlexiLists(Number(sectionId), flexiRecordLists);
  }

  /**
   * Stores a flexi record structure via DatabaseService, including parsed field mapping.
   *
   * @param {Object} structure - Normalized structure object with flexirecord_id or extraid
   * @returns {Promise<void>}
   */
  async storeFlexiRecordStructure(structure) {
    const { parseFlexiStructure } = await import('../utils/flexiRecordTransforms.js');
    const fieldMapping = parseFlexiStructure(structure);

    const fieldMappingObject = {};
    for (const [fieldId, fieldInfo] of fieldMapping.entries()) {
      fieldMappingObject[fieldId] = fieldInfo;
    }

    const enhancedStructure = {
      ...structure,
      parsedFieldMapping: fieldMappingObject,
    };

    const recordId = enhancedStructure.extraid || enhancedStructure.flexirecord_id;
    await databaseService.saveFlexiStructure(recordId, enhancedStructure);

    logger.debug('Stored FlexiRecord structure with parsed field mapping', {
      fieldCount: fieldMapping.size,
    }, LOG_CATEGORIES.STORAGE);
  }

  /**
   * Retrieves flexi record lists from DatabaseService for the given section IDs.
   *
   * @param {number[]} [sectionIds=[]] - Section IDs to filter by. If empty, returns empty array.
   * @returns {Promise<Object[]>} Array of flexi list objects
   */
  async getFlexiRecordLists(sectionIds = []) {
    await this.initialize();

    const results = [];
    for (const sectionId of sectionIds) {
      const lists = await databaseService.getFlexiLists(Number(sectionId));
      results.push(...lists);
    }

    logger.debug('Retrieved FlexiRecord lists', {
      sectionCount: sectionIds.length,
      listCount: results.length,
    }, LOG_CATEGORIES.STORAGE);

    return results;
  }

  /**
   * Retrieves flexi record structures from DatabaseService for the given record IDs.
   *
   * @param {number[]} [flexiRecordIds=[]] - FlexiRecord IDs to filter by. If empty, returns all structures.
   * @returns {Promise<Object[]>} Array of flexi structure objects
   */
  async getFlexiRecordStructures(flexiRecordIds = []) {
    await this.initialize();

    if (flexiRecordIds.length === 0) {
      const allStructures = await databaseService.getAllFlexiStructures();
      return allStructures;
    }

    const results = [];
    for (const recordId of flexiRecordIds) {
      const structure = await databaseService.getFlexiStructure(recordId);
      if (structure) {
        results.push(structure);
      }
    }

    logger.debug('Retrieved FlexiRecord structures', {
      requestedCount: flexiRecordIds.length,
      foundCount: results.length,
    }, LOG_CATEGORIES.STORAGE);

    return results;
  }

  /**
   * Retrieves flexi record data. Viking Event records are returned via the orchestrator;
   * other record types are not stored.
   *
   * @param {number[]} [flexiRecordIds=[]] - FlexiRecord IDs to retrieve data for
   * @param {number[]} [_sectionIds=[]] - Section IDs (unused, kept for API compatibility)
   * @returns {Promise<Object[]>} Array of flexi record data objects
   */
  async getFlexiRecordData(flexiRecordIds = [], _sectionIds = []) {
    await this.initialize();

    if (flexiRecordIds.length > 0) {
      const vikingEventRecordIds = [];
      const normalRecordIds = [];

      for (const flexiRecordId of flexiRecordIds) {
        const isVikingEvent = await this.isVikingEventManagementFlexiRecord(flexiRecordId);
        if (isVikingEvent) {
          vikingEventRecordIds.push(flexiRecordId);
        } else {
          normalRecordIds.push(flexiRecordId);
        }
      }

      let vikingEventData = [];
      const normalFlexiRecordData = [];

      if (vikingEventRecordIds.length > 0) {
        try {
          vikingEventData = await this.orchestrator.getVikingEventDataForFlexiRecordAPI(vikingEventRecordIds);

          logger.debug('Retrieved Viking Event data via orchestrator', {
            vikingRecordIds: vikingEventRecordIds,
            dataCount: vikingEventData.length,
          }, LOG_CATEGORIES.STORAGE);
        } catch (err) {
          logger.error('Failed to retrieve Viking Event data via orchestrator', {
            error: err,
            vikingRecordIds: vikingEventRecordIds,
          }, LOG_CATEGORIES.STORAGE);
        }
      }

      if (normalRecordIds.length > 0) {
        logger.info('Non-Viking Event FlexiRecord data requested but not stored', {
          normalRecordIds: normalRecordIds,
          count: normalRecordIds.length,
        }, LOG_CATEGORIES.STORAGE);
      }

      return [...vikingEventData, ...normalFlexiRecordData];
    }

    logger.info('FlexiRecord data requested but no specific records - only Viking Event data is stored', {
      isNative: this.isNative,
    }, LOG_CATEGORIES.STORAGE);

    return [];
  }
}

export default new FlexiRecordDataService();
