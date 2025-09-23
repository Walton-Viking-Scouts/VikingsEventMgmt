import { Capacitor } from '@capacitor/core';
import { validateTokenBeforeAPICall } from './api/api/base.js';
import databaseService from './storage/database.js';
import logger, { LOG_CATEGORIES } from './utils/logger.js';
import { isDemoMode } from '../../config/demoMode.js';
import { getFlexiRecords, getFlexiStructure, getSingleFlexiRecord } from './api/api/flexiRecords.js';
import dataServiceOrchestrator from './data/dataServiceOrchestrator.js';

const _CACHE_KEYS = {
  FLEXI_LISTS: 'viking_flexirecord_lists_offline',
  FLEXI_STRUCTURES: 'viking_flexirecord_structures_offline',
  FLEXI_DATA: 'viking_flexirecord_data_offline',
};

class FlexiRecordDataService {
  constructor(orchestrator = dataServiceOrchestrator) {
    this.orchestrator = orchestrator;
    this.isNative = Capacitor.isNativePlatform();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    await databaseService.initialize();
    this.isInitialized = true;

    logger.info('FlexiRecord data service initialized', {
      platform: this.isNative ? 'native' : 'web',
      demoMode: isDemoMode(),
    }, LOG_CATEGORIES.STORAGE);
  }

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

      logger.debug('Structure check result', {
        flexiRecordId,
        structureName: structure.name,
        isVikingEvent,
        structureKeys: Object.keys(structure),
      }, LOG_CATEGORIES.DATA_SERVICE);

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

  async fetchAndStoreFlexiRecordLists(sectionId, termId, token) {
    await this.initialize();

    validateTokenBeforeAPICall(token, 'fetchFlexiRecordLists');

    const _sectionInfo = await this.getSectionInfo(sectionId);

    const apiData = await getFlexiRecords(sectionId, token, 'n', true);

    if (!apiData?.items || !Array.isArray(apiData.items)) {
      throw new Error('Invalid API response: missing FlexiRecord items array');
    }

    const flexiRecordLists = this.normalizeFlexiRecordLists(apiData.items, sectionId, termId, _sectionInfo);

    await this.storeFlexiRecordLists(flexiRecordLists);

    logger.info('FlexiRecord lists fetched and stored successfully', {
      sectionId,
      listCount: flexiRecordLists.length,
    }, LOG_CATEGORIES.STORAGE);

    return { success: true, listCount: flexiRecordLists.length };
  }

  async fetchAndStoreFlexiRecordStructure(flexiRecordId, sectionId, termId, token) {
    await this.initialize();

    validateTokenBeforeAPICall(token, 'fetchFlexiRecordStructure');

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

  async fetchAndStoreFlexiRecordData(flexiRecordId, sectionId, termId, token) {
    await this.initialize();

    validateTokenBeforeAPICall(token, 'fetchFlexiRecordData');

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

  async getSectionInfo(sectionId) {
    try {
      if (this.isNative) {
        const db = await databaseService.getDatabase();
        const result = await db.query('SELECT sectionname, section, sectionType FROM sections WHERE sectionid = ?', [sectionId]);
        const section = result.values?.[0];
        return {
          sectionname: section?.sectionname || `Section ${sectionId}`,
          section: section?.section || null,
          sectionType: section?.sectionType || null,
        };
      } else {
        const sections = await databaseService.storageBackend.getSections();
        const section = sections.find(s => s.sectionid === sectionId);
        return {
          sectionname: section?.sectionname || `Section ${sectionId}`,
          section: section?.section || null,
          sectionType: section?.sectionType || null,
        };
      }
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

  normalizeFlexiRecordStructure(apiData, flexiRecordId) {
    return {
      ...apiData,
      flexirecord_id: Number(flexiRecordId),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

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


  async storeData(flexiRecordLists, flexiRecordStructures, flexiRecordData) {
    if (this.isNative) {
      await this.storeInSQLite(flexiRecordLists, flexiRecordStructures, flexiRecordData);
    } else {
      await this.storeInIndexedDB(flexiRecordLists, flexiRecordStructures, flexiRecordData);
    }
  }

  async storeFlexiRecordLists(flexiRecordLists) {
    if (this.isNative) {
      await this.storeFlexiRecordListsInSQLite(flexiRecordLists);
    } else {
      await this.storeFlexiRecordListsInIndexedDB(flexiRecordLists);
    }
  }

  async storeFlexiRecordStructure(structure) {
    if (this.isNative) {
      await this.storeFlexiRecordStructureInSQLite(structure);
    } else {
      await this.storeFlexiRecordStructureInIndexedDB(structure);
    }
  }



  async storeFlexiRecordListsInIndexedDB(flexiRecordLists) {
    logger.debug('Storing FlexiRecord lists to IndexedDB', {
      listCount: flexiRecordLists.length,
    }, LOG_CATEGORIES.STORAGE);

    await databaseService.storageBackend.saveFlexiRecordLists(flexiRecordLists);

    logger.debug('Successfully stored FlexiRecord lists to IndexedDB', {}, LOG_CATEGORIES.STORAGE);
  }

  async storeFlexiRecordStructureInIndexedDB(structure) {
    logger.debug('Storing FlexiRecord structure to IndexedDB', {
      flexiRecordId: structure.flexirecord_id,
      structureName: structure.name,
    }, LOG_CATEGORIES.STORAGE);

    // Parse the complex structure once and store simplified field mapping
    const { parseFlexiStructure } = await import('../utils/flexiRecordTransforms.js');
    const fieldMapping = parseFlexiStructure(structure);

    // Convert Map to plain object for storage
    const fieldMappingObject = {};
    for (const [fieldId, fieldInfo] of fieldMapping.entries()) {
      fieldMappingObject[fieldId] = fieldInfo;
    }

    // Store both original structure and parsed field mapping
    const enhancedStructure = {
      ...structure,
      parsedFieldMapping: fieldMappingObject,
    };

    await databaseService.storageBackend.saveFlexiRecordStructure(enhancedStructure);

    logger.debug('Successfully stored FlexiRecord structure with parsed field mapping to IndexedDB', {
      fieldCount: fieldMapping.size,
    }, LOG_CATEGORIES.STORAGE);
  }


  async getFlexiRecordLists(sectionIds = []) {
    await this.initialize();

    if (this.isNative) {
      return await this.getFlexiRecordListsFromSQLite(sectionIds);
    } else {
      return await this.getFlexiRecordListsFromIndexedDB(sectionIds);
    }
  }

  async getFlexiRecordStructures(flexiRecordIds = []) {
    await this.initialize();

    if (this.isNative) {
      return await this.getFlexiRecordStructuresFromSQLite(flexiRecordIds);
    } else {
      return await this.getFlexiRecordStructuresFromIndexedDB(flexiRecordIds);
    }
  }

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
          vikingEventData = await this.orchestrator.getVikingEventDataForFlexiRecordAPI();

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

  async getFlexiRecordListsFromSQLite(_sectionIds) {
    // TODO: Implement SQLite retrieval for FlexiRecord lists
    throw new Error('SQLite retrieval for FlexiRecord lists not yet implemented');
  }

  async getFlexiRecordStructuresFromSQLite(_flexiRecordIds) {
    // TODO: Implement SQLite retrieval for FlexiRecord structures
    throw new Error('SQLite retrieval for FlexiRecord structures not yet implemented');
  }

  async getFlexiRecordDataFromSQLite(_flexiRecordIds, _sectionIds) {
    // TODO: Implement SQLite retrieval for FlexiRecord data
    throw new Error('SQLite retrieval for FlexiRecord data not yet implemented');
  }

  async getFlexiRecordListsFromIndexedDB(sectionIds) {
    logger.debug('Reading FlexiRecord lists from IndexedDB', {
      sectionFilter: sectionIds?.length || 'all',
    }, LOG_CATEGORIES.STORAGE);

    const flexiRecordLists = await databaseService.storageBackend.getFlexiRecordLists(sectionIds);

    logger.debug('Retrieved FlexiRecord lists from IndexedDB', {
      listCount: flexiRecordLists.length,
    }, LOG_CATEGORIES.STORAGE);

    return flexiRecordLists;
  }

  async getFlexiRecordStructuresFromIndexedDB(flexiRecordIds) {
    logger.debug('Reading FlexiRecord structures from IndexedDB', {
      structureFilter: flexiRecordIds?.length || 'all',
    }, LOG_CATEGORIES.STORAGE);

    const flexiRecordStructures = await databaseService.storageBackend.getFlexiRecordStructures(flexiRecordIds);

    logger.debug('Retrieved FlexiRecord structures from IndexedDB', {
      structureCount: flexiRecordStructures.length,
    }, LOG_CATEGORIES.STORAGE);

    return flexiRecordStructures;
  }

  async getFlexiRecordDataFromIndexedDB(flexiRecordIds, sectionIds) {
    logger.debug('Reading FlexiRecord data from IndexedDB', {
      recordFilter: flexiRecordIds?.length || 'all',
      sectionFilter: sectionIds?.length || 'all',
    }, LOG_CATEGORIES.STORAGE);

    const flexiRecordData = await databaseService.storageBackend.getFlexiRecordData(flexiRecordIds, sectionIds);

    logger.debug('Retrieved FlexiRecord data from IndexedDB', {
      dataCount: flexiRecordData.length,
    }, LOG_CATEGORIES.STORAGE);

    return flexiRecordData;
  }
}

export default new FlexiRecordDataService();