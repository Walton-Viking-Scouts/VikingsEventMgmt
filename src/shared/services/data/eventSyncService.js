import { getEventAttendance, getSharedEventAttendance } from '../api/api/events.js';
import { getToken } from '../auth/tokenService.js';
import databaseService from '../storage/database.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { getScoutFriendlyMessage } from '../../utils/scoutErrorHandler.js';

class EventSyncService {
  constructor() {
    this.isLoading = false;
    this.refreshPromise = null;
    this.lastSyncTime = null;
    this.performanceMetrics = {
      lastSyncDuration: null,
      totalApiCalls: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastApiCallCount: 0,
    };
  }

  async syncAllEventAttendance(forceRefresh = false) {
    if (!forceRefresh && this.isRecentlyRefreshed()) {
      logger.debug('Event attendance recently synced', {
        lastSyncAge: this.lastSyncTime ? Date.now() - this.lastSyncTime : null,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return { success: true, message: 'Recently synced - using cached data' };
    }

    return await this.refreshAllEventAttendance();
  }

  async refreshAllEventAttendance() {
    if (this.isLoading) {
      logger.debug('Event attendance sync already in progress', {}, LOG_CATEGORIES.DATA_SERVICE);
      if (this.refreshPromise) {
        return await this.refreshPromise;
      }
      return { success: false, message: 'Sync already in progress' };
    }

    this.refreshPromise = this._doSync();
    return await this.refreshPromise;
  }

  async _doSync() {
    const startTime = performance.now();
    let apiCallCount = 0;

    try {
      this.isLoading = true;
      logger.info('Starting optimized event attendance sync', {}, LOG_CATEGORIES.DATA_SERVICE);

      const token = getToken();
      if (!token) {
        const scoutMessage = 'Your session has expired. Please log in again to sync events.';
        logger.warn('No auth token available for event sync', {}, LOG_CATEGORIES.DATA_SERVICE);
        return { success: false, message: scoutMessage };
      }

      const allEvents = await this.getEventsDirectly();
      if (allEvents.length === 0) {
        const scoutMessage = 'No Scout events found to sync. Check that you have events scheduled in OSM.';
        logger.warn('No events found for attendance sync', {}, LOG_CATEGORIES.DATA_SERVICE);
        return { success: false, message: scoutMessage };
      }

      const validEvents = allEvents.filter(event =>
        event.sectionid && event.eventid && event.termid,
      );

      if (validEvents.length === 0) {
        logger.warn('No valid events found (missing required fields)', {}, LOG_CATEGORIES.DATA_SERVICE);
        return { success: false, message: 'No valid events found to sync.' };
      }

      // Filter to only events we'll display (last week to 3 months from now)
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const displayableEvents = validEvents.filter(event => {
        const eventDate = new Date(event.startdate);
        if (isNaN(eventDate.getTime())) return false;
        return eventDate >= oneWeekAgo && eventDate <= threeMonthsFromNow;
      });

      logger.info('Starting concurrent attendance sync', {
        totalEvents: allEvents.length,
        validEvents: validEvents.length,
        displayableEvents: displayableEvents.length,
        skippedEvents: validEvents.length - displayableEvents.length,
        dateRange: {
          from: oneWeekAgo.toISOString().split('T')[0],
          to: threeMonthsFromNow.toISOString().split('T')[0],
        },
      }, LOG_CATEGORIES.DATA_SERVICE);

      // Sync all displayable events (rate limiting handled by smart queue)
      const syncPromises = displayableEvents.map(event => this.syncEventAttendanceSafe(event, token));
      const results = await Promise.allSettled(syncPromises);
      apiCallCount = displayableEvents.length;

      // Sync shared attendance data for shared events (only displayable events)
      const sharedAttendanceResults = await this.syncSharedAttendance(displayableEvents, token);
      apiCallCount += sharedAttendanceResults.apiCallCount;

      const syncResults = {
        totalEvents: allEvents.length,
        validEvents: validEvents.length,
        displayableEvents: displayableEvents.length,
        skippedEvents: validEvents.length - displayableEvents.length,
        syncedEvents: 0,
        failedEvents: 0,
        errors: [],
      };

      results.forEach((result, index) => {
        const event = displayableEvents[index];
        if (result.status === 'fulfilled') {
          syncResults.syncedEvents++;
          logger.debug('Synced attendance for event', {
            eventName: event.name,
            eventId: event.eventid,
          }, LOG_CATEGORIES.DATA_SERVICE);
        } else {
          syncResults.failedEvents++;
          syncResults.errors.push({
            eventId: event.eventid,
            eventName: event.name,
            error: result.reason?.message || 'Unknown error',
          });
          logger.warn('Failed to sync attendance for event', {
            eventName: event.name,
            eventId: event.eventid,
            error: result.reason?.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      this.lastSyncTime = Date.now();
      this.performanceMetrics.lastSyncDuration = duration;
      this.performanceMetrics.totalApiCalls += apiCallCount;
      this.performanceMetrics.lastApiCallCount = apiCallCount;
      this.performanceMetrics.successfulSyncs++;

      logger.info('Optimized event attendance sync completed', {
        ...syncResults,
        duration: `${Math.round(duration)}ms`,
        apiCalls: apiCallCount,
        avgTimePerEvent: displayableEvents.length > 0 ? `${Math.round(duration / displayableEvents.length)}ms` : '0ms',
      }, LOG_CATEGORIES.DATA_SERVICE);

      const successMessage = `Synced ${syncResults.syncedEvents}/${syncResults.displayableEvents} displayable events (${syncResults.skippedEvents} skipped) in ${Math.round(duration)}ms`;
      return {
        success: true,
        message: successMessage,
        details: {
          ...syncResults,
          performance: {
            duration,
            apiCalls: apiCallCount,
            avgTimePerEvent: displayableEvents.length > 0 ? duration / displayableEvents.length : 0,
          },
        },
      };

    } catch (error) {
      this.performanceMetrics.failedSyncs++;
      const scoutMessage = getScoutFriendlyMessage(error, 'sync event attendance');
      logger.error('Failed to sync event attendance', {
        error: error.message,
        scoutMessage,
        apiCallsMade: apiCallCount,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return {
        success: false,
        message: scoutMessage,
      };
    } finally {
      this.isLoading = false;
      this.refreshPromise = null;
    }
  }

  async syncEventAttendance(event, token) {
    const attendanceRecords = await getEventAttendance(
      event.sectionid,
      event.eventid,
      event.termid,
      token,
    );

    if (attendanceRecords.length > 0) {
      await databaseService.saveAttendance(event.eventid, attendanceRecords, {
        fromSync: true,
      });
    }

    return attendanceRecords;
  }

  async syncEventAttendanceSafe(event, token) {
    try {
      return await this.syncEventAttendance(event, token);
    } catch (error) {
      logger.debug('Event sync failed for individual event', {
        eventId: event.eventid,
        eventName: event.name,
        error: error.message,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw error;
    }
  }

  async getAllEvents() {
    const sections = await databaseService.getSections();
    const allEvents = [];

    for (const section of sections) {
      try {
        const sectionEvents = await databaseService.getEvents(section.sectionid);
        allEvents.push(...sectionEvents);
      } catch (error) {
        logger.warn('Failed to get events for section', {
          sectionId: section.sectionid,
          sectionName: section.sectionname,
          error: error.message,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }
    }

    logger.debug('Retrieved all events for sync', {
      eventCount: allEvents.length,
      sectionCount: sections.length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return allEvents;
  }

  async getEventsDirectly() {
    try {
      const sections = await databaseService.getSections();

      if (sections.length === 0) {
        logger.debug('No sections found for event sync', {}, LOG_CATEGORIES.DATA_SERVICE);
        return [];
      }

      const eventPromises = sections.map(async (section) => {
        try {
          const events = await databaseService.getEvents(section.sectionid);
          return events || [];
        } catch (error) {
          logger.warn('Failed to get events for section', {
            sectionId: section.sectionid,
            sectionName: section.sectionname,
            error: error.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
          return [];
        }
      });

      const eventArrays = await Promise.allSettled(eventPromises);
      const allEvents = eventArrays
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value);

      logger.debug('Retrieved events directly from database', {
        eventCount: allEvents.length,
        sectionCount: sections.length,
        failedSections: eventArrays.filter(r => r.status === 'rejected').length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return allEvents;
    } catch (error) {
      logger.error('Failed to get events directly', {
        error: error.message,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return [];
    }
  }

  isRecentlyRefreshed() {
    if (!this.lastSyncTime) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return (Date.now() - this.lastSyncTime) < fiveMinutes;
  }

  getLastSyncTime() {
    return this.lastSyncTime;
  }

  getSyncStatus() {
    return {
      isLoading: this.isLoading,
      lastSyncTime: this.lastSyncTime,
      isRecentlyRefreshed: this.isRecentlyRefreshed(),
      performance: this.performanceMetrics,
    };
  }

  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      isLoading: this.isLoading,
      lastSyncTime: this.lastSyncTime,
      syncAge: this.lastSyncTime ? Date.now() - this.lastSyncTime : null,
    };
  }

  resetPerformanceMetrics() {
    this.performanceMetrics = {
      lastSyncDuration: null,
      totalApiCalls: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastApiCallCount: 0,
    };
    logger.debug('Performance metrics reset', {}, LOG_CATEGORIES.DATA_SERVICE);
  }

  clearSyncCache() {
    this.lastSyncTime = null;
    this.resetPerformanceMetrics();
    logger.debug('Event sync cache and metrics cleared', {}, LOG_CATEGORIES.DATA_SERVICE);
  }

  async syncSharedAttendance(events, token) {
    let apiCallCount = 0;
    let successCount = 0;
    let errorCount = 0;

    logger.info('🌐 Starting shared attendance sync', {
      totalEvents: events.length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    // Call getSharedEventAttendance for all events - it handles cache/API logic internally
    for (const event of events) {
      try {
        logger.debug('Syncing shared attendance for event', {
          eventName: event.name,
          eventId: event.eventid,
          sectionId: event.sectionid,
        }, LOG_CATEGORIES.DATA_SERVICE);

        const sharedAttendanceData = await getSharedEventAttendance(
          event.eventid,
          event.sectionid,
          token,
        );

        apiCallCount++;
        successCount++;

        logger.debug('✅ Shared attendance synced', {
          eventName: event.name,
          eventId: event.eventid,
          attendeeCount: sharedAttendanceData?.items?.length || sharedAttendanceData?.combined_attendance?.length || 0,
        }, LOG_CATEGORIES.DATA_SERVICE);

      } catch (apiError) {
        apiCallCount++;
        errorCount++;
        logger.debug('Shared attendance sync failed for event', {
          eventName: event.name,
          eventId: event.eventid,
          error: apiError.message,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }
    }

    logger.info('🌐 Shared attendance sync completed', {
      totalEvents: events.length,
      successCount,
      errorCount,
      apiCallCount,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return {
      apiCallCount,
      successCount,
      errorCount,
      sharedEvents: successCount + errorCount,
    };
  }
}

export default new EventSyncService();