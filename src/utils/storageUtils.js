// Safe storage utilities with structured logging
import { sentryUtils } from '../services/sentry.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

/**
 * Safely get and parse an item from localStorage with structured error logging
 * @param {string} key - Storage key to retrieve
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} Parsed value or default value
 * @example
 * // Get cached user preferences with fallback
 * const preferences = safeGetItem('user_preferences', { theme: 'light' });
 * 
 * // Get array data with empty array fallback
 * const sections = safeGetItem('viking_sections_offline', []);
 */
export function safeGetItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    // Log to structured logger with context
    logger.warn('Storage retrieval failed', {
      operation: 'localStorage.getItem',
      key,
      error: error.message,
      hasDefaultValue: defaultValue !== null,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // Capture exception with Sentry
    sentryUtils.captureException(error, {
      tags: {
        operation: 'storage_get',
        storage_type: 'localStorage',
      },
      contexts: {
        storage: {
          key,
          hasDefaultValue: defaultValue !== null,
          defaultValueType: typeof defaultValue,
        },
      },
    });

    return defaultValue;
  }
}

/**
 * Safely set an item in localStorage with JSON serialization and structured error logging
 * @param {string} key - Storage key to set
 * @param {*} value - Value to store (will be JSON serialized)
 * @returns {boolean} True if successful, false otherwise
 * @example
 * // Store user preferences
 * const success = safeSetItem('user_preferences', { theme: 'dark', language: 'en' });
 * 
 * // Store array data
 * const success = safeSetItem('viking_sections_offline', sections);
 */
export function safeSetItem(key, value) {
  try {
    // Handle undefined values to prevent storing "undefined" string
    const serializedValue = value === undefined ? 'null' : JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
    return true;
  } catch (error) {
    // Log to structured logger with context
    logger.warn('Storage write failed', {
      operation: 'localStorage.setItem',
      key,
      valueType: typeof value,
      isArray: Array.isArray(value),
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // Capture exception with Sentry
    sentryUtils.captureException(error, {
      tags: {
        operation: 'storage_set',
        storage_type: 'localStorage',
      },
      contexts: {
        storage: {
          key,
          valueType: typeof value,
          isArray: Array.isArray(value),
          estimatedSize: 'N/A (serialization failed)',
        },
      },
    });

    return false;
  }
}

/**
 * Safely get and parse an item from sessionStorage with structured error logging
 * @param {string} key - Storage key to retrieve
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} Parsed value or default value
 * @example
 * // Get authentication token with fallback
 * const token = safeGetSessionItem('auth_token', null);
 * 
 * // Get temporary state with object fallback
 * const state = safeGetSessionItem('temp_state', { initialized: false });
 */
export function safeGetSessionItem(key, defaultValue = null) {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    // Log to structured logger with context
    logger.warn('Session storage retrieval failed', {
      operation: 'sessionStorage.getItem',
      key,
      error: error.message,
      hasDefaultValue: defaultValue !== null,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // Capture exception with Sentry
    sentryUtils.captureException(error, {
      tags: {
        operation: 'storage_get',
        storage_type: 'sessionStorage',
      },
      contexts: {
        storage: {
          key,
          hasDefaultValue: defaultValue !== null,
          defaultValueType: typeof defaultValue,
        },
      },
    });

    return defaultValue;
  }
}

/**
 * Safely set an item in sessionStorage with JSON serialization and structured error logging
 * @param {string} key - Storage key to set
 * @param {*} value - Value to store (will be JSON serialized)
 * @returns {boolean} True if successful, false otherwise
 * @example
 * // Store authentication token
 * const success = safeSetSessionItem('auth_token', tokenData);
 * 
 * // Store temporary application state
 * const success = safeSetSessionItem('temp_state', { step: 2, data: formData });
 */
export function safeSetSessionItem(key, value) {
  try {
    // Handle undefined values to prevent storing "undefined" string
    const serializedValue = value === undefined ? 'null' : JSON.stringify(value);
    sessionStorage.setItem(key, serializedValue);
    return true;
  } catch (error) {
    // Log to structured logger with context
    logger.warn('Session storage write failed', {
      operation: 'sessionStorage.setItem',
      key,
      valueType: typeof value,
      isArray: Array.isArray(value),
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // Capture exception with Sentry
    sentryUtils.captureException(error, {
      tags: {
        operation: 'storage_set',
        storage_type: 'sessionStorage',
      },
      contexts: {
        storage: {
          key,
          valueType: typeof value,
          isArray: Array.isArray(value),
          estimatedSize: 'N/A (serialization failed)',
        },
      },
    });

    return false;
  }
}
/**
 * Enhanced caching utility with comprehensive error handling and logging
 * Provides standardized caching pattern to avoid silent failures in production
 * 
 * @param {string} cacheKey - Cache key for localStorage
 * @param {any} data - Data to cache
 * @param {string} category - Log category for structured logging
 * @param {Object} context - Additional context for logging
 * @returns {boolean} Success status of caching operation
 * 
 * @example
 * // Cache API response data
 * const success = safeCacheWithLogging(
 *   'viking_members_offline',
 *   membersData,
 *   LOG_CATEGORIES.API,
 *   { sectionId: '12345', operation: 'sync_members' }
 * );
 */
export async function safeCacheWithLogging(cacheKey, data, category, context = {}) {
  // Dynamic imports to avoid circular dependencies
  const { default: logger, LOG_CATEGORIES } = await import('../services/logger.js');
  const { sentryUtils } = await import('../services/sentry.js');
  
  try {
    // Add timestamp for TTL-based caching
    const cachedData = { 
      ...data, 
      _cacheTimestamp: Date.now(), 
    };
    
    const success = safeSetItem(cacheKey, cachedData);
    
    // Enhanced logging with data insights
    const logContext = {
      cacheKey,
      dataSize: JSON.stringify(cachedData).length,
      itemCount: Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : 0),
      hasTimestamp: !!data._cacheTimestamp,
      ...context,
    };
    
    if (success) {
      logger.info('Data successfully cached', logContext, category || LOG_CATEGORIES.API);
    } else {
      logger.error('Data caching failed - safeSetItem returned false', logContext, LOG_CATEGORIES.ERROR);
    }
    
    return success;
    
  } catch (error) {
    const errorContext = {
      cacheKey,
      error: error.message,
      errorType: error.name,
      dataType: typeof data,
      isArray: Array.isArray(data),
      ...context,
    };
    
    logger.error('Data caching error - exception thrown', errorContext, LOG_CATEGORIES.ERROR);
    
    sentryUtils.captureException(error, {
      tags: {
        operation: 'safe_cache_with_logging',
        cache_key: cacheKey,
      },
      contexts: {
        caching: errorContext,
      },
    });
    
    return false;
  }
}
