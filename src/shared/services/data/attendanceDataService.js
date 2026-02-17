import { getEventAttendance } from '../api/api/events.js';
import { getToken } from '../auth/tokenService.js';
import databaseService from '../storage/database.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { getScoutFriendlyMessage } from '../../utils/scoutErrorHandler.js';

class AttendanceDataService {
  constructor() {
    this.lastFetchTime = null;
    this.isLoading = false;
    this.refreshPromise = null;
  }

  /**
   * Retrieves attendance data, preferring IndexedDB cache then API refresh
   * @param {boolean} forceRefresh - Force API refresh instead of using cache
   * @returns {Promise<Array<Object>>} Enriched attendance records
   */
  async getAttendanceData(forceRefresh = false) {
    if (!forceRefresh) {
      try {
        const cachedData = await this.loadAttendanceFromCache();
        if (cachedData.length > 0) {
          logger.debug('Loaded attendance data from IndexedDB', {
            recordCount: cachedData.length,
          }, LOG_CATEGORIES.DATA_SERVICE);

          this.lastFetchTime = Date.now();
          return cachedData;
        }
      } catch (error) {
        logger.warn('Failed to load attendance from cache, will try refresh if token available', {
          error: error.message,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }
    }

    const token = getToken();
    if (forceRefresh && token) {
      return await this.refreshAttendanceData();
    }

    logger.debug('No token available or refresh not requested, returning empty', {
      hasToken: !!token,
      forceRefresh,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return [];
  }

  /**
   * Refreshes attendance data from the API, deduplicating concurrent requests
   * @returns {Promise<Array<Object>>} Enriched attendance records
   */
  async refreshAttendanceData() {
    if (this.isLoading) {
      logger.debug('Attendance data refresh already in progress', {}, LOG_CATEGORIES.DATA_SERVICE);
      if (this.refreshPromise) {
        return await this.refreshPromise;
      }
      return [];
    }

    this.refreshPromise = this._doRefresh();
    return await this.refreshPromise;
  }

  /**
   * Performs the actual API refresh, saves core records to normalized store,
   * and returns enriched records for display
   * @private
   * @returns {Promise<Array<Object>>} Enriched attendance records
   */
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

          const coreRecords = attendanceRecords.map(record => ({
            ...record,
            eventid: event.eventid,
            sectionid: event.sectionid,
          }));

          if (coreRecords.length > 0) {
            await databaseService.saveAttendance(event.eventid, coreRecords);
          }

          return coreRecords.map(record => ({
            ...record,
            eventname: event.name,
            eventdate: event.startdate,
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

      this.lastFetchTime = Date.now();

      logger.info('Optimized attendance data refresh completed', {
        recordCount: allAttendance.length,
        eventCount: cachedEvents.length,
        validEvents: validEvents.length,
        invalidEvents: invalidCount,
        successfulResults: results.filter(r => r.status === 'fulfilled').length,
        failedResults: results.filter(r => r.status === 'rejected').length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return allAttendance;

    } catch (error) {
      const scoutMessage = getScoutFriendlyMessage(error, 'refresh attendance data');
      logger.error('Failed to refresh attendance data', {
        error: error.message,
        scoutMessage,
      }, LOG_CATEGORIES.DATA_SERVICE);

      const scoutError = new Error(scoutMessage);
      scoutError.originalError = error;
      throw scoutError;
    } finally {
      this.isLoading = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Returns the timestamp of the last successful data fetch
   * @returns {number|null} Timestamp or null if never fetched
   */
  getLastFetchTime() {
    return this.lastFetchTime;
  }

  /**
   * Retrieves events from DatabaseService (normalized store)
   * @returns {Promise<Array<Object>>} Array of events from all sections
   */
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
      logger.error('Failed to get cached events from database', {
        error: error.message,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return [];
    }
  }

  /**
   * Loads attendance from normalized IndexedDB store with read-time enrichment
   * @returns {Promise<Array<Object>>} Enriched attendance records
   */
  async loadAttendanceFromCache() {
    try {
      const cachedEvents = await this.getCachedEventsOptimized();
      if (cachedEvents.length === 0) {
        logger.debug('No cached events found for attendance loading', {}, LOG_CATEGORIES.DATA_SERVICE);
        return [];
      }

      const attendancePromises = cachedEvents.map(async (event) => {
        try {
          const records = await databaseService.getAttendance(event.eventid);
          if (!records || records.length === 0) {
            return [];
          }

          return records.map(record => ({
            ...record,
            eventname: event.name,
            eventdate: event.startdate,
            sectionname: event.sectionname,
          }));
        } catch (error) {
          logger.debug('No cached attendance found for event', {
            eventId: event.eventid,
            eventName: event.name,
          }, LOG_CATEGORIES.DATA_SERVICE);
          return [];
        }
      });

      const results = await Promise.allSettled(attendancePromises);
      const allAttendance = results
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value);

      logger.debug('Loaded attendance data from IndexedDB', {
        eventCount: cachedEvents.length,
        recordCount: allAttendance.length,
        successfulEvents: results.filter(r => r.status === 'fulfilled').length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return allAttendance;
    } catch (error) {
      logger.warn('Failed to load attendance from IndexedDB cache', {
        error: error.message,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return [];
    }
  }

  /**
   * Clears the last fetch timestamp
   */
  clearCache() {
    this.lastFetchTime = null;
    logger.debug('Attendance data cache cleared', {}, LOG_CATEGORIES.DATA_SERVICE);
  }
}

export default new AttendanceDataService();
