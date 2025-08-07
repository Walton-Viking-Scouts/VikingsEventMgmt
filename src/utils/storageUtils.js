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