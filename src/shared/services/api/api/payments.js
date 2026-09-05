/**
 * OSM online-payments API service — proxies the payment scheme list and the
 * per-scheme payment status through the backend for the subs monitoring
 * feature.
 *
 * Both endpoints are read-only and rate-limit sensitive: responses are cached
 * in the generic CACHE_DATA store for 30 minutes exactly like getProgramme,
 * and callers make one request per user action with no retry.
 *
 * Two deliberate departures from the other endpoints. Cache reads are bounded
 * by the same TTL, because osmRequest otherwise serves ANY cached value —
 * ignoring its age and even forceRefresh — when a request fails, is refused
 * (401) or cannot be made; subs must fail loudly rather than show stale
 * money. And the response envelope is validated in the transform, so a
 * malformed body is rejected before it can be cached.
 *
 * Checking the caller may see a section's finances (finance permission and
 * the token's finance scope) is the caller's job — see subsService.js — not
 * this module's.
 *
 * @module payments
 */

import { osmRequest } from './base.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import IndexedDBService from '../../storage/indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

const PAYMENTS_CACHE_TTL = 30 * 60 * 1000;

/**
 * Reads a cached payment response, treating anything older than the TTL as
 * absent. osmRequest falls back to `cacheRead` whenever a request fails or
 * cannot be sent, with no age check of its own; bounding it here means only
 * a still-fresh response can be served that way — and a fresh response would
 * already have short-circuited the request.
 *
 * @param {string} cacheKey - CACHE_DATA key to read
 * @returns {Function} async () => cached value or null
 */
function freshCacheReader(cacheKey) {
  return async () => {
    const cached = await IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, cacheKey);
    const cachedAt = cached?._cacheTimestamp;
    if (!cachedAt || Date.now() - cachedAt >= PAYMENTS_CACHE_TTL) {
      return null;
    }
    return cached;
  };
}

/**
 * Rejects a malformed or error response before it reaches the cache.
 *
 * @param {Object|null} data - Response body with _rateLimitInfo already stripped
 * @param {string} description - What was being loaded, for the message
 * @param {Function} isWellFormed - Predicate for the endpoint's payload shape
 * @returns {Object} The unchanged body
 * @throws {Error} When the body is empty, flags an error, or has the wrong shape
 */
function requireValidEnvelope(data, description, isWellFormed) {
  if (!data || typeof data !== 'object') {
    throw new Error(`${description}: empty response from OSM`);
  }
  if (data.status === false || data.error) {
    throw new Error(`${description}: OSM reported "${data.error ?? 'an error'}"`);
  }
  if (!isWellFormed(data)) {
    throw new Error(`${description}: unexpected response shape from OSM`);
  }
  return data;
}

/**
 * Builds a cacheWrite that stamps `_cacheTimestamp` and logs failures.
 *
 * @param {string} cacheKey - CACHE_DATA key to write
 * @param {Object} context - Extra logging context (ids)
 * @returns {Function} async (result) => void
 */
function cacheWriter(cacheKey, context) {
  return async (result) => {
    const withTimestamp = { ...result, _cacheTimestamp: Date.now() };
    const success = await IndexedDBService.set(
      IndexedDBService.STORES.CACHE_DATA,
      cacheKey,
      withTimestamp,
    );
    if (!success) {
      logger.error('Payment response caching failed', context, LOG_CATEGORIES.ERROR);
    }
  };
}

/**
 * Retrieves the payment schemes configured for a section.
 *
 * @param {number|string} sectionId - OSM section identifier
 * @param {string} token - OSM authentication token
 * @param {Object} [options] - Load options
 * @param {boolean} [options.forceRefresh=false] - Bypass the 30 minute TTL
 * @returns {Promise<Object|null>} The raw getSchemes response, or null in demo mode
 * @throws {Error} When the request fails, the response is malformed, or no
 *   fresh cached data is available
 *
 * @example
 * const schemes = await getPaymentSchemes(49097, token);
 * const subsSchemes = (schemes?.items ?? []).filter((s) => s.require_all === 1);
 */
export async function getPaymentSchemes(sectionId, token, { forceRefresh = false } = {}) {
  if (isDemoMode()) {
    return null;
  }

  const cacheKey = `viking_payment_schemes_${sectionId}`;

  return osmRequest(
    'getPaymentSchemes',
    `/get-payment-schemes?sectionid=${encodeURIComponent(sectionId)}`,
    {
      token,
      ttl: PAYMENTS_CACHE_TTL,
      forceRefresh,
      cacheRead: freshCacheReader(cacheKey),
      transform: (data) => requireValidEnvelope(
        data,
        `Payment schemes for section ${sectionId}`,
        (body) => Array.isArray(body.items),
      ),
      cacheWrite: cacheWriter(cacheKey, { sectionId }),
      throwWhenUnavailable: true,
      emptyValue: null,
    },
  );
}

/**
 * Retrieves the per-member payment status for one scheme and term. Always
 * requests `payload=1` so the full per-payment status history is returned.
 *
 * @param {number|string} sectionId - OSM section identifier
 * @param {number|string} schemeId - OSM payment scheme identifier
 * @param {number|string} termId - OSM term identifier
 * @param {string} token - OSM authentication token
 * @param {Object} [options] - Load options
 * @param {boolean} [options.forceRefresh=false] - Bypass the 30 minute TTL
 * @returns {Promise<Object|null>} The raw getPaymentStatus response, or null in demo mode
 * @throws {Error} When the request fails, the response is malformed, or no
 *   fresh cached data is available
 *
 * @example
 * const status = await getPaymentStatus(49097, 60603, 965353, token);
 * const members = status?.data?.members ?? [];
 */
export async function getPaymentStatus(sectionId, schemeId, termId, token, { forceRefresh = false } = {}) {
  if (isDemoMode()) {
    return null;
  }

  const cacheKey = `viking_payment_status_${sectionId}_${schemeId}_${termId}`;
  const path = `/get-payment-status?sectionid=${encodeURIComponent(sectionId)}`
    + `&schemeid=${encodeURIComponent(schemeId)}`
    + `&termid=${encodeURIComponent(termId)}`
    + '&payload=1';

  return osmRequest('getPaymentStatus', path, {
    token,
    ttl: PAYMENTS_CACHE_TTL,
    forceRefresh,
    cacheRead: freshCacheReader(cacheKey),
    transform: (data) => requireValidEnvelope(
      data,
      `Payment status for scheme ${schemeId} in section ${sectionId}`,
      (body) => Array.isArray(body.data?.members),
    ),
    cacheWrite: cacheWriter(cacheKey, { sectionId, schemeId, termId }),
    throwWhenUnavailable: true,
    emptyValue: null,
  });
}
