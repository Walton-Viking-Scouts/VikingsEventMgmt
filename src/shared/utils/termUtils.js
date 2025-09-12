// Term utility functions for Vikings Event Management Mobile
import { sentryUtils } from '../services/utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

/**
 * Find the most recent term from a list of terms based on end date
 * Compares term end dates to determine which is the most recent/current
 * 
 * @param {TermObject[]} terms - Array of term objects with enddate property
 * @returns {TermObject|null} Most recent term object or null if no valid terms
 * @throws {Error} If terms parameter is invalid
 * 
 * @typedef {object} TermObject
 * @property {string} termid - Unique term identifier
 * @property {string} enddate - Term end date in ISO format or parseable date string
 * @property {string} [name] - Optional term name
 * @property {string} [startdate] - Optional term start date
 * 
 * @example
 * // Find current/most recent term from API response
 * const terms = [
 *   { termid: '1', enddate: '2023-07-31', name: 'Summer 2023' },
 *   { termid: '2', enddate: '2023-12-15', name: 'Autumn 2023' },
 *   { termid: '3', enddate: '2024-03-31', name: 'Spring 2024' }
 * ];
 * const currentTerm = findMostRecentTerm(terms); // Returns Spring 2024 term
 */
export function findMostRecentTerm(terms) {
  // Input validation
  if (!Array.isArray(terms)) {
    const error = new Error(`Invalid terms parameter: expected array, got ${typeof terms}`);
    
    logger.error('Invalid terms parameter for findMostRecentTerm', {
      providedType: typeof terms,
      isArray: Array.isArray(terms),
      isNull: terms === null,
      isUndefined: terms === undefined,
    }, LOG_CATEGORIES.ERROR);
    
    sentryUtils.captureException(error, {
      tags: {
        operation: 'find_most_recent_term',
        validation_error: true,
      },
      contexts: {
        input: {
          type: typeof terms,
          isArray: Array.isArray(terms),
          isNull: terms === null,
        },
      },
    });
    
    throw error;
  }

  if (terms.length === 0) {
    // No terms provided - this is a normal condition, not worth logging
    return null;
  }

  try {
    const mostRecentTerm = terms.reduce((latest, term) => {
      // Validate term object structure
      if (!term || typeof term !== 'object' || !term.enddate) {
        logger.warn('Invalid term object found', {
          term: term,
          hasEnddate: !!(term && term.enddate),
        }, LOG_CATEGORIES.APP);
        return latest; // Skip invalid terms
      }

      const termEndDate = new Date(term.enddate);
      const latestEndDate = latest ? new Date(latest.enddate) : new Date(0);
      
      // Check for invalid dates
      if (isNaN(termEndDate.getTime())) {
        logger.warn('Invalid enddate in term', {
          termid: term.termid,
          enddate: term.enddate,
        }, LOG_CATEGORIES.APP);
        return latest; // Skip terms with invalid dates
      }
      
      return termEndDate > latestEndDate ? term : latest;
    }, null);

    // Successfully found most recent term - no need to log routine operations

    return mostRecentTerm;
  } catch (error) {
    logger.error('Error finding most recent term', {
      error: error.message,
      termsCount: terms.length,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'find_most_recent_term',
      },
      contexts: {
        terms: {
          count: terms.length,
          hasValidStructure: terms.every(t => t && typeof t === 'object'),
        },
      },
    });

    throw error;
  }
}

/**
 * Get the most recent term ID for a specific section from pre-loaded terms data
 * Convenience function that combines section lookup with most recent term finding
 * 
 * @param {number|string} sectionId - Section ID to find terms for (will be converted to string for lookup)
 * @param {object} allTerms - Terms object keyed by section ID, values are arrays of term objects
 * @returns {string|null} Most recent term ID or null if not found
 * @throws {Error} If parameters are invalid
 * 
 * @example
 * // Get current term ID for a specific section
 * const allTerms = {
 *   '101': [
 *     { termid: 'term1', enddate: '2023-12-31' },
 *     { termid: 'term2', enddate: '2024-06-30' }
 *   ],
 *   '102': [
 *     { termid: 'term3', enddate: '2024-03-31' }
 *   ]
 * };
 * 
 * const currentTermId = getMostRecentTermId(101, allTerms); // Returns 'term2'
 * const unknownSectionTerm = getMostRecentTermId(999, allTerms); // Returns null
 */
export function getMostRecentTermId(sectionId, allTerms) {
  // Input validation
  if (sectionId === null || sectionId === undefined) {
    const error = new Error('Section ID is required');
    
    logger.error('Missing section ID for getMostRecentTermId', {
      sectionId,
      hasAllTerms: !!allTerms,
    }, LOG_CATEGORIES.ERROR);
    
    throw error;
  }

  if (!allTerms || typeof allTerms !== 'object') {
    const error = new Error(`Invalid allTerms parameter: expected object, got ${typeof allTerms}`);
    
    logger.error('Invalid allTerms parameter', {
      sectionId,
      allTermsType: typeof allTerms,
      isNull: allTerms === null,
    }, LOG_CATEGORIES.ERROR);
    
    throw error;
  }

  // Convert sectionId to string for consistent lookup
  const sectionKey = String(sectionId);
  
  if (!allTerms[sectionKey]) {
    // No terms for this section - expected for some sections
    return null;
  }

  try {
    const mostRecentTerm = findMostRecentTerm(allTerms[sectionKey]);
    
    if (!mostRecentTerm) {
      logger.warn('No valid terms found for section', {
        sectionId: sectionKey,
        termsCount: allTerms[sectionKey].length,
      }, LOG_CATEGORIES.APP);
      return null;
    }

    // Successfully retrieved term ID - routine operation, no logging needed

    return mostRecentTerm.termid;
  } catch (error) {
    logger.error('Error getting most recent term ID', {
      sectionId: sectionKey,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'get_most_recent_term_id',
      },
      contexts: {
        section: {
          sectionId: sectionKey,
          hasTerms: !!(allTerms[sectionKey]),
          termsCount: allTerms[sectionKey]?.length || 0,
        },
      },
    });

    throw error;
  }
}