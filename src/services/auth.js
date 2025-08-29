// Authentication service for Viking Event Management Mobile
// React version of the original auth module

// Removed heavy API imports - auth should be lightweight
import { sentryUtils } from './sentry.js';
import { config } from '../config/env.js';
import logger, { LOG_CATEGORIES } from './logger.js';
import { authHandler } from './simpleAuthHandler.js';
import { isDemoMode } from '../config/demoMode.js';

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
  // In demo mode, return a dummy token to enable offline functionality
  if (isDemoMode()) {
    return 'demo-mode-token';
  }
  
  // Don't return a token if it's been marked as expired
  const tokenExpired = sessionStorage.getItem('token_expired') === 'true';
  if (tokenExpired) {
    return null;
  }
  
  return sessionStorage.getItem('access_token');
}

export function setToken(token) {
  sessionStorage.setItem('access_token', token);
  
  // Reset auth error state when new token is set
  authHandler.reset();
  
  // Set user context in Sentry when token is set - with error handling
  try {
    sentryUtils.setUser({
      segment: 'mobile-app-users',
    });
  } catch (sentryError) {
    // Log the error but don't let it break authentication
    logger.error('Failed to set Sentry user context', { 
      error: sentryError.message,
      hasToken: !!token, 
    }, LOG_CATEGORIES.AUTH);
  }
    
  logger.info('User authenticated successfully', {}, LOG_CATEGORIES.AUTH);
}

export function clearToken() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('token_invalid');
  sessionStorage.removeItem('token_expired');
  sessionStorage.removeItem('token_expires_at');
  
  // Reset auth handler state when token is cleared
  authHandler.reset();
  
  // Clear user context in Sentry when logging out - with error handling
  try {
    sentryUtils.setUser(null);
    sentryUtils.clearScope();
    sentryUtils.addBreadcrumb({
      category: 'auth',
      message: 'User logged out; cleared Sentry user context',
      level: 'info',
    });
  } catch (sentryError) {
    // Log the error but don't let it break logout
    logger.error('Failed to clear Sentry user context', { 
      error: sentryError.message, 
    }, LOG_CATEGORIES.AUTH);
  }
    
  logger.info('User logged out - token cleared', {}, LOG_CATEGORIES.AUTH);
}

export function isAuthenticated() {
  // In demo mode, always return true to enable all functionality
  if (isDemoMode()) {
    return true;
  }
  
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

// Store current page path for return after OAuth
export function storeReturnPath() {
  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  sessionStorage.setItem('oauth_return_path', currentPath);
  logger.info('Stored return path for OAuth', { returnPath: currentPath }, LOG_CATEGORIES.AUTH);
}

// Get stored return path and clear it
export function getAndClearReturnPath() {
  const returnPath = sessionStorage.getItem('oauth_return_path');
  if (returnPath) {
    sessionStorage.removeItem('oauth_return_path');
    logger.info('Retrieved and cleared return path', { returnPath }, LOG_CATEGORIES.AUTH);
  }
  return returnPath || '/';
}

// Check if token is expired (for API call prevention)
export function isTokenExpired() {
  const expiresAt = sessionStorage.getItem('token_expires_at');
  if (!expiresAt) {
    // No expiration time stored - fall back to existing token_expired flag
    return sessionStorage.getItem('token_expired') === 'true';
  }
  
  const expirationTime = parseInt(expiresAt, 10);
  
  // Validate the parsed expiration time
  if (!Number.isFinite(expirationTime)) {
    logger.warn('Corrupt token expiration time detected in API validation', {
      corruptValue: expiresAt,
      tokenExpiredFlag: sessionStorage.getItem('token_expired'),
    }, LOG_CATEGORIES.AUTH);
    
    // Fall back to token_expired flag
    const fallbackExpired = sessionStorage.getItem('token_expired') === 'true';
    if (fallbackExpired) {
      logger.info('Setting token_expired flag due to corrupt expiration time', {
        corruptValue: expiresAt,
      }, LOG_CATEGORIES.AUTH);
      sessionStorage.setItem('token_expired', 'true');
    }
    return fallbackExpired;
  }
  
  const now = Date.now();
  const isExpired = now >= expirationTime;
  
  // If expired, set the token_expired flag for consistency with existing code
  if (isExpired && sessionStorage.getItem('token_expired') !== 'true') {
    logger.info('Token expiration detected during API validation', {
      now,
      expirationTime,
      expired: true,
    }, LOG_CATEGORIES.AUTH);
    sessionStorage.setItem('token_expired', 'true');
  }
  
  return isExpired;
}

// OAuth URL generation with optional return path storage
export function generateOAuthUrl(storeCurrentPath = false) {
  if (storeCurrentPath) {
    storeReturnPath();
  }

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
    storedCurrentPath: storeCurrentPath,
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

// Fetch fresh user info from OSM startup data API
export async function fetchUserInfoFromAPI() {
  const fallbackUserInfo = {
    firstname: 'Scout Leader',
    lastname: '',
    userid: null,
    email: null,
    fullname: 'Scout Leader',
  };

  // In demo mode, return demo user info
  if (isDemoMode()) {
    const demoUserInfo = {
      firstname: 'Demo',
      lastname: 'Leader',
      userid: 'demo_user',
      email: 'demo@example.com',
      fullname: 'Demo Leader',
    };
    
    logger.info('Returning demo user info', { 
      firstname: demoUserInfo.firstname, 
      hasUserInfo: true,
    }, LOG_CATEGORIES.AUTH);
    
    return demoUserInfo;
  }

  try {
    // Direct sessionStorage access intentional - this function fetches user info 
    // regardless of token expiration status (for API calls vs general auth checks)
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    try {
      const apiModule = await import('./api.js');
      
      if (typeof apiModule.getStartupData !== 'function') {
        throw new Error('getStartupData function not available');
      }
      
      const startupData = await apiModule.getStartupData(token);
      
      if (startupData && startupData.globals) {
        const userInfo = {
          firstname: startupData.globals.firstname || 'Scout Leader',
          lastname: startupData.globals.lastname || '',
          userid: startupData.globals.userid || null,
          email: startupData.globals.email || null,
          fullname: `${startupData.globals.firstname || 'Scout'} ${startupData.globals.lastname || 'Leader'}`.trim(),
        };
        
        logger.info('Successfully fetched user info from API', { 
          firstname: userInfo.firstname, 
          hasUserInfo: true,
        }, LOG_CATEGORIES.AUTH);
        
        // Update Sentry user context with real user identity
        try {
          const sentryUser = {
            username: userInfo.fullname,
            segment: 'mobile-app-users',
            ...(userInfo.userid ? { id: String(userInfo.userid) } : {}),
            ...(userInfo.email ? { email: userInfo.email } : {}),
          };
          sentryUtils.setUser(sentryUser);
        } catch (sentryError) {
          logger.warn('Failed to update Sentry user identity', {
            error: sentryError.message,
            hasUserInfo: !!userInfo,
          }, LOG_CATEGORIES.AUTH);
          
          sentryUtils.captureException(sentryError, {
            tags: { operation: 'sentry_user_update' },
            contexts: { 
              userInfo: { hasUserInfo: !!userInfo },
              auth: { operation: 'update_sentry_user_context' },
            },
          });
        }
        
        return userInfo;
      } else {
        logger.warn('No globals data in startup response - using fallback user info', {}, LOG_CATEGORIES.AUTH);
        return fallbackUserInfo;
      }
    } catch (importError) {
      logger.warn('Failed to fetch user info from API, using fallback', { 
        error: importError.message,
      }, LOG_CATEGORIES.AUTH);
      
      return fallbackUserInfo;
    }
  } catch (error) {
    logger.error('Failed to fetch user info from API', { error: error.message }, LOG_CATEGORIES.AUTH);
    throw error;
  }
}

// Get user info from cache or return null
// This function never makes API calls - it's for retrieving cached data only
export function fetchUserInfo() {
  return getUserInfo();
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
    const demoMode = isDemoMode();
    const sectionsKey = demoMode ? 'demo_viking_sections_offline' : 'viking_sections_offline';
    const startupKey = demoMode ? 'demo_viking_startup_data_offline' : 'viking_startup_data_offline';
    const termsKey = demoMode ? 'demo_viking_terms_offline' : 'viking_terms_offline';
    
    const cachedSections = localStorage.getItem(sectionsKey);
    const cachedStartupData = localStorage.getItem(startupKey);
    const cachedTerms = localStorage.getItem(termsKey);
    
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
    
    // Check for dynamic keys (events, attendance, members) - include demo keys
    const hasEventData = Object.keys(localStorage).some(key => 
      key.startsWith('viking_events_') || 
      key.startsWith('viking_attendance_') || 
      key.startsWith('viking_members_') ||
      key.startsWith('demo_viking_events_') || 
      key.startsWith('demo_viking_attendance_') || 
      key.startsWith('demo_viking_members_'),
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
      // Prevent stale/negative countdown while offline
      sessionStorage.removeItem('token_expires_at');
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
  const demoMode = isDemoMode();
  const sectionsKey = demoMode ? 'demo_viking_sections_offline' : 'viking_sections_offline';
  const termsKey = demoMode ? 'demo_viking_terms_offline' : 'viking_terms_offline';
  const startupKey = demoMode ? 'demo_viking_startup_data_offline' : 'viking_startup_data_offline';
  
  localStorage.removeItem(sectionsKey);
  localStorage.removeItem(termsKey);
  localStorage.removeItem(startupKey);
  
  // Clear all offline caches (demo & production): events, attendance, members, Flexi, metadata, shared attendance
  const prefixes = ['viking_', 'demo_viking_'];
  const patterns = [
    'events_',
    'attendance_',
    'members_',
    'flexi_lists_',
    'flexi_structure_',
    'flexi_data_',
    'shared_metadata_',
    'shared_attendance_',
  ];
  Object.keys(localStorage).forEach(key => {
    if (prefixes.some(p => patterns.some(pt => key.startsWith(p + pt)))) {
      localStorage.removeItem(key);
    }
  });
  
  sessionStorage.removeItem('user_info');
  logger.info('User logged out - all cached data cleared including FlexiRecords and shared metadata', {}, LOG_CATEGORIES.AUTH);
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
  fetchUserInfo,
  validateToken,
  logout,
  isBlocked,
};
