// Token management service - shared across all features
// Handles authentication tokens without creating feature dependencies

import { sentryUtils } from '../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { isDemoMode } from '../../../config/demoMode.js';
import { config } from '../../../config/env.js';
import { authHandler } from './authHandler.js';

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

export function isTokenExpired() {
  return sessionStorage.getItem('token_expired') === 'true';
}

export function markTokenAsExpired() {
  sessionStorage.setItem('token_expired', 'true');
}

export function markTokenAsValid() {
  sessionStorage.removeItem('token_expired');
}

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

export function checkWritePermission() {
  if (sessionStorage.getItem('token_expired') === 'true') {
    throw new Error('Write operations are not allowed while in offline mode with expired token');
  }
}

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