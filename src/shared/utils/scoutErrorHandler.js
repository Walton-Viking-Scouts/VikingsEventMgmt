/**
 * @file Scout-friendly error handling utilities
 *
 * Converts technical errors into clear, actionable messages appropriate for Scout leaders.
 * Replaces cryptic technical errors with user-friendly explanations and next steps.
 *
 * This utility follows the established simplification pattern - avoiding over-engineering
 * while providing practical error handling that Scout leaders can understand and act upon.
 *
 * @module scoutErrorHandler
 * @version 2.3.7
 * @since 2.3.7 - Created during error handling simplification
 * @author Vikings Event Management Team
 */

import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
import { notifyError, notifyWarning } from './notifications.js';

// Scout-friendly error messages mapped to common error patterns
const SCOUT_ERROR_MESSAGES = {
  // Network and connectivity errors
  NETWORK_ERROR: 'Unable to connect to OSM. Check your internet connection and try again.',
  TIMEOUT_ERROR: 'Request timed out. The server may be busy - please try again in a moment.',
  CONNECTION_REFUSED: 'Cannot reach the server. Check your internet connection.',
  DNS_ERROR: 'Network connection problem. Check your internet and try again.',

  // Authentication and permission errors
  AUTH_EXPIRED: 'Your session has expired. Please log in again to continue.',
  AUTH_INVALID: 'Login credentials are invalid. Please try logging in again.',
  PERMISSION_DENIED: 'You don\'t have permission for this action. Contact your section admin.',
  ACCESS_FORBIDDEN: 'Access denied. Please check your OSM permissions.',

  // Data and sync errors
  SYNC_FAILED: 'Unable to sync data from OSM. Check your connection and try refreshing.',
  DATA_CORRUPTED: 'Some data couldn\'t be loaded. Try refreshing to reload from OSM.',
  MISSING_DATA: 'Required information is missing. Try syncing from OSM again.',
  INVALID_DATA: 'The data format is invalid. Please contact support if this continues.',

  // Server and API errors
  SERVER_ERROR: 'OSM server is having problems. Please try again in a few minutes.',
  SERVICE_UNAVAILABLE: 'OSM service is temporarily unavailable. Try again later.',
  RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
  API_ERROR: 'There was a problem with OSM. Please try again or contact support.',

  // File and storage errors
  STORAGE_FULL: 'Device storage is full. Free up space and try again.',
  FILE_TOO_LARGE: 'File is too large to upload. Please use a smaller file.',
  UNSUPPORTED_FILE: 'File type not supported. Please use a different file.',
  SAVE_FAILED: 'Unable to save changes. Check storage space and try again.',

  // Generic fallback
  UNKNOWN_ERROR: 'Something went wrong. Please try again or contact support if this continues.',
};

// Error type detection patterns
const ERROR_PATTERNS = {
  // Network related
  network: [
    /network/i,
    /fetch/i,
    /connection/i,
    /cors/i,
    /timeout/i,
    /refused/i,
    /dns/i,
    /unreachable/i,
  ],

  // Authentication related
  auth: [
    /unauthorized/i,
    /authentication/i,
    /token/i,
    /login/i,
    /session/i,
    /expired/i,
  ],

  // Permission related
  permission: [
    /forbidden/i,
    /permission/i,
    /access.*denied/i,
    /not.*allowed/i,
  ],

  // Server related
  server: [
    /server.*error/i,
    /internal.*error/i,
    /service.*unavailable/i,
    /bad.*gateway/i,
    /gateway.*timeout/i,
  ],

  // Data related
  data: [
    /parse/i,
    /json/i,
    /invalid.*data/i,
    /corrupt/i,
    /missing.*data/i,
  ],

  // Storage related
  storage: [
    /storage/i,
    /quota/i,
    /disk.*full/i,
    /space/i,
  ],
};

/**
 * Converts technical errors to Scout-friendly messages
 *
 * Takes any error (Error object, string, or API response) and converts it to a
 * clear, actionable message that Scout leaders can understand. Automatically
 * logs technical details while showing user-friendly messages.
 *
 * @param {Error|string|Object} error - The error to convert
 * @param {string} [context=''] - Optional context about what was being done
 * @returns {string} Scout-friendly error message
 *
 * @example
 * // Basic error conversion
 * try {
 *   await syncData();
 * } catch (error) {
 *   const message = getScoutFriendlyMessage(error);
 *   notifyError(message);
 * }
 *
 * @example
 * // Error with context
 * const message = getScoutFriendlyMessage(error, 'loading member data');
 * // Returns: "Unable to load member data. Check your internet connection and try again."
 */
export function getScoutFriendlyMessage(error, context = '') {
  let errorMessage = '';
  let errorDetails = null;

  // Extract error message from different error types
  if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = {
      name: error.name,
      stack: error.stack,
      message: error.message,
    };
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    errorMessage = error.message || error.error || error.statusText || JSON.stringify(error);
    errorDetails = error;
  } else {
    errorMessage = String(error);
  }

  // Log technical details for debugging
  logger.error('Converting error to Scout-friendly message', {
    originalError: errorMessage,
    context,
    errorDetails,
  }, LOG_CATEGORIES.ERROR);

  // Determine error type and get appropriate message
  const scoutMessage = categorizeAndConvertError(errorMessage, context);

  return scoutMessage;
}

/**
 * Categorizes error and returns appropriate Scout-friendly message
 *
 * @param {string} errorMessage - Technical error message
 * @param {string} context - Context of what was being done
 * @returns {string} Scout-friendly message
 */
function categorizeAndConvertError(errorMessage, context) {
  const lowerMessage = errorMessage.toLowerCase();

  // Check for specific HTTP status codes first
  if (errorMessage.includes('401') || errorMessage.includes('403')) {
    return context
      ? `Unable to ${context}. ${SCOUT_ERROR_MESSAGES.PERMISSION_DENIED}`
      : SCOUT_ERROR_MESSAGES.PERMISSION_DENIED;
  }

  if (errorMessage.includes('404')) {
    return context
      ? `Unable to ${context}. The requested information wasn't found.`
      : 'The requested information wasn\'t found.';
  }

  if (errorMessage.includes('429')) {
    return SCOUT_ERROR_MESSAGES.RATE_LIMITED;
  }

  if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
    return SCOUT_ERROR_MESSAGES.SERVER_ERROR;
  }

  // Check error patterns
  for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(lowerMessage))) {
      return getMessageForCategory(category, context);
    }
  }

  // Default fallback with context
  return context
    ? `Unable to ${context}. ${SCOUT_ERROR_MESSAGES.UNKNOWN_ERROR}`
    : SCOUT_ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Gets Scout-friendly message for error category
 *
 * @param {string} category - Error category
 * @param {string} context - Context of operation
 * @returns {string} Scout-friendly message
 */
function getMessageForCategory(category, context) {
  const baseMessages = {
    network: SCOUT_ERROR_MESSAGES.NETWORK_ERROR,
    auth: SCOUT_ERROR_MESSAGES.AUTH_EXPIRED,
    permission: SCOUT_ERROR_MESSAGES.PERMISSION_DENIED,
    server: SCOUT_ERROR_MESSAGES.SERVER_ERROR,
    data: SCOUT_ERROR_MESSAGES.DATA_CORRUPTED,
    storage: SCOUT_ERROR_MESSAGES.STORAGE_FULL,
  };

  const baseMessage = baseMessages[category] || SCOUT_ERROR_MESSAGES.UNKNOWN_ERROR;

  if (context) {
    // Add context to make the message more specific
    const contextualPrefixes = {
      network: `Unable to ${context}.`,
      auth: `Unable to ${context}.`,
      permission: `Unable to ${context}.`,
      server: `Unable to ${context}.`,
      data: `Unable to ${context}.`,
      storage: `Unable to ${context}.`,
    };

    const prefix = contextualPrefixes[category] || `Unable to ${context}.`;
    return `${prefix} ${baseMessage}`;
  }

  return baseMessage;
}

/**
 * Handles errors with automatic notification display
 *
 * Converts error to Scout-friendly message and displays appropriate notification.
 * Returns the friendly message for additional handling if needed.
 *
 * @param {Error|string|Object} error - The error to handle
 * @param {string} [context=''] - Context of what was being done
 * @param {Object} [options={}] - Handling options
 * @param {boolean} [options.showNotification=true] - Whether to show notification
 * @param {boolean} [options.isWarning=false] - Show as warning instead of error
 * @returns {string} Scout-friendly error message
 *
 * @example
 * // Auto-notify error
 * try {
 *   await loadData();
 * } catch (error) {
 *   handleScoutError(error, 'loading member data');
 * }
 *
 * @example
 * // Handle without notification
 * const message = handleScoutError(error, 'syncing', { showNotification: false });
 * // Use message for custom handling
 *
 * @example
 * // Show as warning for non-critical errors
 * handleScoutError(error, 'background sync', { isWarning: true });
 */
export function handleScoutError(error, context = '', options = {}) {
  const {
    showNotification = true,
    isWarning = false,
  } = options;

  const scoutMessage = getScoutFriendlyMessage(error, context);

  if (showNotification) {
    if (isWarning) {
      notifyWarning(scoutMessage);
    } else {
      notifyError(scoutMessage, error instanceof Error ? error : null);
    }
  }

  return scoutMessage;
}

/**
 * Creates a simple error handler function for common async operations
 *
 * Returns a pre-configured error handler that automatically converts and displays
 * Scout-friendly error messages. Useful for consistent error handling across components.
 *
 * @param {string} context - What operation is being performed
 * @param {Object} [options={}] - Handler options
 * @returns {Function} Error handler function
 *
 * @example
 * // Create reusable error handler
 * const handleSyncError = createErrorHandler('syncing attendance data');
 *
 * try {
 *   await syncAttendance();
 * } catch (error) {
 *   handleSyncError(error);
 * }
 *
 * @example
 * // Handler with custom options
 * const handleBackgroundError = createErrorHandler('background sync', {
 *   isWarning: true,
 *   showNotification: true
 * });
 */
export function createErrorHandler(context, options = {}) {
  return (error) => handleScoutError(error, context, options);
}

/**
 * Common error handlers for typical Scout app operations
 * Pre-configured handlers for frequent operations in the app
 */
export const commonErrorHandlers = {
  sync: createErrorHandler('syncing data from OSM'),
  load: createErrorHandler('loading data'),
  save: createErrorHandler('saving changes'),
  upload: createErrorHandler('uploading file'),
  login: createErrorHandler('logging in'),
  refresh: createErrorHandler('refreshing data'),
  search: createErrorHandler('searching'),
  export: createErrorHandler('exporting data'),
};

/**
 * Utility to check if an error indicates offline status
 *
 * @param {Error|string|Object} error - Error to check
 * @returns {boolean} True if error indicates offline condition
 */
export function isOfflineError(error) {
  const message = error?.message || String(error);
  const offlinePatterns = [
    /fetch.*failed/i,
    /network.*error/i,
    /network.*request.*failed/i,
    /failed.*to.*fetch/i,
    /connection.*refused/i,
    /no.*internet/i,
  ];

  return offlinePatterns.some(pattern => pattern.test(message));
}

export default {
  getScoutFriendlyMessage,
  handleScoutError,
  createErrorHandler,
  commonErrorHandlers,
  isOfflineError,
};