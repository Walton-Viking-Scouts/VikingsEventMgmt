// Base API configuration and shared utilities.
// Owns the single request pipeline (osmRequest) shared by every endpoint —
// see the osmRequest JSDoc for the exact step order.

import { sentryUtils } from '../../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';
import { authHandler } from '../../auth/authHandler.js';
import { checkNetworkStatus, addNetworkListener } from '../../../utils/networkUtils.js';
import { withRateLimitQueue, globalRateLimitQueue } from '../../../utils/rateLimitQueue.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { isTokenExpired, checkWritePermission } from '../../auth/tokenService.js';

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

// Permission denied on a specific endpoint (403). Deliberately NOT a
// breaker-tripping condition: one section without flexi access must not
// take down all API traffic.
export class PermissionDeniedError extends Error {
  constructor(apiName) {
    super(`${apiName}: permission denied by OSM (403)`);
    this.name = 'PermissionDeniedError';
    this.status = 403;
    this.code = 'PERMISSION_DENIED';
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

    const err = new Error('No authentication token');
    err.status = 401;
    err.code = 'NO_TOKEN';
    throw err;
  }

  if (isTokenExpired()) {
    logger.debug(`${functionName}: Token has expired`, {
      functionName,
      tokenPresent: !!token,
      tokenExpiresAt: localStorage.getItem('token_expires_at') || null,
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
 * Feeds OSM rate-limit quota from API responses back into the dispatch queue
 * so it throttles BEFORE OSM starts rejecting requests.
 * @param {Object} responseData - API response data containing rate limit info
 * @param {string} apiName - Name of the API call for logging context
 */
export function logRateLimitInfo(responseData, apiName) {
  const osm = responseData?._rateLimitInfo?.osm;
  if (!osm) return;

  globalRateLimitQueue.applyQuotaInfo(osm);

  if (osm.remaining < 20 && osm.limit > 0) {
    const percentUsed = ((osm.limit - osm.remaining) / osm.limit * 100).toFixed(1);
    logger.warn('OSM rate limit warning', {
      apiName,
      remaining: osm.remaining,
      percentUsed,
    }, LOG_CATEGORIES.API);
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

  if (response.status === 403) {
    throw new PermissionDeniedError(apiName);
  }

  // 401 trips the session circuit breaker via authHandler
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
        localStorage.setItem('osm_blocked', 'true');
        globalRateLimitQueue.clear('OSM API access is blocked');
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
 * Single request pipeline for all OSM-backend endpoints.
 *
 * Owns, in order: demo-mode short-circuit, TTL cache read, network check,
 * blocked/circuit-breaker guards, token validation, write-permission check,
 * the rate-limit queue, response handling, cache write, and cache fallback
 * on error. Endpoint functions declare WHAT they need; this owns HOW.
 *
 * @param {string} apiName - Endpoint name for logging/monitoring
 * @param {string} path - Backend path incl. query string (e.g. '/get-events?...')
 * @param {Object} opts
 * @param {string} opts.token - OSM auth token
 * @param {string} [opts.method='GET'] - HTTP method
 * @param {Object} [opts.body] - JSON body for POST requests
 * @param {boolean} [opts.write=false] - Marks OSM writes: blocks the call
 *   when the stored token is known-expired (checkWritePermission), jumps the
 *   read queue (priority 10), and errors instead of returning emptyValue
 *   when the request cannot be sent
 * @param {number} [opts.priority] - Explicit queue priority override
 * @param {Function} [opts.cacheRead] - async () => cached value or null.
 *   Used for every unavailable state (demo, offline, blocked, breaker), the
 *   TTL check, and the error fallback.
 * @param {Function} [opts.cacheWrite] - async (data) => void. Failures logged, not thrown.
 * @param {number} [opts.ttl] - Cache max-age in ms. With cacheRead: fresh cache
 *   is returned without hitting the network unless forceRefresh.
 * @param {boolean} [opts.forceRefresh=false] - Bypass the TTL check
 * @param {*} [opts.emptyValue=null] - Returned for reads in any unavailable
 *   state (demo/offline/blocked/breaker) with no cache; writes throw instead
 * @param {boolean} [opts.throwWhenUnavailable=false] - Throw instead of
 *   returning emptyValue when the request can't be made and no cache exists
 * @param {Function} [opts.transform] - Maps the raw response before cacheWrite
 *   and return (e.g. extract/patch the items array)
 * @returns {Promise<*>} Response data (with _rateLimitInfo stripped)
 */
export async function osmRequest(apiName, path, opts = {}) {
  const {
    token,
    method = 'GET',
    body,
    write = false,
    priority = write ? 10 : 0,
    cacheRead,
    cacheWrite,
    ttl,
    forceRefresh = false,
    emptyValue = null,
    throwWhenUnavailable = false,
    transform,
  } = opts;

  const unavailable = async (reason) => {
    // Writes must NEVER resolve via this path: a write that "succeeds"
    // without sending anything makes callers (e.g. the sign-in outbox)
    // discard the operation as synced. Offline/blocked/breaker are errors
    // for a write.
    if (write) {
      const err = new Error(`${apiName}: cannot send write - ${reason}`);
      err.code = 'WRITE_UNAVAILABLE';
      throw err;
    }
    if (cacheRead) {
      try {
        const cached = await cacheRead();
        if (cached !== null && cached !== undefined) return cached;
      } catch (cacheError) {
        logger.debug(`${apiName}: cache read failed`, { error: cacheError.message }, LOG_CATEGORIES.API);
      }
    }
    if (throwWhenUnavailable) {
      throw new Error(`${apiName}: ${reason} and no cached data available`);
    }
    return emptyValue;
  };

  if (isDemoMode()) {
    return unavailable('demo mode');
  }

  // Fresh-enough cache wins before any network activity
  if (cacheRead && ttl && !forceRefresh) {
    try {
      const cached = await cacheRead();
      const cachedAt = cached?._cacheTimestamp;
      if (cachedAt && Date.now() - cachedAt < ttl) {
        return cached;
      }
    } catch (cacheError) {
      logger.debug(`${apiName}: TTL cache read failed`, { error: cacheError.message }, LOG_CATEGORIES.API);
    }
  }

  const online = await checkNetworkStatus();
  if (!online) {
    return unavailable('offline');
  }

  if (localStorage.getItem('osm_blocked') === 'true') {
    return unavailable('OSM access blocked');
  }

  if (!authHandler.shouldMakeAPICall()) {
    return unavailable('authentication failed this session');
  }

  if (write) {
    validateTokenBeforeAPICall(token, apiName);
    checkWritePermission();
  } else {
    const tokenValidation = validateTokenBeforeAPICall(token, apiName, { allowMissingToken: true });
    if (!tokenValidation.isValid) {
      if (cacheRead) {
        try {
          const cached = await cacheRead();
          if (cached !== null && cached !== undefined) return cached;
        } catch (cacheError) {
          // warn, not debug: a cache failure here changes the user-visible
          // outcome (sign-in wall instead of cached data), so storage
          // problems must stay findable.
          logger.warn(`${apiName}: cache read failed`, { error: cacheError.message }, LOG_CATEGORIES.API);
        }
      }
      // Deliberately not emptyValue here: an empty flexi list would make rota
      // discovery falsely report "no rota set up" to a signed-out user.
      if (tokenValidation.reason === 'TOKEN_EXPIRED') {
        throw new TokenExpiredError(`Cannot call ${apiName} - authentication token has expired`);
      }
      const err = new Error('No authentication token');
      err.status = 401;
      err.code = 'NO_TOKEN';
      throw err;
    }
  }

  try {
    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      return await handleAPIResponseWithRateLimit(response, apiName);
    }, { priority });

    let result = data;
    if (data && data._rateLimitInfo) {
      const { _rateLimitInfo: _ignored, ...rest } = data;
      result = rest;
    }

    if (transform) {
      result = await transform(result);
    }

    if (cacheWrite && result !== null && result !== undefined) {
      try {
        await cacheWrite(result);
      } catch (cacheError) {
        logger.error(`${apiName}: cache write failed`, {
          error: cacheError.message,
        }, LOG_CATEGORIES.ERROR);
      }
    }

    return result;
  } catch (error) {
    // Writes must never silently return stale data as if the write succeeded
    if (write) throw error;

    logger.error(`${apiName} failed`, { error: error.message }, LOG_CATEGORIES.API);
    if (cacheRead) {
      try {
        const cached = await cacheRead();
        if (cached !== null && cached !== undefined) {
          logger.info(`${apiName}: using cached fallback after API error`, {}, LOG_CATEGORIES.API);
          return cached;
        }
      } catch (cacheError) {
        logger.debug(`${apiName}: cache fallback failed`, { error: cacheError.message }, LOG_CATEGORIES.API);
      }
    }
    throw error;
  }
}

/**
 * Tests connectivity to the backend API server
 * @returns {Promise<Object>} Connection test result with status
 */
export async function testBackendConnection() {
  if (isDemoMode()) {
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
    logger.error('Backend connection test error', { error: error }, LOG_CATEGORIES.API);
    return { status: 'error', error: error.message };
  }
}
