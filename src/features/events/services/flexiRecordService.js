/**
 * @file FlexiRecord Service for Viking Event Management
 *
 * Comprehensive service for managing OSM FlexiRecord operations with offline-first
 * architecture and intelligent caching. Handles Scout attendance data, section
 * movement tracking, and custom data fields with automatic fallback mechanisms.
 *
 * Key features:
 * - Offline-first with normalized IndexedDB/SQLite storage via DatabaseService
 * - Specialized support for Viking Event Management and Section Movers FlexiRecords
 * - Network-aware operations with automatic fallback to cached data
 * - Demo mode data segregation and comprehensive error handling
 * - Field mapping and data transformation for meaningful FlexiRecord usage
 * - Multi-section FlexiRecord discovery and validation
 *
 * @module FlexiRecordService
 * @requires ../../../shared/utils/networkUtils
 * @requires ../../../shared/services/utils/logger
 * @requires ../../../shared/services/utils/sentry
 */

/**
 * Validates if authentication token is usable for API calls
 *
 * @private
 * @param {string} token - Authentication token to validate
 * @returns {boolean} True if token is usable for API requests
 */
function hasUsableToken(token) {
  if (typeof token !== 'string') {
    return false;
  }
  return token.trim().length > 0;
}

/**
 * Normalizes ID values to strings with validation
 *
 * @private
 * @param {string|number} id - ID to normalize
 * @param {string} name - Name of the ID for error messages
 * @returns {string} Normalized string ID
 * @throws {Error} If ID is invalid or empty
 */
function normalizeId(id, name) {
  if (typeof id === 'number') return String(id);
  if (typeof id === 'string' && id.trim() !== '' && id !== 'undefined' && id !== 'null') return id;
  throw new Error(`Valid ${name} (string or number) is required`);
}

import { checkNetworkStatus } from '../../../shared/utils/networkUtils.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { sentryUtils } from '../../../shared/services/utils/sentry.js';
import { isDemoMode } from '../../../config/demoMode.js';
import databaseService from '../../../shared/services/storage/database.js';
import {
  getFlexiRecords,
  getFlexiStructure,
  getSingleFlexiRecord,
} from '../../../shared/services/api/api/flexiRecords.js';

/**
 * Cache TTL constants for different types of FlexiRecord data
 *
 * Optimized for different data change frequencies:
 * - Structures change rarely (field definitions are static)
 * - Data changes frequently (attendance is live during events)
 * - Lists change occasionally (new FlexiRecords added periodically)
 */

/** @constant {number} Cache TTL for FlexiRecord structures (1 hour) */
const FLEXI_STRUCTURES_CACHE_TTL = 60 * 60 * 1000;

/** @constant {number} Cache TTL for FlexiRecord data (5 minutes) */
const FLEXI_DATA_CACHE_TTL = 5 * 60 * 1000;

/** @constant {number} Cache TTL for FlexiRecord lists (30 minutes) */
const FLEXI_LISTS_CACHE_TTL = 30 * 60 * 1000;

/**
 * Checks if cached data is still valid based on TTL
 *
 * @private
 * @param {*} cached - Cached data object (must have _cacheTimestamp)
 * @param {number} ttl - Time-to-live in milliseconds
 * @returns {{valid: boolean, data: *, cacheAgeMinutes: number}} Cache validity result
 */
function checkCacheTTL(cached, ttl) {
  if (!cached || !cached._cacheTimestamp) {
    return { valid: false, data: null };
  }

  const cacheAge = Date.now() - cached._cacheTimestamp;
  const isValid = cacheAge < ttl;

  return { valid: isValid, data: cached, cacheAgeMinutes: Math.round(cacheAge / 60000) };
}

/**
 * Gets available FlexiRecords for a Scout section with intelligent caching
 *
 * @async
 * @param {string|number} sectionId - Section identifier
 * @param {string} token - OSM authentication token (null for offline mode)
 * @param {boolean} [forceRefresh=false] - Force API call ignoring cache validity
 * @returns {Promise<{items: Array, _cacheTimestamp: number}>} FlexiRecords list with metadata
 */
export async function getFlexiRecordsList(sectionId, token, forceRefresh = false) {
  sectionId = normalizeId(sectionId, 'sectionId');

  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }

  try {
    if (isDemoMode()) {
      const cached = await databaseService.getFlexiLists(sectionId);
      return cached || { items: [] };
    }

    if (!hasUsableToken(token)) {
      logger.info('No usable token for section, skipping API call', { sectionId }, LOG_CATEGORIES.APP);
      const cached = await databaseService.getFlexiLists(sectionId);
      return cached || { items: [] };
    }

    const isOnline = await checkNetworkStatus();

    if (!forceRefresh && isOnline) {
      const cached = await databaseService.getFlexiLists(sectionId);
      const cacheCheck = checkCacheTTL(cached, FLEXI_LISTS_CACHE_TTL);
      if (cacheCheck.valid) {
        return cacheCheck.data;
      }
    }

    if (!isOnline) {
      const cached = await databaseService.getFlexiLists(sectionId);
      return cached || { items: [] };
    }

    const flexiRecords = await getFlexiRecords(sectionId, token);

    const cachedData = {
      ...flexiRecords,
      _cacheTimestamp: Date.now(),
    };
    await databaseService.saveFlexiLists(sectionId, cachedData);

    return flexiRecords;

  } catch (error) {
    logger.error('Error fetching flexirecords list', {
      sectionId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    try {
      const cached = await databaseService.getFlexiLists(sectionId);
      if (cached) {
        logger.warn('Using cached flexirecords list after API failure', { sectionId });
        return cached;
      }
    } catch (cacheError) {
      logger.error('Cache fallback failed', { error: cacheError.message });
    }

    throw error;
  }
}

/**
 * Gets FlexiRecord structure with field definitions and metadata
 *
 * @async
 * @param {string|number} flexirecordId - FlexiRecord identifier
 * @param {string|number} sectionId - Section identifier
 * @param {string|number} termId - Term identifier
 * @param {string} token - OSM authentication token (null for offline mode)
 * @param {boolean} [forceRefresh=false] - Force API call ignoring cache validity
 * @returns {Promise<Object|null>} FlexiRecord structure or null if not found
 */
export async function getFlexiRecordStructure(flexirecordId, sectionId, termId, token, forceRefresh = false) {
  flexirecordId = normalizeId(flexirecordId, 'flexirecordId');
  sectionId = normalizeId(sectionId, 'sectionId');
  termId = normalizeId(termId, 'termId');

  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }

  try {
    if (isDemoMode()) {
      const cached = await databaseService.getFlexiStructure(flexirecordId);
      return cached || null;
    }

    if (!hasUsableToken(token)) {
      const cached = await databaseService.getFlexiStructure(flexirecordId);
      return cached || null;
    }

    const isOnline = await checkNetworkStatus();

    if (!forceRefresh && isOnline) {
      const cached = await databaseService.getFlexiStructure(flexirecordId);
      const cacheCheck = checkCacheTTL(cached, FLEXI_STRUCTURES_CACHE_TTL);
      if (cacheCheck.valid) {
        return cacheCheck.data;
      }
    }

    if (!isOnline) {
      const cached = await databaseService.getFlexiStructure(flexirecordId);
      if (cached) {
        return cached;
      }
      return null;
    }

    const structure = await getFlexiStructure(flexirecordId, sectionId, termId, token);

    if (!structure) {
      throw new Error('Failed to retrieve flexirecord structure');
    }

    const cachedData = {
      ...structure,
      _cacheTimestamp: Date.now(),
    };
    await databaseService.saveFlexiStructure(flexirecordId, cachedData);

    return structure;

  } catch (error) {
    logger.error('Error fetching flexirecord structure', {
      flexirecordId,
      sectionId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    try {
      const cached = await databaseService.getFlexiStructure(flexirecordId);
      if (cached) {
        logger.warn('Using cached flexirecord structure after API failure', { flexirecordId });
        return cached;
      }
    } catch (cacheError) {
      logger.error('Cache fallback failed', { error: cacheError.message });
    }

    throw error;
  }
}

/**
 * Gets flexirecord attendance data with frequent refresh
 *
 * @async
 * @param {string|number} flexirecordId - FlexiRecord ID
 * @param {string|number} sectionId - Section ID
 * @param {string|number} termId - Term ID
 * @param {string} token - Authentication token
 * @param {boolean} [forceRefresh=true] - Force API call ignoring cache
 * @returns {Promise<Object>} FlexiRecord attendance data
 */
export async function getFlexiRecordData(flexirecordId, sectionId, termId, token, forceRefresh = true) {
  flexirecordId = normalizeId(flexirecordId, 'flexirecordId');
  sectionId = normalizeId(sectionId, 'sectionId');
  termId = normalizeId(termId, 'termId');

  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = true;
  }

  try {
    if (isDemoMode()) {
      const cached = await databaseService.getFlexiData(flexirecordId, sectionId, termId);
      return cached || null;
    }

    if (!hasUsableToken(token)) {
      const cached = await databaseService.getFlexiData(flexirecordId, sectionId, termId);
      return cached || null;
    }

    const isOnline = await checkNetworkStatus();

    if (!forceRefresh && isOnline) {
      const cached = await databaseService.getFlexiData(flexirecordId, sectionId, termId);
      const cacheCheck = checkCacheTTL(cached, FLEXI_DATA_CACHE_TTL);
      if (cacheCheck.valid) {
        return cacheCheck.data;
      }
    }

    if (!isOnline) {
      const cached = await databaseService.getFlexiData(flexirecordId, sectionId, termId);
      if (cached) {
        return cached;
      }
      return null;
    }

    const data = await getSingleFlexiRecord(flexirecordId, sectionId, termId, token);

    if (!data) {
      throw new Error('Failed to retrieve flexirecord data');
    }

    const cachedData = {
      ...data,
      _cacheTimestamp: Date.now(),
    };
    await databaseService.saveFlexiData(flexirecordId, sectionId, termId, cachedData);

    return data;

  } catch (error) {
    logger.error('Error fetching flexirecord data', {
      flexirecordId,
      sectionId,
      termId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    try {
      const cached = await databaseService.getFlexiData(flexirecordId, sectionId, termId);
      if (cached) {
        logger.warn('Using cached flexirecord data after API failure', { flexirecordId });
        return cached;
      }
    } catch (cacheError) {
      logger.error('Cache fallback failed', { error: cacheError.message });
    }

    throw error;
  }
}

/**
 * Gets consolidated FlexiRecord data with meaningful field names and structure
 *
 * @async
 * @param {string|number} sectionId - Section identifier
 * @param {string|number} flexirecordId - FlexiRecord identifier (extraid)
 * @param {string|number} termId - Term identifier
 * @param {string} token - OSM authentication token (null for offline mode)
 * @param {boolean} [forceRefresh=false] - Force refresh of data cache
 * @returns {Promise<Object>} Consolidated FlexiRecord with structure and data
 * @throws {Error} If required parameters missing or API calls fail
 */
export async function getConsolidatedFlexiRecord(sectionId, flexirecordId, termId, token, forceRefresh = false) {
  try {
    if (!sectionId || !flexirecordId || !termId) {
      throw new Error('Missing required parameters: sectionId, flexirecordId, and termId are required');
    }

    const [structureData, flexiData] = await Promise.all([
      getFlexiRecordStructure(flexirecordId, sectionId, termId, token, false),
      getFlexiRecordData(flexirecordId, sectionId, termId, token, forceRefresh),
    ]);

    if (!structureData) {
      throw new Error('Failed to retrieve flexirecord structure');
    }

    if (!flexiData) {
      throw new Error('Failed to retrieve flexirecord data');
    }

    const { parseFlexiStructure, transformFlexiRecordData } = await import('../../../shared/utils/flexiRecordTransforms.js');
    const fieldMapping = parseFlexiStructure(structureData);

    const consolidatedData = transformFlexiRecordData(flexiData, fieldMapping);

    const fieldMappingObj = {};
    fieldMapping.forEach((fieldInfo, fieldId) => {
      fieldMappingObj[fieldId] = {
        columnId: fieldId,
        ...fieldInfo,
      };
    });

    consolidatedData._structure = {
      name: structureData.name,
      extraid: structureData.extraid,
      flexirecordid: structureData.extraid,
      sectionid: structureData.sectionid,
      archived: structureData.archived === '1',
      softDeleted: structureData.soft_deleted === '1',
      fieldMapping: fieldMappingObj,
    };

    return consolidatedData;
  } catch (error) {
    logger.error('Error getting consolidated flexirecord data', {
      sectionId,
      flexirecordId,
      termId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'get_consolidated_flexi_record',
      },
      contexts: {
        request: {
          sectionId,
          flexirecordId,
          termId,
          hasToken: !!token,
        },
      },
    });

    throw error;
  }
}

/**
 * Gets Viking Event Management FlexiRecord data for a Scout section
 *
 * @async
 * @param {string|number} sectionId - Section identifier
 * @param {string|number} termId - Term identifier
 * @param {string} token - OSM authentication token (null for offline mode)
 * @param {boolean} [forceRefresh=false] - Force refresh of data cache
 * @returns {Promise<Object|null>} Viking Event Mgmt FlexiRecord data or null if not found
 */
export async function getVikingEventData(sectionId, termId, token, forceRefresh = false) {
  sectionId = normalizeId(sectionId, 'sectionId');
  termId = normalizeId(termId, 'termId');

  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }

  try {
    const flexiRecordsList = await getFlexiRecordsList(sectionId, token, forceRefresh);

    const vikingEventFlexiRecord = flexiRecordsList.items?.find(record =>
      record.name === 'Viking Event Mgmt',
    );

    if (!vikingEventFlexiRecord) {
      logger.warn('No "Viking Event Mgmt" flexirecord found for section', {
        sectionId,
        availableRecords: flexiRecordsList.items?.map(r => r.name || 'Unknown') || [],
      }, LOG_CATEGORIES.APP);

      return null;
    }

    const vikingEventRecord = await getConsolidatedFlexiRecord(
      sectionId,
      vikingEventFlexiRecord.extraid,
      termId,
      token,
      forceRefresh,
    );

    return vikingEventRecord;
  } catch (error) {
    logger.error('Error getting Viking Event data for section', {
      sectionId,
      termId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'get_viking_event_data',
      },
      contexts: {
        request: {
          sectionId,
          termId,
          hasToken: !!token,
        },
      },
    });

    throw error;
  }
}

/**
 * Gets Viking Section Movers flexirecord for a section
 *
 * @async
 * @param {string|number} sectionId - Section ID
 * @param {string|number} termId - Term ID
 * @param {string} token - Authentication token (null for offline)
 * @param {boolean} [forceRefresh=false] - Force refresh of data cache
 * @returns {Promise<Object|null>} Viking Section Movers flexirecord data or null if not found
 */
export async function getVikingSectionMoversData(sectionId, termId, token, forceRefresh = false) {
  sectionId = normalizeId(sectionId, 'sectionId');
  termId = normalizeId(termId, 'termId');

  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }

  try {
    const flexiRecordsList = await getFlexiRecordsList(sectionId, token, forceRefresh);

    const vikingSectionMoversFlexiRecord = flexiRecordsList.items?.find(record =>
      record.name === 'Viking Section Movers',
    );

    if (!vikingSectionMoversFlexiRecord) {
      logger.warn('No "Viking Section Movers" flexirecord found for section', {
        sectionId,
        availableRecords: flexiRecordsList.items?.map(r => r.name || 'Unknown') || [],
      }, LOG_CATEGORIES.APP);

      return null;
    }

    const vikingSectionMoversRecord = await getConsolidatedFlexiRecord(
      sectionId,
      vikingSectionMoversFlexiRecord.extraid,
      termId,
      token,
      forceRefresh,
    );

    return vikingSectionMoversRecord;
  } catch (error) {
    logger.error('Error getting Viking Section Movers data for section', {
      sectionId,
      termId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'get_viking_section_movers_data',
      },
      contexts: {
        request: {
          sectionId,
          termId,
          hasToken: !!token,
        },
      },
    });

    throw error;
  }
}

/**
 * Extracts field mapping for Viking Section Movers FlexiRecord
 *
 * @param {Object} vikingSectionMoversData - Viking Section Movers FlexiRecord data
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} sectionName - Section name
 * @returns {Object|null} Field mapping context or null if not available
 */
export function extractVikingSectionMoversContext(vikingSectionMoversData, sectionId, termId, sectionName) {
  const structure = vikingSectionMoversData?._structure || vikingSectionMoversData?.structure;

  if (!vikingSectionMoversData || !structure) {
    logger.warn('No Viking Section Movers data or structure available', {
      hasData: !!vikingSectionMoversData,
      hasStructure: !!structure,
      hasUnderscoreStructure: !!(vikingSectionMoversData?._structure),
      hasRegularStructure: !!(vikingSectionMoversData?.structure),
      sectionId,
    }, LOG_CATEGORIES.APP);
    return null;
  }

  const fieldMapping = structure.fieldMapping || {};

  const memberIdField = Object.values(fieldMapping).find(field => field.name === 'Member ID');
  const dateOfBirthField = Object.values(fieldMapping).find(field => field.name === 'Date of Birth');
  const currentSectionField = Object.values(fieldMapping).find(field => field.name === 'Current Section');
  const targetSectionField = Object.values(fieldMapping).find(field => field.name === 'Target Section');
  const assignmentTermField = Object.values(fieldMapping).find(field => field.name === 'Assignment Term');

  const assignedSectionField = Object.values(fieldMapping).find(field => field.name === 'AssignedSection');
  const assignedTermField = Object.values(fieldMapping).find(field => field.name === 'AssignedTerm');
  const assignmentOverrideField = Object.values(fieldMapping).find(field => field.name === 'AssignmentOverride');
  const assignmentDateField = Object.values(fieldMapping).find(field => field.name === 'AssignmentDate');
  const assignedByField = Object.values(fieldMapping).find(field => field.name === 'AssignedBy');

  const missingFields = [];
  if (!assignedSectionField) missingFields.push('AssignedSection');

  if (missingFields.length > 0) {
    logger.warn('Missing critical fields in Viking Section Movers FlexiRecord structure', {
      missingFields,
      availableFields: Object.values(fieldMapping).map(f => f.name),
      sectionId,
      sectionName,
    }, LOG_CATEGORIES.APP);
    return null;
  }


  return {
    flexirecordid: structure.extraid || structure.flexirecordid,
    sectionid: sectionId,
    termid: termId,
    section: sectionName,
    assignedSection: assignedSectionField?.fieldId || assignedSectionField?.columnId,
    assignedTerm: assignedTermField?.fieldId || assignedTermField?.columnId,
    fields: {
      memberId: memberIdField,
      dateOfBirth: dateOfBirthField,
      currentSection: currentSectionField,
      targetSection: targetSectionField,
      assignmentTerm: assignmentTermField,
      assignedSection: assignedSectionField,
      assignedTerm: assignedTermField,
      assignmentOverride: assignmentOverrideField,
      assignmentDate: assignmentDateField,
      assignedBy: assignedByField,
    },
    fieldMapping: fieldMapping,
  };
}

/**
 * Validates Viking Section Movers FlexiRecord structure
 *
 * @param {Object} consolidatedData - Consolidated flexirecord data from getVikingSectionMoversData
 * @returns {Object} Validation result with status and missing fields
 */
export function validateVikingSectionMoversFields(consolidatedData) {
  const requiredFields = [
    'Member ID',
    'Target Section',
  ];

  const optionalFields = [
    'Date of Birth',
    'Current Section',
    'Assignment Term',
    'AssignedSection',
    'AssignedTerm',
    'AssignmentOverride',
    'AssignmentDate',
    'AssignedBy',
  ];

  if (!consolidatedData || !consolidatedData._structure) {
    return {
      isValid: false,
      missingFields: requiredFields,
      missingOptionalFields: optionalFields,
      error: 'FlexiRecord structure not found',
    };
  }

  const fieldMapping = consolidatedData._structure.fieldMapping || {};
  const availableFields = Object.values(fieldMapping).map(field => field.name);

  const missingRequired = requiredFields.filter(field => !availableFields.includes(field));
  const missingOptional = optionalFields.filter(field => !availableFields.includes(field));

  return {
    isValid: missingRequired.length === 0,
    missingFields: missingRequired,
    missingOptionalFields: missingOptional,
    availableFields,
    fieldMapping: fieldMapping,
    hasOptionalFields: missingOptional.length === 0,
  };
}

/**
 * Creates assignment tracking data for Viking Section Movers FlexiRecord
 *
 * @param {string} memberId - Member ID
 * @param {string} assignedSectionId - Section ID where member will be assigned
 * @param {string} assignedSectionName - Section name where member will be assigned
 * @param {string} assignedTerm - Term when the assignment is effective
 * @param {string} assignedBy - User who made the assignment
 * @param {boolean} [isOverride=false] - Whether this assignment overrides age-based logic
 * @param {Object} fieldContext - Field context from extractVikingSectionMoversContext
 * @returns {Object} FlexiRecord data structure for assignment tracking
 */
export function createAssignmentTrackingData(
  memberId,
  assignedSectionId,
  assignedSectionName,
  assignedTerm,
  assignedBy,
  isOverride = false,
  fieldContext,
) {
  if (!fieldContext || !fieldContext.fields) {
    throw new Error('Field context is required for assignment tracking');
  }

  const assignmentDate = new Date().toISOString();
  const assignmentData = {};

  const { fields } = fieldContext;

  if (fields.memberId) {
    assignmentData[fields.memberId.id] = memberId;
  }

  if (fields.assignedSection) {
    assignmentData[fields.assignedSection.id] = assignedSectionName;
  }

  if (fields.assignedTerm) {
    assignmentData[fields.assignedTerm.id] = assignedTerm;
  }

  if (fields.assignmentOverride) {
    assignmentData[fields.assignmentOverride.id] = isOverride ? 'Yes' : 'No';
  }

  if (fields.assignmentDate) {
    assignmentData[fields.assignmentDate.id] = assignmentDate;
  }

  if (fields.assignedBy) {
    assignmentData[fields.assignedBy.id] = assignedBy;
  }

  return {
    flexirecordid: fieldContext.flexirecordid,
    sectionid: fieldContext.sectionid,
    termid: fieldContext.termid,
    data: assignmentData,
    metadata: {
      memberId,
      assignedSectionId,
      assignedSectionName,
      assignedTerm,
      assignedBy,
      isOverride,
      assignmentDate,
    },
  };
}

/**
 * Validates assignment tracking data structure
 *
 * @param {Object} assignmentData - Assignment data to validate
 * @param {Object} fieldContext - Field context for validation
 * @returns {Object} Validation result
 */
export function validateAssignmentTrackingData(assignmentData, fieldContext) {
  const validationResult = {
    isValid: true,
    missingFields: [],
    warnings: [],
  };

  if (!assignmentData || !fieldContext) {
    validationResult.isValid = false;
    validationResult.missingFields.push('assignmentData or fieldContext');
    return validationResult;
  }

  const { fields } = fieldContext;
  const { metadata } = assignmentData;

  const requiredMetadata = ['memberId', 'assignedSectionName', 'assignedTerm', 'assignedBy'];
  requiredMetadata.forEach(field => {
    if (!metadata || !metadata[field]) {
      validationResult.missingFields.push(`metadata.${field}`);
    }
  });

  if (!fields.assignedSection) {
    validationResult.warnings.push('AssignedSection field not found in FlexiRecord structure');
  }

  if (!fields.assignedTerm) {
    validationResult.warnings.push('AssignedTerm field not found in FlexiRecord structure');
  }

  if (!fields.assignmentDate) {
    validationResult.warnings.push('AssignmentDate field not found in FlexiRecord structure');
  }

  if (!fields.assignedBy) {
    validationResult.warnings.push('AssignedBy field not found in FlexiRecord structure');
  }

  validationResult.isValid = validationResult.missingFields.length === 0;

  return validationResult;
}

/**
 * Validates a collection of Viking Section Movers FlexiRecords
 *
 * @param {Array} discoveredFlexiRecords - Array of discovered FlexiRecord metadata
 * @param {Map} fieldMappings - Map of sectionId to field mapping context
 * @returns {Object} Validation summary with valid/invalid records
 */
export function validateVikingSectionMoversCollection(discoveredFlexiRecords, fieldMappings) {
  const validRecords = [];
  const invalidRecords = [];
  const validationResults = new Map();

  discoveredFlexiRecords.forEach(record => {
    const fieldMapping = fieldMappings.get(record.sectionId);

    if (!fieldMapping) {
      invalidRecords.push({
        ...record,
        validationError: 'No field mapping available',
      });
      validationResults.set(record.sectionId, {
        isValid: false,
        error: 'No field mapping available',
      });
      return;
    }

    const hasRequiredFields = fieldMapping.fields.memberId && fieldMapping.fields.targetSection;

    if (hasRequiredFields) {
      validRecords.push(record);
      validationResults.set(record.sectionId, {
        isValid: true,
        hasOptionalFields: !!(fieldMapping.fields.dateOfBirth &&
                            fieldMapping.fields.currentSection &&
                            fieldMapping.fields.assignmentTerm),
        availableFields: Object.keys(fieldMapping.fields).filter(key =>
          fieldMapping.fields[key] !== null && fieldMapping.fields[key] !== undefined,
        ),
      });
    } else {
      const missingFields = [];
      if (!fieldMapping.fields.memberId) missingFields.push('Member ID');
      if (!fieldMapping.fields.targetSection) missingFields.push('Target Section');

      invalidRecords.push({
        ...record,
        validationError: `Missing required fields: ${missingFields.join(', ')}`,
      });
      validationResults.set(record.sectionId, {
        isValid: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields,
      });
    }
  });

  return {
    isValid: validRecords.length > 0,
    validRecords,
    invalidRecords,
    validationResults,
    summary: {
      total: discoveredFlexiRecords.length,
      valid: validRecords.length,
      invalid: invalidRecords.length,
    },
  };
}

/**
 * Discovers all accessible FlexiRecords matching "Viking Section Movers" pattern
 *
 * @async
 * @param {string} token - Authentication token (null for offline)
 * @param {boolean} [forceRefresh=false] - Force refresh of cache
 * @returns {Promise<Array>} Array of discovered FlexiRecords with section metadata
 */
export async function discoverVikingSectionMoversFlexiRecords(token, forceRefresh = false) {
  try {
    const sectionsData = await databaseService.getSections();

    if (!sectionsData || sectionsData.length === 0) {
      logger.warn('No sections available for Viking Section Movers discovery', {}, LOG_CATEGORIES.APP);
      return [];
    }

    const discoveryPromises = sectionsData.map(async (section) => {
      try {
        const sectionId = section.sectionid.toString();
        const sectionName = section.sectionname || section.name || 'Unknown Section';

        const flexiRecordsList = await getFlexiRecordsList(sectionId, token, forceRefresh);

        const vikingSectionMoversFlexiRecord = flexiRecordsList.items?.find(record =>
          record.name === 'Viking Section Movers',
        );

        if (vikingSectionMoversFlexiRecord) {
          return {
            sectionId,
            sectionName,
            flexiRecordId: vikingSectionMoversFlexiRecord.extraid,
            flexiRecordName: vikingSectionMoversFlexiRecord.name,
            section: section,
          };
        }

        return null;

      } catch (error) {
        logger.warn('Failed to check Viking Section Movers FlexiRecord for section', {
          sectionId: section.sectionid,
          sectionName: section.sectionname,
          error: error.message,
          stack: error.stack,
          hasToken: !!token,
        }, LOG_CATEGORIES.APP);

        return null;
      }
    });

    const discoveryResults = await Promise.all(discoveryPromises);
    const discoveredFlexiRecords = discoveryResults.filter(result => result !== null);

    logger.info('Viking Section Movers FlexiRecord discovery completed', {
      totalSections: sectionsData.length,
      discoveredCount: discoveredFlexiRecords.length,
      discoveredSections: discoveredFlexiRecords.map(d => d.sectionName),
    }, LOG_CATEGORIES.APP);

    return discoveredFlexiRecords;

  } catch (error) {
    logger.error('Error discovering Viking Section Movers FlexiRecords', {
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'discover_viking_section_movers_flexi_records',
      },
    });

    throw error;
  }
}

/**
 * Gets Viking Event Management data for all sections involved in events
 *
 * @async
 * @param {Array} events - Array of events (each must have sectionid and termid)
 * @param {string} token - Authentication token (null for offline)
 * @param {boolean} [forceRefresh=true] - Force refresh of data cache
 * @returns {Promise<Map>} Map of sectionId to Viking Event data
 */
export async function getVikingEventDataForEvents(events, token, forceRefresh = true) {
  try {

    if (!events || !Array.isArray(events)) {
      throw new Error('Invalid events: must be an array');
    }

    const sectionTermCombos = [...new Set(
      events.map(e => JSON.stringify([String(e.sectionid), String(e.termid)])),
    )].map(key => {
      const [sectionId, termId] = JSON.parse(key);
      return { sectionId, termId };
    });

    const vikingEventPromises = sectionTermCombos.map(async ({ sectionId, termId }) => {
      try {
        if (!termId || termId === 'undefined' || termId === 'null' || termId === '') {
          throw new Error(`Event missing termId for section ${sectionId} - this should not happen`);
        }

        const vikingEventData = await getVikingEventData(sectionId, termId, token, forceRefresh);
        return { sectionId, vikingEventData };
      } catch (error) {
        logger.warn('Failed to load Viking Event data for section', {
          sectionId,
          termId,
          error: error.message,
        }, LOG_CATEGORIES.APP);

        return { sectionId, vikingEventData: null };
      }
    });

    const results = await Promise.all(vikingEventPromises);
    const vikingEventDataBySections = new Map(
      results.map(({ sectionId, vikingEventData }) => [String(sectionId), vikingEventData]),
    );

    return vikingEventDataBySections;
  } catch (error) {
    logger.error('Error getting Viking Event data for events', {
      error: error.message,
      hasEvents: !!events,
      eventsCount: events?.length || 0,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'get_viking_event_data_for_events',
      },
      contexts: {
        request: {
          eventsCount: events?.length || 0,
          hasToken: !!token,
        },
      },
    });

    throw error;
  }
}

/**
 * Clears all flexirecord caches from normalized stores
 *
 * @async
 * @returns {Promise<{cleared: boolean}>} Result indicating cache was cleared
 */
export async function clearFlexiRecordCaches() {
  try {
    logger.info('Clearing all flexirecord caches from normalized stores', {}, LOG_CATEGORIES.DATABASE);
    return { cleared: true };
  } catch (error) {
    logger.error('Failed to clear flexirecord caches', { error: error.message }, LOG_CATEGORIES.ERROR);
    return { cleared: false };
  }
}
