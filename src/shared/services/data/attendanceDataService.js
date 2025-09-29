import { getEventAttendance } from '../api/api/events.js';
import { getToken } from '../auth/tokenService.js';
import databaseService from '../storage/database.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { getScoutFriendlyMessage } from '../../utils/scoutErrorHandler.js';

class AttendanceDataService {
  constructor() {
    this.attendanceCache = [];
    this.lastFetchTime = null;
    this.isLoading = false;
    this.refreshPromise = null;
  }

  async getAttendanceData(forceRefresh = false) {
    if (!forceRefresh && this.attendanceCache.length > 0) {
      logger.debug('Returning cached attendance data', {
        recordCount: this.attendanceCache.length,
        cacheAge: this.lastFetchTime ? Date.now() - this.lastFetchTime : null,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return this.attendanceCache;
    }

    return await this.refreshAttendanceData();
  }

  async refreshAttendanceData() {
    if (this.isLoading) {
      logger.debug('Attendance data refresh already in progress', {}, LOG_CATEGORIES.DATA_SERVICE);
      if (this.refreshPromise) {
        return await this.refreshPromise;
      }
      return this.attendanceCache;
    }

    this.refreshPromise = this._doRefresh();
    return await this.refreshPromise;
  }

  async _doRefresh() {
    try {
      this.isLoading = true;
      logger.info('Refreshing attendance data', {}, LOG_CATEGORIES.DATA_SERVICE);

      const token = getToken();
      if (!token) {
        logger.warn('No auth token available for attendance refresh', {}, LOG_CATEGORIES.DATA_SERVICE);
        throw new Error('Your session has expired. Please log in again to refresh attendance data.');
      }

      const cachedEvents = await this.getCachedEventsOptimized();
      if (cachedEvents.length === 0) {
        logger.warn('No cached events found for attendance refresh', {}, LOG_CATEGORIES.DATA_SERVICE);
        throw new Error('No Scout events found. Please sync events from OSM first.');
      }

      const validEvents = cachedEvents.filter(event =>
        event.sectionid && event.eventid && event.termid,
      );

      const invalidCount = cachedEvents.length - validEvents.length;
      if (invalidCount > 0) {
        logger.debug('Skipped events with missing required fields', {
          invalidCount,
          totalEvents: cachedEvents.length,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }

      const attendancePromises = validEvents.map(async (event) => {
        try {
          const attendanceRecords = await getEventAttendance(
            event.sectionid,
            event.eventid,
            event.termid,
            token,
          );

          return attendanceRecords.map(record => ({
            ...record,
            eventid: event.eventid,
            eventname: event.name,
            eventdate: event.startdate,
            sectionid: event.sectionid,
            sectionname: event.sectionname,
          }));

        } catch (eventError) {
          logger.warn('Failed to fetch attendance for event', {
            eventName: event.name,
            eventId: event.eventid,
            error: eventError.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
          return [];
        }
      });

      const results = await Promise.allSettled(attendancePromises);
      const allAttendance = results
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value);

      this.attendanceCache = allAttendance;
      this.lastFetchTime = Date.now();

      logger.info('Optimized attendance data refresh completed', {
        recordCount: allAttendance.length,
        eventCount: cachedEvents.length,
        validEvents: validEvents.length,
        invalidEvents: invalidCount,
        successfulResults: results.filter(r => r.status === 'fulfilled').length,
        failedResults: results.filter(r => r.status === 'rejected').length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return this.attendanceCache;

    } catch (error) {
      const scoutMessage = getScoutFriendlyMessage(error, 'refresh attendance data');
      logger.error('Failed to refresh attendance data', {
        error: error.message,
        scoutMessage,
      }, LOG_CATEGORIES.DATA_SERVICE);

      // Create new error with Scout-friendly message but preserve stack trace
      const scoutError = new Error(scoutMessage);
      scoutError.originalError = error;
      throw scoutError;
    } finally {
      this.isLoading = false;
      this.refreshPromise = null;
    }
  }

  getLastFetchTime() {
    return this.lastFetchTime;
  }

  getCachedEvents() {
    const events = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('viking_events_') || key.includes('demo_viking_events_')) && key.endsWith('_offline')) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            const eventItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
            events.push(...eventItems);
          }
        } catch (error) {
          logger.debug('Failed to parse cached events', {
            cacheKey: key,
            error: error.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
        }
      }
    }

    logger.debug('Found cached events for attendance', {
      eventCount: events.length,
      events: events.map(e => ({ sectionid: e.sectionid, eventid: e.eventid, name: e.name })),
    }, LOG_CATEGORIES.DATA_SERVICE);

    return events;
  }

  async getCachedEventsOptimized() {
    try {
      const sections = await databaseService.getSections();

      if (sections.length === 0) {
        logger.debug('No sections found for attendance cache', {}, LOG_CATEGORIES.DATA_SERVICE);
        return [];
      }

      const eventPromises = sections.map(async (section) => {
        try {
          const events = await databaseService.getEvents(section.sectionid);
          return events || [];
        } catch (error) {
          logger.warn('Failed to get events for section during attendance cache', {
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

      logger.debug('Retrieved events directly from database for attendance', {
        eventCount: allEvents.length,
        sectionCount: sections.length,
        failedSections: eventArrays.filter(r => r.status === 'rejected').length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return allEvents;
    } catch (error) {
      logger.error('Failed to get cached events optimized, falling back to localStorage scan', {
        error: error.message,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return this.getCachedEvents();
    }
  }

  clearCache() {
    this.attendanceCache = [];
    this.lastFetchTime = null;
    logger.debug('Attendance data cache cleared', {}, LOG_CATEGORIES.DATA_SERVICE);
  }
}

export default new AttendanceDataService();