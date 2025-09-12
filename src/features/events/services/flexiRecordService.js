/**
 * @file FlexiRecord Service for Viking Event Management
 * 
 * Comprehensive service for managing OSM FlexiRecord operations with offline-first
 * architecture and intelligent caching. Handles Scout attendance data, section
 * movement tracking, and custom data fields with automatic fallback mechanisms.
 * 
 * Key features:
 * - Offline-first with localStorage caching and TTL management
 * - Specialized support for Viking Event Management and Section Movers FlexiRecords
 * - Network-aware operations with automatic fallback to cached data
 * - Demo mode data segregation and comprehensive error handling
 * - Field mapping and data transformation for meaningful FlexiRecord usage
 * - Multi-section FlexiRecord discovery and validation
 * 
 * @module FlexiRecordService
 * @requires ../../../shared/utils/storageUtils
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
 * 
 * @example
 * // Check token before API call
 * if (hasUsableToken(authToken)) {
 *   // Proceed with API request
 * } else {
 *   // Use cached data only
 * }
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
 * 
 * @example
 * // Normalize section ID
 * const sectionId = normalizeId(123, 'sectionId'); // Returns "123"
 * const termId = normalizeId('term_456', 'termId'); // Returns "term_456"
 */
function normalizeId(id, name) {
  if (typeof id === 'number') return String(id);
  if (typeof id === 'string' && id.trim() !== '' && id !== 'undefined' && id !== 'null') return id;
  throw new Error(`Valid ${name} (string or number) is required`);
}

import { safeGetItem, safeSetItem } from '../../../shared/utils/storageUtils.js';
import { checkNetworkStatus } from '../../../shared/utils/networkUtils.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { sentryUtils } from '../../../shared/services/utils/sentry.js';
import { isDemoMode } from '../../../config/demoMode.js';
import { 
  getFlexiRecords,
  getFlexiStructure, 
  getSingleFlexiRecord,
} from '../../../shared/services/api/api.js';

/**
 * Cache TTL constants for different types of FlexiRecord data
 * 
 * Optimized for different data change frequencies:
 * - Structures change rarely (field definitions are static)
 * - Data changes frequently (attendance is live during events)
 * - Lists change occasionally (new FlexiRecords added periodically)
 */

/** @constant {number} Cache TTL for FlexiRecord structures (1 hour) */
const FLEXI_STRUCTURES_CACHE_TTL = 60 * 60 * 1000; // 1 hour - field definitions are static

/** @constant {number} Cache TTL for FlexiRecord data (5 minutes) */
const FLEXI_DATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes - attendance changes frequently

/** @constant {number} Cache TTL for FlexiRecord lists (30 minutes) */
const FLEXI_LISTS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes - available flexirecords per section

/**
 * Checks if localStorage cache is still valid based on TTL
 * 
 * @private
 * @param {string} cacheKey - Cache key to check
 * @param {number} ttl - Time-to-live in milliseconds
 * @returns {object} Cache validity result with data and age information
 * @returns {boolean} returns.valid - Whether cache is still valid
 * @returns {*} returns.data - Cached data if available
 * @returns {number} returns.cacheAgeMinutes - Age of cache in minutes
 * 
 * @example
 * // Check if events cache is valid
 * const cacheCheck = isCacheValid('viking_events_1_offline', FLEXI_LISTS_CACHE_TTL);
 * if (cacheCheck.valid) {
 *   console.log(`Using cache from ${cacheCheck.cacheAgeMinutes} minutes ago`);
 *   return cacheCheck.data;
 * }
 */
function isCacheValid(cacheKey, ttl) {
  const cached = safeGetItem(cacheKey, null);
  if (!cached || !cached._cacheTimestamp) {
    return { valid: false, data: null };
  }
  
  const cacheAge = Date.now() - cached._cacheTimestamp;
  const isValid = cacheAge < ttl;
  
  return { valid: isValid, data: cached, cacheAgeMinutes: Math.round(cacheAge / 60000) };
}

/**
 * Caches data with timestamp and comprehensive error handling
 * 
 * @private
 * @param {string} cacheKey - Cache key for localStorage
 * @param {*} data - Data to cache (will be JSON serialized)
 * @returns {*} Original data without timestamp (for chaining)
 * 
 * @example
 * // Cache FlexiRecord data with automatic timestamp
 * const cachedData = cacheData('viking_flexi_data_123_offline', flexiData);
 * return cachedData; // Returns original data for immediate use
 */
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
 * Gets available FlexiRecords for a Scout section with intelligent caching
 * 
 * Retrieves list of FlexiRecords available for a section with offline-first
 * approach and demo mode support. Uses localStorage caching with configurable
 * TTL and automatically falls back to cached data when offline or on API failure.
 * 
 * @async
 * @param {string|number} sectionId - Section identifier
 * @param {string} token - OSM authentication token (null for offline mode)
 * @param {boolean} [forceRefresh=false] - Force API call ignoring cache validity
 * @returns {Promise<object>} FlexiRecords list with metadata
 * @returns {Array} returns.items - Array of available FlexiRecord objects
 * @returns {number} [returns._cacheTimestamp] - Cache timestamp for debugging
 * 
 * @example
 * // Get FlexiRecords for Beavers section
 * const flexiRecords = await getFlexiRecordsList(1, authToken);
 * 
 * console.log(`Found ${flexiRecords.items.length} FlexiRecords:`);
 * flexiRecords.items.forEach(record => {
 *   console.log(`- ${record.name} (ID: ${record.extraid})`);
 * });
 * 
 * @example
 * // Force refresh for up-to-date data
 * const freshRecords = await getFlexiRecordsList(sectionId, token, true);
 * 
 * @example
 * // Offline usage with cached data
 * const cachedRecords = await getFlexiRecordsList(sectionId, null);
 */
export async function getFlexiRecordsList(sectionId, token, forceRefresh = false) {
  sectionId = normalizeId(sectionId, 'sectionId');
  
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
    
    // If no token available, skip API calls and use empty cache fallback
    if (!hasUsableToken(token)) {
      logger.info('No usable token for section, skipping API call', { sectionId }, LOG_CATEGORIES.APP);
      const emptyCache = safeGetItem(cacheKey, { items: [] });
      return emptyCache;
    }
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cacheCheck = isCacheValid(cacheKey, FLEXI_LISTS_CACHE_TTL);
      if (cacheCheck.valid) {
        return cacheCheck.data;
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(cacheKey, { items: [] });
      return cached;
    }

    // token is guaranteed here due to early return above

    // Get fresh data from API
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
 * Gets FlexiRecord structure with field definitions and metadata
 * 
 * Retrieves the structure/schema for a specific FlexiRecord including field
 * definitions, types, and configuration. Cached longer than data as field
 * definitions rarely change. Essential for understanding FlexiRecord layout
 * and mapping field IDs to meaningful names.
 * 
 * @async
 * @param {string|number} flexirecordId - FlexiRecord identifier
 * @param {string|number} sectionId - Section identifier
 * @param {string|number} termId - Term identifier
 * @param {string} token - OSM authentication token (null for offline mode)
 * @param {boolean} [forceRefresh=false] - Force API call ignoring cache validity
 * @returns {Promise<object | null>} FlexiRecord structure or null if not found
 * @returns {string} returns.name - FlexiRecord name
 * @returns {string} returns.extraid - FlexiRecord external ID
 * @returns {object} returns.structure - Field definitions and configuration
 * @returns {number} [returns._cacheTimestamp] - Cache timestamp for debugging
 * 
 * @example
 * // Get structure for Viking Event Management FlexiRecord
 * const structure = await getFlexiRecordStructure('flexi_123', 1, 'term_456', token);
 * 
 * if (structure) {
 *   console.log(`FlexiRecord: ${structure.name}`);
 *   console.log('Available fields:', Object.keys(structure.structure.columns));
 * }
 * 
 * @example
 * // Use structure to understand field mappings
 * const structure = await getFlexiRecordStructure(flexiId, sectionId, termId, token);
 * const fieldMapping = parseFlexiStructure(structure);
 * 
 * // Map field IDs to human-readable names
 * fieldMapping.forEach((fieldInfo, fieldId) => {
 *   console.log(`Field ${fieldId}: ${fieldInfo.name} (${fieldInfo.type})`);
 * });
 */
export async function getFlexiRecordStructure(flexirecordId, sectionId, termId, token, forceRefresh = false) {
  flexirecordId = normalizeId(flexirecordId, 'flexirecordId');
  sectionId = normalizeId(sectionId, 'sectionId');
  termId = normalizeId(termId, 'termId');
  
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
 * @param {string|number} flexirecordId - FlexiRecord ID
 * @param {string|number} sectionId - Section ID
 * @param {string|number} termId - Term ID
 * @param {string} token - Authentication token
 * @param {boolean} forceRefresh - Force API call ignoring cache (default: true)
 * @returns {Promise<object>} FlexiRecord attendance data
 */
export async function getFlexiRecordData(flexirecordId, sectionId, termId, token, forceRefresh = true) {
  flexirecordId = normalizeId(flexirecordId, 'flexirecordId');
  sectionId = normalizeId(sectionId, 'sectionId');
  termId = normalizeId(termId, 'termId');
  
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
 * Gets consolidated FlexiRecord data with meaningful field names and structure
 * 
 * Main function that combines FlexiRecord structure and data retrieval with
 * intelligent caching and field mapping. Transforms raw FlexiRecord data into
 * a usable format with human-readable field names and proper data types.
 * This is the primary function for working with FlexiRecord data.
 * 
 * @async
 * @param {string|number} sectionId - Section identifier
 * @param {string|number} flexirecordId - FlexiRecord identifier (extraid)
 * @param {string|number} termId - Term identifier
 * @param {string} token - OSM authentication token (null for offline mode)
 * @param {boolean} [forceRefresh=false] - Force refresh of data cache
 * @returns {Promise<object>} Consolidated FlexiRecord with structure and data
 * @returns {object} returns.items - Array of data records with meaningful field names
 * @returns {object} returns._structure - FlexiRecord metadata and field mapping
 * @returns {string} returns._structure.name - FlexiRecord name
 * @returns {string} returns._structure.extraid - FlexiRecord external ID
 * @returns {boolean} returns._structure.archived - Whether FlexiRecord is archived
 * @returns {object} returns._structure.fieldMapping - Field ID to name/type mapping
 * @throws {Error} If required parameters missing or API calls fail
 * 
 * @example
 * // Get consolidated Viking Event Management data
 * const eventData = await getConsolidatedFlexiRecord(
 *   sectionId, 
 *   'viking_event_flexi_123', 
 *   termId, 
 *   authToken
 * );
 * 
 * // Access data with meaningful field names
 * eventData.items.forEach(record => {
 *   console.log(`Scout: ${record.scoutName}`);
 *   console.log(`Attendance: ${record.eventAttendance}`);
 *   console.log(`Notes: ${record.attendanceNotes}`);
 * });
 * 
 * // Use field mapping for dynamic field access
 * const fieldMapping = eventData._structure.fieldMapping;
 * Object.values(fieldMapping).forEach(field => {
 *   console.log(`Field: ${field.name} - Type: ${field.type}`);
 * });
 * 
 * @example
 * // Handle offline mode gracefully
 * try {
 *   const data = await getConsolidatedFlexiRecord(sectionId, flexiId, termId, null);
 *   // Use cached data
 * } catch (error) {
 *   console.log('No cached data available - need internet connection');
 * }
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
    const { parseFlexiStructure, transformFlexiRecordData } = await import('../../../shared/utils/flexiRecordTransforms.js');
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
 * Gets Viking Event Management FlexiRecord data for a Scout section
 * 
 * Specialized function that looks for the "Viking Event Mgmt" FlexiRecord
 * within a section and returns consolidated data with meaningful field names.
 * This is the primary function for accessing Scout event attendance data
 * in the Vikings Event Management system.
 * 
 * @async
 * @param {string|number} sectionId - Section identifier
 * @param {string|number} termId - Term identifier
 * @param {string} token - OSM authentication token (null for offline mode)
 * @param {boolean} [forceRefresh=false] - Force refresh of data cache
 * @returns {Promise<object | null>} Viking Event Mgmt FlexiRecord data or null if not found
 * @returns {Array} returns.items - Event attendance records with scout details
 * @returns {object} returns._structure - FlexiRecord structure and field mapping
 * @returns {string} returns._structure.name - Always "Viking Event Mgmt"
 * @returns {object} returns._structure.fieldMapping - Field mappings for attendance data
 * 
 * @example
 * // Get Viking Event data for Beavers section
 * const eventData = await getVikingEventData(1, 'term_2024_spring', authToken);
 * 
 * if (eventData) {
 *   console.log(`Found ${eventData.items.length} attendance records`);
 *   
 *   // Process attendance data
 *   eventData.items.forEach(record => {
 *     console.log(`${record.scoutName}: ${record.eventAttendance}`);
 *     if (record.attendanceNotes) {
 *       console.log(`  Notes: ${record.attendanceNotes}`);
 *     }
 *   });
 * } else {
 *   console.log('No Viking Event Management FlexiRecord found for this section');
 * }
 * 
 * @example
 * // Use for event dashboard display
 * const sections = await getSections();
 * 
 * for (const section of sections) {
 *   const eventData = await getVikingEventData(section.sectionid, termId, token);
 *   if (eventData) {
 *     const attendingCount = eventData.items.filter(
 *       record => record.eventAttendance === 'Yes'
 *     ).length;
 *     console.log(`${section.sectionname}: ${attendingCount} attending`);
 *   }
 * }
 */
export async function getVikingEventData(sectionId, termId, token, forceRefresh = false) {
  sectionId = normalizeId(sectionId, 'sectionId');
  termId = normalizeId(termId, 'termId');
  
  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }
  
  try {

    // Getting Viking Event data for section
    
    // Get flexirecords list
    const flexiRecordsList = await getFlexiRecordsList(sectionId, token, forceRefresh);

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
 * @param {string|number} sectionId - Section ID
 * @param {string|number} termId - Term ID
 * @param {string} token - Authentication token (null for offline)
 * @param {boolean} forceRefresh - Force refresh of data cache (default: false)
 * @returns {Promise<object | null>} Viking Section Movers flexirecord data or null if not found
 */
export async function getVikingSectionMoversData(sectionId, termId, token, forceRefresh = false) {
  sectionId = normalizeId(sectionId, 'sectionId');
  termId = normalizeId(termId, 'termId');
  
  if (typeof forceRefresh !== 'boolean') {
    forceRefresh = false;
  }
  
  try {

    // Getting Viking Section Movers data for section

    // Get flexirecords list
    const flexiRecordsList = await getFlexiRecordsList(sectionId, token, forceRefresh);

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
 * @param {object} vikingSectionMoversData - Viking Section Movers FlexiRecord data  
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} sectionName - Section name
 * @returns {object | null} Field mapping context or null if not available
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
 * @param {object} consolidatedData - Consolidated flexirecord data from getVikingSectionMoversData
 * @returns {object} Validation result with status and missing fields
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
 * @param {object} fieldContext - Field context from extractVikingSectionMoversContext
 * @returns {object} FlexiRecord data structure for assignment tracking
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
 * @param {object} assignmentData - Assignment data to validate
 * @param {object} fieldContext - Field context for validation
 * @returns {object} Validation result
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
 * @returns {object} Validation summary with valid/invalid records
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
    const { default: databaseService } = await import('../../../shared/services/storage/database.js');
    
    // Get all accessible sections
    const sectionsData = await databaseService.getSections();
    
    if (!sectionsData || sectionsData.length === 0) {
      logger.warn('No sections available for Viking Section Movers discovery', {}, LOG_CATEGORIES.APP);
      return [];
    }

    // Discover Viking Section Movers FlexiRecords across all sections
    const discoveryPromises = sectionsData.map(async (section) => {
      try {
        const sectionId = section.sectionid.toString();
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
      events.map(e => JSON.stringify([String(e.sectionid), String(e.termid)])),
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
      results.map(({ sectionId, vikingEventData }) => [String(sectionId), vikingEventData]),
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