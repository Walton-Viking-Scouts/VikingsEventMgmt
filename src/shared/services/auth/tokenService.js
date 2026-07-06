// Token management service - shared across all features
// Handles authentication tokens without creating feature dependencies

import { sentryUtils } from '../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { isDemoMode } from '../../../config/demoMode.js';

import { authHandler } from './authHandler.js';

export function getToken() {
  if (isDemoMode()) {
    return 'demo-mode-token';
  }
  
  const tokenExpired = localStorage.getItem('token_expired') === 'true';
  if (tokenExpired) {
    return null;
  }
  
  return localStorage.getItem('access_token');
}

export function setToken(token) {
  localStorage.setItem('access_token', token);
  
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
  localStorage.removeItem('access_token');
  localStorage.removeItem('token_expired');
  localStorage.removeItem('token_expires_at');
  
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
  const expiresAt = localStorage.getItem('token_expires_at');
  if (!expiresAt) {
    // No expiration time stored - fall back to existing token_expired flag
    return localStorage.getItem('token_expired') === 'true';
  }
  
  const expirationTime = parseInt(expiresAt, 10);
  
  // Validate the parsed expiration time
  if (!Number.isFinite(expirationTime)) {
    logger.warn('Corrupt token expiration time detected in API validation', {
      corruptValue: expiresAt,
      tokenExpiredFlag: localStorage.getItem('token_expired'),
    }, LOG_CATEGORIES.AUTH);
    
    // Treat corrupt expiration as expired for safety and consistency
    localStorage.setItem('token_expired', 'true');
    return true;
  }
  
  const now = Date.now();
  const isExpired = now >= expirationTime;
  
  // If expired, set the token_expired flag for consistency with existing code
  if (isExpired && localStorage.getItem('token_expired') !== 'true') {
    logger.info('Token expiration detected during API validation', {
      now,
      expirationTime,
      expired: true,
    }, LOG_CATEGORIES.AUTH);
    localStorage.setItem('token_expired', 'true');
  }
  
  return isExpired;
}

export function checkWritePermission() {
  if (localStorage.getItem('token_expired') === 'true') {
    throw new Error('Write operations are not allowed while in offline mode with expired token');
  }
}
