import databaseService from '../services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

/**
 * Loads all attendance from the normalized IndexedDB store with read-time enrichment.
 * Raw attendance records contain only core fields (scoutid, eventid, sectionid, attending, patrol, notes).
 * Enrichment fields (eventname, eventdate, sectionname) are joined at read time from the events store.
 * @returns {Promise<Array<Object>>} Enriched attendance records
 */
export async function loadAllAttendanceFromDatabase() {
  try {
    const sections = await databaseService.getSections();
    const allEvents = [];

    for (const section of sections) {
      const events = await databaseService.getEvents(section.sectionid);
      allEvents.push(...(events || []));
    }

    const attendancePromises = allEvents.map(async (event) => {
      try {
        const records = await databaseService.getAttendance(event.eventid);
        if (!records || records.length === 0) return [];

        return records.map(record => ({
          ...record,
          eventname: event.name ?? null,
          eventdate: event.startdate ?? null,
          sectionname: event.sectionname ?? null,
        }));
      } catch {
        return [];
      }
    });

    const results = await Promise.allSettled(attendancePromises);
    const allAttendance = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    logger.debug('Loaded attendance from normalized store with enrichment', {
      eventCount: allEvents.length,
      recordCount: allAttendance.length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return allAttendance;
  } catch (error) {
    logger.error('Failed to load attendance from IndexedDB', {
      error: error.message,
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
