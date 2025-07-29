// Event Dashboard Helper Functions
// Extracted from EventDashboard component for better testability and reusability

import { getMostRecentTermId, getMostRecentTermIdFromCache, getEvents, getEventAttendance, getTerms } from '../services/api.js';
import databaseService from '../services/database.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

/**
 * Fetches events for all sections with optimized terms loading
 * @param {Array} sections - Array of section objects
 * @param {string|null} token - Authentication token (null for cache-only)
 * @param {boolean} developmentMode - Whether development delays should be used
 * @returns {Promise<Array>} Array of all events from all sections
 */
export const fetchAllSectionEvents = async (sections, token, developmentMode = false) => {
  const allEvents = [];
  
  // Load terms once for all sections (major optimization!)
  let allTerms = null;
  if (token) {
    try {
      console.log('Loading terms once for all sections...');
      allTerms = await getTerms(token); // This will use cache from sync process
      console.log(`Using cached terms for ${Object.keys(allTerms).length} sections`);
    } catch (err) {
      logger.error('Error loading terms, will use individual API calls as fallback', { error: err }, LOG_CATEGORIES.COMPONENT);
    }
  }
  
  // Fetch events for all sections using cached terms
  for (const section of sections) {
    try {
      const sectionEvents = await fetchSectionEvents(section, token, developmentMode, allTerms);
      allEvents.push(...sectionEvents);
    } catch (err) {
      logger.error('Error processing section {sectionId}', { 
        error: err, 
        sectionId: section.sectionid,
        sectionName: section.sectionname, 
      }, LOG_CATEGORIES.COMPONENT);
    }
  }
  
  return allEvents;
};

/**
 * Fetches events for a single section from API or cache
 * @param {Object} section - Section object with sectionid and sectionname
 * @param {string|null} token - Authentication token (null for cache-only)
 * @param {boolean} developmentMode - Whether development delays should be used
 * @param {Object|null} allTerms - Pre-loaded terms data (optional optimization)
 * @returns {Promise<Array>} Array of events for the section
 */
export const fetchSectionEvents = async (section, token, developmentMode = false, allTerms = null) => {
  try {
    let events = [];
    
    if (token) {
      // Add delay between sections to prevent rapid API calls
      const sectionDelay = developmentMode ? 1500 : 800;
      await new Promise(resolve => setTimeout(resolve, sectionDelay));
      
      // Fetch from API - use cached terms if available for major optimization
      let termId;
      if (allTerms) {
        // Use pre-loaded terms (avoids API call per section!)
        termId = getMostRecentTermIdFromCache(section.sectionid, allTerms);
      } else {
        // Fallback to individual API call
        termId = await getMostRecentTermId(section.sectionid, token);
      }
      
      if (termId) {
        const eventDelay = developmentMode ? 1000 : 500;
        await new Promise(resolve => setTimeout(resolve, eventDelay));
        const sectionEvents = await getEvents(section.sectionid, termId, token);
        if (sectionEvents && Array.isArray(sectionEvents)) {
          events = sectionEvents.map(event => ({
            ...event,
            sectionid: section.sectionid,
            sectionname: section.sectionname,
            termid: termId,
          }));
          
          // Save to cache (with termid included)
          await databaseService.saveEvents(section.sectionid, events);
        }
      }
    } else {
      // Load from cache
      const cachedEvents = await databaseService.getEvents(section.sectionid);
      events = cachedEvents.map(event => ({
        ...event,
        sectionname: section.sectionname,
        termid: event.termid || null,
      }));
    }
    
    return events;
  } catch (err) {
    logger.error('Error fetching events for section {sectionId}', { 
      error: err, 
      sectionId: section.sectionid,
      sectionName: section.sectionname,
    }, LOG_CATEGORIES.API);
    return [];
  }
};

/**
 * Fetches attendance data for a single event from API or cache
 * @param {Object} event - Event object with eventid, sectionid, termid
 * @param {string|null} token - Authentication token (null for cache-only)
 * @param {boolean} developmentMode - Whether development delays should be used
 * @returns {Promise<Array|null>} Attendance data or null if failed
 */
export const fetchEventAttendance = async (event, token, developmentMode = false) => {
  try {
    if (token) {
      // Add delay between attendance calls to prevent rapid API calls
      const attendanceDelay = developmentMode ? 1200 : 600;
      await new Promise(resolve => setTimeout(resolve, attendanceDelay));
      
      // If termid is missing, get it from API
      let termId = event.termid;
      if (!termId) {
        const termIdDelay = developmentMode ? 600 : 300;
        await new Promise(resolve => setTimeout(resolve, termIdDelay));
        termId = await getMostRecentTermId(event.sectionid, token);
        event.termid = termId;
      }
      
      if (termId) {
        const finalDelay = developmentMode ? 800 : 400;
        await new Promise(resolve => setTimeout(resolve, finalDelay));
        const attendanceData = await getEventAttendance(
          event.sectionid, 
          event.eventid, 
          termId, 
          token,
        );
        
        if (attendanceData) {
          await databaseService.saveAttendance(event.eventid, attendanceData);
          return attendanceData;
        }
      }
    } else {
      // Load from cache
      const cachedAttendance = await databaseService.getAttendance(event.eventid);
      return cachedAttendance;
    }
  } catch (err) {
    logger.error('Error fetching attendance for event {eventId}', { 
      error: err, 
      eventId: event.eventid,
      eventName: event.name,
      sectionId: event.sectionid,
    }, LOG_CATEGORIES.API);
  }
  return null;
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
  events.sort((a, b) => new Date(a.startdate) - new Date(b.startdate));
  
  // Create card with earliest event date for sorting
  return {
    id: `${eventName}-${events[0].eventid}`,
    name: eventName,
    events: events,
    earliestDate: new Date(events[0].startdate),
    sections: [...new Set(events.map(e => e.sectionname))],
  };
};

/**
 * Filters events to include only future events and events from the past week
 * @param {Array} events - Array of event objects
 * @param {Date} oneWeekAgo - Date representing one week ago
 * @returns {Array} Filtered events
 */
export const filterEventsByDateRange = (events, oneWeekAgo) => {
  return events.filter(event => {
    const eventDate = new Date(event.startdate);
    return eventDate >= oneWeekAgo;
  });
};