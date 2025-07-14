// Authentication service for Viking Event Management Mobile
// React version of the original auth module

import { getUserRoles, getStartupData } from './api.js';
import { sentryUtils } from './sentry.js';
import { config } from '../config/env.js';
import logger, { LOG_CATEGORIES } from './logger.js';

const clientId = config.oauthClientId;
const scope = 'section:member:read section:programme:read section:event:read section:flexirecord:write';

// Validate client ID is provided
if (!clientId) {
  logger.error('OAuth client ID environment variable not set', { 
    variable: 'VITE_OAUTH_CLIENT_ID', 
  }, LOG_CATEGORIES.AUTH);
  throw new Error('OAuth client ID not configured. Please set VITE_OAUTH_CLIENT_ID environment variable.');
}

// Token management
export function getToken() {
  return sessionStorage.getItem('access_token');
}

export function setToken(token) {
  sessionStorage.setItem('access_token', token);
    
  // Set user context in Sentry when token is set
  sentryUtils.setUser({
    id: 'authenticated-user',
    segment: 'mobile-app-users',
  });
    
  logger.info('User authenticated successfully');
}

export function clearToken() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('token_invalid');
    
  // Clear user context in Sentry when logging out
  sentryUtils.setUser(null);
    
  logger.info('User logged out - token cleared');
}

export function isAuthenticated() {
  const token = getToken();
  if (!token) {
    return false;
  }
  
  // Check if we've previously determined this token is invalid
  const tokenInvalid = sessionStorage.getItem('token_invalid');
  if (tokenInvalid === 'true') {
    // Clear the invalid token and flags
    clearToken();
    sessionStorage.removeItem('token_invalid');
    return false;
  }
  
  return true;
}

// Token validation
export function isTokenValid(responseData) {
  if (responseData && (
    (responseData.status === false && responseData.error && responseData.error.code === 'access-error-2') ||
        responseData.error === 'Invalid access token' ||
        responseData.message === 'Unauthorized' ||
        responseData.error === 'Token expired'
  )) {
    return false;
  }
  return true;
}

// Token expiration handling
export function handleTokenExpiration() {
  logger.info('Token expired - clearing session but keeping offline data', {}, LOG_CATEGORIES.AUTH);
  clearToken();
  
  // DON'T clear offline cached data when token expires
  // The offline data should remain available for offline access
  // Only clear session-specific data
  sessionStorage.removeItem('user_info');
  sessionStorage.removeItem('token_invalid');
    
  // Instead of reloading, we'll let React handle the state change
  // The useAuth hook will detect the token removal and update accordingly
    
  // For compatibility with existing code, return a promise
  return Promise.resolve();
}

// OAuth URL generation
export function generateOAuthUrl() {
  const BACKEND_URL = config.apiUrl;
  const frontendUrl = window.location.origin;
  
  // Build redirect URI without query parameter to match OSM registration
  const redirectUri = `${BACKEND_URL}/oauth/callback`;
    
  // Determine environment based on hostname
  const hostname = window.location.hostname;
  const isDeployedServer = hostname.includes('.onrender.com') || hostname === 'vikings-eventmgmt-mobile.onrender.com';
    
  // Embed frontend URL in state parameter for backend detection
  const baseState = isDeployedServer ? 'prod' : 'dev';
  const stateWithFrontendUrl = `${baseState}&frontend_url=${encodeURIComponent(frontendUrl)}`;
    
  logger.info('Mobile OAuth configuration', {
    hostname,
    isDeployedServer,
    baseState,
    frontendUrl,
    redirectUri,
    backendUrl: BACKEND_URL,
  }, LOG_CATEGORIES.AUTH);

  const authUrl = 'https://www.onlinescoutmanager.co.uk/oauth/authorize?' +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${encodeURIComponent(stateWithFrontendUrl)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        'response_type=code';
    
  logger.info('Generated Mobile OAuth URL', { authUrl }, LOG_CATEGORIES.AUTH);
  return authUrl;
}

// User data management
export function getUserInfo() {
  const userInfoStr = sessionStorage.getItem('user_info');
  if (userInfoStr) {
    try {
      return JSON.parse(userInfoStr);
    } catch (error) {
      logger.warn('Could not parse user info from session storage', { error }, LOG_CATEGORIES.AUTH);
      return null;
    }
  }
  return null;
}

export function setUserInfo(userInfo) {
  sessionStorage.setItem('user_info', JSON.stringify(userInfo));
}

// Validate token by making API call
export async function validateToken() {
  try {
    const token = getToken();
    if (!token) {
      logger.info('No token found - user needs to login', {}, LOG_CATEGORIES.AUTH);
      return false;
    }

    // Check if OSM API access is blocked
    if (sessionStorage.getItem('osm_blocked') === 'true') {
      logger.error('Application is blocked - cannot validate token', { 
        blockedStatus: sessionStorage.getItem('osm_blocked'), 
      }, LOG_CATEGORIES.AUTH);
      return false;
    }

    // Validate token by making a lightweight API call
    logger.info('Token found, testing validity', {}, LOG_CATEGORIES.AUTH);
    await getUserRoles(token);
        
    // If getUserRoles succeeds, token is valid
    logger.info('Token is valid', {}, LOG_CATEGORIES.AUTH);
        
    // Fetch user information for display
    try {
      const startupData = await getStartupData(token);
      if (startupData && startupData.globals && startupData.globals.firstname) {
        const userInfo = {
          firstname: startupData.globals.firstname,
          lastname: startupData.globals.lastname || '',
          fullname: `${startupData.globals.firstname} ${startupData.globals.lastname || ''}`.trim(),
        };
        setUserInfo(userInfo);
        logger.info('User info stored successfully', { 
          firstname: userInfo.firstname,
          lastname: userInfo.lastname,
          fullname: userInfo.fullname, 
        }, LOG_CATEGORIES.AUTH);
      }
    } catch (error) {
      logger.warn('Could not fetch user info from startup data', { error }, LOG_CATEGORIES.AUTH);
      // Continue without user info
    }
        
    return true;
        
  } catch (error) {
    logger.error('Token validation failed', { error, status: error.status }, LOG_CATEGORIES.AUTH);
    
    // For authentication errors, check if we have cached data before forcing re-login
    if (error.status === 401 || error.status === 403) {
      logger.info('Authentication failed - checking for cached data', { 
        errorStatus: error.status, 
      }, LOG_CATEGORIES.AUTH);
      
      // Check if we have any cached data that would allow offline access
      const hasCachedData = checkForCachedData();
      
      if (hasCachedData) {
        logger.info('Found cached data - allowing offline access with expired token', {}, LOG_CATEGORIES.AUTH);
        logger.info('Token is expired but user can access cached data', {}, LOG_CATEGORIES.AUTH);
        
        // Mark token as expired but don't clear it completely
        sessionStorage.setItem('token_expired', 'true');
        
        // Try to get user info from cache
        try {
          const cachedUserInfo = getUserInfo();
          if (cachedUserInfo) {
            logger.info('Using cached user info', { 
              firstname: cachedUserInfo.firstname,
              lastname: cachedUserInfo.lastname,
              fullname: cachedUserInfo.fullname, 
            }, LOG_CATEGORIES.AUTH);
          }
        } catch (cacheError) {
          logger.warn('Could not load cached user info', { error: cacheError }, LOG_CATEGORIES.AUTH);
        }
        
        // Allow access in offline mode
        return true;
      } else {
        logger.info('No cached data found - user must re-authenticate', {}, LOG_CATEGORIES.AUTH);
        // Mark token as invalid for quick future checks
        sessionStorage.setItem('token_invalid', 'true');
        clearToken();
        return false;
      }
    }
    
    return false;
  }
}

// Helper function to check for cached data
function checkForCachedData() {
  try {
    // Check localStorage for all cached data types (comprehensive check)
    const cachedSections = localStorage.getItem('viking_sections_offline');
    const cachedStartupData = localStorage.getItem('viking_startup_data_offline');
    const cachedTerms = localStorage.getItem('viking_terms_offline');
    
    // Check static cache keys
    if (cachedSections && JSON.parse(cachedSections).length > 0) {
      return true;
    }
    
    if (cachedStartupData) {
      return true;
    }
    
    if (cachedTerms) {
      return true;
    }
    
    // Check for dynamic keys (events, attendance, members)
    const hasEventData = Object.keys(localStorage).some(key => 
      key.startsWith('viking_events_') || 
      key.startsWith('viking_attendance_') || 
      key.startsWith('viking_members_'),
    );
    
    if (hasEventData) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking cached data', { error }, LOG_CATEGORIES.AUTH);
    return false;
  }
}

// Guard function to check if write operations are allowed
export function checkWritePermission() {
  if (sessionStorage.getItem('token_expired') === 'true') {
    throw new Error('Write operations are not allowed while in offline mode with expired token');
  }
}

// Logout function
export function logout() {
  clearToken();
  
  // Clear all offline cached data
  localStorage.removeItem('viking_sections_offline');
  localStorage.removeItem('viking_terms_offline');
  localStorage.removeItem('viking_startup_data_offline');
  
  // Clear all event-related cached data
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('viking_events_') || 
        key.startsWith('viking_attendance_') || 
        key.startsWith('viking_members_')) {
      localStorage.removeItem(key);
    }
  });
  
  sessionStorage.removeItem('user_info');
  sessionStorage.removeItem('token_invalid');
  logger.info('User logged out - all cached data cleared', {}, LOG_CATEGORIES.AUTH);
}

// Check for blocked status
export function isBlocked() {
  return sessionStorage.getItem('osm_blocked') === 'true';
}

export default {
  getToken,
  setToken,
  clearToken,
  isAuthenticated,
  isTokenValid,
  handleTokenExpiration,
  generateOAuthUrl,
  getUserInfo,
  setUserInfo,
  validateToken,
  logout,
  isBlocked,
};
