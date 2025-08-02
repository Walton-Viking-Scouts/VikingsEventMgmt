// API service for Viking Event Management Mobile
// React version of the original API module with enhanced mobile support and offline capabilities

import databaseService from './database.js';
import { sentryUtils, logger } from './sentry.js';
import { authHandler } from './simpleAuthHandler.js';
import { sleep } from '../utils/asyncUtils.js';
import { getMostRecentTermId } from '../utils/termUtils.js';
import { checkNetworkStatus, addNetworkListener } from '../utils/networkUtils.js';
import { safeGetItem, safeSetItem } from '../utils/storageUtils.js';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://vikings-osm-backend.onrender.com';


// API call queue to prevent simultaneous requests
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

// Clear all flexirecord caches (useful after fixing auth issues)
export function clearFlexiRecordCaches() {
  console.log('🧹 Clearing all flexirecord caches...');
  
  // Clear in-memory caches
  flexiRecordsCache.clear();
  flexiRecordsCacheTimestamp.clear();
  flexiStructuresCache.clear();
  flexiStructuresCacheTimestamp.clear();
  flexiStructuresInFlight.clear();
  
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
    console.log('🧹 Clearing old consolidated cache entries:', consolidatedKeys);
  }
  
  flexiKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ Removed localStorage key: ${key}`);
  });
  
  console.log(`✅ Cleared ${flexiKeys.length} flexirecord cache entries`);
  
  return {
    clearedMemoryCaches: ['flexiRecordsCache', 'flexiStructuresCache', 'flexiStructuresInFlight'],
    clearedLocalStorageKeys: flexiKeys.length,
  };
}

// Network status checking with proper initialization
let isOnline = true;

// Initialize network status properly on startup
(async () => {
  try {
    isOnline = await checkNetworkStatus();
    console.log('Initial network status:', isOnline ? 'Online' : 'Offline');
    
    // Then set up monitoring for changes
    addNetworkListener((status) => {
      isOnline = status.connected;
      console.log('Network status changed:', status.connected ? 'Online' : 'Offline');
    });
  } catch (error) {
    console.warn('Failed to initialize network status, assuming online:', error);
    isOnline = true;
  }
})();

// Check if OSM API access is blocked
function checkIfBlocked() {
  if (sessionStorage.getItem('osm_blocked') === 'true') {
    throw new Error('OSM API access has been blocked. Please contact the system administrator.');
  }
}

// Enhanced rate limit monitoring
function logRateLimitInfo(responseData, apiName) {
  if (responseData && responseData._rateLimitInfo) {
    const info = responseData._rateLimitInfo;
        
    if (info.osm) {
      const osm = info.osm;
      const percentUsed = osm.limit > 0 ? ((osm.limit - osm.remaining) / osm.limit * 100).toFixed(1) : 0;
            
      console.group(`🔄 ${apiName} Rate Limit Status`);
      console.log('📊 OSM API:', {
        remaining: `${osm.remaining}/${osm.limit}`,
        percentUsed: `${percentUsed}%`,
        window: osm.window || 'per hour',
        available: osm.available,
        rateLimited: osm.rateLimited || false,
      });
            
      if (osm.remaining < 20 && osm.limit > 0) {
        console.warn(`⚠️ OSM rate limit warning for ${apiName}: Only ${osm.remaining} requests remaining (${percentUsed}% used)!`);
      }
            
      if (osm.remaining < 10 && osm.limit > 0) {
        console.error(`🚨 CRITICAL: Only ${osm.remaining} OSM requests remaining for ${apiName}! (${percentUsed}% used)`);
      }
    }
        
    if (info.backend) {
      const backend = info.backend;
      const backendPercentUsed = backend.limit > 0 ? (((backend.limit - backend.remaining) / backend.limit) * 100).toFixed(1) : 0;
            
      console.log('🖥️ Backend API:', {
        remaining: `${backend.remaining}/${backend.limit}`,
        percentUsed: `${backendPercentUsed}%`,
        window: backend.window || 'per minute',
      });
    }
        
    console.groupEnd();
  } else {
    console.log(`📊 ${apiName}: No rate limit info available`);
  }
}

// Enhanced API response handler with Sentry monitoring
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
        
    if (errorData.rateLimitInfo) {
      const retryAfter = errorData.rateLimitInfo.retryAfter || 'unknown time';
      console.warn(`🚫 ${apiName} rate limited by OSM. Backend managing retry. Wait: ${retryAfter}s`);
            
      if (errorData.rateLimitInfo.retryAfter) {
        throw new Error(`OSM API rate limit exceeded. Please wait ${errorData.rateLimitInfo.retryAfter} seconds before trying again.`);
      } else {
        throw new Error('OSM API rate limit exceeded. Please wait before trying again.');
      }
    } else {
      console.warn(`🚫 ${apiName} rate limited. Backend managing request flow.`);
      throw new Error('Rate limited. The backend is managing request flow to prevent blocking.');
    }
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
        console.error(`🚨 CRITICAL: OSM API BLOCKED on ${apiName}!`, errorMessage);
        sessionStorage.setItem('osm_blocked', 'true');
        throw new Error(`OSM API BLOCKED: ${errorMessage}`);
      }
    }
        
    console.error(`❌ ${apiName} API error:`, errorMessage);
    throw new Error(`${apiName} failed: ${errorMessage}`);
  }
    
  try {
    const data = await response.json();
    logRateLimitInfo(data, apiName);
    return data;
  } catch {
    console.error(`❌ ${apiName} returned invalid JSON`);
    throw new Error(`${apiName} returned invalid response`);
  }
}

// Terms cache to prevent multiple API calls within same session
let termsCache = null;
let termsCacheTimestamp = null;
const TERMS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// FlexiRecord lists cache (per section) - structure lists don't change during session
const flexiRecordsCache = new Map(); // sectionId -> flexirecords list
const flexiRecordsCacheTimestamp = new Map(); // sectionId -> timestamp
const FLEXI_RECORDS_CACHE_TTL = 60 * 60 * 1000; // 60 minutes (longer TTL as structure rarely changes)

// FlexiRecord structures cache (per flexirecord) - field definitions don't change during session  
const flexiStructuresCache = new Map(); // flexirecordId -> structure
const flexiStructuresCacheTimestamp = new Map(); // flexirecordId -> timestamp
const flexiStructuresInFlight = new Map(); // flexirecordId -> Promise (for deduplication)
const FLEXI_STRUCTURES_CACHE_TTL = 60 * 60 * 1000; // 60 minutes

// API functions
export async function getTerms(token, forceRefresh = false) {
  try {
    // Check if we have a valid cache (unless force refresh)
    if (!forceRefresh && termsCache && termsCacheTimestamp) {
      const cacheAge = Date.now() - termsCacheTimestamp;
      if (cacheAge < TERMS_CACHE_TTL) {
        return termsCache;
      }
    }

    // Check network status first
    isOnline = await checkNetworkStatus();
    
    // If offline, get from localStorage
    if (!isOnline) {
      const terms = safeGetItem('viking_terms_offline', {});
      
      // Cache in memory for this session
      termsCache = terms;
      termsCacheTimestamp = Date.now();
      
      return terms;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-terms`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await handleAPIResponseWithRateLimit(response, 'getTerms');
    const terms = data || {};
    
    // Cache terms data for offline use
    safeSetItem('viking_terms_offline', terms);
    
    // Cache in memory for this session
    termsCache = terms;
    termsCacheTimestamp = Date.now();
    
    return terms;

  } catch (error) {
    console.error('Error fetching terms:', error);
    
    // If online request fails, try localStorage as fallback
    if (isOnline) {
      try {
        const terms = safeGetItem('viking_terms_offline', {});
        
        // Cache in memory for this session
        termsCache = terms;
        termsCacheTimestamp = Date.now();
        
        return terms;
      } catch (cacheError) {
        console.error('Cache fallback also failed:', cacheError);
      }
    }
    
    throw error;
  }
}

export async function fetchMostRecentTermId(sectionId, token) {
  return apiQueue.add(async () => {
    try {
      const terms = await getTerms(token);
      return getMostRecentTermId(sectionId, terms);
    } catch (error) {
      console.error(`Error fetching most recent term ID for section ${sectionId}:`, error);
      throw error;
    }
  });
}

// Optimized version that uses pre-loaded terms to avoid multiple API calls

export async function getUserRoles(token) {
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
        logger.debug('Making API request for user roles');

        const response = await fetch(`${BACKEND_URL}/get-user-roles`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await handleAPIResponseWithRateLimit(response, 'getUserRoles');

        if (!data || typeof data !== 'object') {
          logger.warn('Invalid data received from getUserRoles API');
          return [];
        }

        // Get user information from startup data (getUserRoles doesn't contain user info)
        try {
          // First try to get from startup data API which contains user info
          const startupData = await getStartupData(token);
          if (startupData && startupData.globals) {
            const userInfo = {
              firstname: startupData.globals.firstname || 'Scout Leader',
              lastname: startupData.globals.lastname || '',
              userid: startupData.globals.userid || null,
              email: startupData.globals.email || null,
            };
            
            const authService = await import('./auth.js');
            authService.setUserInfo(userInfo);
            logger.info('User info found in startup data', { firstname: userInfo.firstname });
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
            
            const authService = await import('./auth.js');
            authService.setUserInfo(userInfo);
            logger.info('User info found in cached startup data', { firstname: userInfo.firstname });
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
              authService.setUserInfo(fallbackUserInfo);
              logger.warn('Created fallback user info - no startup data available');
            } else {
              logger.info('Keeping existing user info', { firstname: existingUserInfo.firstname });
            }
          }
        }

        const sections = Object.keys(data)
          .filter(key => !isNaN(key))
          .map(key => data[key])
          .filter(item => item && typeof item === 'object')
          .map(item => ({
            sectionid: parseInt(item.sectionid, 10), // Standardize to number
            sectionname: item.sectionname,
            section: item.section,
            sectiontype: item.section, // Map section to sectiontype for database
            isDefault: item.isDefault === '1',
            permissions: item.permissions,
          }));

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

export async function getEvents(sectionId, termId, token) {
  try {
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
      console.log('Auth failed this session - using cached events only');
      const events = await databaseService.getEvents(sectionId);
      return events;
    }

    const response = await fetch(`${BACKEND_URL}/get-events?sectionid=${sectionId}&termid=${termId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await handleAPIResponseWithRateLimit(response, 'getEvents');
    // Events are in the 'items' property of the response
    const events = (data && data.items) ? data.items : [];
    

    // Save to local database when online (even if empty to cache the result)
    await databaseService.saveEvents(sectionId, events);

    return events;

  } catch (error) {
    console.error(`Error fetching events for section ${sectionId} and term ${termId}:`, error);
        
    // If online request fails, try local database as fallback
    if (isOnline) {
      try {
        const events = await databaseService.getEvents(sectionId);
        return events;
      } catch (dbError) {
        console.error('Database fallback also failed:', dbError);
      }
    }
        
    throw error;
  }
}

export async function getEventAttendance(sectionId, eventId, termId, token) {
  try {
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
      console.log('Auth failed this session - using cached attendance only');
      const attendance = await databaseService.getAttendance(eventId);
      return attendance;
    }

    const response = await fetch(`${BACKEND_URL}/get-event-attendance?sectionid=${sectionId}&termid=${termId}&eventid=${eventId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await handleAPIResponseWithRateLimit(response, 'getEventAttendance');
    // Attendance is in the 'items' property of the response
    const attendance = (data && data.items) ? data.items : [];

    // Save to local database when online
    if (attendance.length > 0) {
      await databaseService.saveAttendance(eventId, attendance);
    }

    return attendance;

  } catch (error) {
    console.error(`Error fetching event attendance for event ${eventId}:`, error);
        
    // If online request fails, try local database as fallback
    if (isOnline) {
      try {
        const attendance = await databaseService.getAttendance(eventId);
        return attendance;
      } catch (dbError) {
        console.error('Database fallback also failed:', dbError);
      }
    }
        
    throw error;
  }
}

export async function getFlexiRecords(sectionId, token, archived = 'n', forceRefresh = false) {
  try {
    const cacheKey = `${sectionId}-${archived}`;
    
    // Check if we have a valid cache (unless force refresh)
    if (!forceRefresh && flexiRecordsCache.has(cacheKey) && flexiRecordsCacheTimestamp.has(cacheKey)) {
      const cacheAge = Date.now() - flexiRecordsCacheTimestamp.get(cacheKey);
      if (cacheAge < FLEXI_RECORDS_CACHE_TTL) {
        return flexiRecordsCache.get(cacheKey);
      }
    }

    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // If offline, get from localStorage
    if (!isOnline) {
      const cacheData = safeGetItem(`viking_flexi_records_${sectionId}_archived_${archived}_offline`, { identifier: null, label: null, items: [] });
      
      // Cache in memory for this session
      flexiRecordsCache.set(cacheKey, cacheData);
      flexiRecordsCacheTimestamp.set(cacheKey, Date.now());
      
      return cacheData;
    }
    
    checkIfBlocked();
        
    if (!token) {
      throw new Error('No authentication token');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      console.log('Auth failed this session - using cached flexi records only');
      const cacheData = safeGetItem(`viking_flexi_records_${sectionId}_archived_${archived}_offline`, { identifier: null, label: null, items: [] });
      
      // Cache in memory for this session
      flexiRecordsCache.set(cacheKey, cacheData);
      flexiRecordsCacheTimestamp.set(cacheKey, Date.now());
      
      return cacheData;
    }

    const response = await fetch(`${BACKEND_URL}/get-flexi-records?sectionid=${sectionId}&archived=${archived}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await handleAPIResponseWithRateLimit(response, 'getFlexiRecords');
        
    let flexiData;
    if (data && data._rateLimitInfo) {
      const { _rateLimitInfo, ...responseData } = data;
      flexiData = responseData || { identifier: null, label: null, items: [] };
    } else {
      flexiData = data || { identifier: null, label: null, items: [] };
    }
    
    // Cache data for offline use
    safeSetItem(`viking_flexi_records_${sectionId}_archived_${archived}_offline`, flexiData);
    
    // Cache in memory for this session
    flexiRecordsCache.set(cacheKey, flexiData);
    flexiRecordsCacheTimestamp.set(cacheKey, Date.now());
    
    return flexiData;

  } catch (error) {
    console.error('Error fetching flexi records:', error);
    
    // Don't cache error responses - only return existing cache as fallback
    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const cacheData = safeGetItem(`viking_flexi_records_${sectionId}_archived_${archived}_offline`, { identifier: null, label: null, items: [] });
        
        // DON'T cache the fallback data - let it retry on next call
        console.log('Using cached fallback data after API error, not updating cache timestamp');
        
        return cacheData;
      } catch (cacheError) {
        console.error('Cache fallback also failed:', cacheError);
      }
    }
    
    throw error;
  }
}

export async function getSingleFlexiRecord(flexirecordid, sectionid, termid, token) {
  try {
    console.log('🔍 getSingleFlexiRecord called with:', {
      flexirecordid,
      sectionid,
      termid,
      hasToken: !!token,
    });

    if (!token) {
      throw new Error('No authentication token');
    }

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      console.log('Auth failed this session - getSingleFlexiRecord blocked');
      throw new Error('Authentication failed - unable to fetch flexi record data');
    }

    const response = await fetch(`${BACKEND_URL}/get-single-flexi-record?flexirecordid=${flexirecordid}&sectionid=${sectionid}&termid=${termid}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'getSingleFlexiRecord');
        
    if (data && data._rateLimitInfo) {
      const { _rateLimitInfo, ...flexiData } = data;
      return flexiData || { identifier: null, items: [] };
    }
        
    return data || { identifier: null, items: [] };
        
  } catch (error) {
    console.error('Error fetching single flexi record:', error);
    throw error;
  }
}

export async function getFlexiStructure(extraid, sectionid, termid, token, forceRefresh = false) {
  try {
    const cacheKey = `${extraid}`;
    
    // Check if we have a valid cache (unless force refresh)
    if (!forceRefresh && flexiStructuresCache.has(cacheKey) && flexiStructuresCacheTimestamp.has(cacheKey)) {
      const cacheAge = Date.now() - flexiStructuresCacheTimestamp.get(cacheKey);
      if (cacheAge < FLEXI_STRUCTURES_CACHE_TTL) {
        console.log(`🎯 getFlexiStructure using CACHE for ${extraid} (age: ${Math.round(cacheAge/1000)}s)`);
        return flexiStructuresCache.get(cacheKey);
      }
    }

    // Check if request is already in flight (deduplication)
    if (!forceRefresh && flexiStructuresInFlight.has(cacheKey)) {
      console.log(`⏳ getFlexiStructure DEDUPLICATING for ${extraid} - waiting for in-flight request`);
      return await flexiStructuresInFlight.get(cacheKey);
    }

    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // If offline, get from localStorage
    if (!isOnline) {
      const cacheData = safeGetItem(`viking_flexi_structure_${extraid}_offline`, null);
      
      // Cache in memory for this session
      if (cacheData) {
        flexiStructuresCache.set(cacheKey, cacheData);
        flexiStructuresCacheTimestamp.set(cacheKey, Date.now());
      }
      
      return cacheData;
    }
    
    // Create and track the API request Promise for deduplication
    const apiRequest = (async () => {
      try {
        if (!token) {
          throw new Error('No authentication token');
        }

        // Simple circuit breaker - use cache if auth already failed
        if (!authHandler.shouldMakeAPICall()) {
          console.log('Auth failed this session - getFlexiStructure blocked');
          throw new Error('Authentication failed - unable to fetch flexi structure data');
        }

        console.log(`🌐 getFlexiStructure making API CALL for ${extraid} (section: ${sectionid}, term: ${termid})`);
        const response = await fetch(`${BACKEND_URL}/get-flexi-structure?flexirecordid=${extraid}&sectionid=${sectionid}&termid=${termid}`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json', 
          },
        });
            
        const data = await handleAPIResponseWithRateLimit(response, 'getFlexiStructure');
        const structureData = data || null;
        
        // Cache data for offline use
        if (structureData) {
          safeSetItem(`viking_flexi_structure_${extraid}_offline`, structureData);
        }
        
        // Cache in memory for this session
        flexiStructuresCache.set(cacheKey, structureData);
        flexiStructuresCacheTimestamp.set(cacheKey, Date.now());
        
        return structureData;
      } finally {
        // Clean up in-flight tracking when request completes (success or failure)
        flexiStructuresInFlight.delete(cacheKey);
      }
    })();

    // Store the Promise for deduplication
    flexiStructuresInFlight.set(cacheKey, apiRequest);
    
    return await apiRequest;
        
  } catch (error) {
    console.error('Error fetching flexi structure:', error);
    
    // Don't cache error responses - only return existing cache as fallback
    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const cacheData = safeGetItem(`viking_flexi_structure_${extraid}_offline`, null);
        
        // DON'T cache the fallback data - let it retry on next call
        console.log('Using cached fallback data after API error, not updating cache timestamp');
        
        return cacheData;
      } catch (cacheError) {
        console.error('Cache fallback also failed:', cacheError);
      }
    }
    
    throw error;
  }
}

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
    
    // Cache startup data for offline use
    if (startupData) {
      safeSetItem('viking_startup_data_offline', startupData);
    }
    
    return startupData;
        
  } catch (error) {
    console.error('Error fetching startup data:', error);
    
    // Don't fall back to cache for authentication errors - these need to be handled by auth system
    if (error.status === 401 || error.status === 403) {
      console.error('Authentication error - not using cache fallback');
      throw error;
    }
    
    // If online request fails (non-auth errors), try localStorage as fallback
    if (isOnline) {
      try {
        return safeGetItem('viking_startup_data_offline', null);
      } catch (cacheError) {
        console.error('Cache fallback also failed:', cacheError);
      }
    }
    
    throw error;
  }
}

export async function updateFlexiRecord(sectionid, scoutid, flexirecordid, columnid, value, token) {
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
      }),
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'updateFlexiRecord');
    return data || null;
        
  } catch (error) {
    console.error('Error updating flexi record:', error);
    throw error;
  }
}

// FlexiRecord consolidation functions - re-export from utilities
export { 
  parseFlexiStructure,
  transformFlexiRecordData,
  getConsolidatedFlexiRecord,
  getAllConsolidatedFlexiRecords,
  extractVikingEventFields,
} from '../utils/flexiRecordUtils.js';

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
      console.log('Auth failed this session - using cached members only');
      const cachedMembers = await databaseService.getMembers([sectionId]);
      return cachedMembers;
    }

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

    const data = await handleAPIResponseWithRateLimit(response, 'getMembersGrid');
    
    // Transform the grid data into a more usable format
    if (data && data.data && data.data.members) {
      return data.data.members.map(member => {
        // Map patrol_id to person type
        let person_type = 'Young People'; // default
        if (member.patrol_id === -2) {
          person_type = 'Leaders';
        } else if (member.patrol_id === -3) {
          person_type = 'Young Leaders';
        }
        
        // The backend now provides flattened fields, so we can use them directly
        // All custom_data fields are now available as flattened properties like:
        // primary_contact_1_email_1, primary_contact_1_phone_1, etc.
        
        return {
          // Core member info
          scoutid: member.member_id,
          member_id: member.member_id,
          firstname: member.first_name,
          lastname: member.last_name,
          date_of_birth: member.date_of_birth,
          age: member.age,
          
          // Section info
          sectionid: member.section_id,
          patrol: member.patrol,
          patrol_id: member.patrol_id,
          person_type: person_type, // New field for person classification
          started: member.started,
          joined: member.joined,
          active: member.active,
          end_date: member.end_date,
          
          // Photo info
          photo_guid: member.photo_guid,
          has_photo: member.pic,
          
          // All flattened custom fields are now available directly on the member object
          // No need to extract them - they're already flattened by the backend
          ...member, // Spread all fields including flattened custom_data fields
          
          // Keep grouped contact data for backward compatibility
          contact_groups: member.contact_groups,
        };
      });
    }

    return [];

  } catch (error) {
    console.error(`Error fetching members grid for section ${sectionId}:`, error);
    
    // If online request fails, try local database as fallback
    if (isOnline) {
      try {
        const cachedMembers = await databaseService.getMembers([sectionId]);
        return cachedMembers;
      } catch (dbError) {
        console.error('Database fallback also failed:', dbError);
      }
    }
    
    throw error;
  }
}

// Note: extractContactField and extractEmergencyContacts functions removed
// The backend now provides all custom_data fields as flattened properties
// using the actual group names and column labels from OSM metadata

export async function getListOfMembers(sections, token) {
  // Check network status first
  isOnline = await checkNetworkStatus();
  const sectionIds = sections.map(s => s.sectionid);
  
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
  console.log('Loading terms once for all sections...');
  const allTerms = await getTerms(token);
  
  for (const section of sections) {
    try {
      // Add delay between sections to prevent rapid API calls
      await sleep(600);
      
      // Use cached terms instead of calling API again
      const termId = getMostRecentTermId(section.sectionid, allTerms);
      if (!termId) continue;
      
      // Add delay before members grid call
      await sleep(300);
      
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
      console.warn(`Failed to fetch members for section ${section.sectionid}:`, sectionError);
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


export async function testBackendConnection() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
        
        
    if (response.ok) {
      await response.text();
      return true;
    } else {
      console.error('Backend connection test failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Backend connection test error:', error);
    return false;
  }
}

/**
 * Preload flexirecord lists and structures for all sections (startup optimization)
 * Similar to how terms are preloaded to reduce API calls during usage
 * 
 * @param {Array} sections - Array of section objects with sectionid
 * @param {string} token - Authentication token
 * @returns {Promise<void>}
 */
export async function preloadFlexiRecordStructures(sections, token) {
  try {
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      console.log('No sections provided for flexirecord preloading');
      return;
    }

    console.log(`Preloading flexirecord structures for ${sections.length} sections...`);
    
    // Load flexirecord lists for all sections first
    const flexiRecordPromises = sections.map(async (section) => {
      try {
        const flexiRecords = await getFlexiRecords(section.sectionid, token, 'n', false); // Use cache if available
        return { sectionId: section.sectionid, flexiRecords, success: true };
      } catch (error) {
        console.warn(`Failed to preload flexirecords for section ${section.sectionid}:`, error.message);
        return { sectionId: section.sectionid, flexiRecords: null, success: false };
      }
    });

    const flexiRecordResults = await Promise.all(flexiRecordPromises);
    const successfulSections = flexiRecordResults.filter(r => r.success);
    
    console.log(`Loaded flexirecord lists for ${successfulSections.length}/${sections.length} sections`);

    // Now load structures for all unique flexirecords found
    const allFlexiRecords = new Map(); // extraid -> { extraid, name, sectionIds[] }
    
    successfulSections.forEach(({ sectionId, flexiRecords }) => {
      if (flexiRecords?.items) {
        flexiRecords.items.forEach(record => {
          if (!allFlexiRecords.has(record.extraid)) {
            allFlexiRecords.set(record.extraid, {
              extraid: record.extraid,
              name: record.name,
              sectionIds: [sectionId],
            });
          } else {
            allFlexiRecords.get(record.extraid).sectionIds.push(sectionId);
          }
        });
      }
    });

    if (allFlexiRecords.size === 0) {
      console.log('No flexirecords found to preload structures for');
      return;
    }

    console.log(`Preloading structures for ${allFlexiRecords.size} unique flexirecords...`);

    // Load structures for all unique flexirecords
    const structurePromises = Array.from(allFlexiRecords.values()).map(async (record) => {
      try {
        // Use first section's termId for structure (structure should be same across sections)
        const firstSectionId = record.sectionIds[0];
        
        // Get termId from cache (terms should already be loaded)
        const terms = await getTerms(token);
        const termId = getMostRecentTermId(firstSectionId, terms);
        
        if (!termId) {
          throw new Error(`No termId found for section ${firstSectionId}`);
        }

        const structure = await getFlexiStructure(record.extraid, firstSectionId, termId, token, false); // Use cache if available
        return { extraid: record.extraid, name: record.name, structure, success: true };
      } catch (error) {
        console.warn(`Failed to preload structure for flexirecord ${record.name} (${record.extraid}):`, error.message);
        return { extraid: record.extraid, name: record.name, structure: null, success: false };
      }
    });

    const structureResults = await Promise.all(structurePromises);
    const successfulStructures = structureResults.filter(r => r.success);
    
    console.log(`✅ Preloaded structures for ${successfulStructures.length}/${allFlexiRecords.size} flexirecords`);
    console.log('Flexirecord structures preloading complete');

  } catch (error) {
    console.error('Error preloading flexirecord structures:', error);
    // Don't throw - this is optimization, not critical
  }
}
