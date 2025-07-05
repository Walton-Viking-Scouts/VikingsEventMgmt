// Authentication service for Viking Event Management Mobile
// React version of the original auth module

import { getUserRoles, getStartupData } from './api.js';
import { sentryUtils, logger } from './sentry.js';
import { config } from '../config/env.js';

const clientId = config.oauthClientId;
const scope = 'section:member:read section:programme:read section:event:read section:flexirecord:write';

// Validate client ID is provided
if (!clientId) {
  console.error('⚠️ VITE_OAUTH_CLIENT_ID environment variable not set');
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
  console.log('Token expired - clearing session');
  clearToken();
  localStorage.removeItem('viking_sections_cache');
    
  // Instead of reloading, we'll let React handle the state change
  // The useAuth hook will detect the token removal and update accordingly
    
  // For compatibility with existing code, return a promise
  return Promise.resolve();
}

// OAuth URL generation
export function generateOAuthUrl() {
  const BACKEND_URL = config.apiUrl;
  const redirectUri = `${BACKEND_URL}/oauth/callback`;
    
  // Determine environment based on hostname
  const hostname = window.location.hostname;
  const isDeployedServer = hostname.includes('.onrender.com') || hostname === 'vikings-eventmgmt-mobile.onrender.com';
    
  const baseState = isDeployedServer ? 'prod' : 'dev';
  const frontendUrl = window.location.origin;
  const stateParam = `${baseState}&frontend_url=${encodeURIComponent(frontendUrl)}`;
    
  console.log('🔧 Mobile OAuth Config:', {
    hostname,
    isDeployedServer,
    baseState,
    frontendUrl,
    stateParam,
    redirectUri,
    backendUrl: BACKEND_URL,
  });

  const authUrl = 'https://www.onlinescoutmanager.co.uk/oauth/authorize?' +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${encodeURIComponent(stateParam)}&` +  // Re-enable state parameter
        `scope=${encodeURIComponent(scope)}&` +
        'response_type=code';
    
  console.log('🔗 Generated Mobile OAuth URL:', authUrl);
  return authUrl;
}

// User data management
export function getUserInfo() {
  const userInfoStr = sessionStorage.getItem('user_info');
  if (userInfoStr) {
    try {
      return JSON.parse(userInfoStr);
    } catch (error) {
      console.warn('Could not parse user info:', error);
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
      console.log('No token found - user needs to login');
      return false;
    }

    // Check if OSM API access is blocked
    if (sessionStorage.getItem('osm_blocked') === 'true') {
      console.error('🚨 Application is blocked - cannot validate token');
      return false;
    }

    // Validate token by making a lightweight API call
    console.log('Token found, testing validity...');
    await getUserRoles(token);
        
    // If getUserRoles succeeds, token is valid
    console.log('Token is valid');
        
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
        console.log('User info stored:', userInfo);
      }
    } catch (error) {
      console.warn('Could not fetch user info:', error);
      // Continue without user info
    }
        
    return true;
        
  } catch (error) {
    console.error('Token validation failed:', error);
    if (error.status === 401 || error.status === 403) {
      // Mark token as invalid for quick future checks
      sessionStorage.setItem('token_invalid', 'true');
      clearToken();
    }
    return false;
  }
}

// Logout function
export function logout() {
  clearToken();
  localStorage.removeItem('viking_sections_cache');
  sessionStorage.removeItem('user_info');
  sessionStorage.removeItem('token_invalid');
  console.log('User logged out');
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
