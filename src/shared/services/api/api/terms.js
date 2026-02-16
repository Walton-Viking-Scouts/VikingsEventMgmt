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
import { isDemoMode } from '../../../../config/demoMode.js';
import { findMostRecentTerm } from '../../../utils/termUtils.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';
import { CurrentActiveTermsService } from '../../storage/currentActiveTermsService.js';
import DatabaseService from '../../storage/database.js';

/**
 * Calculate and store current active terms from API response
 * Processes terms data to extract the current/most recent term for each section
 * and stores them in the current_active_terms table for direct lookup
 * @param {Object} termsData - Raw terms data from API response
 * @returns {Promise<void>}
 */
async function calculateAndStoreCurrentTerms(termsData) {
  if (!termsData || typeof termsData !== 'object') {
    logger.warn('calculateAndStoreCurrentTerms received invalid data', {
      hasData: !!termsData,
      dataType: typeof termsData,
    }, LOG_CATEGORIES.DATABASE);
    return;
  }

  try {
    let storedTerms = 0;
    let skippedTerms = 0;
    const errors = [];

    // Process each section's terms
    for (const [sectionId, sectionTerms] of Object.entries(termsData)) {
      // Skip internal properties like _cacheTimestamp
      if (sectionId.startsWith('_')) {
        continue;
      }

      try {
        // Validate section terms structure
        if (!Array.isArray(sectionTerms) || sectionTerms.length === 0) {
          logger.debug('Skipping section with no terms', { sectionId }, LOG_CATEGORIES.DATABASE);
          skippedTerms++;
          continue;
        }

        // Find the current/most recent term for this section
        const currentTerm = findMostRecentTerm(sectionTerms);
        if (!currentTerm) {
          logger.debug('No current term found for section', { sectionId }, LOG_CATEGORIES.DATABASE);
          skippedTerms++;
          continue;
        }

        // Store the current active term in the table with error handling
        await CurrentActiveTermsService.setCurrentActiveTerm(sectionId, {
          currentTermId: currentTerm.termid,
          termName: currentTerm.name,
          startDate: currentTerm.startdate,
          endDate: currentTerm.enddate,
        });

        storedTerms++;

        logger.info('Stored current active term for section', {
          sectionId,
          termId: currentTerm.termid,
          termName: currentTerm.name,
        }, LOG_CATEGORIES.DATABASE);

      } catch (sectionError) {
        const errorInfo = {
          sectionId,
          error: sectionError.message,
        };
        logger.error('Error storing current term for section', errorInfo, LOG_CATEGORIES.ERROR);
        errors.push(errorInfo);
      }
    }

    logger.info('Current active terms processing completed', {
      stored: storedTerms,
      skipped: skippedTerms,
      errors: errors.length,
    }, LOG_CATEGORIES.DATABASE);

    // If we had some successes but also some errors, continue but log
    if (errors.length > 0 && storedTerms > 0) {
      logger.warn('Some terms failed to store but others succeeded', {
        successCount: storedTerms,
        errorCount: errors.length,
        firstError: errors[0],
      }, LOG_CATEGORIES.DATABASE);
    } else if (errors.length > 0 && storedTerms === 0) {
      // All attempts failed
      throw new Error(`Failed to store any terms. First error: ${errors[0].error}`);
    }

  } catch (error) {
    logger.error('Failed to store current active terms', {
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);
    throw error;
  }
}

/**
 * Stores all terms to the normalized DatabaseService store for offline access.
 * Iterates over each section in the terms data and saves via DatabaseService.saveTerms.
 *
 * @param {Object} termsData - Terms data keyed by section ID
 * @returns {Promise<void>}
 */
async function storeTermsToNormalizedStore(termsData) {
  if (!termsData || typeof termsData !== 'object') {
    return;
  }

  try {
    const databaseService = DatabaseService.getInstance();
    for (const [sectionId, sectionTerms] of Object.entries(termsData)) {
      if (sectionId.startsWith('_')) {
        continue;
      }
      if (!Array.isArray(sectionTerms) || sectionTerms.length === 0) {
        continue;
      }
      await databaseService.saveTerms(sectionId, sectionTerms);
    }
    logger.debug('Terms stored to normalized store', {
      sectionCount: Object.keys(termsData).filter(k => !k.startsWith('_')).length,
    }, LOG_CATEGORIES.DATABASE);
  } catch (error) {
    logger.error('Failed to store terms to normalized store', {
      error: error.message,
    }, LOG_CATEGORIES.ERROR);
  }
}

/**
 * Retrieves OSM terms data with caching and offline support
 * @param {string} token - OSM authentication token
 * @param {boolean} [forceRefresh=false] - Force refresh from API instead of using cache
 * @returns {Promise<Object>} Terms data from OSM API
 * @throws {Error} When token is missing or API request fails
 * 
 * @example
 * const terms = await getTerms(userToken);
 * const freshTerms = await getTerms(userToken, true);
 */
export async function getTerms(token, forceRefresh = false) {
  try {
    // Check network status first
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      throw new Error('No network connection available for fetching terms');
    }

    // For demo mode, return mock data without API calls
    const demoMode = isDemoMode();
    if (demoMode && !forceRefresh) {
      const mockTerms = {
        '999901': [
          {
            termid: 'demo-term-1',
            name: 'Demo Term 2024',
            startdate: '2024-01-01',
            enddate: '2024-12-31',
          },
        ],
      };

      try {
        await calculateAndStoreCurrentTerms(mockTerms);
      } catch (currentTermsError) {
        logger.error('Demo mode: Failed to store current terms', {
          error: currentTermsError.message,
        }, LOG_CATEGORIES.ERROR);
      }

      await storeTermsToNormalizedStore(mockTerms);

      return mockTerms;
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

    try {
      await calculateAndStoreCurrentTerms(terms);
      logger.debug('Current active terms storage completed successfully', {
        termSectionsCount: Object.keys(terms || {}).filter(k => !k.startsWith('_')).length,
      }, LOG_CATEGORIES.DATABASE);
    } catch (currentTermsError) {
      logger.error('Failed to store current active terms', {
        error: currentTermsError.message,
        stack: currentTermsError.stack,
      }, LOG_CATEGORIES.ERROR);
      logger.warn('Term storage failed - sync operations may fail to find terms', {
        affectedSections: Object.keys(terms || {}).filter(k => !k.startsWith('_')).length,
      }, LOG_CATEGORIES.API);
    }

    await storeTermsToNormalizedStore(terms);

    return terms;
    
  } catch (error) {
    logger.error('Error fetching terms - no fallback available', {
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // No fallback storage - throw the original error
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
      logger.debug('Fetching most recent term ID', { sectionId, sectionIdType: typeof sectionId }, LOG_CATEGORIES.API);

      const currentTerm = await CurrentActiveTermsService.getCurrentActiveTerm(sectionId);
      const termId = currentTerm?.currentTermId || null;

      if (!termId) {
        logger.info('No cached term found, refreshing from API', { sectionId }, LOG_CATEGORIES.API);

        // If no term found, try refreshing data from API and wait for storage completion
        await getTerms(token, true);

        // Add a small delay to ensure database writes complete
        await new Promise(resolve => setTimeout(resolve, 100));

        const refreshedTerm = await CurrentActiveTermsService.getCurrentActiveTerm(sectionId);
        const refreshedTermId = refreshedTerm?.currentTermId || null;

        if (!refreshedTermId) {
          logger.warn('Term lookup failed even after API refresh', {
            sectionId,
            hadCurrentTerm: !!currentTerm,
            hadRefreshedTerm: !!refreshedTerm,
          }, LOG_CATEGORIES.API);
        }

        return refreshedTermId;
      }

      return termId;
    } catch (error) {
      logger.error('Error fetching most recent term ID', { sectionId, error: error.message }, LOG_CATEGORIES.ERROR);
      throw error;
    }
  });
}