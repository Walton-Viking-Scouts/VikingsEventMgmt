// Event Dashboard Helper Functions
// UI-only helpers for reading from IndexedDB - NO API CALLS

import databaseService from '../services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
import { loadAllAttendanceFromDatabase } from './attendanceHelpers_new.js';

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
 * Fetches attendance data for an event including shared attendance from other sections
 * @param {Object} event - Event object with eventid and sectionid properties
 * @returns {Promise<Array>} Array of attendance records including synthetic records for shared sections
 */
export const fetchEventAttendance = async (event) => {
  try {
    // Load regular attendance for this event
    const allAttendanceData = await loadAllAttendanceFromDatabase();
    const eventAttendance = allAttendanceData?.filter(record => record.eventid === event.eventid) || [];

    logger.debug('Fetched attendance data from IndexedDB', {
      eventId: event.eventid,
      eventName: event.name,
      eventAttendance: eventAttendance.length,
    }, LOG_CATEGORIES.COMPONENT);

    // Load shared attendance data from IndexedDB
    const { UnifiedStorageService } = await import('../services/storage/unifiedStorageService.js');
    const sharedKey = `viking_shared_attendance_${event.eventid}_${event.sectionid}_offline`;

    try {
      const sharedData = await UnifiedStorageService.get(sharedKey);
      const sharedAttendance = sharedData?.items || sharedData?.combined_attendance;

      if (sharedAttendance && Array.isArray(sharedAttendance)) {
        logger.debug('Found shared attendance data', {
          eventId: event.eventid,
          sharedAttendees: sharedAttendance.length,
        }, LOG_CATEGORIES.COMPONENT);

        // Get sectionids that exist in regular attendance (accessible sections)
        const regularSectionIds = new Set(eventAttendance.map(r => r.sectionid));

        // Only include shared attendance from sections NOT in regular attendance (inaccessible sections)
        // This prevents double-counting in totals while showing all inaccessible sections
        const syntheticAttendees = sharedAttendance
          .filter(attendee => !regularSectionIds.has(attendee.sectionid))
          .map(attendee => ({
            ...attendee,
            scoutid: `synthetic-${attendee.scoutid}`, // Mark as synthetic for EventCard logic
            eventid: event.eventid,
          }));

        // Merge regular attendance with shared attendance from inaccessible sections only
        const mergedAttendance = [...eventAttendance, ...syntheticAttendees];

        logger.debug('Merged regular and shared attendance', {
          eventId: event.eventid,
          regularRecords: eventAttendance.length,
          sharedOnlyRecords: sharedOnlyAttendees.length,
          totalRecords: mergedAttendance.length,
          attendanceBreakdown: {
            yes: mergedAttendance.filter(a => a.attending === 'Yes').length,
            no: mergedAttendance.filter(a => a.attending === 'No').length,
            invited: mergedAttendance.filter(a => a.attending === 'Invited').length,
            notInvited: mergedAttendance.filter(a => a.attending === 'Not Invited').length,
          },
        }, LOG_CATEGORIES.COMPONENT);

        return mergedAttendance;
      }
    } catch (sharedError) {
      logger.debug('No shared attendance data found - using regular attendance', {
        eventId: event.eventid,
        error: sharedError.message,
      }, LOG_CATEGORIES.COMPONENT);
    }

    // No shared attendance - use regular attendance
    return eventAttendance;

  } catch (err) {
    logger.error('Error fetching attendance', {
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