// Base API configuration and shared utilities
// Extracted from monolithic api.js for better modularity

/**
 * @typedef {'api'|'cache'|'none'} DataSource
 * @typedef {Object} GracefulAPICallResult
 * @property {*} [data]
 * @property {DataSource} source
 * @property {boolean} [needsAuth]
 * @property {string} [error]
 */

import { sentryUtils } from '../../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';
import { authHandler } from '../../auth/authHandler.js';
import { checkNetworkStatus, addNetworkListener } from '../../../utils/networkUtils.js';
// Storage utilities imported where needed
import { withRateLimitQueue } from '../../../utils/rateLimitQueue.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { isTokenExpired } from '../../auth/tokenService.js';

export const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://vikings-osm-backend.onrender.com';

// Custom error class for expired tokens
export class TokenExpiredError extends Error {
  constructor(message = 'Authentication token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
    this.isTokenExpired = true;
    this.status = 401;
    this.code = 'TOKEN_EXPIRED';
  }
}

/**
 * Validates token before making API calls with graceful handling for offline-first behavior
 * @param {string} token - Authentication token to validate
 * @param {string} functionName - Name of the API function for logging
 * @param {Object} options - Validation options
 * @param {boolean} options.allowMissingToken - If true, returns validation result instead of throwing
 * @returns {Object} Validation result: { isValid: boolean, reason: string, shouldFallbackToCache: boolean }
 * @throws {TokenExpiredError} If token is expired and allowMissingToken is false
 * @throws {Error} If no token provided and allowMissingToken is false
 */
export function validateTokenBeforeAPICall(token, functionName, options = {}) {
  const { allowMissingToken = false } = options;
  
  if (!token) {
    logger.debug(`${functionName}: No authentication token provided`, {}, LOG_CATEGORIES.API);
    
    if (allowMissingToken) {
      return {
        isValid: false,
        reason: 'NO_TOKEN',
        shouldFallbackToCache: true,
        message: 'No authentication token - will use cached data if available',
      };
    }
    
    // Legacy behavior - throw error (but don't spam Sentry for expected cases)
    const err = new Error('No authentication token');
    err.status = 401;
    err.code = 'NO_TOKEN';
    throw err;
  }
  
  if (isTokenExpired()) {
    logger.debug(`${functionName}: Token has expired`, {
      functionName,
      tokenPresent: !!token,
      tokenExpiresAt: sessionStorage.getItem('token_expires_at') || null,
    }, LOG_CATEGORIES.API);
    
    if (allowMissingToken) {
      return {
        isValid: false,
        reason: 'TOKEN_EXPIRED',
        shouldFallbackToCache: true,
        message: 'Authentication token expired - will use cached data if available',
      };
    }
    
    throw new TokenExpiredError(`Cannot call ${functionName} - authentication token has expired`);
  }
  
  
  return {
    isValid: true,
    reason: 'VALID',
    shouldFallbackToCache: false,
    message: 'Token is valid',
  };
}

/**
 * API call queue to prevent simultaneous requests and manage rate limiting
 * Processes API calls sequentially with controlled delays
 */
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
export const apiQueue = new APIQueue();

// Export queue stats for debugging
export const getAPIQueueStats = () => apiQueue.getStats();

/**
 * Enhanced rate limit monitoring for OSM API responses
 * Logs warnings when rate limits are approaching critical thresholds
 * @param {Object} responseData - API response data containing rate limit info
 * @param {string} apiName - Name of the API call for logging context
 */
export function logRateLimitInfo(responseData, apiName) {
  if (responseData && responseData._rateLimitInfo) {
    const info = responseData._rateLimitInfo;
        
    if (info.osm) {
      const osm = info.osm;
      const percentUsed = osm.limit > 0 ? ((osm.limit - osm.remaining) / osm.limit * 100).toFixed(1) : 0;
            
      if (osm.remaining < 20 && osm.limit > 0) {
        logger.warn('OSM rate limit warning', {
          apiName,
          remaining: osm.remaining,
          percentUsed,
        }, LOG_CATEGORIES.API);
      }
            
      if (osm.remaining < 10 && osm.limit > 0) {
        logger.error('CRITICAL: Low OSM requests remaining', {
          apiName,
          remaining: osm.remaining,
          percentUsed,
        }, LOG_CATEGORIES.API);
      }
    }
        
    if (info.backend) {
      // Backend rate limit info available
    }
  }
}

/**
 * Enhanced API response handler with comprehensive error handling
 * Manages rate limiting, authentication, and Sentry monitoring
 * @param {Response} response - Fetch API response object
 * @param {string} apiName - Name of the API call for logging and monitoring
 * @returns {Promise<Object>} Parsed JSON response data
 * @throws {Error} For rate limits, auth failures, or API errors
 */
export async function handleAPIResponseWithRateLimit(response, apiName) {
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
    
    // Create error object that RateLimitQueue can handle
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.status = 429;
    
    if (errorData.rateLimitInfo) {
      // OSM API rate limiting - this is genuine and should be logged
      const retryAfter = errorData.rateLimitInfo.retryAfter;
      logger.warn(`${apiName} rate limited by OSM API`, { 
        api: apiName,
        retryAfter,
        source: 'OSM',
      }, LOG_CATEGORIES.API);
      
      // Set retryAfter for RateLimitQueue to use
      if (retryAfter) {
        rateLimitError.retryAfter = retryAfter;
        rateLimitError.message = `OSM API rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`;
      } else {
        rateLimitError.message = 'OSM API rate limit exceeded. Please wait before trying again.';
      }
    } else {
      // Internal backend rate limiting - expected behavior, don't spam logs
      const backendRetryAfter = errorData.rateLimit?.retryAfter;
      logger.debug(`${apiName} rate limited by internal backend (expected behavior)`, { 
        api: apiName,
        retryAfter: backendRetryAfter,
        source: 'INTERNAL',
      }, LOG_CATEGORIES.API);
      
      if (backendRetryAfter) {
        rateLimitError.retryAfter = backendRetryAfter;
        rateLimitError.message = `Request queued by backend rate limiting. Please wait ${backendRetryAfter} seconds.`;
      } else {
        rateLimitError.message = 'Request queued by backend rate limiting to prevent OSM API blocking.';
      }
    }
    
    throw rateLimitError;
  }
    
  // Simple auth handling with circuit breaker
  if (!authHandler.handleAPIResponse(response)) {
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
        logger.error('CRITICAL: OSM API BLOCKED', {
          apiName,
          errorMessage,
        }, LOG_CATEGORIES.API);
        sessionStorage.setItem('osm_blocked', 'true');
        throw new Error(`OSM API BLOCKED: ${errorMessage}`);
      }
    }
        
    logger.error('API error', {
      apiName,
      errorMessage,
    }, LOG_CATEGORIES.API);
    throw new Error(`${apiName} failed: ${errorMessage}`);
  }
    
  try {
    const data = await response.json();
    logRateLimitInfo(data, apiName);
    return data;
  } catch {
    logger.error(`${apiName} returned invalid JSON`, {}, LOG_CATEGORIES.API);
    throw new Error(`${apiName} returned invalid response`);
  }
}

// Network status checking with proper initialization
let isOnline = true;

// Initialize network status properly on startup
(async () => {
  try {
    isOnline = await checkNetworkStatus();
    logger.info('Initial network status', {
      status: isOnline ? 'Online' : 'Offline',
    }, LOG_CATEGORIES.API);
    
    // Then set up monitoring for changes
    addNetworkListener((status) => {
      isOnline = status.connected;
      logger.info('Network status changed', {
        status: status.connected ? 'Online' : 'Offline',
      }, LOG_CATEGORIES.API);
    });
  } catch (error) {
    logger.warn('Failed to initialize network status, assuming online', {
      error: error.message,
    }, LOG_CATEGORIES.API);
    isOnline = true;
  }
})();

export { isOnline };

/**
 * Tests connectivity to the backend API server
 * @returns {Promise<Object>} Connection test result with status
 * @returns {Promise<{status: 'ok'}>} When connection successful
 * @returns {Promise<{status: 'error', httpStatus: number, error: string}>} When connection fails
 * 
 * @example
 * const result = await testBackendConnection();
 * if (result.status === 'ok') {
 *   console.log('Backend is reachable');
 * } else {
 *   console.error('Backend connection failed:', result.error);
 * }
 */
export async function testBackendConnection() {
  // Skip health checks in demo mode
  const demoMode = isDemoMode();
  if (demoMode) {
    return { status: 'ok' };
  }
  
  try {
    const result = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        await response.text();
        return { status: 'ok' };
      } else {
        logger.error('Backend connection test failed', { status: response.status }, LOG_CATEGORIES.API);
        return { status: 'error', httpStatus: response.status };
      }
    });
    
    return result;
  } catch (error) {
    logger.error('Backend connection test error', { error: error.message }, LOG_CATEGORIES.API);
    return { status: 'error', error: error.message };
  }
}

/**
 * Creates a graceful API call wrapper that handles missing tokens by falling back to cached data
 * This prevents "No authentication token" errors from being thrown to Sentry for unauthenticated users
 * @param {Function} apiCall - The API function to call (should accept token as parameter)
 * @param {Function} getCachedData - Function to retrieve cached data when API call fails
 * @param {string} functionName - Name of the API function for logging
 * @param {Object} options - Configuration options
 * @param {boolean} options.requireAuth - If true, will prompt for login when no cached data
 * @returns {Promise<GracefulAPICallResult>}
 * 
 * @example
 * const result = await gracefulAPICall(
 *   (token) => getFlexiRecords(sectionId, token),
 *   () => getCachedFlexiRecords(sectionId),
 *   'getFlexiRecords'
 * );
 * 
 * if (result.needsAuth) {
 *   // Show login prompt
 * } else if (result.data) {
 *   // Use data (from API or cache)
 * }
 */
export async function gracefulAPICall(apiCall, getCachedData, functionName, options = {}) {
  const { requireAuth = false } = options;
  
  // Get token and validate with graceful handling
  const { getToken } = await import('../../auth/tokenService.js');
  const token = getToken();
  
  const validation = validateTokenBeforeAPICall(token, functionName, { allowMissingToken: true });
  
  if (validation.isValid) {
    // Token is valid, try API call
    try {
      const data = await apiCall(token);
      return { data, source: 'api' };
    } catch (error) {
      // API call failed, fall back to cache
      logger.debug(`${functionName}: API call failed, falling back to cache`, {
        error: error.message,
      }, LOG_CATEGORIES.API);
      
      if (getCachedData) {
        try {
          const cachedData = await getCachedData();
          if (cachedData) {
            return { data: cachedData, source: 'cache' };
          }
        } catch (cacheError) {
          logger.debug(`${functionName}: Cache retrieval failed`, {
            error: cacheError.message,
          }, LOG_CATEGORIES.API);
        }
      }
      
      return { 
        source: 'none', 
        needsAuth: requireAuth,
        error: error.message, 
      };
    }
  } else {
    // Token is missing or expired, try cached data first
    logger.debug(`${functionName}: ${validation.message}`, {}, LOG_CATEGORIES.API);
    
    if (getCachedData) {
      try {
        const cachedData = await getCachedData();
        if (cachedData) {
          return { data: cachedData, source: 'cache' };
        }
      } catch (cacheError) {
        logger.debug(`${functionName}: Cache retrieval failed`, {
          error: cacheError.message,
        }, LOG_CATEGORIES.API);
      }
    }
    
    // No cached data available
    return { 
      source: 'none', 
      needsAuth: requireAuth || !getCachedData,
      error: validation.message,
    };
  }
}