/**
 * Data Loading Service
 *
 * Orchestrates loading of all application data types to avoid duplication and ensure proper sequencing.
 * Maintains separation of concerns while providing unified loading interfaces.
 *
 * Flow: Core Reference → Events → Attendance → FlexiRecord Data
 *
 * @module dataLoadingService
 * @version 1.1.0
 * @since 1.1.0 - Split FlexiRecord loading to run after events/attendance
 * @author Vikings Event Management Team
 */

import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import databaseService from '../storage/database.js';

class DataLoadingService {
  constructor() {
    this.isLoadingAll = false;
    this.isRefreshing = false;
    this.loadAllPromise = null;
    this.refreshPromise = null;
  }

  /**
   * Loads all data after successful authentication
   * Sequence: Core Reference → Events → Attendance → FlexiRecord Data
   *
   * @param {string} token - OSM authentication token
   * @param {Object} callbacks - Optional callbacks for events
   * @returns {Promise<Object>} Results object with all loading results
   */
  async loadAllDataAfterAuth(token, callbacks = {}) {
    if (this.isLoadingAll) {
      logger.debug('Full data load already in progress', {}, LOG_CATEGORIES.DATA_SERVICE);
      if (this.loadAllPromise) {
        return await this.loadAllPromise;
      }
    }

    this.loadAllPromise = this._doLoadAllData(token, callbacks);
    return await this.loadAllPromise;
  }

  async _doLoadAllData(token, callbacks = {}) {
    const startTime = performance.now();

    try {
      this.isLoadingAll = true;
      logger.info('Starting comprehensive data load after authentication', {}, LOG_CATEGORIES.DATA_SERVICE);

      if (!token) {
        logger.warn('No token provided for data loading', {}, LOG_CATEGORIES.DATA_SERVICE);
        return {
          success: false,
          hasErrors: true,
          errors: ['No authentication token available'],
          results: {
            reference: null,
            events: null,
            attendance: null,
          },
        };
      }

      const results = {
        reference: null,
        events: null,
        attendance: null,
        flexiRecords: null,
      };
      const errors = [];
      let totalSuccessCount = 0;

      // Step 1: Load core reference data (terms, roles, startup, members)
      try {
        logger.debug('Loading reference data', {}, LOG_CATEGORIES.DATA_SERVICE);
        const { loadInitialReferenceData } = await import('../referenceData/referenceDataService.js');
        results.reference = await loadInitialReferenceData(token);

        if (results.reference.success) {
          totalSuccessCount++;
          logger.info('Reference data loaded successfully', {
            summary: results.reference.summary,
          }, LOG_CATEGORIES.DATA_SERVICE);
        } else {
          logger.warn('Reference data loading had issues', {
            summary: results.reference.summary,
            hasErrors: results.reference.hasErrors,
          }, LOG_CATEGORIES.DATA_SERVICE);
          errors.push(...results.reference.errors.map(e => ({ ...e, category: 'reference' })));
        }
      } catch (referenceError) {
        logger.error('Failed to load reference data', {
          error: referenceError.message,
        }, LOG_CATEGORIES.DATA_SERVICE);
        errors.push({
          type: 'reference',
          category: 'reference',
          message: referenceError.message,
          originalError: referenceError.message,
        });
      }

      // Step 2: Load events (if we have sections from reference data)
      const userRoles = results.reference?.results?.userRoles;
      if (userRoles && userRoles.length > 0) {
        try {
          logger.debug('Loading events for sections', {
            sectionCount: userRoles.length,
          }, LOG_CATEGORIES.DATA_SERVICE);

          const { loadEventsForSections } = await import('./eventsService.js');
          results.events = await loadEventsForSections(userRoles, token);

          if (results.events.success) {
            totalSuccessCount++;
            logger.info('Events loaded successfully', {
              summary: results.events.summary,
            }, LOG_CATEGORIES.DATA_SERVICE);

            if (callbacks.onEventsLoaded) {
              await callbacks.onEventsLoaded();
            }
          } else {
            logger.warn('Events loading had issues', {
              summary: results.events.summary,
              hasErrors: results.events.hasErrors,
            }, LOG_CATEGORIES.DATA_SERVICE);
            errors.push(...results.events.errors.map(e => ({ ...e, category: 'events' })));
          }
        } catch (eventsError) {
          logger.error('Failed to load events', {
            error: eventsError.message,
            sectionCount: userRoles.length,
          }, LOG_CATEGORIES.DATA_SERVICE);
          errors.push({
            type: 'events',
            category: 'events',
            message: eventsError.message,
            originalError: eventsError.message,
          });
        }
      } else {
        logger.info('No sections available - skipping events loading', {
          hasReference: !!results.reference,
          hasUserRoles: !!userRoles,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }

      // Step 3: Load initial attendance (if we have events)
      const hasEvents = results.events?.results?.some(section => section.events?.length > 0);
      if (hasEvents) {
        try {
          logger.debug('Loading initial attendance data', {}, LOG_CATEGORIES.DATA_SERVICE);

          const eventSyncServiceModule = await import('./eventSyncService.js');
          const eventSyncService = eventSyncServiceModule.default;
          results.attendance = await eventSyncService.syncAllEventAttendance(false);

          if (results.attendance.success) {
            totalSuccessCount++;
            logger.info('Initial attendance sync completed', {
              message: results.attendance.message,
              details: results.attendance.details,
            }, LOG_CATEGORIES.DATA_SERVICE);

            // Trigger callback to update UI with attendance data
            if (callbacks.onAttendanceLoaded) {
              await callbacks.onAttendanceLoaded();
            }
          } else {
            logger.warn('Initial attendance sync failed', {
              message: results.attendance.message,
            }, LOG_CATEGORIES.DATA_SERVICE);
            errors.push({
              type: 'attendance',
              category: 'attendance',
              message: results.attendance.message,
              originalError: results.attendance.message,
            });
          }
        } catch (attendanceError) {
          logger.error('Failed to sync initial attendance', {
            error: attendanceError.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
          errors.push({
            type: 'attendance',
            category: 'attendance',
            message: attendanceError.message,
            originalError: attendanceError.message,
          });
        }
      } else {
        logger.info('No events available - skipping attendance loading', {
          hasEvents: !!hasEvents,
          eventsResult: results.events?.summary,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }

      // Step 4: Load FlexiRecord data (after events and attendance)
      if (userRoles && userRoles.length > 0) {
        try {
          logger.debug('Loading FlexiRecord data', {
            sectionCount: userRoles.length,
          }, LOG_CATEGORIES.DATA_SERVICE);

          const { loadFlexiRecordData } = await import('../referenceData/referenceDataService.js');
          results.flexiRecords = await loadFlexiRecordData(userRoles, token);

          if (results.flexiRecords.success) {
            totalSuccessCount++;
            logger.info('FlexiRecord data loaded successfully', {
              summary: results.flexiRecords.summary,
            }, LOG_CATEGORIES.DATA_SERVICE);
          } else {
            logger.warn('FlexiRecord data loading had issues', {
              summary: results.flexiRecords.summary,
              hasErrors: results.flexiRecords.hasErrors,
            }, LOG_CATEGORIES.DATA_SERVICE);
            errors.push(...results.flexiRecords.errors.map(e => ({ ...e, category: 'flexiRecords' })));
          }
        } catch (flexiError) {
          logger.error('Failed to load FlexiRecord data', {
            error: flexiError.message,
            sectionCount: userRoles.length,
          }, LOG_CATEGORIES.DATA_SERVICE);
          errors.push({
            type: 'flexiRecords',
            category: 'flexiRecords',
            message: flexiError.message,
            originalError: flexiError.message,
          });
        }
      } else {
        logger.info('No sections available - skipping FlexiRecord loading', {
          hasReference: !!results.reference,
          hasUserRoles: !!userRoles,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const hasErrors = errors.length > 0;
      const isCompleteFailure = totalSuccessCount === 0;

      // Log comprehensive summary
      if (isCompleteFailure) {
        logger.error('Complete data loading failure', {
          totalAttempts: 4,
          successCount: totalSuccessCount,
          errorCount: errors.length,
          errors: errors.map(e => `${e.category}:${e.type}`),
          duration: `${Math.round(duration)}ms`,
        }, LOG_CATEGORIES.ERROR);
      } else if (hasErrors) {
        logger.warn('Partial data loading failure', {
          totalAttempts: 4,
          successCount: totalSuccessCount,
          errorCount: errors.length,
          successfulCategories: Object.keys(results).filter(k => results[k]?.success),
          failedCategories: errors.map(e => e.category),
          duration: `${Math.round(duration)}ms`,
        }, LOG_CATEGORIES.DATA_SERVICE);
      } else {
        logger.info('All data loaded successfully after authentication', {
          totalAttempts: 4,
          successCount: totalSuccessCount,
          duration: `${Math.round(duration)}ms`,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }

      return {
        success: !isCompleteFailure,
        hasErrors,
        errors,
        results,
        summary: {
          total: 4,
          successful: totalSuccessCount,
          failed: errors.length,
          duration,
          categories: {
            reference: results.reference?.success || false,
            events: results.events?.success || false,
            attendance: results.attendance?.success || false,
            flexiRecords: results.flexiRecords?.success || false,
          },
        },
      };

    } catch (error) {
      logger.error('Critical error during comprehensive data loading', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);

      return {
        success: false,
        hasErrors: true,
        errors: [{
          type: 'critical',
          category: 'system',
          message: error.message,
          originalError: error.message,
        }],
        results: {
          reference: null,
          events: null,
          attendance: null,
          flexiRecords: null,
        },
      };
    } finally {
      this.isLoadingAll = false;
      this.loadAllPromise = null;
    }
  }

  /**
   * Refreshes events and attendance data (for manual refresh)
   * Does not reload reference data
   *
   * @param {string} token - OSM authentication token
   * @returns {Promise<Object>} Results object with refresh results
   */
  async refreshEventData(token) {
    if (this.isRefreshing) {
      logger.debug('Event data refresh already in progress', {}, LOG_CATEGORIES.DATA_SERVICE);
      if (this.refreshPromise) {
        return await this.refreshPromise;
      }
    }

    this.refreshPromise = this._doRefreshEventData(token);
    return await this.refreshPromise;
  }

  async _doRefreshEventData(token) {
    const startTime = performance.now();

    try {
      this.isRefreshing = true;
      logger.info('Starting event data refresh', {}, LOG_CATEGORIES.DATA_SERVICE);

      if (!token) {
        logger.warn('No token provided for event data refresh', {}, LOG_CATEGORIES.DATA_SERVICE);
        return {
          success: false,
          hasErrors: true,
          errors: ['No authentication token available'],
          results: {
            events: null,
            attendance: null,
          },
        };
      }

      const results = {
        events: null,
        attendance: null,
      };
      const errors = [];
      let successCount = 0;

      // Get cached sections for events loading
      let sections = [];
      try {
        sections = await databaseService.getSections();
        logger.debug('Retrieved cached sections for refresh', {
          sectionCount: sections.length,
        }, LOG_CATEGORIES.DATA_SERVICE);
      } catch (sectionsError) {
        logger.warn('Could not retrieve cached sections', {
          error: sectionsError.message,
        }, LOG_CATEGORIES.DATA_SERVICE);
        errors.push({
          type: 'sections',
          category: 'cache',
          message: 'Could not retrieve cached sections for refresh',
          originalError: sectionsError.message,
        });
      }

      // Refresh events
      if (sections.length > 0) {
        try {
          logger.debug('Refreshing events', {
            sectionCount: sections.length,
          }, LOG_CATEGORIES.DATA_SERVICE);

          const { loadEventsForSections } = await import('./eventsService.js');
          results.events = await loadEventsForSections(sections, token);

          if (results.events.success) {
            successCount++;
            logger.info('Events refreshed successfully', {
              summary: results.events.summary,
            }, LOG_CATEGORIES.DATA_SERVICE);
          } else {
            logger.warn('Events refresh had issues', {
              summary: results.events.summary,
            }, LOG_CATEGORIES.DATA_SERVICE);
            errors.push(...results.events.errors.map(e => ({ ...e, category: 'events' })));
          }
        } catch (eventsError) {
          logger.error('Failed to refresh events', {
            error: eventsError.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
          errors.push({
            type: 'events',
            category: 'events',
            message: eventsError.message,
            originalError: eventsError.message,
          });
        }
      }

      // Refresh attendance
      try {
        logger.debug('Refreshing attendance data', {}, LOG_CATEGORIES.DATA_SERVICE);

        const eventSyncServiceModule = await import('./eventSyncService.js');
        const eventSyncService = eventSyncServiceModule.default;
        results.attendance = await eventSyncService.refreshAllEventAttendance();

        if (results.attendance.success) {
          successCount++;
          logger.info('Attendance refreshed successfully', {
            message: results.attendance.message,
            details: results.attendance.details,
          }, LOG_CATEGORIES.DATA_SERVICE);
        } else {
          logger.warn('Attendance refresh failed', {
            message: results.attendance.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
          errors.push({
            type: 'attendance',
            category: 'attendance',
            message: results.attendance.message,
            originalError: results.attendance.message,
          });
        }
      } catch (attendanceError) {
        logger.error('Failed to refresh attendance', {
          error: attendanceError.message,
        }, LOG_CATEGORIES.DATA_SERVICE);
        errors.push({
          type: 'attendance',
          category: 'attendance',
          message: attendanceError.message,
          originalError: attendanceError.message,
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const hasErrors = errors.length > 0;
      const isCompleteFailure = successCount === 0;

      // Log refresh summary
      if (isCompleteFailure) {
        logger.error('Complete event data refresh failure', {
          totalAttempts: 2,
          successCount,
          errorCount: errors.length,
          duration: `${Math.round(duration)}ms`,
        }, LOG_CATEGORIES.ERROR);
      } else if (hasErrors) {
        logger.warn('Partial event data refresh failure', {
          totalAttempts: 2,
          successCount,
          errorCount: errors.length,
          duration: `${Math.round(duration)}ms`,
        }, LOG_CATEGORIES.DATA_SERVICE);
      } else {
        logger.info('Event data refresh completed successfully', {
          totalAttempts: 2,
          successCount,
          duration: `${Math.round(duration)}ms`,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }

      return {
        success: !isCompleteFailure,
        hasErrors,
        errors,
        results,
        summary: {
          total: 2,
          successful: successCount,
          failed: errors.length,
          duration,
          categories: {
            events: results.events?.success || false,
            attendance: results.attendance?.success || false,
          },
        },
      };

    } catch (error) {
      logger.error('Critical error during event data refresh', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);

      return {
        success: false,
        hasErrors: true,
        errors: [{
          type: 'critical',
          category: 'system',
          message: error.message,
          originalError: error.message,
        }],
        results: {
          events: null,
          attendance: null,
        },
      };
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Gets loading status for debugging
   * @returns {Object} Current loading state
   */
  getLoadingStatus() {
    return {
      isLoadingAll: this.isLoadingAll,
      isRefreshing: this.isRefreshing,
      hasLoadAllPromise: !!this.loadAllPromise,
      hasRefreshPromise: !!this.refreshPromise,
    };
  }
}

export default new DataLoadingService();