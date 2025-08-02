// FlexiRecord utility functions for Vikings Event Management Mobile
// NOTE: This file is deprecated - use flexiRecordService.js and flexiRecordTransforms.js instead
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import { 
  getConsolidatedFlexiRecord as getConsolidatedFlexiRecordFromService,
} from '../services/flexiRecordService.js';
import { 
  parseFlexiStructure as parseFlexiStructureFromTransforms,
  transformFlexiRecordData as transformFlexiRecordDataFromTransforms,
  extractVikingEventFields as extractVikingEventFieldsFromTransforms,
} from './flexiRecordTransforms.js';

// Legacy storage keys - no longer used but kept for reference
// const STORAGE_KEYS = {
//   FLEXI_RECORDS_LIST: (sectionId) => `viking_flexi_records_${sectionId}_offline`,
//   CONSOLIDATED: (flexirecordId, termId) => `viking_flexi_consolidated_${flexirecordId}_${termId}_offline`,
// };

/**
 * Parse flexirecord structure configuration to create field mapping
 * @deprecated Use parseFlexiStructure from flexiRecordTransforms.js instead
 */
export function parseFlexiStructure(structureData) {
  logger.warn('parseFlexiStructure is deprecated, use the function from flexiRecordTransforms.js', {
    hasStructureData: !!structureData,
  }, LOG_CATEGORIES.APP);
  
  return parseFlexiStructureFromTransforms(structureData);
}

/**
 * Transform flexirecord data by mapping generic field names to actual column names
 * @deprecated Use transformFlexiRecordData from flexiRecordTransforms.js instead
 */
export function transformFlexiRecordData(flexiData, fieldMapping) {
  logger.warn('transformFlexiRecordData is deprecated, use the function from flexiRecordTransforms.js', {
    hasFlexiData: !!flexiData,
    hasFieldMapping: !!fieldMapping,
  }, LOG_CATEGORIES.APP);
  
  return transformFlexiRecordDataFromTransforms(flexiData, fieldMapping);
}

/**
 * Get consolidated flexirecord data with meaningful field names
 * @deprecated Use getConsolidatedFlexiRecord from flexiRecordService.js instead
 */
export async function getConsolidatedFlexiRecord(sectionId, flexirecordId, termId, token) {
  logger.warn('getConsolidatedFlexiRecord is deprecated, use the function from flexiRecordService.js', {
    sectionId, flexirecordId, termId, hasToken: !!token,
  }, LOG_CATEGORIES.APP);
  
  return await getConsolidatedFlexiRecordFromService(sectionId, flexirecordId, termId, token);
}


/**
 * Get all available flexirecords with their consolidated data
 * @deprecated This function has complex logic and should be refactored to use the new service layer
 */
export async function getAllConsolidatedFlexiRecords(sectionId, termId, token, includeArchived = false) {
  logger.error('getAllConsolidatedFlexiRecords is deprecated and complex - needs manual migration to service layer', {
    sectionId, termId, includeArchived, hasToken: !!token,
  }, LOG_CATEGORIES.APP);
  
  throw new Error('getAllConsolidatedFlexiRecords is deprecated - migrate to use getVikingEventDataForEvents from flexiRecordService.js');
}

/**
 * Extract expected Viking Event Management fields from flexirecord data
 * @deprecated Use extractVikingEventFields from flexiRecordTransforms.js instead
 */
export function extractVikingEventFields(consolidatedData) {
  logger.warn('extractVikingEventFields is deprecated, use the function from flexiRecordTransforms.js', {
    hasConsolidatedData: !!consolidatedData,
  }, LOG_CATEGORIES.APP);
  
  return extractVikingEventFieldsFromTransforms(consolidatedData);
}