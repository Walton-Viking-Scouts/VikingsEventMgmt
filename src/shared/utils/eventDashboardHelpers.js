// Event Dashboard Helper Functions
// UI-only helpers for reading from IndexedDB - NO API CALLS

import databaseService from '../services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
import attendanceDataService from '../services/data/attendanceDataService.js';

/**
 * Fetches events for all sections from IndexedDB only
 * @param {Array} sections - Array of section objects
 * @returns {Promise<Array>} Array of all events from all sections
 */
export const fetchAllSectionEvents = async (sections) => {
  const allEvents = [];

  // Fetch events for all sections from IndexedDB only
  const results = await Promise.all(
    sections.map(async (section) => {
      try {
        return await fetchSectionEvents(section);
      } catch (err) {
        logger.error('Error processing section {sectionId}', {
          error: err,
          sectionId: section.sectionid,
          sectionName: section.sectionname,
        }, LOG_CATEGORIES.COMPONENT);
        return [];
      }
    }),
  );
  for (const sectionEvents of results) {
    allEvents.push(...sectionEvents);
  }

  return allEvents;
};

/**
 * Fetches events for a single section from IndexedDB only
 * @param {Object} section - Section object with sectionid and sectionname
 * @returns {Promise<Array>} Array of events for the section
 */
export const fetchSectionEvents = async (section) => {
  try {
    // Defensive check for section ID (allows valid falsy values like 0)
    if (!section || section.sectionid === null || section.sectionid === undefined) {
      logger.warn('Skipping section with invalid ID in fetchSectionEvents', {
        sectionid: section?.sectionid ?? null,
        sectionname: section?.sectionname ?? null,
        sectiontype: section?.sectiontype ?? null,
        section: section?.section ?? null,
      }, LOG_CATEGORIES.COMPONENT);
      return []; // Return empty array for invalid section
    }

    // Load from IndexedDB cache only
    const cachedEvents = (await databaseService.getEvents(section.sectionid)) || [];

    const events = cachedEvents.map(event => ({
      ...event,
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      termid: event.termid, // Keep existing termid from cache
    }));

    return events;
  } catch (err) {
    logger.error('Error fetching events for section {sectionId}', {
      error: err,
      sectionId: section?.sectionid ?? null,
      sectionName: section?.sectionname ?? null,
    }, LOG_CATEGORIES.COMPONENT);
    return [];
  }
};

/**
 * Fetches attendance data for an event using attendanceDataService
 * This ensures consistency with the attendance view and eliminates duplicate data access
 * @param {Object} event - Event object with eventid property
 * @returns {Promise<Array>} Array of attendance records or empty array
 */
export const fetchEventAttendance = async (event) => {
  try {
    // Use attendanceDataService as the single source of truth for attendance data
    const allAttendanceData = await attendanceDataService.getAttendanceData(false);

    if (allAttendanceData && allAttendanceData.length > 0) {
      // Filter to only include records for this specific event
      const eventAttendance = allAttendanceData.filter(record => record.eventid === event.eventid);

      logger.debug('Fetched attendance data via service', {
        eventId: event.eventid,
        eventName: event.name,
        totalCached: allAttendanceData.length,
        eventSpecific: eventAttendance.length,
      }, LOG_CATEGORIES.COMPONENT);

      return eventAttendance;
    }

    logger.debug('No attendance data available in service cache', {
      eventId: event.eventid,
      eventName: event.name,
    }, LOG_CATEGORIES.COMPONENT);

    return [];

  } catch (err) {
    logger.error('Error fetching attendance via attendanceDataService', {
      error: err.message,
      eventId: event.eventid,
      eventName: event.name,
    }, LOG_CATEGORIES.COMPONENT);
    return [];
  }
};

/**
 * Groups events by their name
 * @param {Array} events - Array of event objects
 * @returns {Map} Map of event names to arrays of events
 */
export const groupEventsByName = (events) => {
  const eventGroups = new Map();

  for (const event of events) {
    const eventName = event.name;
    if (!eventGroups.has(eventName)) {
      eventGroups.set(eventName, []);
    }
    eventGroups.get(eventName).push(event);
  }

  return eventGroups;
};

/**
 * Builds an individual event card from grouped events
 * @param {string} eventName - Name of the event
 * @param {Array} events - Array of events with the same name
 * @returns {Object} Event card object
 */
export const buildEventCard = (eventName, events) => {
  // Sort events within group by date
  const sorted = [...events].sort((a, b) => new Date(a.startdate) - new Date(b.startdate));

  // Create card with earliest event date for sorting
  return {
    id: `${eventName}-${sorted[0].eventid}`,
    name: eventName,
    events: sorted,
    earliestDate: new Date(sorted[0].startdate),
    sections: [...new Set(sorted.map(e => e.sectionname))],
    sectionIds: [...new Set(sorted.map(e => e.sectionid))],
  };
};

/**
 * Filters events by date range
 * @param {Array} events - Array of event objects
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Array} Filtered events
 */
export const filterEventsByDateRange = (events, startDate, endDate) => {
  // Defensive parameter validation - return empty array if missing required params
  if (!events || !Array.isArray(events) || !startDate || !endDate) {
    return [];
  }

  return events.filter(event => {
    const eventDate = new Date(event.startdate);
    // Handle invalid dates by filtering them out
    if (isNaN(eventDate.getTime())) {
      return false;
    }
    return eventDate >= startDate && eventDate <= endDate;
  });
};

/**
 * Expands shared events (placeholder - cache-only implementation)
 * @param {Array} events - Array of event objects
 * @returns {Array} Events array (unchanged in cache-only mode)
 */
export const expandSharedEvents = (events) => {
  // In cache-only mode, just return events as-is
  // Shared event expansion should be handled by Reference Data Service
  return events;
};

export default {
  fetchAllSectionEvents,
  fetchSectionEvents,
  fetchEventAttendance,
  groupEventsByName,
  buildEventCard,
  filterEventsByDateRange,
  expandSharedEvents,
};