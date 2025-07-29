// Authentication service for Viking Event Management Mobile
// React version of the original auth module

// Removed heavy API imports - auth should be lightweight
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
    // Token was marked as invalid, but don't clear it immediately
    // Let the auth flow decide when to clear it
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

// Simple token validation - just check if we have a token
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

    // Skip meaningless backend validation - just trust we have a token
    // Real validation happens when actual API calls are made
    logger.info('Token found - assuming valid until API calls prove otherwise', {}, LOG_CATEGORIES.AUTH);
    
    // Clear any invalid token flag since we're assuming the token is good
    sessionStorage.removeItem('token_invalid');
    sessionStorage.removeItem('token_expired');
    
    return true;
        
  } catch (error) {
    logger.error('Token validation failed', { error }, LOG_CATEGORIES.AUTH);
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

// Enhanced error handling for API authentication failures
export function handleApiAuthError(error) {
  if (error?.status === 401 || error?.status === 403) {
    logger.info('API authentication failed - clearing token and redirecting to login', { 
      status: error.status,
      message: error.message, 
    }, LOG_CATEGORIES.AUTH);
    
    // Check if we have cached data before fully logging out
    const hasCachedData = checkForCachedData();
    
    if (hasCachedData) {
      logger.info('API auth failed but cached data available - enabling offline mode', {}, LOG_CATEGORIES.AUTH);
      sessionStorage.setItem('token_expired', 'true');
      return { offline: true, shouldReload: true };
    } else {
      logger.info('API auth failed with no cached data - full logout required', {}, LOG_CATEGORIES.AUTH);
      clearToken();
      return { offline: false, shouldReload: true };
    }
  }
  
  return { offline: false, shouldReload: false };
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
