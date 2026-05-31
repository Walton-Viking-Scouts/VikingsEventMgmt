import { getEventAttendance, getSharedEventAttendance, createMemberSectionRecordsForSharedAttendees } from '../api/api/events.js';
import { getToken } from '../auth/tokenService.js';
import databaseService from '../storage/database.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { sentryUtils } from '../utils/sentry.js';
import { getScoutFriendlyMessage } from '../../utils/scoutErrorHandler.js';
import { buildSharedSectionsList } from '../../utils/sharedEventAttendance.js';

class EventDataLoader {
  constructor() {
    this.isLoading = false;
    this.refreshPromise = null;
    this.lastSyncTime = null;
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

  /**
   * Syncs attendance for a caller-supplied set of events only, avoiding the
   * full all-events sync (which iterates every cached event across every
   * section the user has access to and can hit OSM rate limits).
   *
   * Behaviour:
   * - Per-event attendance + shared-attendance lookups run concurrently for
   *   each valid event (`sectionid` + `eventid` + `termid` all present).
   * - Events missing required fields are silently skipped and counted in
   *   `details.skippedEvents`.
   * - If a sync is already in flight (global or scoped), this call short-
   *   circuits with `success: true` and a "sync already in progress"
   *   message, leaving the in-flight pass to complete.
   * - Empty input is a no-op success (no API calls, no toast-worthy error).
   * - `Promise.allSettled` is used: per-event failures populate
   *   `details.errors` and are tagged in Sentry, but do not abort the rest.
   * - `success` is true when at least one event synced; partial failures are
   *   still `success: true` so the caller can present a warning rather than
   *   a hard error. Only zero-success runs report `success: false`.
   * - `lastSyncTime` is intentionally NOT updated — that field gates the
   *   global sync's cooldown, and a scoped refresh shouldn't suppress a
   *   subsequent global refresh.
   * - `syncSharedAttendance` runs after per-event syncs; its per-event
   *   failures are best-effort logged (debug) and do not affect the
   *   returned `success`.
   *
   * @param {Array<Object>} events - Events to refresh. Each must have
   *   `sectionid`, `eventid`, and `termid`.
   * @returns {Promise<{success: boolean, message: string, details?: {
   *   totalEvents: number, validEvents: number, skippedEvents: number,
   *   syncedEvents: number, failedEvents: number,
   *   errors: Array<{eventId: *, eventName: string, error: string}>
   * }}>}
   */
  async syncEventsAttendance(events) {
    if (!Array.isArray(events) || events.length === 0) {
      return { success: true, message: 'Nothing to refresh.' };
    }

    if (this.isLoading) {
      logger.debug('Scoped sync skipped — sync already in progress', {}, LOG_CATEGORIES.DATA_SERVICE);
      if (this.refreshPromise) {
        return await this.refreshPromise;
      }
      return { success: true, message: 'Sync already in progress' };
    }

    this.isLoading = true;
    this.refreshPromise = this._doScopedSync(events);
    try {
      return await this.refreshPromise;
    } finally {
      this.isLoading = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Internal implementation of `syncEventsAttendance`. Caller is responsible
   * for setting/clearing `this.isLoading` and `this.refreshPromise` around
   * this call.
   *
   * @param {Array<Object>} events
   * @returns {Promise<Object>}
   */
  async _doScopedSync(events) {
    try {
      const token = getToken();
      if (!token) {
        const scoutMessage = 'Your session has expired. Please log in again to sync events.';
        logger.warn('No auth token available for scoped event sync', {}, LOG_CATEGORIES.DATA_SERVICE);
        return { success: false, message: scoutMessage };
      }

      const validEvents = events.filter(event =>
        event && event.sectionid && event.eventid && event.termid,
      );

      if (validEvents.length === 0) {
        logger.warn('No valid events in scoped sync set (missing required fields)', {
          inputCount: events.length,
        }, LOG_CATEGORIES.DATA_SERVICE);
        return {
          success: false,
          message: 'No valid events to sync — check that sectionid, eventid, and termid are all present.',
        };
      }

      logger.info('Starting scoped attendance sync', {
        eventCount: validEvents.length,
        eventIds: validEvents.map(e => e.eventid),
      }, LOG_CATEGORIES.DATA_SERVICE);

      const syncPromises = validEvents.map(event => this.syncEventAttendanceSafe(event, token));
      const results = await Promise.allSettled(syncPromises);

      const sharedResult = await this.syncSharedAttendance(validEvents, token);

      const syncResults = {
        totalEvents: events.length,
        validEvents: validEvents.length,
        skippedEvents: events.length - validEvents.length,
        syncedEvents: 0,
        failedEvents: 0,
        errors: [],
        shared: sharedResult,
      };

      results.forEach((result, index) => {
        const event = validEvents[index];
        if (result.status === 'fulfilled') {
          syncResults.syncedEvents++;
        } else {
          syncResults.failedEvents++;
          syncResults.errors.push({
            eventId: event.eventid,
            eventName: event.name,
            error: result.reason?.message || 'Unknown error',
          });
          const reasonMsg = result.reason?.message || String(result.reason);
          logger.warn(`Failed to sync attendance for event "${event.name}" (id=${event.eventid}): ${reasonMsg}`, {
            eventName: event.name,
            eventId: event.eventid,
            error: result.reason?.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
          if (result.reason instanceof Error) {
            sentryUtils.captureException(result.reason, {
              tags: { operation: 'sync_event_attendance_scoped' },
              contexts: { event: { id: String(event.eventid), name: event.name, sectionid: event.sectionid } },
            });
          }
        }
      });

      logger.info('Scoped attendance sync completed', { ...syncResults }, LOG_CATEGORIES.DATA_SERVICE);

      const sharedFailed = sharedResult.errorCount > 0;
      const partial = (syncResults.failedEvents > 0 || sharedFailed) && syncResults.syncedEvents > 0;

      let message = `Synced ${syncResults.syncedEvents}/${syncResults.validEvents} events`;
      if (syncResults.failedEvents > 0) {
        message += `; ${syncResults.failedEvents} failed`;
      }
      if (sharedFailed) {
        message += `; shared-attendance had ${sharedResult.errorCount} failure${sharedResult.errorCount === 1 ? '' : 's'}`;
      }

      return {
        success: syncResults.syncedEvents > 0,
        partial,
        message,
        details: syncResults,
      };
    } catch (error) {
      const scoutMessage = getScoutFriendlyMessage(error, 'sync event attendance');
      logger.error('Scoped attendance sync failed', {
        error: error.message,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return { success: false, message: scoutMessage };
    }
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

      // Sync shared attendance data for shared events (only displayable events)
      await this.syncSharedAttendance(displayableEvents, token);

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
          const reasonMsg = result.reason?.message || String(result.reason);
          logger.warn(`Failed to sync attendance for event "${event.name}" (id=${event.eventid}): ${reasonMsg}`, {
            eventName: event.name,
            eventId: event.eventid,
            error: result.reason?.message,
            stack: result.reason?.stack,
          }, LOG_CATEGORIES.DATA_SERVICE);
          if (result.reason instanceof Error) {
            sentryUtils.captureException(result.reason, {
              tags: { operation: 'sync_event_attendance' },
              contexts: { event: { id: String(event.eventid), name: event.name, sectionid: event.sectionid } },
            });
          }
        }
      });

      this.lastSyncTime = Date.now();

      logger.info('Optimized event attendance sync completed', {
        ...syncResults,
      }, LOG_CATEGORIES.DATA_SERVICE);

      const successMessage = `Synced ${syncResults.syncedEvents}/${syncResults.displayableEvents} displayable events (${syncResults.skippedEvents} skipped)`;
      return {
        success: true,
        message: successMessage,
        details: syncResults,
      };

    } catch (error) {
      const scoutMessage = getScoutFriendlyMessage(error, 'sync event attendance');
      logger.error('Failed to sync event attendance', {
        error: error.message,
        scoutMessage,
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

  /**
   * Syncs attendance for a single event from the API to the normalized store
   * @param {Object} event - Event object with sectionid, eventid, termid
   * @param {string} token - Auth token
   * @returns {Promise<Array<Object>>} Core-fields-only attendance records
   */
  async syncEventAttendance(event, token) {
    const attendanceRecords = await getEventAttendance(
      event.sectionid,
      event.eventid,
      event.termid,
      token,
    );

    if (attendanceRecords.length > 0) {
      const coreRecords = attendanceRecords.map(record => ({
        scoutid: record.scoutid,
        eventid: String(event.eventid),
        sectionid: Number(record.sectionid ?? event.sectionid),
        attending: record.attending,
        patrol: record.patrol ?? null,
        notes: record.notes ?? null,
      }));
      await databaseService.saveAttendance(event.eventid, coreRecords);
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

  /**
   * Syncs shared attendance for events flagged as shared in
   * `shared_event_metadata`. Events without metadata (or with
   * `isSharedEvent === false`) are skipped — `eventsService` populates the
   * flag at event-load time so by the time attendance sync runs, only
   * genuinely shared events incur an API call here.
   *
   * Per-event failures are reported via the returned `errorCount` and
   * `errors` array, and individually captured to Sentry. They do NOT abort
   * the loop — best-effort across the set.
   *
   * @param {Array<Object>} events - Events to consider for shared sync.
   * @param {string} token - Auth token.
   * @returns {Promise<{apiCallCount: number, successCount: number,
   *   errorCount: number, sharedEvents: number, skippedNonShared: number,
   *   errors: Array<{eventId: *, eventName: string, error: string}>
   * }>}
   */
  async syncSharedAttendance(events, token) {
    let apiCallCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    const sharedFlags = await Promise.all(
      events.map(async (event) => {
        try {
          const meta = await databaseService.getSharedEventMetadata(event.eventid);
          const isShared = meta?.is_shared_event === 1
            || meta?.is_shared_event === true
            || meta?.isSharedEvent === true;
          return { event, isShared };
        } catch (lookupError) {
          logger.warn('Failed to read shared_event_metadata; assuming not shared', {
            eventId: event.eventid,
            error: lookupError.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
          return { event, isShared: false };
        }
      }),
    );

    const sharedEvents = sharedFlags.filter(({ isShared }) => isShared).map(({ event }) => event);
    const skippedNonShared = events.length - sharedEvents.length;

    logger.info('Starting shared attendance sync', {
      totalEvents: events.length,
      sharedEvents: sharedEvents.length,
      skippedNonShared,
    }, LOG_CATEGORIES.DATA_SERVICE);

    for (const event of sharedEvents) {
      try {
        const sharedAttendanceData = await getSharedEventAttendance(
          event.eventid,
          event.sectionid,
          token,
        );

        apiCallCount++;
        successCount++;

        const items = Array.isArray(sharedAttendanceData?.items) ? sharedAttendanceData.items : [];
        const combined = Array.isArray(sharedAttendanceData?.combined_attendance) ? sharedAttendanceData.combined_attendance : [];
        const attendance = items.length > 0 ? items : combined;

        if (attendance.length > 0) {
          const coreSharedRecords = attendance.map(record => ({
            scoutid: record.scoutid,
            eventid: String(event.eventid),
            sectionid: Number(record.sectionid ?? event.sectionid),
            attending: record.attending,
            patrol: record.patrol ?? null,
            notes: record.notes ?? null,
            isSharedSection: true,
          }));
          await databaseService.saveSharedAttendance(event.eventid, coreSharedRecords);

          await databaseService.saveSharedEventMetadata({
            eventid: String(event.eventid),
            isSharedEvent: true,
            ownerSectionId: Number(event.sectionid),
            sections: buildSharedSectionsList(attendance, event.sectionid),
          });

          await createMemberSectionRecordsForSharedAttendees(event.sectionid, attendance);
        }

        logger.debug('Shared attendance synced', {
          eventName: event.name,
          eventId: event.eventid,
          attendeeCount: attendance.length,
        }, LOG_CATEGORIES.DATA_SERVICE);

      } catch (apiError) {
        apiCallCount++;
        errorCount++;
        errors.push({
          eventId: event.eventid,
          eventName: event.name,
          error: apiError.message,
        });
        logger.warn('Shared attendance sync failed for event', {
          eventName: event.name,
          eventId: event.eventid,
          sectionId: event.sectionid,
          error: apiError.message,
        }, LOG_CATEGORIES.DATA_SERVICE);
        if (apiError instanceof Error) {
          sentryUtils.captureException(apiError, {
            tags: { operation: 'sync_shared_attendance' },
            contexts: { event: { id: String(event.eventid), name: event.name, sectionid: event.sectionid } },
          });
        }
      }
    }

    logger.info('Shared attendance sync completed', {
      totalEvents: events.length,
      sharedEvents: sharedEvents.length,
      skippedNonShared,
      successCount,
      errorCount,
      apiCallCount,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return {
      apiCallCount,
      successCount,
      errorCount,
      sharedEvents: sharedEvents.length,
      skippedNonShared,
      errors,
    };
  }
}

export default new EventDataLoader();