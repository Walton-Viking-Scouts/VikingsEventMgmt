/**
 * Programme API service — proxies OSM's programme summary (meeting list)
 * through the backend. Used by the water-rota feature to derive on-water
 * session dates from each section's programme.
 *
 * @module programme
 */

import { osmRequest } from './base.js';
import { safeGetItem } from '../../../utils/storageUtils.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import IndexedDBService from '../../storage/indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

const PROGRAMME_CACHE_TTL = 30 * 60 * 1000;

/**
 * Retrieves the programme summary (meeting list) for a section and term.
 * Cached for 30 minutes — the programme changes rarely within a session.
 * Cache hits and network responses share the same `{items}` shape (the
 * cached copy additionally carries `_cacheTimestamp`), mirroring
 * getStartupData.
 *
 * @param {number|string} sectionId - OSM section identifier
 * @param {number|string} termId - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<{items: Array<Object>}|null>} Programme meetings wrapper, or null when unavailable
 * @throws {Error} When the request fails and no cached data is available
 *
 * @example
 * const programme = await getProgramme(49097, '846925', userToken);
 * const meetings = programme?.items ?? [];
 */
export async function getProgramme(sectionId, termId, token) {
  const cacheKey = `viking_programme_${sectionId}_${termId}`;

  if (isDemoMode()) {
    return safeGetItem(`demo_${cacheKey}_offline`, null);
  }

  return osmRequest(
    'getProgrammeSummary',
    `/get-programme-summary?sectionid=${encodeURIComponent(sectionId)}&termid=${encodeURIComponent(termId)}`,
    {
      token,
      ttl: PROGRAMME_CACHE_TTL,
      cacheRead: () => IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, cacheKey),
      transform: (data) => ({ items: (data && Array.isArray(data.items)) ? data.items : [] }),
      cacheWrite: async (result) => {
        const withTimestamp = { ...result, _cacheTimestamp: Date.now() };
        const success = await IndexedDBService.set(
          IndexedDBService.STORES.CACHE_DATA,
          cacheKey,
          withTimestamp,
        );
        if (!success) {
          logger.error('Programme caching failed', { sectionId, termId }, LOG_CATEGORIES.ERROR);
        }
      },
      emptyValue: null,
    },
  );
}
