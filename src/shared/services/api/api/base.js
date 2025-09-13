// Base API configuration and shared utilities
// Extracted from monolithic api.js for better modularity

import { sentryUtils } from '../../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';
import { authHandler } from '../../auth/authHandler.js';
import { sleep } from '../../../utils/asyncUtils.js';
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
 * Validates token before making API calls to prevent calls with expired tokens
 * @param {string} token - Authentication token to validate
 * @param {string} functionName - Name of the API function for logging
 * @throws {TokenExpiredError} If token is expired
 * @throws {Error} If no token provided
 */
export function validateTokenBeforeAPICall(token, functionName) {
  if (!token) {
    logger.warn(`${functionName}: No authentication token provided`, {}, LOG_CATEGORIES.API);
    const err = new Error('No authentication token');
    err.status = 401;
    err.code = 'NO_TOKEN';
    throw err;
  }
  
  if (isTokenExpired()) {
    logger.warn(`${functionName}: Preventing API call with expired token`, {
      functionName,
      tokenPresent: !!token,
      tokenExpiresAt: sessionStorage.getItem('token_expires_at') || null,
    }, LOG_CATEGORIES.API);
    throw new TokenExpiredError(`Cannot call ${functionName} - authentication token has expired`);
  }
  
  logger.debug(`${functionName}: Token validation passed`, {
    functionName,
    tokenPresent: !!token,
  }, LOG_CATEGORIES.API);
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
        
        // Add delay between queued API calls
        if (this.queue.length > 0) {
          await sleep(200);
        }
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
        
    // Log rate limiting to Sentry
    logger.warn(logger.fmt`Rate limit hit for API: ${apiName}`, {
      api: apiName,
      status: response.status,
      retryAfter: errorData.rateLimitInfo?.retryAfter,
    });
        
    // Create error object that RateLimitQueue can handle
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.status = 429;
    
    if (errorData.rateLimitInfo) {
      const retryAfter = errorData.rateLimitInfo.retryAfter;
      logger.warn(`${apiName} rate limited by OSM`, { retryAfter }, LOG_CATEGORIES.API);
      
      // Set retryAfter for RateLimitQueue to use
      if (retryAfter) {
        rateLimitError.retryAfter = retryAfter;
        rateLimitError.message = `OSM API rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`;
      } else {
        rateLimitError.message = 'OSM API rate limit exceeded. Please wait before trying again.';
      }
    } else {
      // Backend rate limiting - extract from backend response format
      const backendRetryAfter = errorData.rateLimit?.retryAfter;
      if (backendRetryAfter) {
        rateLimitError.retryAfter = backendRetryAfter;
        rateLimitError.message = `Backend rate limit exceeded. Please wait ${backendRetryAfter} seconds.`;
      } else {
        rateLimitError.message = 'Rate limited. The backend is managing request flow to prevent blocking.';
      }
      logger.warn(`${apiName} rate limited by backend`, { retryAfter: backendRetryAfter }, LOG_CATEGORIES.API);
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
 * Clear all FlexiRecord-related caches from localStorage
 * Useful after fixing authentication issues or when data becomes stale
 * @returns {Object} Summary of cleared cache entries
 * 
 * @example
 * const result = clearFlexiRecordCaches();
 * console.log(`Cleared ${result.clearedLocalStorageKeys} cache entries`);
 */
export function clearFlexiRecordCaches() {
  // Clear localStorage caches (especially consolidated cache which shouldn't exist)
  const keys = Object.keys(localStorage);
  const flexiKeys = keys.filter(key => 
    key.includes('viking_flexi_records_') || 
    key.includes('viking_flexi_structure_') ||
    key.includes('viking_flexi_consolidated_'),
  );
  
  // Log what we're clearing for debugging
  const consolidatedKeys = flexiKeys.filter(key => key.includes('viking_flexi_consolidated_'));
  if (consolidatedKeys.length > 0) {
    logger.info('Clearing old consolidated cache entries', {
      count: consolidatedKeys.length,
      keys: consolidatedKeys,
    }, LOG_CATEGORIES.API);
  }
  
  flexiKeys.forEach(key => {
    localStorage.removeItem(key);
    logger.debug('Removed localStorage key', { key }, LOG_CATEGORIES.API);
  });
  
  return {
    clearedLocalStorageKeys: flexiKeys.length,
  };
}

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