/**
 * Reference Data Service
 *
 * Loads essential reference data (terms, user-roles, startup-data, members) after authentication.
 * FlexiRecord data is loaded separately after events/attendance for better performance.
 * Designed for Scout-friendly error handling with non-blocking loads.
 *
 * @module referenceDataService
 * @version 2.4.0
 * @since 2.4.0 - Split FlexiRecord loading into separate function
 * @since 2.3.7 - Created during auth flow simplification
 * @author Vikings Event Management Team
 */

import { getTerms, getUserRoles, getStartupData, getListOfMembers, getFlexiRecords, getFlexiStructure } from '../api/index.js';
import { handleScoutError, isOfflineError } from '../../utils/scoutErrorHandler.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

/**
 * Loads core reference data after successful authentication
 * Non-blocking - user can continue if some data fails to load
 * Does NOT load FlexiRecord data - use loadFlexiRecordData() after events/attendance
 *
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} Results object with success/failure details
 *
 * @example
 * const results = await loadInitialReferenceData(token);
 * if (results.hasErrors) {
 *   console.log('Some data failed:', results.errors);
 * }
 */
export async function loadInitialReferenceData(token) {
  if (!token) {
    logger.warn('No token provided for reference data loading', {}, LOG_CATEGORIES.AUTH);
    return {
      success: false,
      hasErrors: true,
      errors: ['No authentication token available'],
      results: {},
    };
  }

  logger.info('Starting core reference data load after authentication', {}, LOG_CATEGORIES.AUTH);

  const results = {
    terms: null,
    userRoles: null,
    startupData: null,
    members: null,
  };
  const errors = [];
  let successCount = 0;

  // Load terms data
  try {
    logger.debug('Loading terms data', {}, LOG_CATEGORIES.AUTH);
    results.terms = await getTerms(token, false); // Use cache if available
    successCount++;
    logger.info('Terms data loaded successfully', {
      sectionsCount: Object.keys(results.terms || {}).filter(k => !k.startsWith('_')).length,
    }, LOG_CATEGORIES.AUTH);
  } catch (error) {
    const message = handleScoutError(error, 'loading terms data', {
      showNotification: false, // Don't show notifications for background loading
      isWarning: true,
    });
    errors.push({ type: 'terms', message, originalError: error.message });
    logger.warn('Terms data loading failed', { error: error.message }, LOG_CATEGORIES.AUTH);
  }

  // Load user roles
  try {
    logger.debug('Loading user roles', {}, LOG_CATEGORIES.AUTH);
    results.userRoles = await getUserRoles(token);
    successCount++;
    logger.info('User roles loaded successfully', {
      sectionsCount: results.userRoles?.length || 0,
    }, LOG_CATEGORIES.AUTH);
  } catch (error) {
    const message = handleScoutError(error, 'loading user roles', {
      showNotification: false,
      isWarning: true,
    });
    errors.push({ type: 'userRoles', message, originalError: error.message });
    logger.warn('User roles loading failed', { error: error.message }, LOG_CATEGORIES.AUTH);
  }

  // Load startup data
  try {
    logger.debug('Loading startup data', {}, LOG_CATEGORIES.AUTH);
    results.startupData = await getStartupData(token);
    successCount++;
    logger.info('Startup data loaded successfully', {
      hasGlobals: !!(results.startupData?.globals),
      hasRoles: !!(results.startupData?.roles),
    }, LOG_CATEGORIES.AUTH);

    // Extract and set user info from startup data
    if (results.startupData?.globals) {
      try {
        const { setUserInfo } = await import('../../../features/auth/services/auth.js');
        const userInfo = {
          firstname: results.startupData.globals.firstname || 'Scout Leader',
          lastname: results.startupData.globals.lastname || '',
          userid: results.startupData.globals.userid || null,
          email: results.startupData.globals.email || null,
          fullname: `${results.startupData.globals.firstname || 'Scout'} ${results.startupData.globals.lastname || 'Leader'}`.trim(),
        };
        setUserInfo(userInfo);
        logger.info('User info extracted from startup data', {
          firstname: userInfo.firstname,
          hasUserInfo: true,
        }, LOG_CATEGORIES.AUTH);
      } catch (userInfoError) {
        logger.warn('Could not set user info from startup data', {
          error: userInfoError.message,
        }, LOG_CATEGORIES.AUTH);
      }
    }
  } catch (error) {
    const message = handleScoutError(error, 'loading startup data', {
      showNotification: false,
      isWarning: true,
    });
    errors.push({ type: 'startupData', message, originalError: error.message });
    logger.warn('Startup data loading failed', { error: error.message }, LOG_CATEGORIES.AUTH);
  }

  // Load members data
  try {
    logger.debug('Loading members data', {}, LOG_CATEGORIES.AUTH);
    // First get sections to use for members loading
    if (results.userRoles && results.userRoles.length > 0) {
      results.members = await getListOfMembers(results.userRoles, token);
      successCount++;
      logger.info('Members data loaded successfully', {
        membersCount: results.members?.length || 0,
      }, LOG_CATEGORIES.AUTH);
    } else {
      logger.warn('No sections available for members loading', {}, LOG_CATEGORIES.AUTH);
    }
  } catch (error) {
    const message = handleScoutError(error, 'loading members data', {
      showNotification: false,
      isWarning: true,
    });
    errors.push({ type: 'members', message, originalError: error.message });
    logger.warn('Members data loading failed', { error: error.message }, LOG_CATEGORIES.AUTH);
  }

  const hasErrors = errors.length > 0;
  const isCompleteFailure = successCount === 0;

  // Log summary
  if (isCompleteFailure) {
    logger.error('All core reference data loading failed', {
      totalAttempts: 4,
      successCount,
      errorCount: errors.length,
      errors: errors.map(e => e.type),
    }, LOG_CATEGORIES.ERROR);
  } else if (hasErrors) {
    logger.warn('Partial core reference data loading failure', {
      totalAttempts: 4,
      successCount,
      errorCount: errors.length,
      successfulTypes: Object.keys(results).filter(k => results[k] !== null),
      failedTypes: errors.map(e => e.type),
    }, LOG_CATEGORIES.AUTH);
  } else {
    logger.info('All core reference data loaded successfully', {
      totalAttempts: 4,
      successCount,
    }, LOG_CATEGORIES.AUTH);
  }

  return {
    success: !isCompleteFailure,
    hasErrors,
    errors,
    results,
    summary: {
      total: 4,
      successful: successCount,
      failed: errors.length,
    },
  };
}

/**
 * Loads FlexiRecord data (lists and structures) for Viking Event Management
 * Should be called after events and attendance data are loaded
 *
 * @param {Array} sections - User sections/roles with sectionid and sectionname
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} Results object with FlexiRecord data
 *
 * @example
 * const flexiResults = await loadFlexiRecordData(userRoles, token);
 * if (flexiResults.success) {
 *   console.log('FlexiRecords loaded:', flexiResults.results);
 * }
 */
export async function loadFlexiRecordData(sections, token) {
  if (!token) {
    logger.warn('No token provided for FlexiRecord data loading', {}, LOG_CATEGORIES.DATA_SERVICE);
    return {
      success: false,
      hasErrors: true,
      errors: ['No authentication token available'],
      results: null,
    };
  }

  if (!sections || sections.length === 0) {
    logger.warn('No sections provided for FlexiRecord data loading', {}, LOG_CATEGORIES.DATA_SERVICE);
    return {
      success: false,
      hasErrors: true,
      errors: ['No sections available for FlexiRecord loading'],
      results: null,
    };
  }

  logger.info('Starting FlexiRecord data load', {
    sectionCount: sections.length,
  }, LOG_CATEGORIES.DATA_SERVICE);

  const errors = [];

  try {
    const flexiRecordData = {
      lists: [],
      structures: [],
    };

    // Load FlexiRecord lists for all sections
    for (const section of sections) {
      try {
        const flexiRecords = await getFlexiRecords(section.sectionid, token, 'n', false);
        if (flexiRecords && flexiRecords.items) {
          flexiRecordData.lists.push({
            sectionId: section.sectionid,
            sectionName: section.sectionname,
            records: flexiRecords.items,
          });
        }
      } catch (sectionError) {
        logger.warn('Failed to load FlexiRecord list for section', {
          sectionId: section.sectionid,
          sectionName: section.sectionname,
          error: sectionError.message,
        }, LOG_CATEGORIES.DATA_SERVICE);
        errors.push({
          type: 'flexiRecordList',
          sectionId: section.sectionid,
          message: `Failed to load FlexiRecord list for ${section.sectionname}`,
          originalError: sectionError.message,
        });
      }
    }

    // Load structures for Viking-specific FlexiRecords
    const allFlexiRecords = new Map();
    flexiRecordData.lists.forEach(({ sectionId, records }) => {
      records.forEach(record => {
        if (record.extraid && record.name && record.archived !== '1' && record.soft_deleted !== '1') {
          if (!allFlexiRecords.has(record.extraid)) {
            allFlexiRecords.set(record.extraid, {
              extraid: record.extraid,
              name: record.name,
              sectionIds: [],
            });
          }
          allFlexiRecords.get(record.extraid).sectionIds.push(sectionId);
        }
      });
    });

    // Load structures only for Viking Event Mgmt and Viking Section Movers
    const vikingRecords = Array.from(allFlexiRecords.values()).filter(record =>
      record.name === 'Viking Event Mgmt' || record.name === 'Viking Section Movers',
    );

    for (const record of vikingRecords) {
      try {
        const sectionId = record.sectionIds[0]; // Use first section for request
        const structure = await getFlexiStructure(record.extraid, sectionId, null, token);
        if (structure) {
          flexiRecordData.structures.push({
            extraid: record.extraid,
            name: record.name,
            structure: structure,
            sectionIds: record.sectionIds,
          });
        }
      } catch (structureError) {
        logger.warn('Failed to load FlexiRecord structure', {
          recordName: record.name,
          extraid: record.extraid,
          error: structureError.message,
        }, LOG_CATEGORIES.DATA_SERVICE);
        errors.push({
          type: 'flexiRecordStructure',
          recordName: record.name,
          message: `Failed to load structure for ${record.name}`,
          originalError: structureError.message,
        });
      }
    }

    const hasErrors = errors.length > 0;
    const hasData = flexiRecordData.lists.length > 0 || flexiRecordData.structures.length > 0;

    logger.info('FlexiRecord data loading completed', {
      sectionsProcessed: flexiRecordData.lists.length,
      totalRecords: flexiRecordData.lists.reduce((sum, section) => sum + section.records.length, 0),
      vikingStructures: flexiRecordData.structures.length,
      hasErrors,
      errorCount: errors.length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return {
      success: hasData,
      hasErrors,
      errors,
      results: flexiRecordData,
      summary: {
        sectionsProcessed: flexiRecordData.lists.length,
        totalRecords: flexiRecordData.lists.reduce((sum, section) => sum + section.records.length, 0),
        vikingStructures: flexiRecordData.structures.length,
      },
    };

  } catch (error) {
    const message = handleScoutError(error, 'loading FlexiRecord data', {
      showNotification: false,
      isWarning: true,
    });

    logger.error('Critical error during FlexiRecord data loading', {
      error: error.message,
    }, LOG_CATEGORIES.ERROR);

    return {
      success: false,
      hasErrors: true,
      errors: [{ type: 'flexiRecords', message, originalError: error.message }],
      results: null,
    };
  }
}

/**
 * Checks if any reference data loading errors are due to offline conditions
 *
 * @param {Array} errors - Error array from loadInitialReferenceData
 * @returns {boolean} True if any errors appear to be offline-related
 */
export function hasOfflineErrors(errors) {
  return errors.some(error => isOfflineError(error.originalError));
}

/**
 * Formats reference data loading results for user display
 * Only shows user-facing messages for critical failures
 *
 * @param {Object} results - Results from loadInitialReferenceData
 * @returns {string|null} User message or null if no action needed
 */
export function getLoadingResultMessage(results) {
  if (!results.hasErrors) {
    return null; // No message needed for success
  }

  const { errors, summary } = results;

  // If completely offline, provide helpful message
  if (hasOfflineErrors(errors) && summary.successful === 0) {
    return 'Unable to load latest data. Check your internet connection. You can still use cached data.';
  }

  // If partial failure but some success, don't show message (non-critical)
  if (summary.successful > 0) {
    return null;
  }

  // Complete failure but not offline - generic message
  return 'Unable to load some data. Please try refreshing or contact support if this continues.';
}

export default {
  loadInitialReferenceData,
  loadFlexiRecordData,
  hasOfflineErrors,
  getLoadingResultMessage,
};