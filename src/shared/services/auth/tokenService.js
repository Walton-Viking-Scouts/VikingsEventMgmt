// Token management service - shared across all features
// Handles authentication tokens without creating feature dependencies

import { sentryUtils } from '../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { isDemoMode } from '../../../config/demoMode.js';
import { config } from '../../../config/env.js';
import { authHandler } from './authHandler.js';

/**
 * Retrieves the current authentication token from session storage.
 * Returns demo token in demo mode, null if expired, otherwise the stored token.
 * @returns {string|null} The authentication token or null if not available
 */
export function getToken() {
  if (isDemoMode()) {
    return 'demo-mode-token';
  }
  
  const tokenExpired = sessionStorage.getItem('token_expired') === 'true';
  if (tokenExpired) {
    return null;
  }
  
  return sessionStorage.getItem('access_token');
}

/**
 * Stores authentication token and initializes user session context.
 * Sets Sentry user context and resets authentication error states.
 * @param {string} token - The authentication token to store
 * @returns {void} No return value, updates session storage and logging context
 */
export function setToken(token) {
  sessionStorage.setItem('access_token', token);
  
  // Reset auth error state when new token is set
  authHandler.reset();
  
  try {
    sentryUtils.setUser({
      segment: 'mobile-app-users',
    });
  } catch (sentryError) {
    logger.error('Failed to set Sentry user context', { 
      error: sentryError.message,
      hasToken: !!token, 
    }, LOG_CATEGORIES.AUTH);
  }
    
  logger.info('User authenticated successfully', {}, LOG_CATEGORIES.AUTH);
}

/**
 * Removes authentication token and clears all related session data.
 * Resets authentication handlers and clears Sentry user context.
 * @returns {void} No return value, clears session storage and resets auth state
 */
export function clearToken() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('token_invalid');
  sessionStorage.removeItem('token_expired');
  sessionStorage.removeItem('token_expires_at');
  
  // Reset auth handler state when token is cleared
  authHandler.reset();
  
  try {
    sentryUtils.setUser(null);
  } catch (sentryError) {
    logger.error('Failed to clear Sentry user context', {
      error: sentryError.message,
    }, LOG_CATEGORIES.AUTH);
  }
    
  logger.info('User logged out - token cleared', {}, LOG_CATEGORIES.AUTH);
}

/**
 * Checks if the current authentication token has been marked as expired.
 * Used to determine if Scout needs to re-authenticate before API calls.
 * @returns {boolean} True if token is expired, false otherwise
 */
export function isTokenExpired() {
  return sessionStorage.getItem('token_expired') === 'true';
}

/**
 * Marks the current authentication token as expired in session storage.
 * Used when API calls return authentication failures to prevent further attempts.
 * @returns {void} No return value, updates session storage with expired flag
 */
export function markTokenAsExpired() {
  sessionStorage.setItem('token_expired', 'true');
}

/**
 * Clears the token expiration flag from session storage.
 * Used when successful API calls confirm the token is still valid.
 * @returns {void} No return value, removes expired flag from session storage
 */
export function markTokenAsValid() {
  sessionStorage.removeItem('token_expired');
}

/**
 * Generates OAuth authentication URL for Scout login with environment detection.
 * Determines production vs development environment and optionally stores return path.
 * @param {boolean} storeCurrentPath - Whether to store current path for post-auth redirect
 * @returns {string} Complete OAuth URL for backend authentication
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
  }, LOG_CATEGORIES.AUTH);
    
  return authUrl;
}

/**
 * Validates that write operations are allowed with current authentication state.
 * Throws error if token is expired to prevent data corruption in offline mode.
 * @throws {Error} When write operations are not allowed due to expired token
 * @returns {void} No return value if write operations are permitted
 */
export function checkWritePermission() {
  if (sessionStorage.getItem('token_expired') === 'true') {
    throw new Error('Write operations are not allowed while in offline mode with expired token');
  }
}

/**
 * Validates current authentication token without backend verification.
 * Performs local checks and assumes token validity until API calls prove otherwise.
 * @returns {Promise<boolean>} Promise resolving to true if token appears valid, false otherwise
 */
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
    return true;
  } catch (error) {
    logger.error('Token validation failed', { 
      error: error.message,
    }, LOG_CATEGORIES.AUTH);
    return false;
  }
}

/**
 * Stores the current URL path for post-authentication redirect.
 * Used to return users to their original location after OAuth login.
 * @returns {void} No return value, stores path in session storage
 */
function storeReturnPath() {
  try {
    const currentPath = window.location.pathname + window.location.search;
    sessionStorage.setItem('auth_return_path', currentPath);
    logger.info('Stored return path for post-auth redirect', { 
      path: currentPath,
    }, LOG_CATEGORIES.AUTH);
  } catch (error) {
    logger.error('Failed to store return path', { 
      error: error.message,
    }, LOG_CATEGORIES.AUTH);
  }
}