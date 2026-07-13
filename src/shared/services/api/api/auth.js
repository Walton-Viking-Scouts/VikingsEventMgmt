// Auth and user API service
// All requests route through osmRequest (queue, breaker, token validation,
// cache fallback).

import { osmRequest } from './base.js';
import { safeGetItem, safeSetItem } from '../../../utils/storageUtils.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { sentryUtils } from '../../utils/sentry.js';
import databaseService from '../../storage/database.js';
import { IndexedDBService } from '../../storage/indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

// Startup data (user globals) is stable, so the cache exists only as an
// offline fallback — when online we always refetch so an empty or stale
// entry (e.g. one written during an OSM block/deploy window) self-heals on
// the next load instead of being trusted. The short TTL is purely a
// dedupe window for the burst of startup-data reads fired within seconds of
// each other during a single post-login sync; it must stay small enough that
// a bad cached entry can never wedge identity resolution for long.
const STARTUP_DATA_CACHE_TTL = 60 * 1000;

/**
 * Retrieves user roles and section information from OSM API
 * Includes comprehensive error handling with offline fallbacks
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Array of sections with permissions and details
 * @throws {Error} When authentication fails and no cached data available
 *
 * @example
 * const sections = await getUserRoles(userToken);
 * sections.forEach(section => {
 *   console.log(`${section.sectionname}: ${section.sectionid}`);
 * });
 */
export async function getUserRoles(token) {
  if (isDemoMode()) {
    const cached = safeGetItem('demo_viking_user_roles_offline', { sections: [] });
    return cached.sections || [];
  }

  return sentryUtils.startSpan(
    {
      op: 'http.client',
      name: 'GET /api/ext/members/contact/grid/?action=getUserRoles',
    },
    async (span) => {
      span.setAttribute('api.endpoint', 'getUserRoles');

      const sections = await osmRequest('getUserRoles', '/get-user-roles', {
        token,
        cacheRead: () => databaseService.getSections(),
        transform: (data) => transformUserRolesData(data),
        cacheWrite: async (transformed) => {
          if (transformed.length > 0) {
            await databaseService.saveSections(transformed);
            logger.info(logger.fmt`Saved ${transformed.length} sections to local database`);
          }
        },
        emptyValue: [],
      });

      span.setAttribute('sections.count', sections.length);
      return sections;
    },
  );
}

/**
 * Maps the raw get-user-roles response (keyed by numeric index) into the
 * app's section shape, with robust section-ID parsing.
 * @param {Object} data - Raw API response
 * @returns {Array<Object>} Normalized section objects
 */
function transformUserRolesData(data) {
  if (!data || typeof data !== 'object') {
    logger.warn('Invalid data received from getUserRoles API');
    return [];
  }

  return Object.keys(data)
    .filter(key => Number.isInteger(Number(key)) && key !== '')
    .map(key => ({ ...data[key], originalKey: key }))
    .filter(item => item && typeof item === 'object')
    .map(item => {
      let sectionId = item.sectionid;
      if (sectionId === null || sectionId === undefined || sectionId === '') {
        sectionId = item.section_id || item.id || item.originalKey;
      }

      const parsedSectionId = parseInt(sectionId, 10);
      if (isNaN(parsedSectionId)) {
        logger.warn('Invalid section ID detected, filtering out', {
          originalId: item.sectionid,
          fallbackId: sectionId,
          originalKey: item.originalKey,
          itemKeys: Object.keys(item),
        }, LOG_CATEGORIES.API);
        return null;
      }

      return {
        sectionid: parsedSectionId,
        sectionname: item.sectionname || `Section ${parsedSectionId}`,
        section: item.section || item.sectionname,
        sectiontype: item.section || item.sectionname, // Map section to sectiontype for database
        isDefault: item.isDefault === '1' || item.isDefault === 1,
        permissions: item.permissions || {},
      };
    })
    .filter(Boolean);
}

/**
 * Retrieves OSM startup data including user information and globals.
 * Cached only briefly (60s) to dedupe the burst of startup-data reads fired
 * within one post-login sync; otherwise refetched when online, so a stale or
 * empty entry (e.g. one written during an OSM block) self-heals on the next
 * load instead of being trusted.
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object|null>} Startup data with user info and globals
 * @throws {Error} When request fails and no cached data available
 *
 * @example
 * const startup = await getStartupData(token);
 * if (startup?.globals) {
 *   console.log(`Welcome ${startup.globals.firstname}`);
 * }
 */
export async function getStartupData(token) {
  if (isDemoMode()) {
    return safeGetItem('demo_viking_startup_data_offline', null);
  }

  return osmRequest('getStartupData', '/get-startup-data', {
    token,
    ttl: STARTUP_DATA_CACHE_TTL,
    cacheRead: () => IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, 'viking_startup_data'),
    cacheWrite: async (startupData) => {
      const withTimestamp = { ...startupData, _cacheTimestamp: Date.now() };
      const success = isDemoMode()
        ? safeSetItem('demo_viking_startup_data_offline', withTimestamp)
        : await IndexedDBService.set(IndexedDBService.STORES.CACHE_DATA, 'viking_startup_data', withTimestamp);
      if (!success) {
        logger.error('Startup data caching failed', {}, LOG_CATEGORIES.ERROR);
      }
    },
    emptyValue: null,
  });
}
