import databaseService from '../services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

function formatRejectionReason(reason) {
  if (reason instanceof Error || (reason && typeof reason.message === 'string')) {
    return reason.message;
  }
  if (reason === null || reason === undefined) {
    return `rejected with ${reason}`;
  }
  return String(reason);
}

/**
 * Loads all attendance from the normalized IndexedDB store with read-time enrichment.
 * Raw attendance records contain only core fields (scoutid, eventid, sectionid, attending, patrol, notes).
 *
 * Enrichment fields are joined at read time:
 *   - eventname, eventdate from the events store (keyed by record.eventid)
 *   - sectionname from the sections store (keyed by record.sectionid), with
 *     event.sectionname as a fallback when the record's sectionid isn't in the
 *     sections cache.
 *
 * The sections-store join matters for shared events: a record's sectionid can
 * belong to a different section than the event's owner (cross-section invitee
 * via OSM event sharing). Joining sectionname from event.sectionname instead
 * would mis-label those rows under the event-owner's section name.
 *
 * Per-event load failures (e.g. transient DB errors) are tolerated: the failed
 * event's records are skipped and a warn is logged with the failed eventids
 * and sample error messages, but successful events still surface. A top-level
 * failure (e.g. getSections rejecting) returns [] and is logged as an error.
 *
 * @returns {Promise<Array<Object>>} Enriched attendance records
 */
export async function loadAllAttendanceFromDatabase() {
  try {
    const sections = await databaseService.getSections();
    const sectionNameById = new Map(
      (sections || []).map(s => [Number(s.sectionid), s.sectionname]),
    );
    const allEvents = [];

    for (const section of sections) {
      const events = await databaseService.getEvents(section.sectionid);
      allEvents.push(...(events || []));
    }

    const attendancePromises = allEvents.map(async (event) => {
      const records = await databaseService.getAttendance(event.eventid);
      if (!records || records.length === 0) return [];

      return records.map(record => ({
        ...record,
        eventname: event.name ?? null,
        eventdate: event.startdate ?? null,
        sectionname:
          sectionNameById.get(Number(record.sectionid)) ??
          event.sectionname ??
          null,
      }));
    });

    const results = await Promise.allSettled(attendancePromises);
    const rejected = results
      .map((r, i) => ({ result: r, event: allEvents[i] }))
      .filter(({ result }) => result.status === 'rejected');

    if (rejected.length > 0) {
      logger.warn('Failed to load attendance for some events', {
        failedCount: rejected.length,
        totalEvents: allEvents.length,
        sampleFailures: rejected.slice(0, 3).map(({ result, event }) => ({
          eventid: event?.eventid,
          eventname: event?.name,
          error: formatRejectionReason(result.reason),
        })),
      }, LOG_CATEGORIES.DATA_SERVICE);
    }

    const allAttendance = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    logger.debug('Loaded attendance from normalized store with enrichment', {
      eventCount: allEvents.length,
      recordCount: allAttendance.length,
      failedEventCount: rejected.length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return allAttendance;
  } catch (error) {
    logger.error('Failed to load sections/events for attendance enrichment', {
      error: error.message,
      errorName: error.name,
    }, LOG_CATEGORIES.DATA_SERVICE);
    return [];
  }
}

/**
 * Loads attendance for a single event from the normalized store with read-time enrichment
 * @param {string|number} eventid - Event identifier
 * @returns {Promise<Array<Object>>} Enriched attendance records for the event
 */
export async function loadAttendanceForEvent(eventid) {
  try {
    const records = await databaseService.getAttendance(eventid);
    if (!records || records.length === 0) return [];

    const event = await databaseService.getEventById(eventid);

    return records.map(record => ({
      ...record,
      eventname: event?.name ?? null,
      eventdate: event?.startdate ?? null,
      sectionname: event?.sectionname ?? null,
    }));
  } catch (error) {
    logger.debug('No attendance found for event', {
      eventid,
      error: error.message,
    }, LOG_CATEGORIES.DATA_SERVICE);
    return [];
  }
}
