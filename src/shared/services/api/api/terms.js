// Terms API service
// Extracted from monolithic api.js for better modularity

import {
  BACKEND_URL,
  validateTokenBeforeAPICall,
  handleAPIResponseWithRateLimit,
  apiQueue,
} from './base.js';
import { withRateLimitQueue } from '../../../utils/rateLimitQueue.js';
import { checkNetworkStatus } from '../../../utils/networkUtils.js';
import { safeGetItem, safeSetItem } from '../../../utils/storageUtils.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { getMostRecentTermId } from '../../../utils/termUtils.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

// Terms cache TTL - localStorage only for persistence
const TERMS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Retrieves OSM terms data with caching and offline support
 * @param {string} token - OSM authentication token
 * @param {boolean} [forceRefresh=false] - Force refresh from API instead of using cache
 * @returns {Promise<object>} Terms data from OSM API
 * @throws {Error} When token is missing or API request fails
 * 
 * @example
 * const terms = await getTerms(userToken);
 * const freshTerms = await getTerms(userToken, true);
 */
export async function getTerms(token, forceRefresh = false) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = 'demo_viking_terms_offline';
      const cached = safeGetItem(cacheKey, { items: [] });
      if (import.meta.env.DEV) {
        logger.debug('Demo mode: Using cached terms data', {
          termsCount: cached.items?.length || 0,
        }, LOG_CATEGORIES.API);
      }
      return cached;
    }
    
    const cacheKey = demoMode ? 'demo_viking_terms_offline' : 'viking_terms_offline';
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cached = safeGetItem(cacheKey, null);
      if (cached && cached._cacheTimestamp) {
        const cacheAge = Date.now() - cached._cacheTimestamp;
        if (cacheAge < TERMS_CACHE_TTL) {
          logger.info('Using cached terms data', { 
            cacheAgeMinutes: Math.round(cacheAge / 60000),
          }, LOG_CATEGORIES.API);
          return cached;
        }
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(cacheKey, {});
      logger.info('Retrieved terms from localStorage while offline', {}, LOG_CATEGORIES.API);
      return cached;
    }

    // Validate token before making API call
    validateTokenBeforeAPICall(token, 'getTerms');

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/get-terms`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return await handleAPIResponseWithRateLimit(response, 'getTerms');
    });
    const terms = data || {};
    
    // Cache terms data with timestamp - enhanced error handling for visibility  
    try {
      const cachedTerms = {
        ...terms,
        _cacheTimestamp: Date.now(),
      };
      const success = safeSetItem(cacheKey, cachedTerms);
      if (success) {
        logger.info('Terms successfully cached', {
          cacheKey,
          termCount: Array.isArray(terms) 
            ? terms.length 
            : (terms?.items?.length ?? Object.keys(terms || {}).length),
          dataSize: JSON.stringify(cachedTerms).length,
        }, LOG_CATEGORIES.API);
      } else {
        logger.error('Terms caching failed - safeSetItem returned false', {
          cacheKey,
          termCount: Array.isArray(terms) 
            ? terms.length 
            : (terms?.items?.length ?? Object.keys(terms || {}).length),
          dataSize: JSON.stringify(cachedTerms).length,
        }, LOG_CATEGORIES.ERROR);
      }
    } catch (cacheError) {
      logger.error('Terms caching error', {
        cacheKey,
        error: cacheError.message,
        termCount: Array.isArray(terms) 
          ? terms.length 
          : (terms?.items?.length ?? Object.keys(terms || {}).length),
      }, LOG_CATEGORIES.ERROR);
    }
    
    return terms; // Return original data without timestamp
    
  } catch (error) {
    logger.error('Error fetching terms', {
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);
    
    // If online request fails, try localStorage as fallback
    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const demoMode = isDemoMode();
        const cacheKey = demoMode ? 'demo_viking_terms_offline' : 'viking_terms_offline';
        const cached = safeGetItem(cacheKey, {});
        logger.warn('Using cached terms after API failure', {}, LOG_CATEGORIES.API);
        return cached;
      } catch (cacheError) {
        logger.error('Cache fallback also failed', {
          error: cacheError.message,
        }, LOG_CATEGORIES.ERROR);
      }
    }
    
    throw error;
  }
}

/**
 * Fetches the most recent term ID for a specific section
 * @param {number|string} sectionId - OSM section identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<string|null>} Most recent term ID or null if not found
 * @throws {Error} When API request fails or term cannot be determined
 * 
 * @example
 * const termId = await fetchMostRecentTermId(123, userToken);
 */
export async function fetchMostRecentTermId(sectionId, token) {
  return apiQueue.add(async () => {
    try {
      const terms = await getTerms(token);
      return getMostRecentTermId(sectionId, terms);
    } catch (error) {
      logger.error('Error fetching most recent term ID', { sectionId, error: error.message }, LOG_CATEGORIES.API);
      throw error;
    }
  });
}