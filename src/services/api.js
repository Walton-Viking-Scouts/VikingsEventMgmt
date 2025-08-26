// API service for Viking Event Management Mobile
// React version of the original API module with enhanced mobile support and offline capabilities

import databaseService from './database.js';
import { sentryUtils } from './sentry.js';
import logger, { LOG_CATEGORIES } from './logger.js';
import { authHandler } from './simpleAuthHandler.js';
import { sleep } from '../utils/asyncUtils.js';
import { getMostRecentTermId } from '../utils/termUtils.js';
import { checkNetworkStatus, addNetworkListener } from '../utils/networkUtils.js';
import { safeGetItem, safeSetItem } from '../utils/storageUtils.js';
import { withRateLimitQueue } from '../utils/rateLimitQueue.js';
import { isDemoMode } from '../config/demoMode.js';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://vikings-osm-backend.onrender.com';


/**
 * API call queue to prevent simultaneous requests and manage rate limiting
 * Processes API calls sequentially with controlled delays
 */
class APIQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.requestCount = 0;
  }

  async add(apiCall) {
    return new Promise((resolve, reject) => {
      this.queue.push({ apiCall, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    
    while (this.queue.length > 0) {
      const { apiCall, resolve, reject } = this.queue.shift();
      
      try {
        this.requestCount++;
        
        const result = await apiCall();
        resolve(result);
        
        // Add delay between queued API calls
        if (this.queue.length > 0) {
          await sleep(200);
        }
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      totalRequests: this.requestCount,
    };
  }
}

// Global API queue instance
const apiQueue = new APIQueue();

// Export queue stats for debugging
export const getAPIQueueStats = () => apiQueue.getStats();

/**
 * Clear all FlexiRecord-related caches from localStorage
 * Useful after fixing authentication issues or when data becomes stale
 * @returns {Object} Summary of cleared cache entries
 * 
 * @example
 * const result = clearFlexiRecordCaches();
 * console.log(`Cleared ${result.clearedLocalStorageKeys} cache entries`);
 */
export function clearFlexiRecordCaches() {
  // Clearing all flexirecord caches
  
  // Clear localStorage caches (especially consolidated cache which shouldn't exist)
  const keys = Object.keys(localStorage);
  const flexiKeys = keys.filter(key => 
    key.includes('viking_flexi_records_') || 
    key.includes('viking_flexi_structure_') ||
    key.includes('viking_flexi_consolidated_'),
  );
  
  // Log what we're clearing for debugging
  const consolidatedKeys = flexiKeys.filter(key => key.includes('viking_flexi_consolidated_'));
  if (consolidatedKeys.length > 0) {
    logger.info('Clearing old consolidated cache entries', {
      count: consolidatedKeys.length,
      keys: consolidatedKeys,
    }, LOG_CATEGORIES.API);
  }
  
  flexiKeys.forEach(key => {
    localStorage.removeItem(key);
    logger.debug('Removed localStorage key', { key }, LOG_CATEGORIES.API);
  });
  
  // Cleared flexirecord cache entries
  
  return {
    clearedLocalStorageKeys: flexiKeys.length,
  };
}

// Network status checking with proper initialization
let isOnline = true;

// Initialize network status properly on startup
(async () => {
  try {
    isOnline = await checkNetworkStatus();
    logger.info('Initial network status', {
      status: isOnline ? 'Online' : 'Offline',
    }, LOG_CATEGORIES.API);
    
    // Then set up monitoring for changes
    addNetworkListener((status) => {
      isOnline = status.connected;
      logger.info('Network status changed', {
        status: status.connected ? 'Online' : 'Offline',
      }, LOG_CATEGORIES.API);
    });
  } catch (error) {
    logger.warn('Failed to initialize network status, assuming online', {
      error: error.message,
    }, LOG_CATEGORIES.API);
    isOnline = true;
  }
})();


/**
 * Enhanced rate limit monitoring for OSM API responses
 * Logs warnings when rate limits are approaching critical thresholds
 * @param {Object} responseData - API response data containing rate limit info
 * @param {string} apiName - Name of the API call for logging context
 */
function logRateLimitInfo(responseData, apiName) {
  if (responseData && responseData._rateLimitInfo) {
    const info = responseData._rateLimitInfo;
        
    if (info.osm) {
      const osm = info.osm;
      const percentUsed = osm.limit > 0 ? ((osm.limit - osm.remaining) / osm.limit * 100).toFixed(1) : 0;
            
      // Rate limit monitoring active
            
      if (osm.remaining < 20 && osm.limit > 0) {
        logger.warn('OSM rate limit warning', {
          apiName,
          remaining: osm.remaining,
          percentUsed,
        }, LOG_CATEGORIES.API);
      }
            
      if (osm.remaining < 10 && osm.limit > 0) {
        logger.error('CRITICAL: Low OSM requests remaining', {
          apiName,
          remaining: osm.remaining,
          percentUsed,
        }, LOG_CATEGORIES.API);
      }
    }
        
    if (info.backend) {
      // Backend rate limit info available
    }
  } else {
    // No rate limit info available
  }
}

/**
 * Enhanced API response handler with comprehensive error handling
 * Manages rate limiting, authentication, and Sentry monitoring
 * @param {Response} response - Fetch API response object
 * @param {string} apiName - Name of the API call for logging and monitoring
 * @returns {Promise<Object>} Parsed JSON response data
 * @throws {Error} For rate limits, auth failures, or API errors
 */
async function handleAPIResponseWithRateLimit(response, apiName) {
  // Add breadcrumb for API call
  sentryUtils.addBreadcrumb({
    type: 'http',
    level: 'info',
    message: `API call: ${apiName}`,
    data: {
      method: response.request?.method || 'GET',
      url: response.url,
      status_code: response.status,
    },
  });

  if (response.status === 429) {
    const errorData = await response.json().catch(() => ({}));
        
    // Log rate limiting to Sentry
    logger.warn(logger.fmt`Rate limit hit for API: ${apiName}`, {
      api: apiName,
      status: response.status,
      retryAfter: errorData.rateLimitInfo?.retryAfter,
    });
        
    // Create error object that RateLimitQueue can handle
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.status = 429;
    
    if (errorData.rateLimitInfo) {
      const retryAfter = errorData.rateLimitInfo.retryAfter;
      logger.warn(`${apiName} rate limited by OSM`, { retryAfter }, LOG_CATEGORIES.API);
      
      // Set retryAfter for RateLimitQueue to use
      if (retryAfter) {
        rateLimitError.retryAfter = retryAfter;
        rateLimitError.message = `OSM API rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`;
      } else {
        rateLimitError.message = 'OSM API rate limit exceeded. Please wait before trying again.';
      }
    } else {
      // Backend rate limiting - extract from backend response format
      const backendRetryAfter = errorData.rateLimit?.retryAfter;
      if (backendRetryAfter) {
        rateLimitError.retryAfter = backendRetryAfter;
        rateLimitError.message = `Backend rate limit exceeded. Please wait ${backendRetryAfter} seconds.`;
      } else {
        rateLimitError.message = 'Rate limited. The backend is managing request flow to prevent blocking.';
      }
      logger.warn(`${apiName} rate limited by backend`, { retryAfter: backendRetryAfter }, LOG_CATEGORIES.API);
    }
    
    throw rateLimitError;
  }
    
  // Simple auth handling with circuit breaker
  if (!authHandler.handleAPIResponse(response, apiName)) {
    const error = new Error('Authentication failed');
    error.status = response.status;
    throw error;
  }
    
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        
    if (errorMessage && typeof errorMessage === 'string') {
      const errorLower = errorMessage.toLowerCase();
      if (errorLower.includes('blocked') || errorLower.includes('permanently blocked')) {
        logger.error('CRITICAL: OSM API BLOCKED', {
          apiName,
          errorMessage,
        }, LOG_CATEGORIES.API);
        sessionStorage.setItem('osm_blocked', 'true');
        throw new Error(`OSM API BLOCKED: ${errorMessage}`);
      }
    }
        
    logger.error('API error', {
      apiName,
      errorMessage,
    }, LOG_CATEGORIES.API);
    throw new Error(`${apiName} failed: ${errorMessage}`);
  }
    
  try {
    const data = await response.json();
    logRateLimitInfo(data, apiName);
    return data;
  } catch {
    logger.error(`${apiName} returned invalid JSON`, {}, LOG_CATEGORIES.API);
    throw new Error(`${apiName} returned invalid response`);
  }
}

// Terms cache TTL - localStorage only for persistence
const TERMS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// FlexiRecord caching is now handled by flexiRecordService.js

/**
 * Retrieves OSM terms data with caching and offline support
 * @param {string} token - OSM authentication token
 * @param {boolean} [forceRefresh=false] - Force refresh from API instead of using cache
 * @returns {Promise<Object>} Terms data from OSM API
 * @throws {Error} When token is missing or API request fails
 * 
 * @example
 * const terms = await getTerms(userToken);
 * const freshTerms = await getTerms(userToken, true);
 */
// API functions
export async function getTerms(token, forceRefresh = false) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = 'viking_terms_offline';
      const cached = safeGetItem(cacheKey, { items: [] });
      if (import.meta.env.DEV) {
        logger.debug('Demo mode: Using cached terms data', {
          termsCount: cached.items?.length || 0,
        }, LOG_CATEGORIES.API);
      }
      return cached;
    }
    
    const cacheKey = 'viking_terms_offline';
    
    // Check network status first
    isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cached = safeGetItem(cacheKey, null);
      if (cached && cached._cacheTimestamp) {
        const cacheAge = Date.now() - cached._cacheTimestamp;
        if (cacheAge < TERMS_CACHE_TTL) {
          logger.info('Using cached terms data', { 
            cacheAgeMinutes: Math.round(cacheAge / 60000),
          }, LOG_CATEGORIES.API);
          return cached;
        }
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(cacheKey, {});
      logger.info('Retrieved terms from localStorage while offline', {}, LOG_CATEGORIES.API);
      return cached;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/get-terms`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return await handleAPIResponseWithRateLimit(response, 'getTerms');
    });
    const terms = data || {};
    
    // Cache terms data with timestamp
    // Cache terms data - enhanced error handling for visibility  
    try {
      const cachedTerms = {
        ...terms,
        _cacheTimestamp: Date.now(),
      };
      const success = safeSetItem(cacheKey, cachedTerms);
      if (success) {
        logger.info('Terms successfully cached', {
          cacheKey,
          termCount: Array.isArray(terms) 
            ? terms.length 
            : (terms?.items?.length ?? Object.keys(terms || {}).length),
          dataSize: JSON.stringify(cachedTerms).length,
        }, LOG_CATEGORIES.API);
      } else {
        logger.error('Terms caching failed - safeSetItem returned false', {
          cacheKey,
          termCount: Array.isArray(terms) 
            ? terms.length 
            : (terms?.items?.length ?? Object.keys(terms || {}).length),
          dataSize: JSON.stringify(cachedTerms).length,
        }, LOG_CATEGORIES.ERROR);
      }
    } catch (cacheError) {
      logger.error('Terms caching error', {
        cacheKey,
        error: cacheError.message,
        termCount: Array.isArray(terms) 
          ? terms.length 
          : (terms?.items?.length ?? Object.keys(terms || {}).length),
      }, LOG_CATEGORIES.ERROR);
    }
    
    return terms; // Return original data without timestamp
    
  } catch (error) {
    logger.error('Error fetching terms', {
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);
    
    // If online request fails, try localStorage as fallback
    if (isOnline) {
      try {
        const cached = safeGetItem('viking_terms_offline', {});
        logger.warn('Using cached terms after API failure', {}, LOG_CATEGORIES.API);
        return cached;
      } catch (cacheError) {
        logger.error('Cache fallback also failed', {
          error: cacheError.message,
        }, LOG_CATEGORIES.ERROR);
      }
    }
    
    throw error;
  }
}

/**
 * Fetches the most recent term ID for a specific section
 * @param {number|string} sectionId - OSM section identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<string|null>} Most recent term ID or null if not found
 * @throws {Error} When API request fails or term cannot be determined
 * 
 * @example
 * const termId = await fetchMostRecentTermId(123, userToken);
 */
export async function fetchMostRecentTermId(sectionId, token) {
  return apiQueue.add(async () => {
    try {
      const terms = await getTerms(token);
      return getMostRecentTermId(sectionId, terms);
    } catch (error) {
      logger.error('Error fetching most recent term ID', { sectionId, error: error.message }, LOG_CATEGORIES.API);
      throw error;
    }
  });
}

/**
 * Helper function to retrieve user info with multiple fallback strategies
 * Tries startup data API first, then cache, then existing auth data
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} User info object with firstname, lastname, userid, email
 * @throws {Error} When no user info can be retrieved from any source
 * 
 * @example
 * const user = await retrieveUserInfo(token);
 * console.log(`Welcome ${user.firstname} ${user.lastname}`);
 */
async function retrieveUserInfo(token) {
  // First try to get from startup data API which contains user info
  try {
    const startupData = await getStartupData(token);
    if (startupData && startupData.globals) {
      const userInfo = {
        firstname: startupData.globals.firstname || 'Scout Leader',
        lastname: startupData.globals.lastname || '',
        userid: startupData.globals.userid || null,
        email: startupData.globals.email || null,
      };
      
      logger.info('User info found in startup data', { firstname: userInfo.firstname });
      return userInfo;
    } else {
      throw new Error('No globals data in startup response');
    }
  } catch (startupError) {
    logger.warn('Failed to get startup data for user info:', startupError.message);
    
    // Fallback: try to get from cache/localStorage  
    const cachedStartupData = safeGetItem('viking_startup_data_offline');
    if (cachedStartupData && cachedStartupData.globals) {
      const userInfo = {
        firstname: cachedStartupData.globals.firstname || 'Scout Leader',
        lastname: cachedStartupData.globals.lastname || '',
        userid: cachedStartupData.globals.userid || null,
        email: cachedStartupData.globals.email || null,
      };
      
      logger.info('User info found in cached startup data', { firstname: userInfo.firstname });
      return userInfo;
    } else {
      // Don't overwrite existing user info if we can't find it
      const authService = await import('./auth.js');
      const existingUserInfo = authService.getUserInfo();
      
      if (!existingUserInfo) {
        // Ultimate fallback - only if no existing user info
        const fallbackUserInfo = {
          firstname: 'Scout Leader',
          lastname: '',
          userid: null,
          email: null,
        };
        logger.warn('Created fallback user info - no startup data available');
        return fallbackUserInfo;
      } else {
        logger.info('Keeping existing user info', { firstname: existingUserInfo.firstname });
        return existingUserInfo;
      }
    }
  }
}

// Optimized version that uses pre-loaded terms to avoid multiple API calls

/**
 * Retrieves user roles and section information from OSM API
 * Includes comprehensive error handling with offline fallbacks
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Array of sections with permissions and details
 * @throws {Error} When authentication fails and no cached data available
 * 
 * @example
 * const sections = await getUserRoles(userToken);
 * sections.forEach(section => {
 *   console.log(`${section.sectionname}: ${section.sectionid}`);
 * });
 */
export async function getUserRoles(token) {
  // Skip API calls in demo mode - use cached data only
  const demoMode = isDemoMode();
  if (demoMode) {
    const cacheKey = 'viking_user_roles_offline';
    const cached = safeGetItem(cacheKey, { sections: [] });
    const sections = cached.sections || [];
    if (import.meta.env.DEV) {
      logger.debug('Demo mode: Using cached user roles', {
        sectionsCount: sections.length,
      }, LOG_CATEGORIES.API);
    }
    return sections;
  }

  return sentryUtils.startSpan(
    {
      op: 'http.client',
      name: 'GET /api/ext/members/contact/grid/?action=getUserRoles',
    },
    async (span) => {
      try {
        // Add context to span
        span.setAttribute('api.endpoint', 'getUserRoles');
        span.setAttribute('offline_capable', true);
                
        logger.debug('Fetching user roles', { hasToken: !!token });
                
        // Check network status first
        isOnline = await checkNetworkStatus();
        span.setAttribute('network.online', isOnline);
                
        // If offline, try to get from local database
        if (!isOnline) {
          logger.info('Offline mode - retrieving sections from local database');
          span.setAttribute('data.source', 'local_database');
                    
          const sections = await databaseService.getSections();
          return sections;
        }

        if (!token) {
          throw new Error('No authentication token');
        }

        // Simple circuit breaker - use cache if auth already failed
        if (!authHandler.shouldMakeAPICall()) {
          logger.info('Auth failed this session - using cached sections only');
          span.setAttribute('data.source', 'local_database_auth_failed');
          const sections = await databaseService.getSections();
          return sections;
        }

        span.setAttribute('data.source', 'api');
        // Making request to fetch user roles

        const data = await withRateLimitQueue(async () => {
          const response = await fetch(`${BACKEND_URL}/get-user-roles`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          return await handleAPIResponseWithRateLimit(response, 'getUserRoles');
        });

        if (!data || typeof data !== 'object') {
          logger.warn('Invalid data received from getUserRoles API');
          return [];
        }

        // Get user information from startup data (getUserRoles doesn't contain user info)
        const userInfo = await retrieveUserInfo(token);
        const authService = await import('./auth.js');
        authService.setUserInfo(userInfo);

        const sections = Object.keys(data)
          .filter(key => Number.isInteger(Number(key)) && key !== '')
          .map(key => ({ ...data[key], originalKey: key }))
          .filter(item => item && typeof item === 'object')
          .map(item => {
            // Robust section ID parsing with fallbacks
            let sectionId = item.sectionid;
            if (sectionId === null || sectionId === undefined || sectionId === '') {
              // Try alternative field names that might be used
              sectionId = item.section_id || item.id || item.originalKey;
              logger.debug('Using fallback section ID', {
                originalId: item.sectionid,
                fallbackId: sectionId,
                originalKey: item.originalKey,
              }, LOG_CATEGORIES.API);
            }
            
            const parsedSectionId = parseInt(sectionId, 10);
            if (isNaN(parsedSectionId)) {
              logger.warn('Invalid section ID detected, filtering out', {
                originalId: item.sectionid,
                fallbackId: sectionId,
                originalKey: item.originalKey,
                itemKeys: Object.keys(item),
              }, LOG_CATEGORIES.API);
              return null; // Will be filtered out
            }
            
            return {
              sectionid: parsedSectionId,
              sectionname: item.sectionname || `Section ${parsedSectionId}`,
              section: item.section || item.sectionname,
              sectiontype: item.section || item.sectionname, // Map section to sectiontype for database
              isDefault: item.isDefault === '1' || item.isDefault === 1,
              permissions: item.permissions || {},
            };
          })
          .filter(Boolean); // Remove null entries

        // Save to local database when online
        if (sections.length > 0) {
          await databaseService.saveSections(sections);
          logger.info(logger.fmt`Saved ${sections.length} sections to local database`);
        }

        span.setAttribute('sections.count', sections.length);
        return sections;

      } catch (error) {
        logger.error('Error fetching user roles', { 
          error: error.message,
          isOnline,
          hasToken: !!token, 
        });
                
        // Capture exception with context
        sentryUtils.captureException(error, {
          api: {
            endpoint: 'getUserRoles',
            online: isOnline,
            hasToken: !!token,
          },
        });
        
        // If online request fails (including auth errors), try local database as fallback
        if (isOnline) {
          logger.info('Online request failed - trying local database as fallback', {
            errorType: error.status === 401 || error.status === 403 ? 'auth' : 'other',
          });
          span.setAttribute('fallback.used', true);
          span.setAttribute('fallback.reason', error.status === 401 || error.status === 403 ? 'auth_error' : 'other_error');
                    
          try {
            const sections = await databaseService.getSections();
            if (sections && sections.length > 0) {
              logger.info(`Using cached sections data (${sections.length} sections) after API failure`);
              span.setAttribute('fallback.successful', true);
              return sections;
            } else {
              logger.warn('No cached sections available for fallback');
            }
          } catch (dbError) {
            logger.error('Database fallback also failed', { error: dbError.message });
            span.setAttribute('fallback.successful', false);
          }
        }
                
        throw error;
      }
    },
  );
}

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
    isOnline = await checkNetworkStatus();
        
    // If offline, get from local database
    if (!isOnline) {
      const events = await databaseService.getEvents(sectionId);
      return events;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      logger.info('Auth failed - using cached events only', { sectionId, termId }, LOG_CATEGORIES.API);
      const events = await databaseService.getEvents(sectionId);
      return events;
    }

    const data = await withRateLimitQueue(async () => {
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
    const filteredEvents = events.filter(event => !event.eventid || !event.eventid.startsWith('demo_event_'));

    // Save to local database when online (even if empty to cache the result)
    await databaseService.saveEvents(sectionId, filteredEvents);

    return filteredEvents;

  } catch (error) {
    logger.error('Error fetching events', { sectionId, termId, error: error.message }, LOG_CATEGORIES.API);
        
    // If online request fails, try local database as fallback
    if (isOnline) {
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
    isOnline = await checkNetworkStatus();
        
    // If offline, get from local database
    if (!isOnline) {
      const attendance = await databaseService.getAttendance(eventId);
      return attendance;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      logger.info('Auth failed - using cached attendance only', { eventId }, LOG_CATEGORIES.API);
      const attendance = await databaseService.getAttendance(eventId);
      return attendance;
    }

    const data = await withRateLimitQueue(async () => {
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
    if (isOnline) {
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
 * Retrieves FlexiRecord definitions for a section with caching support
 * @param {number|string} sectionId - OSM section identifier
 * @param {string} token - OSM authentication token
 * @param {string} [archived='n'] - Include archived records ('y' or 'n')
 * @param {boolean} [forceRefresh=false] - Force refresh bypassing cache
 * @returns {Promise<Object>} FlexiRecord list with items array
 * @throws {Error} When API request fails and no cached data available
 * 
 * @example
 * const flexiRecords = await getFlexiRecords(123, token);
 * console.log(`Found ${flexiRecords.items.length} FlexiRecords`);
 */
export async function getFlexiRecords(sectionId, token, archived = 'n', forceRefresh = false) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = `viking_flexi_lists_${sectionId}_offline`;
      const cached = safeGetItem(cacheKey, { items: [] });
      return cached;
    }
    
    const storageKey = `viking_flexi_records_${sectionId}_archived_${archived}_offline`;
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cached = safeGetItem(storageKey, null);
      if (cached && cached._cacheTimestamp) {
        const cacheAge = Date.now() - cached._cacheTimestamp;
        const FLEXI_RECORDS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
        if (cacheAge < FLEXI_RECORDS_CACHE_TTL) {
          // Using cached flexi records
          return cached;
        }
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(storageKey, { identifier: null, label: null, items: [] });
      // Retrieved flexi records from localStorage while offline
      return cached;
    }
        
    if (!token) {
      throw new Error('No authentication token');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      // Auth failed - using cached flexi records only
      const cached = safeGetItem(storageKey, null);
      // Validate cached data has meaningful content
      if (cached && cached.items && Array.isArray(cached.items)) {
        return cached;
      }
      // Return valid default structure if no meaningful cache exists
      return { identifier: null, label: null, items: [] };
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/get-flexi-records?sectionid=${sectionId}&archived=${archived}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return await handleAPIResponseWithRateLimit(response, 'getFlexiRecords');
    });
        
    let flexiData;
    if (data && data._rateLimitInfo) {
      const { _rateLimitInfo, ...responseData } = data;
      flexiData = responseData || { identifier: null, label: null, items: [] };
    } else {
      flexiData = data || { identifier: null, label: null, items: [] };
    }
    
    // Cache data with timestamp - enhanced error handling like getMembersGrid fix
    try {
      const cachedData = {
        ...flexiData,
        _cacheTimestamp: Date.now(),
      };
      const success = safeSetItem(storageKey, cachedData);
      if (success) {
        // FlexiRecord list successfully cached
      } else {
        logger.error('FlexiRecord list caching failed - safeSetItem returned false', {
          storageKey,
          itemCount: flexiData.items?.length || 0,
          dataSize: JSON.stringify(cachedData).length,
        }, LOG_CATEGORIES.ERROR);
      }
    } catch (cacheError) {
      logger.error('FlexiRecord list caching error', {
        storageKey,
        error: cacheError.message,
        itemCount: flexiData.items?.length || 0,
      }, LOG_CATEGORIES.ERROR);
    }
    
    return flexiData; // Return original data without timestamp

  } catch (error) {
    logger.error('Error fetching flexi records', { error: error.message }, LOG_CATEGORIES.API);
    
    // Don't cache error responses - only return existing cache as fallback
    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const storageKey = `viking_flexi_records_${sectionId}_archived_${archived}_offline`;
        const cached = safeGetItem(storageKey, { identifier: null, label: null, items: [] });
        logger.info('Using cached fallback data after API error', {}, LOG_CATEGORIES.API);
        return cached;
      } catch (cacheError) {
        logger.error('Cache fallback failed', { cacheError: cacheError.message }, LOG_CATEGORIES.API);
      }
    }
    
    throw error;
  }
}

/**
 * Retrieves data for a single FlexiRecord
 * @param {number|string} flexirecordid - FlexiRecord identifier
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} termid - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} FlexiRecord data with member values
 * @throws {Error} When API request fails or authentication fails
 * 
 * @example
 * const flexiData = await getSingleFlexiRecord(456, 123, '789', token);
 * console.log(`FlexiRecord has ${flexiData.items.length} member entries`);
 */
export async function getSingleFlexiRecord(flexirecordid, sectionid, termid, token) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = `viking_flexi_data_${flexirecordid}_${sectionid}_${termid}_offline`;
      const cached = safeGetItem(cacheKey, { items: [] });
      return cached;
    }
    
    if (!token) {
      throw new Error('No authentication token');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      // Auth failed - getSingleFlexiRecord blocked
      throw new Error('Authentication failed - unable to fetch flexi record data');
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/get-single-flexi-record?flexirecordid=${flexirecordid}&sectionid=${sectionid}&termid=${termid}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      return await handleAPIResponseWithRateLimit(response, 'getSingleFlexiRecord');
    });
        
    if (data && data._rateLimitInfo) {
      const { _rateLimitInfo, ...flexiData } = data;
      return flexiData || { identifier: null, items: [] };
    }
        
    return data || { identifier: null, items: [] };
        
  } catch (error) {
    logger.error('Error fetching single flexi record', { error: error.message }, LOG_CATEGORIES.API);
    throw error;
  }
}

/**
 * Retrieves FlexiRecord structure definition with field mappings
 * @param {number|string} extraid - FlexiRecord external ID (same as flexirecordid)
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} termid - OSM term identifier
 * @param {string} token - OSM authentication token
 * @param {boolean} [forceRefresh=false] - Force refresh bypassing cache
 * @returns {Promise<Object|null>} Structure definition with field mappings or null
 * @throws {Error} When API request fails
 * 
 * @example
 * const structure = await getFlexiStructure(456, 123, '789', token);
 * if (structure) {
 *   console.log(`Structure: ${structure.name}`);
 * }
 */
export async function getFlexiStructure(extraid, sectionid, termid, token, forceRefresh = false) {
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cacheKey = `viking_flexi_structure_${extraid}_offline`;
      const cached = safeGetItem(cacheKey, null);
      return cached;
    }
    
    const storageKey = `viking_flexi_structure_${extraid}_offline`;
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // Check if we have valid cached data (unless force refresh)
    if (!forceRefresh && isOnline) {
      const cached = safeGetItem(storageKey, null);
      if (cached && cached._cacheTimestamp) {
        const cacheAge = Date.now() - cached._cacheTimestamp;
        const FLEXI_STRUCTURES_CACHE_TTL = 60 * 60 * 1000; // 60 minutes
        if (cacheAge < FLEXI_STRUCTURES_CACHE_TTL) {
          // Using cached flexi structure
          return cached;
        }
      }
    }
    
    // If offline, get from localStorage regardless of age
    if (!isOnline) {
      const cached = safeGetItem(storageKey, null);
      if (cached) {
        logger.info('Retrieved structure from localStorage while offline', { 
          extraid,
          structureName: cached.name,
        }, LOG_CATEGORIES.OFFLINE);
        return cached;
      }
      return null;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      // Auth failed - getFlexiStructure blocked
      const cached = safeGetItem(storageKey, null);
      // Validate cached data exists and has meaningful content
      if (cached && typeof cached === 'object' && cached.name) {
        return cached;
      }
      // Return null for structure - caller should handle this case
      return null;
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/get-flexi-structure?flexirecordid=${extraid}&sectionid=${sectionid}&termid=${termid}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json', 
        },
      });
      
      return await handleAPIResponseWithRateLimit(response, 'getFlexiStructure');
    });
    const structureData = data || null;
    
    // Cache data for offline use - enhanced error handling like getMembersGrid fix
    if (structureData) {
      try {
        const cachedData = {
          ...structureData,
          _cacheTimestamp: Date.now(),
        };
        const success = safeSetItem(storageKey, cachedData);
        if (success) {
          // FlexiRecord structure successfully cached
        } else {
          logger.error('FlexiRecord structure caching failed - safeSetItem returned false', {
            storageKey,
            structureName: structureData.name || 'Unknown',
            dataSize: JSON.stringify(cachedData).length,
          }, LOG_CATEGORIES.ERROR);
        }
      } catch (cacheError) {
        logger.error('FlexiRecord structure caching error', {
          storageKey,
          error: cacheError.message,
          structureName: structureData.name || 'Unknown',
        }, LOG_CATEGORIES.ERROR);
      }
    }
    
    return structureData;
    
  } catch (error) {
    logger.error('Error fetching flexi structure', { error: error.message }, LOG_CATEGORIES.API);
    
    // Don't cache error responses - only return existing cache as fallback
    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const storageKey = `viking_flexi_structure_${extraid}_offline`;
        const cacheData = safeGetItem(storageKey, null);
        logger.info('Using cached fallback data after API error, not updating cache timestamp', {}, LOG_CATEGORIES.API);
        return cacheData;
      } catch (cacheError) {
        logger.error('Cache fallback failed', { cacheError: cacheError.message }, LOG_CATEGORIES.API);
      }
    }
    
    throw error;
  }
}

/**
 * Retrieves OSM startup data including user information and globals
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object|null>} Startup data with user info and globals
 * @throws {Error} When authentication fails (401/403) - non-auth errors use cache fallback
 * 
 * @example
 * const startup = await getStartupData(token);
 * if (startup?.globals) {
 *   console.log(`Welcome ${startup.globals.firstname}`);
 * }
 */
export async function getStartupData(token) {
  try {
    // Check network status first
    isOnline = await checkNetworkStatus();
    
    // If offline, get from localStorage
    if (!isOnline) {
      return safeGetItem('viking_startup_data_offline', null);
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-startup-data`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 
      },
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'getStartupData');
    const startupData = data || null;
    
    // Cache startup data for offline use - enhanced error handling
    if (startupData) {
      try {
        const success = safeSetItem('viking_startup_data_offline', startupData);
        if (success) {
          logger.info('Startup data successfully cached', {
            dataSize: JSON.stringify(startupData).length,
            hasRoles: !!(startupData.roles),
            roleCount: startupData.roles?.length || 0,
          }, LOG_CATEGORIES.API);
        } else {
          logger.error('Startup data caching failed - safeSetItem returned false', {
            dataSize: JSON.stringify(startupData).length,
          }, LOG_CATEGORIES.ERROR);
        }
      } catch (cacheError) {
        logger.error('Startup data caching error', {
          error: cacheError.message,
          hasRoles: !!(startupData.roles),
        }, LOG_CATEGORIES.ERROR);
      }
    }
    
    return startupData;
        
  } catch (error) {
    logger.error('Error fetching startup data', { error: error.message }, LOG_CATEGORIES.API);
    
    // Don't fall back to cache for authentication errors - these need to be handled by auth system
    if (error.status === 401 || error.status === 403) {
      logger.error('Authentication error - not using cache fallback', {}, LOG_CATEGORIES.API);
      throw error;
    }
    
    // If online request fails (non-auth errors), try localStorage as fallback
    if (isOnline) {
      try {
        return safeGetItem('viking_startup_data_offline', null);
      } catch (cacheError) {
        logger.error('Cache fallback failed', { cacheError: cacheError.message }, LOG_CATEGORIES.API);
      }
    }
    
    throw error;
  }
}

/**
 * Updates a FlexiRecord field value for a specific member
 * Requires valid authentication and write permissions
 * @param {number|string} sectionid - OSM section identifier
 * @param {number|string} scoutid - Member identifier
 * @param {number|string} flexirecordid - FlexiRecord identifier
 * @param {number|string} columnid - Field column identifier
 * @param {string} value - New field value
 * @param {number|string} termid - OSM term identifier
 * @param {string} section - Section name for context
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object|null>} Update response data
 * @throws {Error} When write permissions denied or API request fails
 * 
 * @example
 * await updateFlexiRecord(123, 456, 789, 'f_1', 'Blue Group', '2024', 'Beavers', token);
 */
export async function updateFlexiRecord(sectionid, scoutid, flexirecordid, columnid, value, termid, section, token) {
  // Demo mode protection
  if (isDemoMode()) {
    logger.info('Demo mode: Simulating updateFlexiRecord success', {
      scoutid,
      flexirecordid,
      columnid,
      value,
    }, LOG_CATEGORIES.API);
    return {
      ok: true,
      success: true,
      message: 'Demo mode: FlexiRecord update simulated',
    };
  }
  
  try {
    // Import the guard function
    const { checkWritePermission } = await import('./auth.js');
    
    // Check if write operations are allowed (blocks offline writes with expired token)
    checkWritePermission();
    
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/update-flexi-record`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 
      },
      body: JSON.stringify({
        sectionid,
        scoutid,
        flexirecordid,
        columnid,
        value,
        termid,
        section,
      }),
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'updateFlexiRecord');
    return data || null;
        
  } catch (error) {
    logger.error('Error updating flexi record', { error: error.message }, LOG_CATEGORIES.API);
    throw error;
  }
}

/**
 * Multi-update FlexiRecord field for multiple members in a single batch operation
 * Updates the same field value for multiple scouts efficiently
 * 
 * @param {number|string} sectionid - OSM section identifier  
 * @param {Array<string|number>} scouts - Array of scout/member IDs to update
 * @param {string} value - New field value to set for all scouts
 * @param {string} column - Field column ID (e.g., "f_1", "f_2")
 * @param {number|string} flexirecordid - FlexiRecord identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object|null>} Update response with success status and updated count
 * @throws {Error} When write permissions denied or API request fails
 * 
 * @example
 * await multiUpdateFlexiRecord(123, ['456', '789'], 'Yellow', 'f_1', '999', token);
 */
export async function multiUpdateFlexiRecord(sectionid, scouts, value, column, flexirecordid, token) {
  // Demo mode protection
  if (isDemoMode()) {
    logger.info('Demo mode: Simulating multiUpdateFlexiRecord success', {
      sectionid,
      flexirecordid,
      column,
      value,
      scoutCount: Array.isArray(scouts) ? scouts.length : 0,
    }, LOG_CATEGORIES.API);
    return {
      ok: true,
      success: true,
      message: `Demo mode: Multi-update simulated for ${Array.isArray(scouts) ? scouts.length : 0} scouts`,
    };
  }
  
  try {
    // Import the guard function
    const { checkWritePermission } = await import('./auth.js');
    
    // Check if write operations are allowed
    checkWritePermission();
    
    if (!token) {
      throw new Error('No authentication token');
    }

    if (!Array.isArray(scouts) || scouts.length === 0) {
      throw new Error('Scouts array is required and must not be empty');
    }

    const requestBody = {
      sectionid,
      scouts,
      value,
      column,
      flexirecordid,
    };

    // Multi-updating FlexiRecord field

    const response = await fetch(`${BACKEND_URL}/multi-update-flexi-record`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 
      },
      body: JSON.stringify(requestBody),
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'multiUpdateFlexiRecord');
    
    if (data?.data?.success) {
      // Multi-update FlexiRecord successful
    }
    
    return data || null;
        
  } catch (error) {
    logger.error('Error multi-updating flexi record', { 
      error: error.message,
      sectionid,
      scoutCount: scouts?.length,
      value,
      column,
    }, LOG_CATEGORIES.API);
    throw error;
  }
}

// FlexiRecord functions - re-export from service and transforms
export { 
  getConsolidatedFlexiRecord,
} from './flexiRecordService.js';

export { 
  parseFlexiStructure,
  transformFlexiRecordData,
  extractVikingEventFields,
} from '../utils/flexiRecordTransforms.js';

/**
 * Retrieves comprehensive member data for a section using the enhanced grid API
 * Includes contact information, patrol assignments, and member status
 * @param {number|string} sectionId - OSM section identifier
 * @param {number|string} termId - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Array of member objects with normalized data
 * @throws {Error} When API request fails and no cached data available
 * 
 * @example
 * const members = await getMembersGrid(123, '456', token);
 * members.forEach(member => {
 *   console.log(`${member.firstname} ${member.lastname} (${member.person_type})`);
 * });
 */
export async function getMembersGrid(sectionId, termId, token) {
  try {
    // Check network status first
    isOnline = await checkNetworkStatus();
    
    // If offline, get from local database (fallback to old format)
    if (!isOnline) {
      const cachedMembers = await databaseService.getMembers([sectionId]);
      return cachedMembers;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      logger.info('Auth failed - using cached members only', { sectionId }, LOG_CATEGORIES.API);
      const cachedMembers = await databaseService.getMembers([sectionId]);
      return cachedMembers;
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/get-members-grid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          section_id: sectionId,
          term_id: termId,
        }),
      });
      
      return await handleAPIResponseWithRateLimit(response, 'getMembersGrid');
    });
    
    // Transform the grid data into a more usable format
    if (data && data.data && data.data.members) {
      const transformedMembers = (Array.isArray(data?.data?.members) ? data.data.members : [])
        .map(member => {
          const scoutId = Number(member.member_id ?? member.scoutid);
          const sectionIdNum = Number(member.section_id ?? member.sectionid);
          const patrolId = Number(member.patrol_id ?? member.patrolid);
          let person_type = 'Young People';
          if (patrolId === -2) person_type = 'Leaders';
          else if (patrolId === -3) person_type = 'Young Leaders';

          return {
            ...member,
            // Core member info (normalised)
            scoutid: scoutId,
            member_id: scoutId,
            firstname: member.first_name ?? member.firstname,
            lastname: member.last_name ?? member.lastname,
            date_of_birth: member.date_of_birth ?? member.dob,
            age: typeof member.age === 'string' ? Number(member.age) : member.age,
            // Section info
            sectionid: sectionIdNum,
            patrol: member.patrol,
            patrol_id: patrolId,
            person_type,
            started: member.started,
            joined: member.joined,
            active: member.active,
            end_date: member.end_date,
            // Photo info
            photo_guid: member.photo_guid,
            has_photo: (() => {
              const v = member.has_photo ?? member.pic ?? member.photo_guid;
              return typeof v === 'string'
                ? ['1', 'y', 'true'].includes(v.toLowerCase())
                : Boolean(v);
            })(),
            // Backward-compatible grouped contacts
            contact_groups: member.contact_groups,
          };
        })
        .filter(m => Number.isFinite(m.scoutid) && Number.isFinite(m.sectionid));
      
      // CRITICAL FIX: Save the transformed members to cache
      try {
        await databaseService.saveMembers([sectionId], transformedMembers);
        logger.info('Members successfully cached', {
          sectionId,
          memberCount: transformedMembers.length,
        }, LOG_CATEGORIES.API);
      } catch (saveError) {
        logger.error('Failed to save members to cache', {
          sectionId,
          error: saveError.message,
          memberCount: transformedMembers.length,
        }, LOG_CATEGORIES.ERROR);
        // Don't throw - return the data even if caching fails
      }
      
      return transformedMembers;
    }

    return [];

  } catch (error) {
    logger.error('Error fetching members grid', { sectionId, error: error.message }, LOG_CATEGORIES.API);
    
    // If online request fails, try local database as fallback
    if (isOnline) {
      try {
        const cachedMembers = await databaseService.getMembers([sectionId]);
        return cachedMembers;
      } catch (dbError) {
        logger.error('Database fallback failed', { dbError: dbError.message }, LOG_CATEGORIES.API);
      }
    }
    
    throw error;
  }
}

// Note: extractContactField and extractEmergencyContacts functions removed
// The backend now provides all custom_data fields as flattened properties
// using the actual group names and column labels from OSM metadata

/**
 * Retrieves members across multiple sections with deduplication
 * Optimized to load terms once and reuse for all sections
 * @param {Array<Object>} sections - Array of section objects with sectionid
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Deduplicated array of members with section assignments
 * @throws {Error} When offline with no cached data or API requests fail
 * 
 * @example
 * const allMembers = await getListOfMembers([
 *   { sectionid: 123, sectionname: 'Beavers' },
 *   { sectionid: 456, sectionname: 'Cubs' }
 * ], token);
 * console.log(`Total unique members: ${allMembers.length}`);
 */
export async function getListOfMembers(sections, token) {
  // Check network status first
  isOnline = await checkNetworkStatus();
  
  // Filter out sections with invalid IDs upfront
  const validSections = sections.filter(section => {
    if (!section.sectionid || section.sectionid === null || section.sectionid === undefined) {
      logger.warn('Filtering out section with invalid ID', {
        section: section,
        sectionKeys: Object.keys(section || {}),
      }, LOG_CATEGORIES.API);
      return false;
    }
    return true;
  });
  
  if (validSections.length === 0) {
    logger.error('No valid sections provided to getListOfMembers', {
      originalCount: sections.length,
      sections: sections,
    }, LOG_CATEGORIES.ERROR);
    return [];
  }
  
  const sectionIds = validSections.map(s => s.sectionid);
  
  // Try cache first (both online and offline)
  try {
    const cachedMembers = await databaseService.getMembers(sectionIds);
    if (cachedMembers.length > 0) {
      logger.info(`Using cached members: ${cachedMembers.length} members for sections ${sectionIds.join(', ')}`);
      return cachedMembers;
    }
  } catch (error) {
    logger.warn('Failed to get cached members:', error);
  }
  
  // If offline and no cache, throw error
  if (!isOnline) {
    logger.error('Offline mode - no cached members available');
    throw new Error('Unable to retrieve members while offline and no cache available');
  }

  // Online mode - fetch from API if cache is empty
  const memberMap = new Map(); // For deduplication by scoutid
  
  // Load terms once for all sections (major optimization!)
  logger.info('Loading terms once for all sections', {}, LOG_CATEGORIES.API);
  const allTerms = await getTerms(token);
  
  for (const section of validSections) {
    try {
      // Use cached terms instead of calling API again
      // Defensive check for section ID
      if (!section.sectionid || section.sectionid === null || section.sectionid === undefined) {
        logger.warn('Skipping section with invalid ID in getListOfMembers', {
          section: section,
          sectionKeys: Object.keys(section),
        }, LOG_CATEGORIES.API);
        continue;
      }
      
      const termId = getMostRecentTermId(section.sectionid, allTerms);
      if (!termId) continue;
      
      // Use the new getMembersGrid API for comprehensive data
      const members = await getMembersGrid(section.sectionid, termId, token);
      
      members.forEach(member => {
        if (member && member.scoutid) {
          const scoutId = member.scoutid;
          
          if (memberMap.has(scoutId)) {
            // Member already exists, add section to their sections list
            const existingMember = memberMap.get(scoutId);
            if (!existingMember.sections) {
              existingMember.sections = [existingMember.sectionname];
            }
            if (!existingMember.sections.includes(section.sectionname)) {
              existingMember.sections.push(section.sectionname);
            }
          } else {
            // New member, add to map with section info
            memberMap.set(scoutId, {
              ...member,
              sectionname: section.sectionname,
              section: section.section,
              sections: [section.sectionname], // Track all sections this member belongs to
            });
          }
        }
      });
      
    } catch (sectionError) {
      logger.warn('Failed to fetch members for section', { sectionId: section.sectionid, error: sectionError.message }, LOG_CATEGORIES.API);
      // Continue with other sections
    }
  }
  
  // Convert map back to array
  const members = Array.from(memberMap.values());
  
  // Cache the members for offline use
  if (members.length > 0) {
    try {
      await databaseService.saveMembers(sectionIds, members);
      logger.info(`Cached ${members.length} members for offline use`);
    } catch (error) {
      logger.warn('Failed to cache members:', error);
      // Don't throw error - this is not critical for the main flow
    }
  }
  
  return members;
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
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    if (!isOnline) {
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
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    if (!isOnline) {
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
    // Skip API calls in demo mode - return mock shared attendance data
    const demoMode = isDemoMode();
    if (demoMode) {
      logger.debug('Demo mode: Generating mock shared attendance data', {}, LOG_CATEGORIES.API);
      return generateDemoSharedAttendance(eventId, sectionId);
    }

    // Check for cached data first - use demo prefix if in demo mode
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
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    if (!isOnline) {
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

    if (!token) {
      throw new Error('No authentication token');
    }

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
 * Tests connectivity to the backend API server
 * @returns {Promise<Object>} Connection test result with status
 * @returns {Promise<{status: 'ok'}>} When connection successful
 * @returns {Promise<{status: 'error', httpStatus?: number, error?: string}>} When connection fails
 * 
 * @example
 * const result = await testBackendConnection();
 * if (result.status === 'ok') {
 *   console.log('Backend is reachable');
 * } else {
 *   console.error('Backend connection failed:', result.error);
 * }
 */
export async function testBackendConnection() {
  // Skip health checks in demo mode
  const demoMode = isDemoMode();
  if (demoMode) {
    return { status: 'ok' };
  }
  
  try {
    const result = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        await response.text();
        return { status: 'ok' };
      } else {
        logger.error('Backend connection test failed', { status: response.status }, LOG_CATEGORIES.API);
        return { status: 'error', httpStatus: response.status };
      }
    });
    
    return result;
  } catch (error) {
    logger.error('Backend connection test error', { error: error.message }, LOG_CATEGORIES.API);
    return { status: 'error', error: error.message };
  }
}

/**
 * Get cached shared attendance data for demo mode
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
