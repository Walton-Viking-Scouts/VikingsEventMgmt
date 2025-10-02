import databaseService from '../services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

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

        const recordArray = Array.isArray(records) ? records : (records.items || []);
        return recordArray.map(record => ({
          ...record,
          eventid: event.eventid,
          eventname: event.name,
          eventdate: event.startdate,
          sectionid: event.sectionid,
          sectionname: event.sectionname,
        }));
      } catch {
        return [];
      }
    });

    const results = await Promise.allSettled(attendancePromises);
    const allAttendance = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    logger.debug('Loaded attendance from IndexedDB', {
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

export async function loadAttendanceForEvent(eventid) {
  try {
    const records = await databaseService.getAttendance(eventid);
    if (!records || records.length === 0) return [];

    const recordArray = Array.isArray(records) ? records : (records.items || []);
    return recordArray;
  } catch (error) {
    logger.debug('No attendance found for event', {
      eventid,
      error: error.message,
    }, LOG_CATEGORIES.DATA_SERVICE);
    return [];
  }
}
