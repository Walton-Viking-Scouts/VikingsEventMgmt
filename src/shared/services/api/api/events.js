// Events API service
// Extracted from monolithic api.js for better modularity

import {
  BACKEND_URL,
  validateTokenBeforeAPICall,
  handleAPIResponseWithRateLimit,
} from './base.js';
import { withRateLimitQueue } from '../../../utils/rateLimitQueue.js';
import { checkNetworkStatus } from '../../../utils/networkUtils.js';
import { safeGetItem } from '../../../utils/storageUtils.js';
import UnifiedStorageService from '../../storage/unifiedStorageService.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { authHandler } from '../../auth/authHandler.js';
import databaseService from '../../storage/database.js';
import IndexedDBService from '../../storage/indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

/**
 * Retrieves events for a specific section and term
 * @param {number|string} sectionId - OSM section identifier
 * @param {number|string} termId - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Array of events with attendance data
 * @throws {Error} When API request fails and no cached data available
 * 
 * @example
 * const events = await getEvents(123, '456', userToken);
 * console.log(`Found ${events.length} events`);
 */
export async function getEvents(sectionId, termId, token) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = `demo_viking_events_${sectionId}_${termId}_offline`;
      const cached = safeGetItem(cacheKey, []);
      return cached;
    }
    
    // Check network status first
    const isOnlineNow = await checkNetworkStatus();
        
    // If offline, get from local database
    if (!isOnlineNow) {
      const events = await databaseService.getEvents(sectionId);
      return events;
    }
    
    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      logger.info('Auth failed - using cached events only', { sectionId, termId }, LOG_CATEGORIES.API);
      const events = await databaseService.getEvents(sectionId);
      return events;
    }

    const data = await withRateLimitQueue(async () => {
      // Online and allowed – validate now
      validateTokenBeforeAPICall(token, 'getEvents');
      
      const response = await fetch(
        `${BACKEND_URL}/get-events?sectionid=${encodeURIComponent(sectionId)}&termid=${encodeURIComponent(termId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      return await handleAPIResponseWithRateLimit(response, 'getEvents');
    });
    // Events are in the 'items' property of the response
    const events = (data && data.items) ? data.items : [];
    
    // Filter out any demo events that might be in production data
    const filteredEvents = events.filter((event) => {
      const eid = event?.eventid;
      return !(typeof eid === 'string' && eid.startsWith('demo_event_'));
    });

    // CRITICAL FIX: Add termid to each event for consistent database storage
    // Web storage needs termid field for attendance sync validation, but API response doesn't include it
    const eventsWithTermId = filteredEvents.map((event) => ({
      ...event,
      termid: event.termid ?? termId ?? null,
      sectionid: event.sectionid ?? sectionId ?? null,
    }));

    // Save to local database when online (even if empty to cache the result)
    await databaseService.saveEvents(sectionId, eventsWithTermId);

    return eventsWithTermId;

  } catch (error) {
    logger.error('Error fetching events', { sectionId, termId, error: error.message }, LOG_CATEGORIES.API);
        
    // If online request fails, try local database as fallback
    const isOnlineNow = await checkNetworkStatus();
    if (isOnlineNow) {
      try {
        const events = await databaseService.getEvents(sectionId);
        return events;
      } catch (dbError) {
        logger.error('Database fallback failed', { dbError: dbError.message }, LOG_CATEGORIES.API);
      }
    }
        
    throw error;
  }
}

/**
 * Retrieves attendance data for a specific event
 * @param {number|string} sectionId - OSM section identifier
 * @param {number|string} eventId - OSM event identifier
 * @param {number|string} termId - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Array of attendance records
 * @throws {Error} When API request fails and no cached data available
 * 
 * @example
 * const attendance = await getEventAttendance(123, 789, '456', userToken);
 * console.log(`${attendance.length} people attended`);
 */
export async function getEventAttendance(sectionId, eventId, termId, token) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = `demo_viking_attendance_${sectionId}_${termId}_${eventId}_offline`;
      const cached = safeGetItem(cacheKey, []);
      // Normalize to array format if cached as object with items
      const attendance = Array.isArray(cached) ? cached : (cached.items || []);
      if (import.meta.env.DEV) {
        logger.debug('Demo mode: Using cached attendance', {
          sectionId,
          eventId,
          termId,
          attendanceCount: attendance.length,
        }, LOG_CATEGORIES.API);
      }
      return attendance;
    }
    
    // Check network status first
    const isOnlineNow = await checkNetworkStatus();
        
    // If offline, get from local database
    if (!isOnlineNow) {
      const attendance = await databaseService.getAttendance(eventId);
      return attendance;
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      logger.info('Auth failed - using cached attendance only', { eventId }, LOG_CATEGORIES.API);
      const attendance = await databaseService.getAttendance(eventId);
      return attendance;
    }

    const data = await withRateLimitQueue(async () => {
      validateTokenBeforeAPICall(token, 'getEventAttendance');
      
      const response = await fetch(`${BACKEND_URL}/get-event-attendance?sectionid=${sectionId}&termid=${termId}&eventid=${eventId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return await handleAPIResponseWithRateLimit(response, 'getEventAttendance');
    });
    // Attendance is in the 'items' property of the response
    const attendance = (data && data.items) ? data.items : [];

    // Save to local database when online
    if (attendance.length > 0) {
      await databaseService.saveAttendance(eventId, attendance);

      // Create member_section records for shared attendees
      await createMemberSectionRecordsForSharedAttendees(sectionId, attendance);
    }

    return attendance;

  } catch (error) {
    logger.error('Error fetching event attendance', { eventId, error: error.message }, LOG_CATEGORIES.API);
        
    // If online request fails, try local database as fallback
    const isOnlineNow = await checkNetworkStatus();
    if (isOnlineNow) {
      try {
        const attendance = await databaseService.getAttendance(eventId);
        return attendance;
      } catch (dbError) {
        logger.error('Database fallback failed', { dbError: dbError.message }, LOG_CATEGORIES.API);
      }
    }
        
    throw error;
  }
}

/**
 * Gets event summary including sharing information
 * @param {number|string} eventId - OSM event identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} Event summary with sharing data
 * @throws {Error} When API request fails
 * 
 * @example
 * const summary = await getEventSummary('1573792', token);
 * if (summary.sharing?.is_owner) {
 *   // This section owns a shared event
 * }
 */
export async function getEventSummary(eventId, token) {
  try {
    // Skip API calls in demo mode - return mock data
    const demoMode = isDemoMode();
    if (demoMode) {
      if (import.meta.env.DEV) {
        logger.debug('Demo mode: Returning mock event summary', {
          eventId,
        }, LOG_CATEGORIES.API);
      }
      // Return a basic mock summary for demo mode
      return {
        eventId,
        attendees: 0,
        invited: 0,
        confirmed: 0,
      };
    }
    
    validateTokenBeforeAPICall(token, 'getEventSummary');
    
    // Check network status first
    const isOnlineNow = await checkNetworkStatus();
    
    if (!isOnlineNow) {
      throw new Error('No network connection available for event summary');
    }

    if (!token) {
      throw new Error('Authentication token required for event summary');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      throw new Error('Authentication failed - cannot fetch event summary');
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/get-event-summary?eventid=${encodeURIComponent(eventId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return await handleAPIResponseWithRateLimit(response, 'getEventSummary');
    });

    return data || null;

  } catch (error) {
    logger.error('Error fetching event summary', { 
      eventId, 
      error: error.message, 
    }, LOG_CATEGORIES.API);
    throw error;
  }
}

/**
 * Retrieves sharing status for an event to see which sections it has been shared with
 * @param {number|string} eventId - OSM event identifier  
 * @param {number|string} sectionId - OSM section identifier (owner section)
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} Sharing status data with shared sections list
 * @throws {Error} When API request fails
 * 
 * @example
 * const sharingStatus = await getEventSharingStatus('12345', '67890', token);
 * console.log(`Event shared with ${sharingStatus.items.length} sections`);
 */
export async function getEventSharingStatus(eventId, sectionId, token) {
  try {
    // Skip API calls in demo mode - return mock data
    const demoMode = isDemoMode();
    if (demoMode) {
      if (import.meta.env.DEV) {
        logger.debug('Demo mode: Returning mock sharing status', {
          eventId,
          sectionId,
        }, LOG_CATEGORIES.API);
      }
      // Return empty sharing status for demo mode
      return {
        items: [],
      };
    }
    
    validateTokenBeforeAPICall(token, 'getEventSharingStatus');
    
    // Check network status first
    const isOnlineNow = await checkNetworkStatus();
    
    if (!isOnlineNow) {
      throw new Error('No network connection available for sharing status');
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      throw new Error('Authentication failed - cannot fetch sharing status');
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(
        `${BACKEND_URL}/get-event-sharing-status?eventid=${encodeURIComponent(eventId)}&sectionid=${encodeURIComponent(sectionId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      return await handleAPIResponseWithRateLimit(response, 'getEventSharingStatus');
    });

    return data || { items: [] };

  } catch (error) {
    logger.error('Error fetching event sharing status', { 
      eventId, 
      sectionId, 
      error: error.message, 
    }, LOG_CATEGORIES.API);
    
    // Re-throw the error to let calling code handle it
    throw error;
  }
}

/**
 * Retrieves combined attendance data from all sections participating in a shared event
 * @param {number|string} eventId - OSM event identifier
 * @param {number|string} sectionId - OSM section identifier (owner section)  
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} Combined attendance data from all shared sections
 * @throws {Error} When API request fails
 * 
 * @example
 * const sharedAttendance = await getSharedEventAttendance('12345', '67890', token);
 * console.log(`${sharedAttendance.combined_attendance.length} total attendees`);
 */
export async function getSharedEventAttendance(eventId, sectionId, token) {
  try {
    // Demo mode fallback
    const demoMode = isDemoMode();
    if (demoMode) {
      logger.debug('Demo mode: Generating shared attendance data', { eventId, sectionId }, LOG_CATEGORIES.API);
      return generateDemoSharedAttendance(eventId, sectionId);
    }

    validateTokenBeforeAPICall(token, 'getSharedEventAttendance');

    // Simple circuit breaker
    if (!authHandler.shouldMakeAPICall()) {
      throw new Error('Authentication failed - cannot fetch shared attendance');
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(
        `${BACKEND_URL}/get-shared-event-attendance?eventid=${encodeURIComponent(eventId)}&sectionid=${encodeURIComponent(sectionId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      );

      return await handleAPIResponseWithRateLimit(response, 'getSharedEventAttendance');
    });

    const result = data || { combined_attendance: [], summary: {}, sections: [] };

    // Cache the successful response in IndexedDB
    try {
      const cacheKey = `viking_shared_attendance_${eventId}_${sectionId}_offline`;
      await UnifiedStorageService.set(cacheKey, result);
      logger.debug('Cached shared attendance data to IndexedDB', { eventId, sectionId }, LOG_CATEGORIES.API);
    } catch (cacheError) {
      logger.warn('Failed to cache shared attendance data', { error: cacheError.message }, LOG_CATEGORIES.API);
    }

    return result;

  } catch (error) {
    logger.error('Error fetching shared event attendance', { 
      eventId, 
      sectionId, 
      error: error.message, 
    }, LOG_CATEGORIES.API);
    
    // Try to return stale cached data as a last resort
    const demoMode = isDemoMode();
    const prefix = demoMode ? 'demo_' : '';
    const sharedCacheKey = `${prefix}viking_shared_attendance_${eventId}_${sectionId}_offline`;
    try {
      const cachedData = demoMode ? safeGetItem(sharedCacheKey) : await UnifiedStorageService.get(sharedCacheKey);
      if (cachedData) {
        logger.info('Using stale cached shared attendance data (API error fallback)', { eventId, sectionId }, LOG_CATEGORIES.API);
        return cachedData;
      }
    } catch (cacheError) {
      // Ignore cache errors in fallback
    }
    
    // Re-throw the error to let calling code handle it
    throw error;
  }
}

/**
 * Get cached shared attendance data for demo mode
 */
function generateDemoSharedAttendance(eventId, sectionId) {
  // Simply fetch the cached shared attendance data - use demo prefix
  const sharedCacheKey = `demo_viking_shared_attendance_${eventId}_${sectionId}_offline`;
  const cachedSharedAttendance = safeGetItem(sharedCacheKey);

  if (import.meta.env.DEV) {
    logger.debug('Demo mode: Looking for cached shared attendance', {
      eventId,
      sectionId,
      cacheKey: sharedCacheKey,
      found: !!cachedSharedAttendance,
    }, LOG_CATEGORIES.API);
  }

  if (cachedSharedAttendance) {
    return cachedSharedAttendance;
  }

  // Return empty structure if no cached data found
  return {
    identifier: 'scoutsectionid',
    items: [],
    _cacheTimestamp: Date.now(),
  };
}

async function createMemberSectionRecordsForSharedAttendees(sectionId, attendance) {
  try {
    logger.debug('createMemberSectionRecordsForSharedAttendees called', {
      sectionId,
      attendanceCount: attendance.length,
    }, LOG_CATEGORIES.DATABASE);

    if (attendance.length === 0) {
      logger.debug('No attendance records to process', {}, LOG_CATEGORIES.DATABASE);
      return;
    }

    const uniqueScoutIds = [...new Set(attendance.map(a => a.scoutid))];
    logger.debug('Unique scout IDs from attendance', {
      count: uniqueScoutIds.length,
      scoutIds: uniqueScoutIds,
    }, LOG_CATEGORIES.DATABASE);

    // Get section name
    const events = await databaseService.getEvents(sectionId);
    const sectionName = events.length > 0 ? events[0]?.sectionname : null;
    logger.debug('Section name retrieved', {
      sectionName,
      eventsCount: events.length,
    }, LOG_CATEGORIES.DATABASE);

    // Step 1: Ensure all attendees exist in core_members (create minimal records if missing)
    const existingCoreMembers = await IndexedDBService.bulkGetCoreMembers(uniqueScoutIds);
    const existingCoreMemberIds = new Set(existingCoreMembers.map(m => m.scoutid));

    logger.debug('Existing core_members', {
      count: existingCoreMembers.length,
      scoutIds: Array.from(existingCoreMemberIds),
    }, LOG_CATEGORIES.DATABASE);

    // Create minimal core_member records for missing scouts
    const attendanceByScoutId = new Map(attendance.map(a => [a.scoutid, a]));
    const missingCoreMembers = uniqueScoutIds
      .filter(scoutid => !existingCoreMemberIds.has(scoutid))
      .map(scoutid => {
        const attendanceRecord = attendanceByScoutId.get(scoutid);
        return {
          scoutid,
          firstname: attendanceRecord?.firstname || '',
          lastname: attendanceRecord?.lastname || '',
          patrol: attendanceRecord?.patrol || '',
          active: true,
        };
      });

    if (missingCoreMembers.length > 0) {
      await IndexedDBService.bulkUpsertCoreMembers(missingCoreMembers);
      logger.debug('Created minimal core_member records for shared attendees', {
        count: missingCoreMembers.length,
        scoutIds: missingCoreMembers.map(m => m.scoutid),
      }, LOG_CATEGORIES.DATABASE);
    }

    // Step 2: Get existing member_section records for this section
    const existingSections = await IndexedDBService.getMemberSectionsByScoutIds(uniqueScoutIds, sectionId);
    const existingSectionScoutIds = new Set(existingSections.map(s => s.scoutid));

    logger.debug('Existing member_section records for this section', {
      count: existingSections.length,
      scoutIds: Array.from(existingSectionScoutIds),
    }, LOG_CATEGORIES.DATABASE);

    // Step 3: Get ALL member_section records for these scouts (from other sections) to infer person_type
    const allMemberSections = await IndexedDBService.getAllMemberSectionsForScouts(uniqueScoutIds);
    const memberSectionsByScoutId = new Map();
    allMemberSections.forEach(section => {
      if (!memberSectionsByScoutId.has(section.scoutid)) {
        memberSectionsByScoutId.set(section.scoutid, []);
      }
      memberSectionsByScoutId.get(section.scoutid).push(section);
    });

    logger.debug('All member_section records across sections', {
      totalRecords: allMemberSections.length,
      scoutsWithRecords: memberSectionsByScoutId.size,
    }, LOG_CATEGORIES.DATABASE);

    // Step 4: Create member_section records for all scouts missing from this section
    const newMemberSections = uniqueScoutIds
      .filter(scoutid => !existingSectionScoutIds.has(scoutid))
      .map(scoutid => {
        let personType = 'Young People'; // Default

        // Infer person_type from their memberships in other sections
        const otherSections = memberSectionsByScoutId.get(scoutid) || [];
        if (otherSections.length > 0) {
          // Prioritize Young Leaders > Leaders > Young People
          const youngLeader = otherSections.find(s => s.person_type === 'Young Leaders');
          const leader = otherSections.find(s => s.person_type === 'Leaders');

          if (youngLeader) {
            personType = 'Young Leaders';
          } else if (leader) {
            personType = 'Leaders';
          } else if (otherSections[0]?.person_type) {
            personType = otherSections[0].person_type;
          }
        }

        return {
          scoutid,
          sectionid: sectionId,
          sectionname: sectionName,
          person_type: personType,
          active: true,
        };
      });

    logger.debug('New member_section records to create', {
      count: newMemberSections.length,
      records: newMemberSections,
    }, LOG_CATEGORIES.DATABASE);

    if (newMemberSections.length > 0) {
      await IndexedDBService.bulkUpsertMemberSections(newMemberSections);
      logger.debug('Created member_section records for shared attendees', {
        count: newMemberSections.length,
        sectionId,
      }, LOG_CATEGORIES.DATABASE);
    } else {
      logger.debug('No new member_section records needed - all scouts already have records for this section', {
        sectionId,
      }, LOG_CATEGORIES.DATABASE);
    }
  } catch (error) {
    logger.error('Failed to create member_section records for shared attendees', {
      sectionId,
      error: error.message,
    }, LOG_CATEGORIES.ERROR);
  }
}