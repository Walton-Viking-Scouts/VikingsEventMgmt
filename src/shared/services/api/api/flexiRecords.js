// FlexiRecords API service
// Extracted from monolithic api.js for better modularity

import {
  BACKEND_URL,
  validateTokenBeforeAPICall,
  handleAPIResponseWithRateLimit,
} from './base.js';
import { withRateLimitQueue } from '../../../utils/rateLimitQueue.js';
import { checkNetworkStatus } from '../../../utils/networkUtils.js';
import { safeGetItem, safeSetItem } from '../../../utils/storageUtils.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { authHandler } from '../../auth/authHandler.js';
import { checkWritePermission } from '../../auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

/**
 * Retrieves FlexiRecord definitions for a section with caching support
 * @param {number|string} sectionId - OSM section identifier
 * @param {string} token - OSM authentication token
 * @param {string} [archived='n'] - Include archived records ('y' or 'n')
 * @param {boolean} [forceRefresh=false] - Force refresh bypassing cache
 * @returns {Promise<object>} FlexiRecord list with items array
 * @throws {Error} When API request fails and no cached data available
 * 
 * @example
 * const flexiRecords = await getFlexiRecords(123, token);
 * console.log(`Found ${flexiRecords.items.length} FlexiRecords`);
 */
export async function getFlexiRecords(sectionId, token, archived = 'n', forceRefresh = false) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = `demo_viking_flexi_lists_${sectionId}_offline`;
      const cached = safeGetItem(cacheKey, { items: [] });
      return cached;
    }
    
    const storageKey = `viking_flexi_records_${sectionId}_archived_${archived}_offline`;
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cached = safeGetItem(storageKey, null);
      if (cached && cached._cacheTimestamp) {
        const cacheAge = Date.now() - cached._cacheTimestamp;
        const FLEXI_RECORDS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
        if (cacheAge < FLEXI_RECORDS_CACHE_TTL) {
          return cached;
        }
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(storageKey, { identifier: null, label: null, items: [] });
      return cached;
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      const cached = safeGetItem(storageKey, null);
      // Validate cached data has meaningful content
      if (cached && cached.items && Array.isArray(cached.items)) {
        return cached;
      }
      // Return valid default structure if no meaningful cache exists
      return { identifier: null, label: null, items: [] };
    }

    const data = await withRateLimitQueue(async () => {
      // Online and allowed – validate now
      validateTokenBeforeAPICall(token, 'getFlexiRecords');
      
      const response = await fetch(`${BACKEND_URL}/get-flexi-records?sectionid=${sectionId}&archived=${archived}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return await handleAPIResponseWithRateLimit(response, 'getFlexiRecords');
    });
        
    let flexiData;
    if (data && data._rateLimitInfo) {
      const { _rateLimitInfo, ...responseData } = data;
      flexiData = responseData || { identifier: null, label: null, items: [] };
    } else {
      flexiData = data || { identifier: null, label: null, items: [] };
    }
    
    // Cache data with timestamp - enhanced error handling like getMembersGrid fix
    try {
      const cachedData = {
        ...flexiData,
        _cacheTimestamp: Date.now(),
      };
      const success = safeSetItem(storageKey, cachedData);
      if (success) {
        // FlexiRecord list successfully cached
      } else {
        logger.error('FlexiRecord list caching failed - safeSetItem returned false', {
          storageKey,
          itemCount: flexiData.items?.length || 0,
          dataSize: JSON.stringify(cachedData).length,
        }, LOG_CATEGORIES.ERROR);
      }
    } catch (cacheError) {
      logger.error('FlexiRecord list caching error', {
        storageKey,
        error: cacheError.message,
        itemCount: flexiData.items?.length || 0,
      }, LOG_CATEGORIES.ERROR);
    }
    
    return flexiData; // Return original data without timestamp

  } catch (error) {
    logger.error('Error fetching flexi records', { error: error.message }, LOG_CATEGORIES.API);
    
    // Don't cache error responses - only return existing cache as fallback
    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const storageKey = `viking_flexi_records_${sectionId}_archived_${archived}_offline`;
        const cached = safeGetItem(storageKey, { identifier: null, label: null, items: [] });
        logger.info('Using cached fallback data after API error', {}, LOG_CATEGORIES.API);
        return cached;
      } catch (cacheError) {
        logger.error('Cache fallback failed', { cacheError: cacheError.message }, LOG_CATEGORIES.API);
      }
    }
    
    throw error;
  }
}

/**
 * Retrieves data for a single FlexiRecord
 * @param {number|string} flexirecordid - FlexiRecord identifier
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} termid - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<object>} FlexiRecord data with member values
 * @throws {Error} When API request fails or authentication fails
 * 
 * @example
 * const flexiData = await getSingleFlexiRecord(456, 123, '789', token);
 * console.log(`FlexiRecord has ${flexiData.items.length} member entries`);
 */
export async function getSingleFlexiRecord(flexirecordid, sectionid, termid, token) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = `demo_viking_flexi_data_${flexirecordid}_${sectionid}_${termid}_offline`;
      const cached = safeGetItem(cacheKey, { items: [] });
      return cached;
    }
    
    // Validate token before making API call
    validateTokenBeforeAPICall(token, 'getSingleFlexiRecord');

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      throw new Error('Authentication failed - unable to fetch flexi record data');
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/get-single-flexi-record?flexirecordid=${flexirecordid}&sectionid=${sectionid}&termid=${termid}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      return await handleAPIResponseWithRateLimit(response, 'getSingleFlexiRecord');
    });
        
    if (data && data._rateLimitInfo) {
      const { _rateLimitInfo, ...flexiData } = data;
      return flexiData || { identifier: null, items: [] };
    }
        
    return data || { identifier: null, items: [] };
        
  } catch (error) {
    logger.error('Error fetching single flexi record', { error: error.message }, LOG_CATEGORIES.API);
    throw error;
  }
}

/**
 * Retrieves FlexiRecord structure definition with field mappings
 * @param {number|string} extraid - FlexiRecord external ID (same as flexirecordid)
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} termid - OSM term identifier
 * @param {string} token - OSM authentication token
 * @param {boolean} [forceRefresh=false] - Force refresh bypassing cache
 * @returns {Promise<object | null>} Structure definition with field mappings or null
 * @throws {Error} When API request fails
 * 
 * @example
 * const structure = await getFlexiStructure(456, 123, '789', token);
 * if (structure) {
 *   console.log(`Structure: ${structure.name}`);
 * }
 */
export async function getFlexiStructure(extraid, sectionid, termid, token, forceRefresh = false) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = `demo_viking_flexi_structure_${extraid}_offline`;
      const cached = safeGetItem(cacheKey, null);
      return cached;
    }
    
    const storageKey = demoMode ? `demo_viking_flexi_structure_${extraid}_offline` : `viking_flexi_structure_${extraid}_offline`;
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cached = safeGetItem(storageKey, null);
      if (cached && cached._cacheTimestamp) {
        const cacheAge = Date.now() - cached._cacheTimestamp;
        const FLEXI_STRUCTURES_CACHE_TTL = 60 * 60 * 1000; // 60 minutes
        if (cacheAge < FLEXI_STRUCTURES_CACHE_TTL) {
          return cached;
        }
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(storageKey, null);
      if (cached) {
        logger.info('Retrieved structure from localStorage while offline', { 
          extraid,
          structureName: cached.name,
        }, LOG_CATEGORIES.OFFLINE);
        return cached;
      }
      return null;
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      const cached = safeGetItem(storageKey, null);
      // Validate cached data exists and has meaningful content
      if (cached && typeof cached === 'object' && cached.name) {
        return cached;
      }
      // Return null for structure - caller should handle this case
      return null;
    }

    const data = await withRateLimitQueue(async () => {
      validateTokenBeforeAPICall(token, 'getFlexiStructure');
      
      const response = await fetch(`${BACKEND_URL}/get-flexi-structure?flexirecordid=${extraid}&sectionid=${sectionid}&termid=${termid}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json', 
        },
      });
      
      return await handleAPIResponseWithRateLimit(response, 'getFlexiStructure');
    });
    const structureData = data || null;
    
    // Cache data for offline use - enhanced error handling like getMembersGrid fix
    if (structureData) {
      try {
        const cachedData = {
          ...structureData,
          _cacheTimestamp: Date.now(),
        };
        const success = safeSetItem(storageKey, cachedData);
        if (success) {
          // FlexiRecord structure successfully cached
        } else {
          logger.error('FlexiRecord structure caching failed - safeSetItem returned false', {
            storageKey,
            structureName: structureData.name || 'Unknown',
            dataSize: JSON.stringify(cachedData).length,
          }, LOG_CATEGORIES.ERROR);
        }
      } catch (cacheError) {
        logger.error('FlexiRecord structure caching error', {
          storageKey,
          error: cacheError.message,
          structureName: structureData.name || 'Unknown',
        }, LOG_CATEGORIES.ERROR);
      }
    }
    
    return structureData;
    
  } catch (error) {
    logger.error('Error fetching flexi structure', { error: error.message }, LOG_CATEGORIES.API);
    
    // Don't cache error responses - only return existing cache as fallback
    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const demoMode = isDemoMode();
        const storageKey = demoMode ? `demo_viking_flexi_structure_${extraid}_offline` : `viking_flexi_structure_${extraid}_offline`;
        const cacheData = safeGetItem(storageKey, null);
        logger.info('Using cached fallback data after API error, not updating cache timestamp', {}, LOG_CATEGORIES.API);
        return cacheData;
      } catch (cacheError) {
        logger.error('Cache fallback failed', { cacheError: cacheError.message }, LOG_CATEGORIES.API);
      }
    }
    
    throw error;
  }
}

/**
 * Updates a FlexiRecord field value for a specific member
 * Requires valid authentication and write permissions
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} scoutid - Member identifier
 * @param {number|string} flexirecordid - FlexiRecord identifier
 * @param {number|string} columnid - Field column identifier
 * @param {string} value - New field value
 * @param {number|string} termid - OSM term identifier
 * @param {string} section - Section name for context
 * @param {string} token - OSM authentication token
 * @returns {Promise<object | null>} Update response data
 * @throws {Error} When write permissions denied or API request fails
 * 
 * @example
 * await updateFlexiRecord(123, 456, 789, 'f_1', 'Blue Group', '2024', 'Beavers', token);
 */
export async function updateFlexiRecord(sectionid, scoutid, flexirecordid, columnid, value, termid, section, token) {
  // Demo mode protection
  if (isDemoMode()) {
    logger.info('Demo mode: Simulating updateFlexiRecord success', {
      scoutid,
      flexirecordid,
      columnid,
      value,
    }, LOG_CATEGORIES.API);
    return {
      ok: true,
      success: true,
      message: 'Demo mode: FlexiRecord update simulated',
    };
  }
  
  try {
    validateTokenBeforeAPICall(token, 'updateFlexiRecord');
    
    // Check if write operations are allowed (blocks offline writes with expired token)
    checkWritePermission();

    // Validate column id format (e.g. "f_1")
    if (typeof columnid !== 'string' || !/^f_\d+$/.test(columnid)) {
      const err = new Error('Invalid columnid format');
      err.status = 400;
      err.code = 'INVALID_COLUMN_ID';
      throw err;
    }

    const response = await fetch(`${BACKEND_URL}/update-flexi-record`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 
      },
      body: JSON.stringify({
        sectionid,
        scoutid,
        flexirecordid,
        columnid,
        value,
        termid,
        section,
      }),
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'updateFlexiRecord');
    return data || null;
        
  } catch (error) {
    logger.error('Error updating flexi record', { error: error.message }, LOG_CATEGORIES.API);
    throw error;
  }
}

/**
 * Multi-update FlexiRecord field for multiple members in a single batch operation
 * Updates the same field value for multiple scouts efficiently
 * 
 * @param {number|string} sectionid - OSM section identifier  
 * @param {Array<string|number>} scouts - Array of scout/member IDs to update
 * @param {string} value - New field value to set for all scouts
 * @param {string} column - Field column ID (e.g., "f_1", "f_2")
 * @param {number|string} flexirecordid - FlexiRecord identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<object | null>} Update response with success status and updated count
 * @throws {Error} When write permissions denied or API request fails
 * 
 * @example
 * await multiUpdateFlexiRecord(123, ['456', '789'], 'Yellow', 'f_1', '999', token);
 */
export async function multiUpdateFlexiRecord(sectionid, scouts, value, column, flexirecordid, token) {
  // Demo mode protection
  if (isDemoMode()) {
    logger.info('Demo mode: Simulating multiUpdateFlexiRecord success', {
      sectionid,
      flexirecordid,
      column,
      value,
      scoutCount: Array.isArray(scouts) ? scouts.length : 0,
    }, LOG_CATEGORIES.API);
    return {
      ok: true,
      success: true,
      message: `Demo mode: Multi-update simulated for ${Array.isArray(scouts) ? scouts.length : 0} scouts`,
    };
  }
  
  validateTokenBeforeAPICall(token, 'multiUpdateFlexiRecord');
  logger.debug('multiUpdateFlexiRecord: Token validation passed', {}, LOG_CATEGORIES.API);
  
  try {
    // Check if write operations are allowed
    checkWritePermission();
    logger.debug('multiUpdateFlexiRecord: Write permission check passed', {}, LOG_CATEGORIES.API);

    // Validate column id format (e.g. "f_1")
    if (typeof column !== 'string' || !/^f_\d+$/.test(column)) {
      const err = new Error('Invalid column format');
      err.status = 400;
      err.code = 'INVALID_COLUMN_ID';
      throw err;
    }
    logger.debug('multiUpdateFlexiRecord: Column format validation passed', { column }, LOG_CATEGORIES.API);

    if (!Array.isArray(scouts) || scouts.length === 0) {
      throw new Error('Scouts array is required and must not be empty');
    }
    logger.debug('multiUpdateFlexiRecord: Scouts array validation passed', { scoutCount: scouts.length }, LOG_CATEGORIES.API);

    const requestBody = {
      sectionid,
      scouts,
      value,
      column,
      flexirecordid,
    };

    logger.debug('multiUpdateFlexiRecord: Making API call', { 
      url: `${BACKEND_URL}/multi-update-flexi-record`,
      requestBody, 
    }, LOG_CATEGORIES.API);

    const response = await fetch(`${BACKEND_URL}/multi-update-flexi-record`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 
      },
      body: JSON.stringify(requestBody),
    });

    logger.debug('multiUpdateFlexiRecord: Response received', { 
      status: response.status,
      statusText: response.statusText, 
    }, LOG_CATEGORIES.API);
        
    const data = await handleAPIResponseWithRateLimit(response, 'multiUpdateFlexiRecord');
    
    logger.debug('multiUpdateFlexiRecord: Response processed', { 
      success: data?.data?.success,
      data: data, 
    }, LOG_CATEGORIES.API);
    
    return data || null;
        
  } catch (error) {
    logger.error('Error multi-updating flexi record', { 
      error: error.message,
      sectionid,
      scoutCount: scouts?.length,
      value,
      column,
    }, LOG_CATEGORIES.API);
    throw error;
  }
}

// TODO: Move getConsolidatedFlexiRecord to shared layer to avoid circular dependency
// Temporarily removing cross-feature export

export { 
  parseFlexiStructure,
  transformFlexiRecordData,
  extractVikingEventFields,
} from '../../../utils/flexiRecordTransforms.js';