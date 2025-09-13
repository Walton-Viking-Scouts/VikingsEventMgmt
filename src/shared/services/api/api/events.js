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
import { isDemoMode } from '../../../../config/demoMode.js';
import { authHandler } from '../../auth/authHandler.js';
import databaseService from '../../storage/database.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

/**
 * Retrieves events for a specific section and term
 * @param {number|string} sectionId - OSM section identifier
 * @param {number|string} termId - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<object>>} Array of events with attendance data
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
      
      const response = await fetch(`${BACKEND_URL}/get-events?sectionid=${sectionId}&termid=${termId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return await handleAPIResponseWithRateLimit(response, 'getEvents');
    });
    // Events are in the 'items' property of the response
    const events = (data && data.items) ? data.items : [];
    
    // Filter out any demo events that might be in production data
    const filteredEvents = events.filter((event) => {
      const eid = event?.eventid;
      return !(typeof eid === 'string' && eid.startsWith('demo_event_'));
    });

    // Save to local database when online (even if empty to cache the result)
    await databaseService.saveEvents(sectionId, filteredEvents);

    return filteredEvents;

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
 * @returns {Promise<Array<object>>} Array of attendance records
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
 * @returns {Promise<object>} Event summary with sharing data
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
 * @returns {Promise<object>} Sharing status data with shared sections list
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
 * @returns {Promise<object>} Combined attendance data from all shared sections
 * @throws {Error} When API request fails
 * 
 * @example
 * const sharedAttendance = await getSharedEventAttendance('12345', '67890', token);
 * console.log(`${sharedAttendance.combined_attendance.length} total attendees`);
 */
export async function getSharedEventAttendance(eventId, sectionId, token) {
  try {
    // Check for cached data first - use demo prefix if in demo mode
    const demoMode = isDemoMode();
    const prefix = demoMode ? 'demo_' : '';
    const cacheKey = `${prefix}viking_shared_attendance_${eventId}_${sectionId}_offline`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        // Check if cache is still fresh (within 1 hour)
        const cacheAge = Date.now() - (cachedData._cacheTimestamp || 0);
        const maxAge = 60 * 60 * 1000; // 1 hour
        
        if (cacheAge < maxAge) {
          logger.debug('Using cached shared attendance data', { eventId, sectionId }, LOG_CATEGORIES.API);
          return cachedData;
        } else {
          logger.debug('Cached shared attendance data expired, fetching fresh data', { eventId, sectionId }, LOG_CATEGORIES.API);
        }
      }
    } catch (cacheError) {
      logger.warn('Failed to parse cached shared attendance data', { error: cacheError.message }, LOG_CATEGORIES.API);
    }
    
    // In demo mode, if no cached data found, generate fallback
    if (demoMode) {
      logger.debug('Demo mode: No cached shared attendance found, generating fallback data', { eventId, sectionId }, LOG_CATEGORIES.API);
      return generateDemoSharedAttendance(eventId, sectionId);
    }
    
    // Check network status first
    const isOnlineNow = await checkNetworkStatus();
    
    if (!isOnlineNow) {
      // If offline, try to return stale cache
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          logger.info('Using stale cached shared attendance data (offline)', { eventId, sectionId }, LOG_CATEGORIES.API);
          return cachedData;
        }
      } catch (cacheError) {
        // Ignore cache errors when offline
      }
      throw new Error('No network connection and no cached shared attendance available');
    }

    validateTokenBeforeAPICall(token, 'getSharedEventAttendance');

    // Simple circuit breaker - use cache if auth already failed  
    if (!authHandler.shouldMakeAPICall()) {
      // Try to return stale cache if auth failed
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          logger.info('Using stale cached shared attendance data (auth failed)', { eventId, sectionId }, LOG_CATEGORIES.API);
          return cachedData;
        }
      } catch (cacheError) {
        // Ignore cache errors when auth failed
      }
      throw new Error('Authentication failed and no cached shared attendance available');
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
    
    // Log the data shape for development (only when fresh API data is received)
    if (import.meta.env.DEV) {
      console.log('🔍 Shared Event Attendance API Response Shape:', {
        eventId,
        sectionId,
        dataStructure: {
          combined_attendance_count: result.combined_attendance?.length || 0,
          combined_attendance_sample: result.combined_attendance?.[0] || null,
          summary_keys: Object.keys(result.summary || {}),
          summary_data: result.summary,
          sections_count: result.sections?.length || 0,
          sections_sample: result.sections?.[0] || null,
          top_level_keys: Object.keys(result),
        },
        full_response: result,
      });
    }
    
    // Cache the successful response
    try {
      const dataToCache = {
        ...result,
        _cacheTimestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
      logger.debug('Cached shared attendance data', { eventId, sectionId }, LOG_CATEGORIES.API);
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
      const cached = localStorage.getItem(sharedCacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
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
 * 
 * Retrieves attendance data from localStorage cache using demo prefix.
 * Returns empty structure if no cached data is found.
 * 
 * @private
 * @param {string|number} eventId - Event identifier
 * @param {string|number} sectionId - Section identifier
 * @returns {{identifier: string, items: Array, _cacheTimestamp: number}} Attendance data with items array and timestamp
 */
function generateDemoSharedAttendance(eventId, sectionId) {
  // Simply fetch the cached shared attendance data - use demo prefix
  const sharedCacheKey = `demo_viking_shared_attendance_${eventId}_${sectionId}_offline`;
  const cachedSharedAttendance = localStorage.getItem(sharedCacheKey);
  
  if (import.meta.env.DEV) {
    logger.debug('Demo mode: Looking for cached shared attendance', {
      eventId,
      sectionId,
      cacheKey: sharedCacheKey,
      found: !!cachedSharedAttendance,
    }, LOG_CATEGORIES.API);
  }
  
  if (cachedSharedAttendance) {
    try {
      const attendanceData = JSON.parse(cachedSharedAttendance);
      return attendanceData;
    } catch (error) {
      logger.warn('Failed to parse cached shared attendance', { error: error.message }, LOG_CATEGORIES.API);
    }
  }
  
  // Return empty structure if no cached data found
  return {
    identifier: 'scoutsectionid',
    items: [],
    _cacheTimestamp: Date.now(),
  };
}