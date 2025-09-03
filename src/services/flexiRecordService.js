// FlexiRecord Service for Viking Event Management
// Handles flexirecord data operations with caching following existing patterns

function hasUsableToken(token) {
  if (typeof token !== 'string') {
    return false;
  }
  return token.trim().length > 0;
}

import { safeGetItem, safeSetItem } from '../utils/storageUtils.js';
import { checkNetworkStatus } from '../utils/networkUtils.js';
import logger, { LOG_CATEGORIES } from './logger.js';
import { sentryUtils } from './sentry.js';
import { isDemoMode } from '../config/demoMode.js';
import { 
  getFlexiRecords,
  getFlexiStructure, 
  getSingleFlexiRecord,
} from './api.js';

// Cache TTL constants - localStorage only for persistence
const FLEXI_STRUCTURES_CACHE_TTL = 60 * 60 * 1000; // 1 hour - field definitions are static
const FLEXI_DATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes - attendance changes frequently
const FLEXI_LISTS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes - available flexirecords per section

// Helper function to check if localStorage cache is valid
function isCacheValid(cacheKey, ttl) {
  const cached = safeGetItem(cacheKey, null);
  if (!cached || !cached._cacheTimestamp) {
    return { valid: false, data: null };
  }
  
  const cacheAge = Date.now() - cached._cacheTimestamp;
  const isValid = cacheAge < ttl;
  
  return { valid: isValid, data: cached, cacheAgeMinutes: Math.round(cacheAge / 60000) };
}

// Helper function to cache data with timestamp
function cacheData(cacheKey, data) {
  const cachedData = {
    ...data,
    _cacheTimestamp: Date.now(),
  };
  
  // Pre-compute once; guard against (de)serialisation errors in logs
  const itemCount = Array.isArray(cachedData.items) ? cachedData.items.length : 0;
  let dataSize;
  try {
    dataSize = new globalThis.TextEncoder().encode(JSON.stringify(cachedData)).length;
  } catch {
    dataSize = null; // not JSON-serialisable
  }

  try {
    const success = safeSetItem(cacheKey, cachedData);
    if (success) {
      // FlexiRecord data cached successfully
    } else {
      logger.error('FlexiRecord caching failed - safeSetItem returned falsy', {
        cacheKey,
        dataSize,
        itemCount,
      }, LOG_CATEGORIES.ERROR);
    }
  } catch (cacheError) {
    logger.error('FlexiRecord caching error', {
      cacheKey,
      error: cacheError.message,
      dataSize,
      itemCount,
    }, LOG_CATEGORIES.ERROR);
    
    sentryUtils.captureException(cacheError, {
      tags: {
        operation: 'flexirecord_cache',
        cacheKey,
      },
      contexts: {
        data: {
          size: dataSize,
          hasItems: itemCount > 0,
          itemCount,
        },
      },
    });
  }
  
  return data; // Return original data without timestamp
}

/**
 * Get available flexirecords for a section (follows getTerms pattern)
 * @param {string} sectionId - Section ID
 * @param {string} token - Authentication token  
 * @param {boolean} forceRefresh - Force API call ignoring cache
 * @returns {Promise<Object>} Flexirecords list
 */
export async function getFlexiRecordsList(sectionId, token, forceRefresh = false) {
  if (!sectionId || typeof sectionId !== 'string') {
    throw new Error('Valid sectionId (string) is required');
  }
  
  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }
  
  try {
    // Skip API calls in demo mode - use cached data only
    if (isDemoMode()) {
      const cacheKey = `demo_viking_flexi_lists_${sectionId}_offline`;
      const cached = safeGetItem(cacheKey, { items: [] });
      return cached;
    }
    
    const cacheKey = `viking_flexi_lists_${sectionId}_offline`;
    
    // If no token available, skip API calls and use cached data only
    if (!hasUsableToken(token)) {
      const cached = safeGetItem(cacheKey, { items: [] });
      return cached;
    }
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cacheCheck = isCacheValid(cacheKey, FLEXI_LISTS_CACHE_TTL);
      if (cacheCheck.valid) {
        // Using cached flexirecords list
        return cacheCheck.data;
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(cacheKey, { items: [] });
      // Retrieved flexirecords from localStorage while offline
      return cached;
    }

    // token is guaranteed here due to early return above

    // Get fresh data from API
    // Fetching flexirecords list from API
    const flexiRecords = await getFlexiRecords(sectionId, token);
    
    // Cache data with timestamp
    const cachedData = cacheData(cacheKey, flexiRecords);
    
    return cachedData;
    
  } catch (error) {
    logger.error('Error fetching flexirecords list', {
      sectionId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // Try cache as fallback
    try {
      const cacheKey = `viking_flexi_lists_${sectionId}_offline`;
      const cached = safeGetItem(cacheKey, null);
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
 * Get flexirecord structure (field definitions) - cached longer as they don't change often
 * @param {string} flexirecordId - FlexiRecord ID
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} token - Authentication token
 * @param {boolean} forceRefresh - Force API call ignoring cache
 * @returns {Promise<Object>} FlexiRecord structure
 */
export async function getFlexiRecordStructure(flexirecordId, sectionId, termId, token, forceRefresh = false) {
  if (!flexirecordId || typeof flexirecordId !== 'string') {
    throw new Error('Valid flexirecordId (string) is required');
  }
  if (!sectionId || typeof sectionId !== 'string') {
    throw new Error('Valid sectionId (string) is required');
  }
  if (!termId || typeof termId !== 'string') {
    throw new Error('Valid termId (string) is required');
  }
  
  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }
  
  try {
    // Skip API calls in demo mode - use cached data only
    if (isDemoMode()) {
      const cacheKey = `demo_viking_flexi_structure_${flexirecordId}_offline`;
      const cached = safeGetItem(cacheKey, null);
      return cached;
    }
    
    const cacheKey = `viking_flexi_structure_${flexirecordId}_offline`;
    
    // If no token available, skip API calls and use cached data only
    if (!hasUsableToken(token)) {
      const cached = safeGetItem(cacheKey, null);
      return cached;
    }
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cacheCheck = isCacheValid(cacheKey, FLEXI_STRUCTURES_CACHE_TTL);
      if (cacheCheck.valid) {
        // Using cached flexirecord structure
        return cacheCheck.data;
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(cacheKey, null);
      if (cached) {
        // Retrieved structure from localStorage while offline
        return cached;
      }
      return null;
    }

    // token is guaranteed here due to early return above

    // Get fresh data from API
    // Fetching flexirecord structure from API
    const structure = await getFlexiStructure(flexirecordId, sectionId, termId, token);
    
    if (!structure) {
      throw new Error('Failed to retrieve flexirecord structure');
    }
    
    // Cache data with timestamp
    const cachedData = cacheData(cacheKey, structure);
    
    return cachedData;
    
  } catch (error) {
    logger.error('Error fetching flexirecord structure', {
      flexirecordId,
      sectionId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // Try cache as fallback
    try {
      const cacheKey = `viking_flexi_structure_${flexirecordId}_offline`;
      const cached = safeGetItem(cacheKey, null);
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
 * Get flexirecord attendance data - refreshed frequently as it changes often
 * @param {string} flexirecordId - FlexiRecord ID
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} token - Authentication token
 * @param {boolean} forceRefresh - Force API call ignoring cache (default: true)
 * @returns {Promise<Object>} FlexiRecord attendance data
 */
export async function getFlexiRecordData(flexirecordId, sectionId, termId, token, forceRefresh = true) {
  if (!flexirecordId || typeof flexirecordId !== 'string') {
    throw new Error('Valid flexirecordId (string) is required');
  }
  if (!sectionId || typeof sectionId !== 'string') {
    throw new Error('Valid sectionId (string) is required');
  }
  if (!termId || typeof termId !== 'string') {
    throw new Error('Valid termId (string) is required');
  }
  
  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = true;
  }
  
  try {
    // Skip API calls in demo mode - use cached data only
    if (isDemoMode()) {
      const storageKey = `demo_viking_flexi_data_${flexirecordId}_${sectionId}_${termId}_offline`;
      const cached = safeGetItem(storageKey, null);
      return cached;
    }
    
    const storageKey = `viking_flexi_data_${flexirecordId}_${sectionId}_${termId}_offline`;
    
    // If no token available, skip API calls and use cached data only
    if (!hasUsableToken(token)) {
      const cached = safeGetItem(storageKey, null);
      return cached;
    }
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cacheCheck = isCacheValid(storageKey, FLEXI_DATA_CACHE_TTL);
      if (cacheCheck.valid) {
        // Using cached flexirecord data
        return cacheCheck.data;
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(storageKey, null);
      if (cached) {
        // Retrieved flexirecord data from localStorage while offline
        return cached;
      }
      return null;
    }

    // token is guaranteed here due to early return above

    // Get fresh data from API
    // Fetching flexirecord data from API
    const data = await getSingleFlexiRecord(flexirecordId, sectionId, termId, token);
    
    if (!data) {
      throw new Error('Failed to retrieve flexirecord data');
    }
    
    // Cache data with timestamp
    const cachedData = cacheData(storageKey, data);
    
    return cachedData;
    
  } catch (error) {
    logger.error('Error fetching flexirecord data', {
      flexirecordId,
      sectionId,
      termId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // Try cache as fallback
    try {
      const storageKey = `viking_flexi_data_${flexirecordId}_${sectionId}_${termId}_offline`;
      const cached = safeGetItem(storageKey, null);
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
 * Get consolidated flexirecord data with meaningful field names
 * This is the main function that combines structure and data retrieval with caching
 * 
 * @param {string} sectionId - Section ID
 * @param {string} flexirecordId - FlexiRecord ID (extraid)
 * @param {string} termId - Term ID
 * @param {string} token - Authentication token (null for offline-only)
 * @param {boolean} forceRefresh - Force refresh of data cache
 * @returns {Promise<Object>} Consolidated flexirecord data with meaningful field names
 * @throws {Error} If any API call fails or data is invalid
 */
export async function getConsolidatedFlexiRecord(sectionId, flexirecordId, termId, token, forceRefresh = false) {
  try {
    if (!sectionId || !flexirecordId || !termId) {
      throw new Error('Missing required parameters: sectionId, flexirecordId, and termId are required');
    }

    // Getting consolidated flexirecord data

    // Get structure and data using service layer caching
    const [structureData, flexiData] = await Promise.all([
      getFlexiRecordStructure(flexirecordId, sectionId, termId, token, false), // Structure cached longer
      getFlexiRecordData(flexirecordId, sectionId, termId, token, forceRefresh), // Data refreshed more often
    ]);

    if (!structureData) {
      throw new Error('Failed to retrieve flexirecord structure');
    }

    if (!flexiData) {
      throw new Error('Failed to retrieve flexirecord data');
    }

    // Parse structure to get field mapping (moved to transforms)
    const { parseFlexiStructure, transformFlexiRecordData } = await import('../utils/flexiRecordTransforms.js');
    const fieldMapping = parseFlexiStructure(structureData);

    // Transform data using field mapping
    const consolidatedData = transformFlexiRecordData(flexiData, fieldMapping);

    // Convert fieldMapping Map to object for easier access
    // Use fieldId as key to ensure uniqueness and prevent overwrites
    const fieldMappingObj = {};
    fieldMapping.forEach((fieldInfo, fieldId) => {
      fieldMappingObj[fieldId] = {
        columnId: fieldId,
        ...fieldInfo,
      };
    });

    // Add structure metadata to result
    consolidatedData._structure = {
      name: structureData.name,
      extraid: structureData.extraid,
      flexirecordid: structureData.extraid, // Alias for backward compatibility
      sectionid: structureData.sectionid,
      archived: structureData.archived === '1',
      softDeleted: structureData.soft_deleted === '1',
      fieldMapping: fieldMappingObj, // Add the field mapping for drag-and-drop context
    };

    // Successfully consolidated flexirecord data

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
 * Get Viking Event Management flexirecord for a section
 * Looks for flexirecord with name="Viking Event Mgmt"
 * 
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} token - Authentication token (null for offline)
 * @param {boolean} forceRefresh - Force refresh of data cache (default: false)
 * @returns {Promise<Object|null>} Viking Event Mgmt flexirecord data or null if not found
 */
export async function getVikingEventData(sectionId, termId, token, forceRefresh = false) {
  if (!sectionId || typeof sectionId !== 'string') {
    throw new Error('Valid sectionId (string) is required');
  }
  if (!termId || typeof termId !== 'string') {
    throw new Error('Valid termId (string) is required');
  }
  
  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }
  
  try {

    // Getting Viking Event data for section

    // Get flexirecords list
    const flexiRecordsList = await getFlexiRecordsList(sectionId, token);

    // Find the Viking Event Mgmt flexirecord ID from the list
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

    // Found "Viking Event Mgmt" flexirecord in list

    // Get the consolidated data (structure + data) for the "Viking Event Mgmt" flexirecord
    const vikingEventRecord = await getConsolidatedFlexiRecord(
      sectionId, 
      vikingEventFlexiRecord.extraid, 
      termId, 
      token,
      forceRefresh, // Pass through forceRefresh parameter
    );

    // Found "Viking Event Mgmt" flexirecord

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
 * Get Viking Section Movers flexirecord for a section
 * Looks for flexirecord with name="Viking Section Movers"
 * 
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} token - Authentication token (null for offline)
 * @param {boolean} forceRefresh - Force refresh of data cache (default: false)
 * @returns {Promise<Object|null>} Viking Section Movers flexirecord data or null if not found
 */
export async function getVikingSectionMoversData(sectionId, termId, token, forceRefresh = false) {
  if (!sectionId || typeof sectionId !== 'string') {
    throw new Error('Valid sectionId (string) is required');
  }
  if (!termId || typeof termId !== 'string') {
    throw new Error('Valid termId (string) is required');
  }
  
  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }
  
  try {

    // Getting Viking Section Movers data for section

    // Get flexirecords list
    const flexiRecordsList = await getFlexiRecordsList(sectionId, token);

    // Find the Viking Section Movers flexirecord ID from the list
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

    // Found "Viking Section Movers" flexirecord in list

    // Get the consolidated data (structure + data) for the "Viking Section Movers" flexirecord
    const vikingSectionMoversRecord = await getConsolidatedFlexiRecord(
      sectionId, 
      vikingSectionMoversFlexiRecord.extraid, 
      termId, 
      token,
      forceRefresh, // Pass through forceRefresh parameter
    );

    // Found "Viking Section Movers" flexirecord

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
 * Extract field mapping for Viking Section Movers FlexiRecord
 * Maps required fields (Member ID, Date of Birth, Current Section, Target Section, Assignment Term)
 * following the extractFlexiRecordContext pattern
 * 
 * @param {Object} vikingSectionMoversData - Viking Section Movers FlexiRecord data  
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} sectionName - Section name
 * @returns {Object|null} Field mapping context or null if not available
 */
export function extractVikingSectionMoversContext(vikingSectionMoversData, sectionId, termId, sectionName) {
  // Try both _structure and structure properties for compatibility
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
  
  // Find required fields from the structure
  const memberIdField = Object.values(fieldMapping).find(field => field.name === 'Member ID');
  const dateOfBirthField = Object.values(fieldMapping).find(field => field.name === 'Date of Birth');
  const currentSectionField = Object.values(fieldMapping).find(field => field.name === 'Current Section');
  const targetSectionField = Object.values(fieldMapping).find(field => field.name === 'Target Section');
  const assignmentTermField = Object.values(fieldMapping).find(field => field.name === 'Assignment Term');
  
  // New assignment tracking fields
  const assignedSectionField = Object.values(fieldMapping).find(field => field.name === 'AssignedSection');
  const assignedTermField = Object.values(fieldMapping).find(field => field.name === 'AssignedTerm');
  const assignmentOverrideField = Object.values(fieldMapping).find(field => field.name === 'AssignmentOverride');
  const assignmentDateField = Object.values(fieldMapping).find(field => field.name === 'AssignmentDate');
  const assignedByField = Object.values(fieldMapping).find(field => field.name === 'AssignedBy');

  // Check for missing critical fields - using actual field names
  // Note: Viking Section Movers FlexiRecord doesn't have Member ID - it only tracks assignments
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
    // Return the actual field IDs for use in API calls
    assignedSection: assignedSectionField?.fieldId || assignedSectionField?.columnId,
    assignedTerm: assignedTermField?.fieldId || assignedTermField?.columnId,
    fields: {
      memberId: memberIdField,
      dateOfBirth: dateOfBirthField,
      currentSection: currentSectionField,
      targetSection: targetSectionField,
      assignmentTerm: assignmentTermField,
      // New assignment tracking fields
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
 * Validate Viking Section Movers FlexiRecord structure
 * Checks if required fields exist for section movement assignments
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
    // New assignment tracking fields (optional for backward compatibility)
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
 * Create assignment tracking data for Viking Section Movers FlexiRecord
 * This function creates the data structure needed to track member assignments
 * 
 * @param {string} memberId - Member ID
 * @param {string} assignedSectionId - Section ID where member will be assigned
 * @param {string} assignedSectionName - Section name where member will be assigned
 * @param {string} assignedTerm - Term when the assignment is effective
 * @param {string} assignedBy - User who made the assignment
 * @param {boolean} isOverride - Whether this assignment overrides age-based logic
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

  // Map the assignment data to the appropriate field IDs
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
 * Validate assignment tracking data structure
 * Ensures all required fields for assignment tracking are present
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

  // Check required metadata
  const requiredMetadata = ['memberId', 'assignedSectionName', 'assignedTerm', 'assignedBy'];
  requiredMetadata.forEach(field => {
    if (!metadata || !metadata[field]) {
      validationResult.missingFields.push(`metadata.${field}`);
    }
  });

  // Check for assignment tracking field availability
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
 * Validate a collection of Viking Section Movers FlexiRecords
 * Filters out invalid records and returns validation summary
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

    // Check if required fields exist
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
 * Discover all accessible FlexiRecords matching "Viking Section Movers" pattern
 * Scans through all accessible sections to find Viking Section Movers FlexiRecords
 * 
 * @param {string} token - Authentication token (null for offline)
 * @param {boolean} forceRefresh - Force refresh of cache (default: false)
 * @returns {Promise<Array>} Array of discovered FlexiRecords with section metadata
 */
export async function discoverVikingSectionMoversFlexiRecords(token, forceRefresh = false) {
  try {
    const { default: databaseService } = await import('./database.js');
    
    // Get all accessible sections
    const sectionsData = await databaseService.getSections();
    
    if (!sectionsData || sectionsData.length === 0) {
      logger.warn('No sections available for Viking Section Movers discovery', {}, LOG_CATEGORIES.APP);
      return [];
    }

    // Discover Viking Section Movers FlexiRecords across all sections
    const discoveryPromises = sectionsData.map(async (section) => {
      try {
        const sectionId = section.sectionid;
        const sectionName = section.sectionname || section.name || 'Unknown Section';
        
        // Get FlexiRecords list for this section
        const flexiRecordsList = await getFlexiRecordsList(sectionId, token, forceRefresh);
        
        // Find Viking Section Movers FlexiRecord
        const vikingSectionMoversFlexiRecord = flexiRecordsList.items?.find(record => 
          record.name === 'Viking Section Movers',
        );
        
        if (vikingSectionMoversFlexiRecord) {
          return {
            sectionId,
            sectionName,
            flexiRecordId: vikingSectionMoversFlexiRecord.extraid,
            flexiRecordName: vikingSectionMoversFlexiRecord.name,
            section: section, // Full section object for additional metadata
          };
        }
        
        return null; // No Viking Section Movers FlexiRecord found for this section
        
      } catch (error) {
        logger.warn('Failed to check Viking Section Movers FlexiRecord for section', {
          sectionId: section.sectionid,
          sectionName: section.sectionname,
          error: error.message,
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
 * Get Viking Event Management data for all sections involved in events
 * Each event contains its own termId, so we use section-term combinations from the events
 * 
 * @param {Array} events - Array of events (each must have sectionid and termid)
 * @param {string} token - Authentication token (null for offline)
 * @param {boolean} forceRefresh - Force refresh of data cache (default: true for dynamic data)
 * @returns {Promise<Map>} Map of sectionId to Viking Event data
 */
export async function getVikingEventDataForEvents(events, token, forceRefresh = true) {
  try {
    if (!events || !Array.isArray(events)) {
      throw new Error('Invalid events: must be an array');
    }

    // Get unique section-term combinations from events
    const sectionTermCombos = [...new Set(
      events.map(e => JSON.stringify([e.sectionid, e.termid])),
    )].map(key => {
      const [sectionId, termId] = JSON.parse(key);
      return { sectionId, termId };
    });

    // Getting Viking Event data for section-term combinations

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
      results.map(({ sectionId, vikingEventData }) => [sectionId, vikingEventData]),
    );

    // const successCount = results.filter(r => r.vikingEventData !== null).length;

    // Completed loading Viking Event data for sections

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
 * Clear all flexirecord caches (useful for debugging or when data needs refresh)
 */
export function clearFlexiRecordCaches() {
  // Clearing all flexirecord caches
  
  // Clear localStorage caches
  const keys = Object.keys(localStorage);
  const flexiKeys = keys.filter(key => 
    key.includes('viking_flexi_') && key.includes('_offline'),
  );
  
  flexiKeys.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Cleared flexirecord caches
  
  return {
    clearedLocalStorageKeys: flexiKeys.length,
  };
}