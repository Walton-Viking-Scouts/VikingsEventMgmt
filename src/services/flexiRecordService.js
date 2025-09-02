// FlexiRecord Service for Viking Event Management
// Handles flexirecord data operations with caching following existing patterns

function hasUsableToken(token) {
  return typeof token === 'string' ? token.trim().length > 0 : !!token;
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
  try {
    if (!sectionId || !termId) {
      throw new Error('Missing required parameters: sectionId and termId are required');
    }

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
  try {
    if (!sectionId || !termId) {
      throw new Error('Missing required parameters: sectionId and termId are required');
    }

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
    'Target Section Name', 
    'Assignment Term',
    'Assigned Date'
  ];
  
  if (!consolidatedData || !consolidatedData._structure) {
    return {
      isValid: false,
      missingFields: requiredFields,
      error: 'FlexiRecord structure not found'
    };
  }
  
  const fieldMapping = consolidatedData._structure.fieldMapping || {};
  const availableFields = Object.values(fieldMapping).map(field => field.name);
  const missingFields = requiredFields.filter(field => !availableFields.includes(field));
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    availableFields,
    fieldMapping: fieldMapping
  };
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