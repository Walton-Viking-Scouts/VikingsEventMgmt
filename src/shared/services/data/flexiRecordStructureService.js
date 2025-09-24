import databaseService from '../storage/database.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { Capacitor } from '@capacitor/core';

/**
 * FlexiRecord Structure Service
 *
 * Handles all FlexiRecord structure-related operations including retrieval,
 * parsing, and field mapping management. This service provides a clean interface
 * for working with FlexiRecord metadata and structure definitions.
 *
 * @example
 * import flexiRecordStructureService from './flexiRecordStructureService.js';
 *
 * const structures = await flexiRecordStructureService.getFlexiRecordStructures([123]);
 * const vikingStructure = await flexiRecordStructureService.getVikingEventStructure();
 * const fieldMappings = await flexiRecordStructureService.parseFieldMappings(structure);
 */
class FlexiRecordStructureService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.structureCache = new Map();
  }

  /**
   * Retrieves FlexiRecord structures from storage
   *
   * @param {number[]} [flexiRecordIds=[]] - Array of FlexiRecord IDs to filter by. If empty, returns all structures.
   * @returns {Promise<Object[]>} Array of FlexiRecord structure objects
   * @throws {Error} If storage operation fails
   *
   * @example
   * // Get all structures
   * const allStructures = await service.getFlexiRecordStructures();
   *
   * // Get specific structures
   * const specificStructures = await service.getFlexiRecordStructures([123, 456]);
   */
  async getFlexiRecordStructures(flexiRecordIds = []) {
    await this.ensureInitialized();

    if (this.isNative) {
      return await this.getStructuresFromSQLite(flexiRecordIds);
    } else {
      return await this.getStructuresFromIndexedDB(flexiRecordIds);
    }
  }

  /**
   * Finds a FlexiRecord structure by its name
   *
   * @param {string} structureName - The name of the structure to find
   * @returns {Promise<Object|undefined>} The matching structure object, or undefined if not found
   *
   * @example
   * const vikingStructure = await service.getStructureByName('Viking Event Mgmt');
   */
  async getStructureByName(structureName) {
    const allStructures = await this.getFlexiRecordStructures();
    return allStructures.find(structure => structure.name === structureName);
  }

  /**
   * Retrieves a single FlexiRecord structure by its ID
   *
   * @param {number} flexiRecordId - The FlexiRecord ID to retrieve
   * @returns {Promise<Object|null>} The structure object, or null if not found
   *
   * @example
   * const structure = await service.getStructureById(123);
   */
  async getStructureById(flexiRecordId) {
    const structures = await this.getFlexiRecordStructures([flexiRecordId]);
    return structures.length > 0 ? structures[0] : null;
  }

  /**
   * Checks if a FlexiRecord structure matches the expected type name
   *
   * @param {number} flexiRecordId - The FlexiRecord ID to check
   * @param {string} expectedName - The expected structure name
   * @returns {Promise<boolean>} True if the structure name matches, false otherwise
   *
   * @example
   * const isVikingEvent = await service.isStructureOfType(123, 'Viking Event Mgmt');
   */
  async isStructureOfType(flexiRecordId, expectedName) {
    try {
      const cacheKey = `type_check_${flexiRecordId}_${expectedName}`;
      if (this.structureCache.has(cacheKey)) {
        return this.structureCache.get(cacheKey);
      }

      const structure = await this.getStructureById(flexiRecordId);
      const isMatch = structure?.name === expectedName;

      this.structureCache.set(cacheKey, isMatch);

      logger.debug('Checked structure type', {
        flexiRecordId,
        expectedName,
        actualName: structure?.name,
        isMatch,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return isMatch;
    } catch (err) {
      logger.error('Failed to check structure type', {
        error: err,
        flexiRecordId,
        expectedName,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return false;
    }
  }

  /**
   * Generates field mappings from a FlexiRecord structure for data transformation
   *
   * @param {Object} structure - The FlexiRecord structure object with parsedFieldMapping
   * @param {Object} structure.parsedFieldMapping - Parsed field definitions from the structure
   * @param {number} structure.flexirecord_id - The FlexiRecord ID
   * @returns {Promise<Object>} Field mapping object with keys as field IDs and values as normalized field names
   *
   * @example
   * const fieldMappings = await service.generateFieldMapping(structure);
   * // Returns: { '12345': 'camp_group', '12346': 'signed_in_by', ... }
   */
  async generateFieldMapping(structure) {
    if (!structure || !structure.parsedFieldMapping) {
      logger.warn('No parsed field mapping found in structure', {
        hasStructure: !!structure,
        hasParsedMapping: !!(structure && structure.parsedFieldMapping),
      }, LOG_CATEGORIES.DATA_SERVICE);
      return {};
    }

    const fieldMappings = {};

    for (const [fieldId, fieldInfo] of Object.entries(structure.parsedFieldMapping)) {
      const fieldName = fieldInfo.name || '';

      switch (fieldName.toLowerCase()) {
      case 'camp group':
      case 'campgroup':
        fieldMappings[fieldId] = 'camp_group';
        break;
      case 'signed in by':
      case 'signedinby':
        fieldMappings[fieldId] = 'signed_in_by';
        break;
      case 'signed in when':
      case 'signedinwhen':
      case 'signed in time':
        fieldMappings[fieldId] = 'signed_in_when';
        break;
      case 'signed out by':
      case 'signedoutby':
        fieldMappings[fieldId] = 'signed_out_by';
        break;
      case 'signed out when':
      case 'signedoutwhen':
      case 'signed out time':
        fieldMappings[fieldId] = 'signed_out_when';
        break;
      default:
        fieldMappings[fieldId] = fieldName.toLowerCase().replace(/\s+/g, '_');
      }
    }

    logger.debug('Generated field mappings from structure', {
      structureId: structure.flexirecord_id,
      mappingCount: Object.keys(fieldMappings).length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return fieldMappings;
  }

  async storeStructure(structure) {
    await this.ensureInitialized();

    if (this.isNative) {
      await this.storeStructureInSQLite(structure);
    } else {
      await this.storeStructureInIndexedDB(structure);
    }

    this.clearCacheForStructure(structure.flexirecord_id);
  }

  async storeStructureInIndexedDB(structure) {
    logger.debug('Storing FlexiRecord structure to IndexedDB', {
      flexiRecordId: structure.flexirecord_id,
      structureName: structure.name,
    }, LOG_CATEGORIES.STORAGE);

    const { parseFlexiStructure } = await import('../../utils/flexiRecordTransforms.js');
    const fieldMapping = parseFlexiStructure(structure);

    const fieldMappingObject = {};
    for (const [fieldId, fieldInfo] of fieldMapping.entries()) {
      fieldMappingObject[fieldId] = fieldInfo;
    }

    const enhancedStructure = {
      ...structure,
      parsedFieldMapping: fieldMappingObject,
    };

    await databaseService.storageBackend.saveFlexiRecordStructure(enhancedStructure);

    logger.debug('Successfully stored FlexiRecord structure with parsed field mapping', {
      fieldCount: fieldMapping.size,
    }, LOG_CATEGORIES.STORAGE);
  }

  async storeStructureInSQLite(_structure) {
    throw new Error('SQLite storage for FlexiRecord structures not yet implemented');
  }

  async getStructuresFromIndexedDB(flexiRecordIds) {
    logger.debug('Reading FlexiRecord structures from IndexedDB', {
      structureFilter: flexiRecordIds?.length || 'all',
    }, LOG_CATEGORIES.STORAGE);

    const structures = await databaseService.storageBackend.getFlexiRecordStructures(flexiRecordIds);

    logger.debug('Retrieved FlexiRecord structures from IndexedDB', {
      structureCount: structures.length,
    }, LOG_CATEGORIES.STORAGE);

    return structures;
  }

  async getStructuresFromSQLite(_flexiRecordIds) {
    throw new Error('SQLite retrieval for FlexiRecord structures not yet implemented');
  }

  clearCacheForStructure(flexiRecordId) {
    const keysToDelete = [];
    for (const key of this.structureCache.keys()) {
      if (key.includes(`_${flexiRecordId}_`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.structureCache.delete(key));

    logger.debug('Cleared structure cache', {
      flexiRecordId,
      clearedKeys: keysToDelete.length,
    }, LOG_CATEGORIES.DATA_SERVICE);
  }

  clearAllCache() {
    this.structureCache.clear();
    logger.debug('Cleared all structure cache', {}, LOG_CATEGORIES.DATA_SERVICE);
  }

  async ensureInitialized() {
    await databaseService.initialize();
  }
}

export default new FlexiRecordStructureService();