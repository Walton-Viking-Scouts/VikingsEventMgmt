/**
 * Events Service
 *
 * Handles loading and caching of event definitions (not attendance data).
 * Event definitions are moderately dynamic (change weekly) but more stable than attendance.
 *
 * For attendance data, use EventSyncService instead.
 *
 * @module eventsService
 * @author Vikings Event Management Team
 */

import { getEvents, fetchMostRecentTermId } from '../api/index.js';
import { handleScoutError, isOfflineError } from '../../utils/scoutErrorHandler.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import databaseService from '../storage/database.js';

/**
 * Loads events for all sections
 * This loads event definitions, not attendance data
 *
 * @param {Array} sections - Array of section objects with sectionid and sectionname
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} Results object with success/failure details
 */
export async function loadEventsForSections(sections, token) {
  if (!token) {
    logger.warn('No token provided for events loading', {}, LOG_CATEGORIES.DATA_SERVICE);
    return {
      success: false,
      hasErrors: true,
      errors: ['No authentication token available'],
      results: [],
    };
  }

  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    logger.warn('No sections provided for events loading', {}, LOG_CATEGORIES.DATA_SERVICE);
    return {
      success: true,
      hasErrors: false,
      errors: [],
      results: [],
    };
  }

  logger.info('Starting events loading for sections', {
    sectionCount: sections.length,
  }, LOG_CATEGORIES.DATA_SERVICE);

  const results = [];
  const errors = [];
  let successCount = 0;

  // Load events for each section
  for (const section of sections) {
    try {
      logger.debug('Loading events for section', {
        sectionId: section.sectionid,
        sectionName: section.sectionname,
      }, LOG_CATEGORIES.DATA_SERVICE);

      const termId = await fetchMostRecentTermId(section.sectionid, token);
      if (termId) {
        const events = await getEvents(section.sectionid, termId, token);
        results.push({
          sectionId: section.sectionid,
          sectionName: section.sectionname,
          termId,
          events: events || [],
        });
        successCount++;

        logger.debug('Events loaded for section', {
          sectionId: section.sectionid,
          sectionName: section.sectionname,
          eventCount: events?.length || 0,
        }, LOG_CATEGORIES.DATA_SERVICE);
      } else {
        logger.info(`No term found for section ${section.sectionid} - skipping events loading`, {
          sectionId: section.sectionid,
          sectionName: section.sectionname,
        }, LOG_CATEGORIES.DATA_SERVICE);

        // Add empty result for consistency
        results.push({
          sectionId: section.sectionid,
          sectionName: section.sectionname,
          termId: null,
          events: [],
        });
      }
    } catch (error) {
      const message = handleScoutError(error, `loading events for section ${section.sectionname}`, {
        showNotification: false,
        isWarning: true,
      });
      errors.push({
        type: 'events',
        sectionId: section.sectionid,
        sectionName: section.sectionname,
        message,
        originalError: error.message,
      });
      logger.warn('Events loading failed for section', {
        sectionId: section.sectionid,
        sectionName: section.sectionname,
        error: error.message,
      }, LOG_CATEGORIES.DATA_SERVICE);
    }
  }

  const hasErrors = errors.length > 0;
  const isCompleteFailure = successCount === 0;

  // Log summary
  if (isCompleteFailure) {
    logger.error('All events loading failed', {
      totalSections: sections.length,
      successCount,
      errorCount: errors.length,
      errors: errors.map(e => `${e.sectionName} (${e.sectionId})`),
    }, LOG_CATEGORIES.ERROR);
  } else if (hasErrors) {
    logger.warn('Partial events loading failure', {
      totalSections: sections.length,
      successCount,
      errorCount: errors.length,
      successfulSections: results.filter(r => r.events.length > 0).map(r => r.sectionName),
      failedSections: errors.map(e => e.sectionName),
    }, LOG_CATEGORIES.DATA_SERVICE);
  } else {
    logger.info('All events loaded successfully', {
      totalSections: sections.length,
      successCount,
      totalEvents: results.reduce((sum, section) => sum + (section.events?.length || 0), 0),
    }, LOG_CATEGORIES.DATA_SERVICE);
  }

  return {
    success: !isCompleteFailure,
    hasErrors,
    errors,
    results,
    summary: {
      totalSections: sections.length,
      successful: successCount,
      failed: errors.length,
      totalEvents: results.reduce((sum, section) => sum + (section.events?.length || 0), 0),
    },
  };
}

/**
 * Loads events from cache only (no API calls)
 * Useful for UI components that should be cache-only
 *
 * @param {Array} sections - Array of section objects with sectionid
 * @returns {Promise<Array>} Array of cached events for all sections
 */
export async function loadEventsFromCache(sections) {
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return [];
  }

  const results = [];

  for (const section of sections) {
    try {
      const events = await databaseService.getEvents(section.sectionid);
      if (events && events.length > 0) {
        results.push({
          sectionId: section.sectionid,
          sectionName: section.sectionname,
          events: events,
        });
      }
    } catch (error) {
      logger.warn('Failed to load cached events for section', {
        sectionId: section.sectionid,
        error: error.message,
      }, LOG_CATEGORIES.DATA_SERVICE);
    }
  }

  logger.debug('Loaded events from cache', {
    sectionCount: sections.length,
    sectionsWithEvents: results.length,
    totalEvents: results.reduce((sum, section) => sum + (section.events?.length || 0), 0),
  }, LOG_CATEGORIES.DATA_SERVICE);

  return results;
}

/**
 * Checks if any events loading errors are due to offline conditions
 *
 * @param {Array} errors - Error array from loadEventsForSections
 * @returns {boolean} True if any errors appear to be offline-related
 */
export function hasOfflineErrors(errors) {
  return errors.some(error => isOfflineError(error.originalError));
}

export default {
  loadEventsForSections,
  loadEventsFromCache,
  hasOfflineErrors,
};