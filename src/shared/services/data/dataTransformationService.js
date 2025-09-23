import logger, { LOG_CATEGORIES } from '../utils/logger.js';

/**
 * Data Transformation Service
 *
 * Handles pure data transformations between FlexiRecord and Viking Event formats.
 * This service contains no storage operations and focuses solely on data mapping,
 * normalization, and transformation logic.
 *
 * @example
 * import dataTransformationService from './dataTransformationService.js';
 *
 * const vikingData = await dataTransformationService.mapFlexiRecordToVikingEventData(
 *   flexiRecord, sectionId, flexiRecordId, fieldMappings
 * );
 * const history = dataTransformationService.generateSignInOutHistory(memberData);
 */
class DataTransformationService {
  /**
   * Transforms FlexiRecord data to Viking Event data format
   *
   * @param {Object} flexiRecord - The source FlexiRecord data
   * @param {number} sectionId - Section ID for the record
   * @param {number} flexiRecordId - FlexiRecord ID
   * @param {Object} fieldMappings - Field mapping object (flexiField -> vikingField)
   * @returns {Promise<Object>} Transformed Viking Event data object
   *
   * @example
   * const vikingData = await service.mapFlexiRecordToVikingEventData(
   *   { scoutid: 123, field_456: 'Blue Group' },
   *   789,
   *   101,
   *   { 'field_456': 'camp_group' }
   * );
   */
  async mapFlexiRecordToVikingEventData(flexiRecord, sectionId, flexiRecordId, fieldMappings) {
    if (!fieldMappings) {
      logger.warn('No field mappings provided for transformation', {
        memberId: flexiRecord?.scoutid || flexiRecord?.member_id,
        flexiRecordId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      fieldMappings = {};
    }

    const mappedData = {
      member_id: flexiRecord.scoutid || flexiRecord.member_id,
      section_id: Number(sectionId),
      flexirecord_id: flexiRecordId,
      last_updated: new Date().toISOString(),
    };

    for (const [flexiField, mappedField] of Object.entries(fieldMappings)) {
      mappedData[mappedField] = flexiRecord[flexiField] || null;
    }

    logger.debug('Mapped FlexiRecord to Viking Event data', {
      memberId: mappedData.member_id,
      campGroup: mappedData.camp_group,
      flexiRecordId: mappedData.flexirecord_id,
      fieldsCount: Object.keys(fieldMappings).length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return mappedData;
  }

  /**
   * Transforms Viking Event data back to FlexiRecord format
   *
   * @param {Object} vikingEventData - The Viking Event data to transform
   * @param {Object} fieldMappings - Field mapping object (flexiField -> vikingField)
   * @returns {Promise<Object>} Transformed FlexiRecord data object
   *
   * @example
   * const flexiData = await service.mapVikingEventDataToFlexiRecord(
   *   { member_id: 123, camp_group: 'Blue Group' },
   *   { 'field_456': 'camp_group' }
   * );
   */
  async mapVikingEventDataToFlexiRecord(vikingEventData, fieldMappings) {
    if (!fieldMappings) {
      logger.warn('No field mappings provided for reverse transformation', {
        memberId: vikingEventData?.member_id,
      }, LOG_CATEGORIES.DATA_SERVICE);
      fieldMappings = {};
    }

    const flexiRecord = {
      scoutid: vikingEventData.member_id,
      flexirecordid: vikingEventData.flexirecord_id,
    };

    const reverseMappings = this.generateReverseMappings(fieldMappings);

    for (const [mappedField, value] of Object.entries(vikingEventData)) {
      if (reverseMappings[mappedField]) {
        flexiRecord[reverseMappings[mappedField]] = value;
      }
    }

    logger.debug('Mapped Viking Event data to FlexiRecord', {
      memberId: flexiRecord.scoutid,
      flexiRecordId: flexiRecord.flexirecordid,
      fieldsCount: Object.keys(reverseMappings).length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return flexiRecord;
  }

  /**
   * Generates reverse field mappings for backward transformation
   *
   * @param {Object} fieldMappings - Original field mappings (flexiField -> vikingField)
   * @returns {Object} Reverse mappings (vikingField -> flexiField)
   *
   * @example
   * const reverse = service.generateReverseMappings({ 'field_456': 'camp_group' });
   * // Returns: { 'camp_group': 'field_456' }
   */
  generateReverseMappings(fieldMappings) {
    const reverseMappings = {};
    for (const [flexiField, mappedField] of Object.entries(fieldMappings)) {
      reverseMappings[mappedField] = flexiField;
    }
    return reverseMappings;
  }

  /**
   * Normalizes FlexiRecord list items with section and term information
   *
   * @param {Array} items - Raw FlexiRecord list items from API
   * @param {number} sectionId - Section ID
   * @param {number} termId - Term ID
   * @param {Object} sectionInfo - Section information object
   * @param {string} sectionInfo.sectionname - Section name
   * @returns {Array} Normalized FlexiRecord list objects
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

    logger.debug('Normalized FlexiRecord lists', {
      itemCount: items.length,
      sectionId,
      termId,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return flexiRecordLists;
  }

  /**
   * Normalizes FlexiRecord structure data from API
   *
   * @param {Object} apiData - Raw structure data from API
   * @param {number} flexiRecordId - FlexiRecord ID
   * @returns {Object} Normalized structure object with timestamps
   */
  normalizeFlexiRecordStructure(apiData, flexiRecordId) {
    const normalized = {
      ...apiData,
      flexirecord_id: Number(flexiRecordId),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    logger.debug('Normalized FlexiRecord structure', {
      flexiRecordId,
      structureName: apiData.name,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return normalized;
  }

  /**
   * Normalizes FlexiRecord data items with validation and metadata
   *
   * @param {Array} items - Raw FlexiRecord data items from API
   * @param {number} flexiRecordId - FlexiRecord ID
   * @param {number} sectionId - Section ID
   * @param {Object} sectionInfo - Section information
   * @returns {Array} Normalized FlexiRecord data objects (excludes items without member IDs)
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

    logger.debug('Normalized FlexiRecord data', {
      inputCount: items.length,
      outputCount: flexiRecordData.length,
      flexiRecordId,
      sectionId,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return flexiRecordData;
  }

  /**
   * Formats Viking Event data for FlexiRecord API compatibility
   *
   * @param {Array} vikingEventData - Array of Viking Event data objects
   * @returns {Array} Formatted data with FlexiRecord-compatible field names
   */
  formatVikingEventDataForFlexiRecordAPI(vikingEventData) {
    return vikingEventData.map(record => ({
      ...record,
      flexirecordid: record.flexirecord_id,
      scoutid: record.member_id,
      sectionid: record.section_id,
    }));
  }

  /**
   * Generates sign-in/out history from member Viking Event data
   *
   * @param {Array} memberData - Array of Viking Event records for a member
   * @returns {Array} Sorted history objects with sign-in/out information
   *
   * @example
   * const history = service.generateSignInOutHistory(memberRecords);
   * // Returns: [{ campGroup: 'Blue', signedInBy: 'Leader1', isCurrentlySignedIn: true, ... }]
   */
  generateSignInOutHistory(memberData) {
    const history = memberData.map(record => ({
      campGroup: record.camp_group,
      signedInBy: record.signed_in_by,
      signedInWhen: record.signed_in_when,
      signedOutBy: record.signed_out_by,
      signedOutWhen: record.signed_out_when,
      isCurrentlySignedIn: record.signed_in_when && !record.signed_out_when,
      lastUpdated: record.last_updated,
    })).sort((a, b) => {
      const aDate = new Date(a.signedInWhen || 0);
      const bDate = new Date(b.signedInWhen || 0);
      return bDate - aDate;
    });

    logger.debug('Generated sign in/out history', {
      inputRecords: memberData.length,
      historyEntries: history.length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return history;
  }

  /**
   * Extracts unique values from a specific field across data records
   *
   * @param {Array} data - Array of data objects
   * @param {string} fieldName - Name of the field to extract values from
   * @returns {Array} Array of unique values (excludes null/undefined)
   *
   * @example
   * const uniqueGroups = service.extractUniqueValues(records, 'camp_group');
   * // Returns: ['Blue Group', 'Red Group', 'Green Group']
   */
  extractUniqueValues(data, fieldName) {
    const uniqueValues = [...new Set(data
      .map(record => record[fieldName])
      .filter(value => value !== null && value !== undefined),
    )];

    logger.debug('Extracted unique values', {
      fieldName,
      inputCount: data.length,
      uniqueCount: uniqueValues.length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return uniqueValues;
  }
}

export default new DataTransformationService();