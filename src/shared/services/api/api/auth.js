// Auth and user API service
// Extracted from monolithic api.js for better modularity

import {
  BACKEND_URL,
  validateTokenBeforeAPICall,
  handleAPIResponseWithRateLimit,
} from './base.js';
import { withRateLimitQueue } from '../../../utils/rateLimitQueue.js';
import { checkNetworkStatus } from '../../../utils/networkUtils.js';
import { safeGetItem, safeSetItem } from '../../../utils/storageUtils.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { authHandler } from '../../../../features/auth/services/simpleAuthHandler.js';
import { sentryUtils } from '../../utils/sentry.js';
import databaseService from '../../storage/database.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

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
    
    // Fallback: try to get from cache/localStorage with demo mode awareness
    const demoMode = isDemoMode();
    const cacheKey = demoMode ? 'demo_viking_startup_data_offline' : 'viking_startup_data_offline';
    const cachedStartupData = safeGetItem(cacheKey);
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
      const authService = await import('../../../../features/auth/services/auth.js');
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
    const cacheKey = 'demo_viking_user_roles_offline';
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
        const isOnline = await checkNetworkStatus();
        span.setAttribute('network.online', isOnline);
                
        // If offline, try to get from local database
        if (!isOnline) {
          logger.info('Offline mode - retrieving sections from local database');
          span.setAttribute('data.source', 'local_database');
                    
          const sections = await databaseService.getSections();
          return sections;
        }

        // Simple circuit breaker - use cache if auth already failed
        if (!authHandler.shouldMakeAPICall()) {
          logger.info('Auth failed this session - using cached sections only');
          span.setAttribute('data.source', 'local_database_auth_failed');
          const sections = await databaseService.getSections();
          return sections;
        }

        span.setAttribute('data.source', 'api');

        const data = await withRateLimitQueue(async () => {
          // We are online and will call the API – validate now
          validateTokenBeforeAPICall(token, 'getUserRoles');
          
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
        const authService = await import('../../../../features/auth/services/auth.js');
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
          hasToken: !!token, 
        });
                
        // Capture exception with context
        sentryUtils.captureException(error, {
          api: {
            endpoint: 'getUserRoles',
            hasToken: !!token,
          },
        });
        
        // If online request fails (including auth errors), try local database as fallback
        const isOnline = await checkNetworkStatus();
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
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      return safeGetItem('demo_viking_startup_data_offline', null);
    }
    
    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // If offline, get from localStorage
    if (!isOnline) {
      const demoMode = isDemoMode();
      const cacheKey = demoMode ? 'demo_viking_startup_data_offline' : 'viking_startup_data_offline';
      return safeGetItem(cacheKey, null);
    }

    validateTokenBeforeAPICall(token, 'getStartupData');
    
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
        const demoMode = isDemoMode();
        const cacheKey = demoMode ? 'demo_viking_startup_data_offline' : 'viking_startup_data_offline';
        const success = safeSetItem(cacheKey, startupData);
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
    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const demoMode = isDemoMode();
        const cacheKey = demoMode ? 'demo_viking_startup_data_offline' : 'viking_startup_data_offline';
        return safeGetItem(cacheKey, null);
      } catch (cacheError) {
        logger.error('Cache fallback failed', { cacheError: cacheError.message }, LOG_CATEGORIES.API);
      }
    }
    
    throw error;
  }
}