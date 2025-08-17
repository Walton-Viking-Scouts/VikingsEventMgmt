// Event Dashboard Helper Functions
// Extracted from EventDashboard component for better testability and reusability

import { fetchMostRecentTermId, getEvents, getEventAttendance, getTerms, getEventSummary, getEventSharingStatus } from '../services/api.js';
import { getMostRecentTermId } from './termUtils.js';
import databaseService from '../services/database.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

/**
 * Fetches events for all sections with optimized terms loading
 * @param {Array} sections - Array of section objects
 * @param {string|null} token - Authentication token (null for cache-only)
 * @returns {Promise<Array>} Array of all events from all sections
 */
export const fetchAllSectionEvents = async (sections, token) => {
  const allEvents = [];
  
  // Load terms once for all sections (major optimization!)
  let allTerms = null;
  if (token) {
    try {
      logger.info('Loading terms once for all sections', {}, LOG_CATEGORIES.COMPONENT);
      allTerms = await getTerms(token); // This will use cache from sync process
      logger.info('Using cached terms', { sectionCount: Object.keys(allTerms || {}).length }, LOG_CATEGORIES.COMPONENT);
    } catch (err) {
      logger.error('Error loading terms, will use individual API calls as fallback', { error: err }, LOG_CATEGORIES.COMPONENT);
    }
  } else {
    // Load offline cached terms once (avoid per-section localStorage parsing)
    try {
      if (typeof localStorage !== 'undefined') {
        const cachedTerms = localStorage.getItem('viking_terms_offline');
        if (cachedTerms) {
          allTerms = JSON.parse(cachedTerms);
          logger.info('Using offline cached terms', { sectionCount: Object.keys(allTerms || {}).length }, LOG_CATEGORIES.COMPONENT);
        }
      }
    } catch (err) {
      logger.warn('Failed to parse offline terms from localStorage', { error: err }, LOG_CATEGORIES.COMPONENT);
    }
  }
  
  // Fetch events for all sections using cached terms
  const results = await Promise.all(
    sections.map(async (section) => {
      try {
        return await fetchSectionEvents(section, token, allTerms);
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
 * Fetches events for a single section from API or cache
 * @param {Object} section - Section object with sectionid and sectionname
 * @param {string|null} token - Authentication token (null for cache-only)
 * @param {Object|null} allTerms - Pre-loaded terms data (optional optimization)
 * @returns {Promise<Array>} Array of events for the section
 */
export const fetchSectionEvents = async (section, token, allTerms = null) => {
  try {
    let events = [];
    
    if (token) {
      // Rate limiting handled by queue
      
      // Fetch from API - use cached terms if available for major optimization
      // Defensive check for section ID (allows valid falsy values like 0)
      if (section.sectionid === null || section.sectionid === undefined) {
        logger.warn('Skipping section with invalid ID in fetchSectionEvents', {
          sectionid: section.sectionid,
          sectionname: section.sectionname,
          sectiontype: section.sectiontype,
          section: section.section,
        }, LOG_CATEGORIES.API);
        return []; // Return empty array for invalid section
      }
      
      let termId;
      if (allTerms) {
        // Use pre-loaded terms (avoids API call per section!)
        termId = getMostRecentTermId(section.sectionid, allTerms);
      } else {
        // Fallback to individual API call
        termId = await fetchMostRecentTermId(section.sectionid, token);
      }
      
      if (termId) {
        // Rate limiting now handled by RateLimitQueue
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
      const cachedEvents = (await databaseService.getEvents(section.sectionid)) || [];
      
      // Get termId for cached events too (same logic as API path)
      let termId;
      if (allTerms) {
        // Use pre-loaded terms (avoids API call per section!)
        termId = getMostRecentTermId(section.sectionid, allTerms);
      } else {
        // Fallback: try to get from cached event or fetch from API if needed
        termId = cachedEvents[0]?.termid;
        
        // If still no termId, try to get from localStorage terms cache
        if (!termId) {
          try {
            const cachedTerms = localStorage.getItem('viking_terms_offline');
            if (cachedTerms) {
              const parsedTerms = JSON.parse(cachedTerms);
              termId = getMostRecentTermId(section.sectionid, parsedTerms);
            }
          } catch (error) {
            logger.warn('Failed to get termId from localStorage terms cache', { error }, LOG_CATEGORIES.COMPONENT);
          }
        }
      }
      
      events = cachedEvents.map(event => ({
        ...event,
        sectionid: section.sectionid,  // CRITICAL FIX: Add missing sectionid 
        sectionname: section.sectionname,
        termid: termId || event.termid, // Use fetched termId, fallback to cached termid (don't default to null)
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
 * For shared events where user has access to owner section, fetches and merges shared attendance data
 * @param {Object} event - Event object with eventid, sectionid, termid
 * @param {string|null} token - Authentication token (null for cache-only)
 * @param {Array|null} allEvents - Array of all events (needed for shared event processing)
 * @returns {Promise<Array|null>} Attendance data (merged for shared events) or null if failed
 */
export const fetchEventAttendance = async (event, token, allEvents = null) => {
  try {
    logger.info('fetchEventAttendance called', {
      eventId: event.eventid,
      eventName: event.name,
      sectionId: event.sectionid,
      hasToken: !!token,
      hasAllEvents: !!allEvents,
      allEventsCount: allEvents?.length || 0,
    }, LOG_CATEGORIES.COMPONENT);
    
    if (token) {
      // Rate limiting handled by queue
      
      // If termid is missing, get it from API
      let termId = event.termid;
      if (!termId) {
        // Rate limiting handled by queue
        termId = await fetchMostRecentTermId(event.sectionid, token);
        // DON'T MUTATE THE ORIGINAL EVENT - just use the local termId variable
      }
      
      if (termId) {
        // Rate limiting now handled by RateLimitQueue
        const sectionSpecificAttendanceData = await getEventAttendance(
          event.sectionid, 
          event.eventid, 
          termId, 
          token,
        );
        
        if (sectionSpecificAttendanceData) {
          logger.info('Got section-specific attendance data', {
            eventId: event.eventid,
            eventName: event.name,
            dataLength: Array.isArray(sectionSpecificAttendanceData) ? sectionSpecificAttendanceData.length : 'NOT_ARRAY',
            dataType: typeof sectionSpecificAttendanceData,
            hasAttendanceData: !!sectionSpecificAttendanceData,
          }, LOG_CATEGORIES.COMPONENT);
          
          // Step 1: Get event summary to check for sharing information
          try {
            logger.info('Fetching event summary to check for sharing', {
              eventId: event.eventid,
              eventName: event.name,
              sectionId: event.sectionid,
              eventDate: event.startdate,
              sectionName: event.sectionname,
            }, LOG_CATEGORIES.COMPONENT);
            
            const eventSummary = await getEventSummary(event.eventid, token);
            
            logger.info('Event summary response received', {
              eventId: event.eventid,
              hasResponse: !!eventSummary,
              responseKeys: eventSummary ? Object.keys(eventSummary) : [],
              hasSharingKey: !!(eventSummary && eventSummary.sharing),
              sharingValue: eventSummary ? eventSummary.sharing : 'NO_RESPONSE',
              fullResponse: eventSummary,
            }, LOG_CATEGORIES.COMPONENT);
            
            // Step 2: Check if this event has sharing information
            if (eventSummary && eventSummary.data && eventSummary.data.sharing) {
              logger.info('🔍 Event has sharing data', {
                eventId: event.eventid,
                eventName: event.name,
                isOwner: eventSummary.data.sharing.is_owner,
                owner: eventSummary.data.sharing.owner,
                hasAllEvents: !!allEvents,
                allEventsCount: allEvents?.length || 0,
                conditionCheck: `is_owner=${eventSummary.data.sharing.is_owner} && allEvents=${!!allEvents}`,
                sharingData: eventSummary.data.sharing,
              }, LOG_CATEGORIES.COMPONENT);
              
              // Step 3: If this section is the owner of a shared event
              if (eventSummary.data.sharing.is_owner && allEvents) {
                logger.info('🚀 SHARED EVENT OWNER - fetching shared attendance', {
                  eventId: event.eventid,
                  eventName: event.name,
                  sectionId: event.sectionid,
                  hasAllEvents: !!allEvents,
                  allEventsCount: allEvents?.length || 0,
                }, LOG_CATEGORIES.COMPONENT);
                
                try {
                  logger.info('📞 Calling getEventSharingStatus API', {
                    eventId: event.eventid,
                    sectionId: event.sectionid,
                    hasToken: !!token,
                  }, LOG_CATEGORIES.COMPONENT);
                  
                  // Get shared event data with section attendance counts
                  const sharedEventData = await getEventSharingStatus(event.eventid, event.sectionid, token);
                  
                  logger.info('📋 getEventSharingStatus API response', {
                    eventId: event.eventid,
                    hasResponse: !!sharedEventData,
                    responseKeys: sharedEventData ? Object.keys(sharedEventData) : [],
                    sectionsCount: sharedEventData?.items?.length || 0,
                    identifier: sharedEventData?.identifier || 'none',
                  }, LOG_CATEGORIES.COMPONENT);
                  
                  if (sharedEventData) {
                    // For shared events, create attendance data from section-level counts
                    // Convert section attendance counts to individual attendance records for EventCard compatibility
                    const sharedAttendanceData = convertSharedEventToAttendanceFormat(sharedEventData);
                    
                    logger.info('✅ Successfully processed shared event data', {
                      eventId: event.eventid,
                      totalAttendees: sharedAttendanceData.items?.length || 0,
                      sectionsCount: sharedEventData.items?.length || 0,
                      sectionsWithAttendance: sharedEventData.items?.filter(s => s.attendance > 0).length || 0,
                    }, LOG_CATEGORIES.COMPONENT);
                    
                    // Combine section-specific and shared data for maximum detail
                    const combinedAttendanceData = [
                      // Include real section-specific data (has No/Invited/NotInvited details)
                      ...sectionSpecificAttendanceData,
                      // Include synthetic data for sections we don't have access to
                      ...sharedAttendanceData.items.filter(item => 
                        item.scoutid && item.scoutid.startsWith('synthetic-')
                      )
                    ];
                    
                    // Save combined attendance data to cache
                    await databaseService.saveAttendance(event.eventid, combinedAttendanceData);
                    
                    // Store shared event metadata separately for event expansion
                    const metadata = {
                      _isSharedEvent: true,
                      _allSections: sharedEventData.items,
                      _sourceEvent: event,
                    };
                    localStorage.setItem(`viking_shared_metadata_${event.eventid}`, JSON.stringify(metadata));
                    
                    // Return combined data for EventCard
                    return combinedAttendanceData;
                  }
                } catch (sharedErr) {
                  logger.warn('Failed to fetch shared event data, falling back to section-specific data', {
                    eventId: event.eventid,
                    error: sharedErr.message,
                  }, LOG_CATEGORIES.API);
                  // Fall through to use section-specific data only
                }
              } else if (eventSummary.data.sharing.is_owner === false && allEvents) {
                logger.info('Event is shared but this section is not the owner - still fetching shared data', {
                  eventId: event.eventid,
                  eventName: event.name,
                  owner: eventSummary.data.sharing.owner,
                  sectionId: event.sectionid,
                }, LOG_CATEGORIES.COMPONENT);
                
                // Even for non-owner sections, we want to show shared attendance data
                try {
                  logger.info('📞 Calling getEventSharingStatus API (non-owner section)', {
                    eventId: event.eventid,
                    sectionId: event.sectionid,
                    hasToken: !!token,
                  }, LOG_CATEGORIES.COMPONENT);
                  
                  // Get shared event data with section attendance counts (should work with any section ID for shared events)
                  const sharedEventData = await getEventSharingStatus(event.eventid, event.sectionid, token);
                  
                  logger.info('📋 getEventSharingStatus API response (non-owner)', {
                    eventId: event.eventid,
                    hasResponse: !!sharedEventData,
                    responseKeys: sharedEventData ? Object.keys(sharedEventData) : [],
                    sectionsCount: sharedEventData?.items?.length || 0,
                    identifier: sharedEventData?.identifier || 'none',
                  }, LOG_CATEGORIES.COMPONENT);
                  
                  if (sharedEventData) {
                    // For shared events, create attendance data from section-level counts  
                    // Convert section attendance counts to individual attendance records for EventCard compatibility
                    const sharedAttendanceData = convertSharedEventToAttendanceFormat(sharedEventData);
                    
                    logger.info('✅ Successfully processed shared event data (non-owner)', {
                      eventId: event.eventid,
                      totalAttendees: sharedAttendanceData.items?.length || 0,
                      sectionsCount: sharedEventData.items?.length || 0,
                      sectionsWithAttendance: sharedEventData.items?.filter(s => s.attendance > 0).length || 0,
                    }, LOG_CATEGORIES.COMPONENT);
                    
                    // Combine section-specific and shared data for maximum detail
                    const combinedAttendanceData = [
                      // Include real section-specific data (has No/Invited/NotInvited details)
                      ...sectionSpecificAttendanceData,
                      // Include synthetic data for sections we don't have access to
                      ...sharedAttendanceData.items.filter(item => 
                        item.scoutid && item.scoutid.startsWith('synthetic-')
                      )
                    ];
                    
                    // Save combined attendance data to cache
                    await databaseService.saveAttendance(event.eventid, combinedAttendanceData);
                    
                    // Store shared event metadata separately for event expansion
                    const metadata = {
                      _isSharedEvent: true,
                      _allSections: sharedEventData.items,
                      _sourceEvent: event,
                    };
                    localStorage.setItem(`viking_shared_metadata_${event.eventid}`, JSON.stringify(metadata));
                    
                    // Return combined data for EventCard
                    return combinedAttendanceData;
                  }
                } catch (sharedErr) {
                  logger.warn('Failed to fetch shared event data for non-owner section, falling back to section-specific data', {
                    eventId: event.eventid,
                    error: sharedErr.message,
                  }, LOG_CATEGORIES.API);
                  // Fall through to use section-specific data only
                }
              }
            } else {
              logger.info('Regular event (no sharing data)', {
                eventId: event.eventid,
                eventName: event.name,
                sectionId: event.sectionid,
              }, LOG_CATEGORIES.COMPONENT);
            }
          } catch (summaryErr) {
            logger.warn('Failed to fetch event summary, treating as regular event', {
              eventId: event.eventid,
              error: summaryErr.message,
            }, LOG_CATEGORIES.API);
            // Continue to return section-specific data for regular events
          }
          
          // Default: Save section-specific data to cache and return it
          await databaseService.saveAttendance(event.eventid, sectionSpecificAttendanceData);
          return sectionSpecificAttendanceData;
        } else {
          logger.warn('No section-specific attendance data returned from API', {
            eventId: event.eventid,
            eventName: event.name,
            sectionId: event.sectionid,
            termId: termId,
            hasToken: !!token,
          }, LOG_CATEGORIES.COMPONENT);
        }
      }
    } else {
      // Load from cache
      logger.info('Loading attendance from cache (shared events not checked)', {
        eventId: event.eventid,
        eventName: event.name,
        sectionId: event.sectionid,
      }, LOG_CATEGORIES.COMPONENT);
      const cachedAttendance = await databaseService.getAttendance(event.eventid);
      // Handle both array format (regular events) and object format (shared events)
      if (Array.isArray(cachedAttendance)) {
        return cachedAttendance;
      } else if (cachedAttendance && cachedAttendance.items) {
        return cachedAttendance.items;
      }
      return cachedAttendance || [];
    }
  } catch (err) {
    logger.error('Error fetching attendance for event {eventId}', { 
      error: err, 
      eventId: event.eventid,
      eventName: event.name,
      sectionId: event.sectionid,
    }, LOG_CATEGORIES.API);
  }
  return [];
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

/**
 * Detects if an event is a shared event owner based on attendance data
 * @param {Object} attendanceData - Attendance data response from API
 * @returns {boolean} True if this section owns a shared event
 */
export const isSharedEventOwner = (attendanceData) => {
  // Check if the response has sharing info and is_owner is true
  if (attendanceData && attendanceData.sharing && attendanceData.sharing.is_owner === true) {
    return true;
  }
  return false;
};

/**
 * Extracts sections that the user has direct access to from events
 * @param {Array} events - Array of event objects with sectionid  
 * @returns {Set} Set of section IDs the user has access to
 */
export const getUserAccessibleSections = (events) => {
  return new Set(events.map(event => event.sectionid));
};

/**
 * Converts shared event data from getEventSharingStatus to attendance format for EventCard compatibility
 * @param {Object} sharedEventData - Response from getEventSharingStatus API with section-level counts
 * @returns {Object} Attendance data compatible with EventCard component
 */
export const convertSharedEventToAttendanceFormat = (sharedEventData) => {
  try {
    // Filter out null/empty section entries (these are totals/summaries)
    const sections = (sharedEventData?.items || []).filter(section => 
      section.sectionid && section.sectionname && 
      section.sectionid !== null && section.sectionid !== 'null' &&
      section.sectionname !== null && section.sectionname !== 'null'
    );
    
    // Create synthetic attendance records for each section based on their counts
    const attendanceItems = [];
    const attendanceSummary = { Yes: 0, No: 0, 'Not invited': 0, total_members: 0 };
    const sectionsInfo = [];
    
    sections.forEach(section => {
      // Add section info
      sectionsInfo.push({
        sectionid: parseInt(section.sectionid),
        section_name: section.sectionname,
        member_count: section.attendance || 0,
        hasDirectAccess: false, // For shared events, access level doesn't matter for display
        status: section.status, // Owner, Accepted, Pending
      });
      
      // For each attending member, create a synthetic attendance record  
      for (let i = 0; i < (section.attendance || 0); i++) {
        attendanceItems.push({
          scoutid: `synthetic-${section.sectionid}-${i}`,
          sectionid: section.sectionid,
          sectionname: section.sectionname,
          attending: 'Yes',
          firstname: `Member ${i + 1}`, // Synthetic name for display count
          lastname: `(${section.sectionname})`,
          groupname: section.groupname,
        });
      }
      
      // Add to summary counts
      attendanceSummary.Yes += section.attendance || 0;
      attendanceSummary['Not invited'] += section.none || 0;
      attendanceSummary.total_members += (section.attendance || 0) + (section.none || 0);
    });
    
    logger.info('Converted shared event data to attendance format', {
      totalSections: sections.length,
      totalAttendees: attendanceSummary.Yes,
      totalNotInvited: attendanceSummary['Not invited'],
      sectionsWithAttendance: sections.filter(s => s.attendance > 0).length,
      attendanceItemsCreated: attendanceItems.length,
      sectionsInfo: sectionsInfo.map(s => `${s.section_name}: ${s.member_count}`),
      allSectionsData: sections.map(s => `${s.sectionname} (${s.sectionid}): ${s.attendance || 0} attending`),
    }, LOG_CATEGORIES.COMPONENT);
    
    return {
      items: attendanceItems,
      summary: attendanceSummary,
      sections: sectionsInfo,
      sharing: {
        isSharedEvent: true,
        hasSharedData: true,
      },
    };
    
  } catch (error) {
    logger.error('Error converting shared event data to attendance format', {
      error: error.message,
      hasData: !!sharedEventData,
    }, LOG_CATEGORIES.COMPONENT);
    
    // Return empty structure on error
    return {
      items: [],
      summary: { Yes: 0, No: 0, 'Not invited': 0, total_members: 0 },
      sections: [],
      sharing: { isSharedEvent: true, hasSharedData: false },
    };
  }
};

/**
 * Expands shared events to include synthetic events for all participating sections
 * This allows EventCard to display attendance for all sections in shared events
 * @param {Array} events - Original events array (only user-accessible sections)
 * @param {Map} attendanceMap - Map of event IDs to attendance data
 * @returns {Array} Expanded events array including synthetic events for shared event sections
 */
export const expandSharedEvents = (events, attendanceMap) => {
  // For shared events, we DON'T want to create synthetic events for each section
  // Instead, we want the EventCard to handle displaying all sections within a single card
  // So we'll just return the original events array without expansion
  
  logger.info('expandSharedEvents called - returning original events to prevent duplicate cards', {
    eventsCount: events.length,
    attendanceMapSize: attendanceMap.size,
    eventNames: events.map(e => e.name).slice(0, 5), // First 5 event names
  }, LOG_CATEGORIES.COMPONENT);

  // The shared event data is already combined in the attendance data
  // EventCard will handle displaying all sections using the combined attendance data
  return events;
};

/**
 * Merges shared event attendance with section-specific attendance data
 * Combines attendee names from shared API with complete counts from section-specific APIs
 * @param {Object} sharedAttendanceData - Response from getSharedEventAttendance API
 * @param {Array} sectionSpecificAttendanceData - Array of attendance data from section-specific APIs
 * @param {Set} sectionsToShow - Set of section IDs to include in the output (all shared sections for shared events)
 * @returns {Object} Merged attendance data with combined attendees and accurate counts
 */
export const mergeSharedAndSectionAttendance = (sharedAttendanceData, sectionSpecificAttendanceData, sectionsToShow) => {
  try {
    // Get shared attendees (all "Yes" responses from all sections)
    // The shared API returns combined attendance in 'items' property
    const sharedAttendees = sharedAttendanceData?.items || [];
    
    // Get section-specific attendees (includes No/Maybe/Not invited for accessible sections)
    const sectionAttendees = sectionSpecificAttendanceData.flatMap(data => data.items || []);
    
    logger.info('Merging attendance data', {
      sharedCount: sharedAttendees.length,
      sectionCount: sectionAttendees.length,
      sectionsToShow: Array.from(sectionsToShow),
    }, LOG_CATEGORIES.COMPONENT);
    
    // Create a map for quick lookup of shared attendees
    const sharedAttendeesMap = new Map();
    sharedAttendees.forEach(attendee => {
      // Shared API uses scoutid, section API might use memberid
      const id = attendee.scoutid || attendee.memberid;
      const key = `${id}-${attendee.sectionid}`;
      sharedAttendeesMap.set(key, attendee);
    });
    
    // Merge logic: start with shared attendees, then add section-specific data that's not already included
    const mergedAttendees = [...sharedAttendees];
    
    // Add section-specific attendees that aren't already in shared data
    sectionAttendees.forEach(attendee => {
      // Section API might use different ID field than shared API
      const id = attendee.scoutid || attendee.memberid;
      const key = `${id}-${attendee.sectionid}`;
      
      // If not already in shared data, add it
      if (!sharedAttendeesMap.has(key)) {
        mergedAttendees.push(attendee);
      }
    });
    
    // Calculate merged summary counts
    const attendanceCountMap = {};
    mergedAttendees.forEach(attendee => {
      const attendance = attendee.attending || 'Unknown';
      attendanceCountMap[attendance] = (attendanceCountMap[attendance] || 0) + 1;
    });
    
    // Build sections summary from shared data and fill in gaps from section-specific data
    const sectionsMap = new Map();
    
    // Extract sections from shared attendee data (since no separate sections array)
    sharedAttendees.forEach(attendee => {
      const sectionId = parseInt(attendee.sectionid);
      if (!sectionsMap.has(sectionId)) {
        sectionsMap.set(sectionId, {
          sectionid: sectionId,
          section_name: attendee.sectionname,
          member_count: 0, // Will be calculated below
          hasDirectAccess: false, // For shared events, we show all sections regardless of access
        });
      }
    });
    
    // Count members per section from shared data
    sharedAttendees.forEach(attendee => {
      const sectionId = parseInt(attendee.sectionid);
      if (sectionsMap.has(sectionId)) {
        sectionsMap.get(sectionId).member_count += 1;
      }
    });
    
    // Add/update sections from section-specific data
    sectionSpecificAttendanceData.forEach(data => {
      if (data.items && data.items.length > 0) {
        const firstItem = data.items[0];
        const sectionId = firstItem.sectionid;
        
        // For shared events, include all sections that have data
        if (sectionsToShow.has(sectionId)) {
          sectionsMap.set(sectionId, {
            sectionid: sectionId,
            section_name: firstItem.sectionname,
            member_count: data.items.length,
            hasDirectAccess: false, // For shared events, access level doesn't matter for display
          });
        }
      }
    });
    
    const mergedData = {
      items: mergedAttendees,
      summary: {
        total_members: mergedAttendees.length,
        ...attendanceCountMap,
      },
      sections: Array.from(sectionsMap.values()),
      sharing: {
        isSharedEvent: true,
        hasSharedData: true,
      },
    };
    
    logger.info('Attendance merge completed', {
      totalAttendees: mergedAttendees.length,
      sectionsCount: mergedData.sections.length,
      summaryBreakdown: attendanceCountMap,
    }, LOG_CATEGORIES.COMPONENT);
    
    return mergedData;
    
  } catch (error) {
    logger.error('Error merging shared and section attendance data', {
      error: error.message,
      sharedDataAvailable: !!sharedAttendanceData,
      sectionDataCount: sectionSpecificAttendanceData?.length || 0,
    }, LOG_CATEGORIES.COMPONENT);
    
    // Fallback to section-specific data only
    return sectionSpecificAttendanceData.flatMap(data => data.items || []);
  }
};