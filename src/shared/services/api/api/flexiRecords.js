/**
 * @file FlexiRecords API service
 * Extracted from monolithic api.js for better modularity
 * @module FlexiRecordsAPI
 */

import {
  BACKEND_URL,
  validateTokenBeforeAPICall,
  handleAPIResponseWithRateLimit,
} from './base.js';
import { withRateLimitQueue } from '../../../utils/rateLimitQueue.js';
import { checkNetworkStatus } from '../../../utils/networkUtils.js';
import databaseService from '../../storage/database.js';
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
 * @returns {Promise<Object>} FlexiRecord list with items array
 * @throws {Error} When API request fails and no cached data available
 */
export async function getFlexiRecords(sectionId, token, archived = 'n', forceRefresh = false) {
  try {
    if (isDemoMode()) {
      const cached = await databaseService.getFlexiLists(sectionId);
      return cached || { items: [] };
    }

    const isOnline = await checkNetworkStatus();

    if (!forceRefresh && isOnline) {
      const cached = await databaseService.getFlexiLists(sectionId);
      if (cached && cached._cacheTimestamp) {
        const cacheAge = Date.now() - cached._cacheTimestamp;
        const FLEXI_RECORDS_CACHE_TTL = 30 * 60 * 1000;
        if (cacheAge < FLEXI_RECORDS_CACHE_TTL) {
          return cached;
        }
      }
    }

    if (!isOnline) {
      const cached = await databaseService.getFlexiLists(sectionId);
      return cached || { identifier: null, label: null, items: [] };
    }

    if (!authHandler.shouldMakeAPICall()) {
      const cached = await databaseService.getFlexiLists(sectionId);
      if (cached && cached.items && Array.isArray(cached.items)) {
        return cached;
      }
      return { identifier: null, label: null, items: [] };
    }

    const data = await withRateLimitQueue(async () => {
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

    try {
      await databaseService.saveFlexiLists(sectionId, flexiData.items || []);
    } catch (cacheError) {
      logger.error('FlexiRecord list caching error', {
        error: cacheError.message,
        itemCount: flexiData.items?.length || 0,
      }, LOG_CATEGORIES.ERROR);
    }

    return flexiData;

  } catch (error) {
    logger.error('Error fetching flexi records', { error: error.message }, LOG_CATEGORIES.API);

    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const cached = await databaseService.getFlexiLists(sectionId);
        if (cached) {
          logger.info('Using cached fallback data after API error', {}, LOG_CATEGORIES.API);
          return cached;
        }
        return { identifier: null, label: null, items: [] };
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
 * @returns {Promise<Object>} FlexiRecord data with member values
 * @throws {Error} When API request fails or authentication fails
 */
export async function getSingleFlexiRecord(flexirecordid, sectionid, termid, token) {
  try {
    if (isDemoMode()) {
      const cached = await databaseService.getFlexiData(flexirecordid, sectionid, termid);
      return cached || { items: [] };
    }

    validateTokenBeforeAPICall(token, 'getSingleFlexiRecord');

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
 * @returns {Promise<Object|null>} Structure definition with field mappings or null
 * @throws {Error} When API request fails
 */
export async function getFlexiStructure(extraid, sectionid, termid, token, forceRefresh = false) {
  try {
    if (isDemoMode()) {
      const cached = await databaseService.getFlexiStructure(extraid);
      return cached || null;
    }

    const isOnline = await checkNetworkStatus();

    if (!forceRefresh && isOnline) {
      const cached = await databaseService.getFlexiStructure(extraid);
      if (cached && cached._cacheTimestamp) {
        const cacheAge = Date.now() - cached._cacheTimestamp;
        const FLEXI_STRUCTURES_CACHE_TTL = 60 * 60 * 1000;
        if (cacheAge < FLEXI_STRUCTURES_CACHE_TTL) {
          return cached;
        }
      }
    }

    if (!isOnline) {
      const cached = await databaseService.getFlexiStructure(extraid);
      if (cached) {
        logger.info('Retrieved structure from normalized store while offline', {
          extraid,
          structureName: cached.name,
        }, LOG_CATEGORIES.OFFLINE);
        return cached;
      }
      return null;
    }

    if (!authHandler.shouldMakeAPICall()) {
      const cached = await databaseService.getFlexiStructure(extraid);
      if (cached && typeof cached === 'object' && cached.name) {
        return cached;
      }
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

    if (structureData) {
      try {
        const cachedData = {
          ...structureData,
          _cacheTimestamp: Date.now(),
        };
        await databaseService.saveFlexiStructure(extraid, cachedData);
      } catch (cacheError) {
        logger.error('FlexiRecord structure caching error', {
          error: cacheError.message,
          structureName: structureData.name || 'Unknown',
        }, LOG_CATEGORIES.ERROR);
      }
    }

    return structureData;

  } catch (error) {
    logger.error('Error fetching flexi structure', { error: error.message }, LOG_CATEGORIES.API);

    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const cached = await databaseService.getFlexiStructure(extraid);
        if (cached) {
          logger.info('Using cached fallback data after API error', {}, LOG_CATEGORIES.API);
          return cached;
        }
      } catch (cacheError) {
        logger.error('Cache fallback failed', { cacheError: cacheError.message }, LOG_CATEGORIES.API);
      }
    }

    throw error;
  }
}

/**
 * Updates a FlexiRecord field value for a specific member
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} scoutid - Member identifier
 * @param {number|string} flexirecordid - FlexiRecord identifier
 * @param {number|string} columnid - Field column identifier
 * @param {string} value - New field value
 * @param {number|string} termid - OSM term identifier
 * @param {string} section - Section name for context
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object|null>} Update response data
 * @throws {Error} When write permissions denied or API request fails
 */
export async function updateFlexiRecord(sectionid, scoutid, flexirecordid, columnid, value, termid, section, token) {
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

    checkWritePermission();

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
 * @param {number|string} sectionid - OSM section identifier
 * @param {Array<string|number>} scouts - Array of scout/member IDs to update
 * @param {string} value - New field value to set for all scouts
 * @param {string} column - Field column ID (e.g., "f_1", "f_2")
 * @param {number|string} flexirecordid - FlexiRecord identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object|null>} Update response with success status and updated count
 * @throws {Error} When write permissions denied or API request fails
 */
export async function multiUpdateFlexiRecord(sectionid, scouts, value, column, flexirecordid, token) {
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
    checkWritePermission();
    logger.debug('multiUpdateFlexiRecord: Write permission check passed', {}, LOG_CATEGORIES.API);

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

/**
 * Creates a new FlexiRecord template for a section
 * @param {number|string} sectionid - OSM section identifier
 * @param {string} name - Name of the new FlexiRecord
 * @param {string} token - OSM authentication token
 * @param {Object} [options={}] - Optional configuration
 * @returns {Promise<Object|null>} Creation result with flexirecordid
 * @throws {Error} When API request fails or validation errors
 */
export async function createFlexiRecord(sectionid, name, token, options = {}) {
  if (isDemoMode()) {
    logger.info('Demo mode: Simulating createFlexiRecord success', {
      sectionid,
      name,
    }, LOG_CATEGORIES.API);
    return {
      success: true,
      flexirecordid: Math.floor(Math.random() * 100000),
      name: name,
    };
  }

  validateTokenBeforeAPICall(token, 'createFlexiRecord');

  try {
    checkWritePermission();

    const requestBody = {
      sectionid,
      name,
      dob: options.dob ?? '1',
      age: options.age ?? '1',
      patrol: options.patrol ?? '1',
      type: options.type ?? 'none',
    };

    logger.debug('createFlexiRecord: Making API call', {
      url: `${BACKEND_URL}/create-flexi-record`,
      requestBody,
    }, LOG_CATEGORIES.API);

    const response = await fetch(`${BACKEND_URL}/create-flexi-record`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    logger.debug('createFlexiRecord: Response received', {
      status: response.status,
      statusText: response.statusText,
    }, LOG_CATEGORIES.API);

    const data = await handleAPIResponseWithRateLimit(response, 'createFlexiRecord');

    logger.debug('createFlexiRecord: Response processed', {
      success: data?.success,
      flexirecordid: data?.flexirecordid,
    }, LOG_CATEGORIES.API);

    return data || null;

  } catch (error) {
    logger.error('Error creating flexi record', {
      error: error.message,
      sectionid,
      name,
    }, LOG_CATEGORIES.API);
    throw error;
  }
}

/**
 * Adds a new column/field to an existing FlexiRecord
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} flexirecordid - Existing FlexiRecord identifier
 * @param {string} columnName - Name of the new column/field to add
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object|null>} Addition result with columnid
 * @throws {Error} When API request fails or validation errors
 */
export async function addFlexiColumn(sectionid, flexirecordid, columnName, token) {
  if (isDemoMode()) {
    logger.info('Demo mode: Simulating addFlexiColumn success', {
      sectionid,
      flexirecordid,
      columnName,
    }, LOG_CATEGORIES.API);
    return {
      success: true,
      columnid: `f_${Math.floor(Math.random() * 100)}`,
      name: columnName,
    };
  }

  validateTokenBeforeAPICall(token, 'addFlexiColumn');

  try {
    checkWritePermission();

    const requestBody = {
      sectionid,
      flexirecordid,
      columnName,
    };

    logger.debug('addFlexiColumn: Making API call', {
      url: `${BACKEND_URL}/add-flexi-column`,
      requestBody,
    }, LOG_CATEGORIES.API);

    const response = await fetch(`${BACKEND_URL}/add-flexi-column`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    logger.debug('addFlexiColumn: Response received', {
      status: response.status,
      statusText: response.statusText,
    }, LOG_CATEGORIES.API);

    const data = await handleAPIResponseWithRateLimit(response, 'addFlexiColumn');

    logger.debug('addFlexiColumn: Response processed', {
      success: data?.success,
      columnid: data?.columnid,
    }, LOG_CATEGORIES.API);

    return data || null;

  } catch (error) {
    logger.error('Error adding flexi column', {
      error: error.message,
      sectionid,
      flexirecordid,
      columnName,
    }, LOG_CATEGORIES.API);
    throw error;
  }
}


export {
  parseFlexiStructure,
  transformFlexiRecordData,
  extractVikingEventFields,
} from '../../../utils/flexiRecordTransforms.js';
