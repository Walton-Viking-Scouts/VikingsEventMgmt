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

  // After all sections processed, detect shared events
  logger.info('📊 EVENTS LOADING COMPLETED - checking shared event detection conditions', {
    totalSections: sections.length,
    resultsCount: results.length,
    successCount,
    results: results.map(r => ({
      sectionId: r.sectionId,
      sectionName: r.sectionName,
      eventCount: r.events?.length || 0,
    })),
  }, LOG_CATEGORIES.DATA_SERVICE);

  // Run shared event detection if we have any results with events
  const resultsWithEvents = results.filter(r => r.events && r.events.length > 0);

  if (resultsWithEvents.length >= 1) {
    logger.info('✅ Starting shared event detection after events loaded', {
      sectionCount: results.length,
      sectionsWithEvents: resultsWithEvents.length,
    }, LOG_CATEGORIES.DATA_SERVICE);
    await detectAndStoreSharedEventsAcrossSections(results, token);
  } else {
    logger.warn('❌ Skipping shared event detection - no sections with events', {
      sectionCount: results.length,
      totalSections: sections.length,
      sectionsWithEvents: resultsWithEvents.length,
    }, LOG_CATEGORIES.DATA_SERVICE);
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

/**
 * Detects shared events by comparing events across all sections and stores shared metadata
 * @param {Array} results - All results array from loadEventsForSections
 */
async function detectAndStoreSharedEventsAcrossSections(results) {
  try {
    logger.debug('Starting shared event detection across sections', {
      sectionCount: results.length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    // Create a map to group events by name and date
    const eventGroups = new Map();

    // First pass: group events by name and similar dates
    for (const sectionResult of results) {
      if (!sectionResult.events || sectionResult.events.length === 0) {
        logger.debug('Skipping section with no events in shared detection', {
          sectionId: sectionResult.sectionId,
          sectionName: sectionResult.sectionName,
          hasEvents: !!sectionResult.events,
          eventCount: sectionResult.events?.length || 0,
        }, LOG_CATEGORIES.DATA_SERVICE);
        continue;
      }

      for (const event of sectionResult.events) {
        const eventKey = `${event.name}|${event.startdate}`;

        if (!eventGroups.has(eventKey)) {
          eventGroups.set(eventKey, []);
        }

        eventGroups.get(eventKey).push({
          ...event,
          _sectionId: sectionResult.sectionId,
          _sectionName: sectionResult.sectionName,
        });
      }
    }

    // Second pass: find groups with multiple sections (shared events)
    for (const [_eventKey, eventInstances] of eventGroups) {
      if (eventInstances.length > 1) {
        // This is a shared event
        const firstEvent = eventInstances[0];
        const allParticipatingSections = eventInstances.map(evt => ({
          sectionid: evt._sectionId,
          sectionname: evt._sectionName,
          eventid: evt.eventid,
        }));

        // Store shared metadata for each instance of the event
        for (const eventInstance of eventInstances) {
          const sharedMetadata = {
            _isSharedEvent: true,
            _ownerSection: firstEvent._sectionId, // First section is considered owner
            _sharedWithSections: allParticipatingSections.length,
            _allSections: allParticipatingSections,
            _detectedAt: new Date().toISOString(),
            eventName: eventInstance.name,
            eventDate: eventInstance.startdate,
          };

          await databaseService.saveSharedEventMetadata({
            ...sharedMetadata,
            eventid: String(eventInstance.eventid),
          });
        }

        logger.info('🔄 SHARED EVENT DETECTED AND STORED', {
          eventName: firstEvent.name,
          eventDate: firstEvent.startdate,
          participatingSectionCount: allParticipatingSections.length,
          participatingSections: allParticipatingSections.map(s => s.sectionname),
          eventIds: eventInstances.map(e => e.eventid),
          metadataKeys: eventInstances.map(e => `viking_shared_metadata_${e.eventid}`),
        }, LOG_CATEGORIES.DATA_SERVICE);
      }
    }

    logger.debug('Shared event detection completed', {
      totalEventGroups: eventGroups.size,
      sharedEventGroups: Array.from(eventGroups.values()).filter(group => group.length > 1).length,
    }, LOG_CATEGORIES.DATA_SERVICE);

  } catch (error) {
    logger.warn('Failed to detect shared events across sections', {
      error: error.message,
    }, LOG_CATEGORIES.DATA_SERVICE);
  }
}

export default {
  loadEventsForSections,
  loadEventsFromCache,
  hasOfflineErrors,
};