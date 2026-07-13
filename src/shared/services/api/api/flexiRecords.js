/**
 * @file FlexiRecords API service
 * All requests route through osmRequest, which owns demo mode, network
 * checks, the rate-limit queue (writes jump the read queue), token
 * validation, and cache fallback.
 * @module FlexiRecordsAPI
 */

import { osmRequest } from './base.js';
import databaseService from '../../storage/database.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

const FLEXI_RECORDS_CACHE_TTL = 30 * 60 * 1000;
const FLEXI_STRUCTURES_CACHE_TTL = 60 * 60 * 1000;

/**
 * Retrieves FlexiRecord definitions for a section with caching support
 * @param {number|string} sectionId - OSM section identifier
 * @param {string} token - OSM authentication token
 * @param {string} [archived='n'] - Include archived records ('y' or 'n')
 * @param {boolean} [forceRefresh=false] - Force refresh bypassing cache
 * @param {number} [priority=0] - Rate-limit queue priority; raise so a user-facing
 *   deep-link load jumps ahead of the background post-login sync
 * @returns {Promise<Object>} FlexiRecord list with items array
 * @throws {Error} When API request fails and no cached data available
 */
export async function getFlexiRecords(sectionId, token, archived = 'n', forceRefresh = false, priority = 0) {
  return osmRequest(
    'getFlexiRecords',
    `/get-flexi-records?sectionid=${encodeURIComponent(sectionId)}&archived=${encodeURIComponent(archived)}`,
    {
      token,
      priority,
      forceRefresh,
      ttl: FLEXI_RECORDS_CACHE_TTL,
      cacheRead: () => databaseService.getFlexiLists(sectionId),
      cacheWrite: (data) => databaseService.saveFlexiLists(sectionId, data.items || []),
      emptyValue: { identifier: null, label: null, items: [] },
    },
  );
}

/**
 * Retrieves data for a single FlexiRecord (member values — the sign-in/out
 * data multiple leaders update concurrently, so no TTL: callers decide
 * freshness and this always hits the API when online).
 * @param {number|string} flexirecordid - FlexiRecord identifier
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} termid - OSM term identifier
 * @param {string} token - OSM authentication token
 * @param {number} [priority=0] - Rate-limit queue priority; raise so a user-facing
 *   deep-link load jumps ahead of the background post-login sync
 * @returns {Promise<Object>} FlexiRecord data with member values
 * @throws {Error} When API request fails or authentication fails
 */
export async function getSingleFlexiRecord(flexirecordid, sectionid, termid, token, priority = 0) {
  return osmRequest(
    'getSingleFlexiRecord',
    `/get-single-flexi-record?flexirecordid=${encodeURIComponent(flexirecordid)}&sectionid=${encodeURIComponent(sectionid)}&termid=${encodeURIComponent(termid)}`,
    {
      token,
      priority,
      cacheRead: () => databaseService.getFlexiData(flexirecordid, sectionid, termid),
      emptyValue: { identifier: null, items: [] },
    },
  );
}

/**
 * Retrieves FlexiRecord structure definition with field mappings
 * @param {number|string} extraid - FlexiRecord external ID (same as flexirecordid)
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} termid - OSM term identifier
 * @param {string} token - OSM authentication token
 * @param {boolean} [forceRefresh=false] - Force refresh bypassing cache
 * @param {number} [priority=0] - Rate-limit queue priority; raise so a user-facing
 *   deep-link load jumps ahead of the background post-login sync
 * @returns {Promise<Object|null>} Structure definition with field mappings or null
 * @throws {Error} When API request fails
 */
export async function getFlexiStructure(extraid, sectionid, termid, token, forceRefresh = false, priority = 0) {
  return osmRequest(
    'getFlexiStructure',
    `/get-flexi-structure?flexirecordid=${encodeURIComponent(extraid)}&sectionid=${encodeURIComponent(sectionid)}&termid=${encodeURIComponent(termid)}`,
    {
      token,
      priority,
      forceRefresh,
      ttl: FLEXI_STRUCTURES_CACHE_TTL,
      cacheRead: () => databaseService.getFlexiStructure(extraid),
      cacheWrite: (data) => databaseService.saveFlexiStructure(extraid, {
        ...data,
        _cacheTimestamp: Date.now(),
      }),
      emptyValue: null,
    },
  );
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

  if (typeof columnid !== 'string' || !/^f_\d+$/.test(columnid)) {
    const err = new Error('Invalid columnid format');
    err.status = 400;
    err.code = 'INVALID_COLUMN_ID';
    throw err;
  }

  return osmRequest('updateFlexiRecord', '/update-flexi-record', {
    token,
    method: 'POST',
    write: true,
    body: { sectionid, scoutid, flexirecordid, columnid, value, termid, section },
  });
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

  if (typeof column !== 'string' || !/^f_\d+$/.test(column)) {
    const err = new Error('Invalid column format');
    err.status = 400;
    err.code = 'INVALID_COLUMN_ID';
    throw err;
  }

  if (!Array.isArray(scouts) || scouts.length === 0) {
    throw new Error('Scouts array is required and must not be empty');
  }

  return osmRequest('multiUpdateFlexiRecord', '/multi-update-flexi-record', {
    token,
    method: 'POST',
    write: true,
    body: { sectionid, scouts, value, column, flexirecordid },
  });
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

  return osmRequest('createFlexiRecord', '/create-flexi-record', {
    token,
    method: 'POST',
    write: true,
    body: {
      sectionid,
      name,
      dob: options.dob ?? '1',
      age: options.age ?? '1',
      patrol: options.patrol ?? '1',
      type: options.type ?? 'none',
    },
  });
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

  return osmRequest('addFlexiColumn', '/add-flexi-column', {
    token,
    method: 'POST',
    write: true,
    body: { sectionid, flexirecordid, columnName },
  });
}


export {
  parseFlexiStructure,
  transformFlexiRecordData,
  extractVikingEventFields,
} from '../../../utils/flexiRecordTransforms.js';
