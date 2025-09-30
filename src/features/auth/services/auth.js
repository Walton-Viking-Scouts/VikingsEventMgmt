/**
 * @file Authentication service for Viking Event Management Mobile
 * 
 * Provides comprehensive authentication utilities with offline-first design,
 * token management, OAuth integration, and Scout-specific user handling.
 * Supports both production OSM authentication and demo mode for offline testing.
 * 
 * Features:
 * - OSM OAuth token management with expiration handling
 * - Offline mode support with cached data preservation
 * - Demo mode for testing without API connectivity
 * - Sentry user context integration
 * - Rate limiting awareness and blocked status handling
 * 
 * @module auth
 * @version 2.3.7
 * @since 2.3.7 - Simplified from heavy API imports to lightweight token management
 * @author Vikings Event Management Team
 */

import { sentryUtils } from '../../../shared/services/utils/sentry.js';
import { config } from '../../../config/env.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { authHandler } from './simpleAuthHandler.js';
import { isDemoMode } from '../../../config/demoMode.js';

// OAuth configuration now handled server-side for security

/**
 * Retrieves the current authentication token from session storage
 * 
 * Returns the OSM access token if valid, or a demo token in demo mode.
 * Checks for token expiration flags and returns null if token is expired.
 * This function is the primary interface for checking authentication status.
 * 
 * @returns {string|null} Access token if available and valid, null if expired or missing
 * 
 * @example
 * // Check if user has valid token
 * const token = getToken();
 * if (token) {
 *   // Make authenticated API calls
 *   const response = await api.getData(token);
 * } else {
 *   // Redirect to login
 *   window.location.href = generateOAuthUrl();
 * }
 * 
 * @example
 * // Demo mode usage
 * if (isDemoMode()) {
 *   const demoToken = getToken(); // Returns 'demo-mode-token'
 *   // Use demo token for offline functionality
 * }
 * 
 * @example
 * // Token expiration check
 * const checkAuth = () => {
 *   const token = getToken();
 *   if (!token && sessionStorage.getItem('token_expired') === 'true') {
 *     notifyWarning('Session expired. Please log in again.');
 *     handleTokenExpiration();
 *   }
 * };
 * 
 * @since 2.3.7
 */
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

/**
 * Stores an authentication token and initializes user session
 * 
 * Sets the OSM access token in session storage and performs initialization
 * tasks including resetting auth error state and setting Sentry user context.
 * This function should be called after successful OAuth authentication.
 * 
 * @param {string} token - OSM access token from successful OAuth flow
 * 
 * @example
 * // After OAuth callback with token
 * const urlParams = new URLSearchParams(window.location.search);
 * const token = urlParams.get('access_token');
 * if (token) {
 *   setToken(token);
 *   // User is now authenticated
 *   navigate('/dashboard');
 * }
 * 
 * @example
 * // Manual token setting for testing
 * if (process.env.NODE_ENV === 'development') {
 *   setToken('test-token-12345');
 *   notifySuccess('Development token set for testing');
 * }
 * 
 * @example
 * // Token refresh scenario
 * const refreshAuthToken = async () => {
 *   try {
 *     const newToken = await api.refreshToken();
 *     setToken(newToken);
 *     notifySuccess('Session refreshed successfully');
 *   } catch (error) {
 *     notifyError('Failed to refresh session', error);
 *     handleTokenExpiration();
 *   }
 * };
 * 
 * @since 2.3.7
 */
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

/**
 * Clears authentication token and resets session state
 * 
 * Removes the access token and all related authentication flags from session
 * storage. Resets auth handler state and clears Sentry user context. Used for
 * logout operations and token expiration handling. Does NOT clear offline cached data.
 * 
 * @example
 * // User-initiated logout
 * const handleLogout = () => {
 *   clearToken();
 *   notifyInfo('You have been logged out');
 *   navigate('/login');
 * };
 * 
 * @example
 * // Automatic token expiration
 * const checkTokenExpiration = () => {
 *   if (isTokenExpired()) {
 *     clearToken();
 *     notifyWarning('Session expired. Switching to offline mode.');
 *   }
 * };
 * 
 * @example
 * // Error handling - clear invalid token
 * const handleAuthError = (error) => {
 *   if (error.status === 401) {
 *     clearToken();
 *     notifyError('Authentication failed', error);
 *   }
 * };
 * 
 * @since 2.3.7
 */
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

/**
 * Checks if user is currently authenticated
 * 
 * Returns true if user has a valid authentication token and can access
 * protected features. In demo mode, always returns true to enable offline
 * functionality. Checks for invalid token flags without making API calls.
 * 
 * @returns {boolean} True if user is authenticated and can access protected features
 * 
 * @example
 * // Route protection
 * const ProtectedRoute = ({ children }) => {
 *   if (!isAuthenticated()) {
 *     return <Navigate to="/login" />;
 *   }
 *   return children;
 * };
 * 
 * @example
 * // Conditional UI rendering
 * const HeaderComponent = () => (
 *   <header>
 *     {isAuthenticated() ? (
 *       <UserMenu />
 *     ) : (
 *       <LoginButton />
 *     )}
 *   </header>
 * );
 * 
 * @example
 * // Feature access check
 * const handleSaveEvent = () => {
 *   if (!isAuthenticated()) {
 *     notifyError('Please log in to save events');
 *     return;
 *   }
 *   // Proceed with save operation
 * };
 * 
 * @since 2.3.7
 */
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

/**
 * Validates API response data to check if token is still valid
 * 
 * Examines API response data for authentication error indicators such as
 * invalid token, unauthorized access, or token expiration messages. Used
 * to detect when tokens become invalid during API operations.
 * 
 * @param {Object} responseData - API response data to check for auth errors
 * @returns {boolean} True if token appears valid, false if auth errors detected
 * 
 * @example
 * // API response validation
 * const handleApiResponse = (response) => {
 *   if (!isTokenValid(response)) {
 *     sessionStorage.setItem('token_invalid', 'true');
 *     notifyError('Session expired. Please log in again.');
 *     handleTokenExpiration();
 *     return;
 *   }
 *   // Process valid response
 * };
 * 
 * @example
 * // Fetch wrapper with token validation
 * const apiCall = async (endpoint) => {
 *   const response = await fetch(endpoint);
 *   const data = await response.json();
 *   
 *   if (!isTokenValid(data)) {
 *     throw new Error('Authentication failed');
 *   }
 *   
 *   return data;
 * };
 * 
 * @since 2.3.7
 */
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


/**
 * Generates OAuth URL for OSM authentication
 * 
 * Creates a secure OAuth authentication URL that redirects to the backend
 * OAuth handler. Automatically detects environment (dev/prod) and embeds
 * frontend URL for proper callback handling. Optionally stores current path
 * for return after authentication.
 * 
 * @param {boolean} [storeCurrentPath=false] - Whether to store current path for post-auth redirect
 * @returns {string} Complete OAuth URL for redirect to authentication
 * 
 * @example
 * // Basic login redirect
 * const handleLogin = () => {
 *   const authUrl = generateOAuthUrl(true); // Store current path
 *   window.location.href = authUrl;
 * };
 * 
 * @example
 * // Login button component
 * const LoginButton = () => (
 *   <button 
 *     onClick={() => window.location.href = generateOAuthUrl(true)}
 *     className="bg-scout-blue text-white px-4 py-2 rounded"
 *   >
 *     Login with OSM
 *   </button>
 * );
 * 
 * @example
 * // Conditional authentication
 * const requireAuth = (callback) => {
 *   if (!isAuthenticated()) {
 *     const authUrl = generateOAuthUrl(true);
 *     notifyInfo('Authentication required');
 *     setTimeout(() => window.location.href = authUrl, 1500);
 *     return;
 *   }
 *   callback();
 * };
 * 
 * @example
 * // Environment-aware authentication
 * const getAuthUrl = () => {
 *   const url = generateOAuthUrl();
 *   console.log('Environment:', url.includes('prod') ? 'Production' : 'Development');
 *   return url;
 * };
 * 
 * @since 2.3.7
 */
export function generateOAuthUrl(storeCurrentPath = false) {
  if (storeCurrentPath) {
    storeReturnPath();
  }

  const BACKEND_URL = config.apiUrl;
  const frontendUrl = window.location.origin;
    
  // Determine environment based on hostname
  const hostname = window.location.hostname;
  const isDeployedServer = hostname.includes('.onrender.com') || hostname === 'vikingeventmgmt.onrender.com';
    
  // Embed frontend URL in query parameter for backend detection
  const baseState = isDeployedServer ? 'prod' : 'dev';
  const authUrl = `${BACKEND_URL}/oauth/login?state=${encodeURIComponent(baseState)}&frontend_url=${encodeURIComponent(frontendUrl)}`;
    
  logger.info('Generated OAuth redirect to backend', {
    hostname,
    isDeployedServer,
    baseState,
    frontendUrl,
    backendUrl: BACKEND_URL,
    storedCurrentPath: storeCurrentPath,
  }, LOG_CATEGORIES.AUTH);
    
  return authUrl;
}

// User data management
export async function getUserInfo() {
  const { UnifiedStorageService } = await import('../../../shared/services/storage/unifiedStorageService.js');
  const { isDemoMode } = await import('../../../config/demoMode.js');

  const demoMode = isDemoMode();
  const cacheKey = demoMode ? 'demo_viking_startup_data_offline' : 'viking_startup_data_offline';
  const startupData = await UnifiedStorageService.get(cacheKey);

  if (startupData?.globals) {
    const globals = startupData.globals;
    return {
      firstname: globals.firstname,
      lastname: globals.lastname,
      userid: globals.userid,
      email: globals.email,
      fullname: `${globals.firstname || ''} ${globals.lastname || ''}`.trim(),
    };
  }

  return null;
}

export function setUserInfo(_userInfo) {
  // No longer using sessionStorage for user info - data is read from startup data
}

export function clearUserInfo() {
  // No longer using sessionStorage for user info - data is read from startup data
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
      const apiModule = await import('../../../shared/services/api/api/auth.js');
      
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
export async function fetchUserInfo() {
  return await getUserInfo();
}

// Simple token validation - just check if we have a token
export async function validateToken() {
  try {
    const token = getToken();
    if (!token) {
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
  clearUserInfo,
  fetchUserInfo,
  validateToken,
  logout,
  isBlocked,
};
