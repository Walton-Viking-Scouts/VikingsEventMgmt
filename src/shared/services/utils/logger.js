/**
 * @file Centralized logging service for Vikings Event Management Mobile
 * 
 * Provides structured logging with automatic Sentry integration, category-based
 * organization, and development console output. Supports template literals,
 * session tracking, and contextual metadata for comprehensive debugging.
 * 
 * Features:
 * - Multi-level logging (trace, debug, info, warn, error, fatal)
 * - Category-based log organization for filtering
 * - Automatic Sentry integration for production monitoring
 * - Session tracking and user context
 * - Platform detection (mobile, Capacitor, viewport)
 * - Template literal support for dynamic messages
 * - Development console output with emoji indicators
 * 
 * @module logger
 * @version 2.3.7
 * @since 2.3.7 - Created for centralized logging across the application
 * @author Vikings Event Management Team
 */

import * as Sentry from '@sentry/react';

// Environment configuration - Direct environment detection to avoid circular dependencies
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

/**
 * Available logging levels in order of severity
 * 
 * @constant {Object} LOG_LEVELS
 * @property {string} TRACE - Detailed tracing information for debugging
 * @property {string} DEBUG - Debug information for development
 * @property {string} INFO - General informational messages
 * @property {string} WARN - Warning messages for potential issues
 * @property {string} ERROR - Error conditions that need attention
 * @property {string} FATAL - Critical errors that may cause application failure
 * 
 * @example
 * // Using log levels
 * logger.trace('Detailed execution flow', data, LOG_CATEGORIES.API);
 * logger.info('User logged in', { userId }, LOG_CATEGORIES.AUTH);
 * logger.error('API call failed', { error }, LOG_CATEGORIES.API);
 * 
 * @since 2.3.7
 */
export const LOG_LEVELS = {
  TRACE: 'trace',
  DEBUG: 'debug', 
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
};

/**
 * Log categories for organizing and filtering log entries
 * 
 * @constant {Object} LOG_CATEGORIES
 * @property {string} APP - General application events and lifecycle
 * @property {string} API - API calls, responses, and network operations
 * @property {string} AUTH - Authentication and authorization events
 * @property {string} NAVIGATION - Route changes and navigation events
 * @property {string} USER_ACTION - User interactions and UI events
 * @property {string} PERFORMANCE - Performance metrics and timing
 * @property {string} OFFLINE - Offline mode and cached data operations
 * @property {string} SYNC - Data synchronization between local and remote
 * @property {string} COMPONENT - React component lifecycle and rendering
 * @property {string} HOOK - Custom hook operations and state changes
 * @property {string} ERROR - Error conditions and exception handling
 * 
 * @example
 * // Using categories for organized logging
 * logger.info('Member data synced', { count: 25 }, LOG_CATEGORIES.SYNC);
 * logger.warn('Network unavailable, using cache', {}, LOG_CATEGORIES.OFFLINE);
 * logger.error('Authentication failed', { error }, LOG_CATEGORIES.AUTH);
 * 
 * @since 2.3.7
 */
export const LOG_CATEGORIES = {
  APP: 'app',
  API: 'api',
  AUTH: 'auth',
  NAVIGATION: 'navigation',
  USER_ACTION: 'user-action',
  PERFORMANCE: 'performance',
  OFFLINE: 'offline',
  SYNC: 'sync',
  COMPONENT: 'component',
  HOOK: 'hook',
  ERROR: 'error',
};

// Create structured log entry
function createLogEntry(level, message, data = {}, category = LOG_CATEGORIES.APP) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    category,
    sessionId: getSessionId(),
    userId: getCurrentUserId(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    platform: getPlatformInfo(),
    ...data,
  };
}

// Get or create session ID
function getSessionId() {
  let sessionId = sessionStorage.getItem('logging_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('logging_session_id', sessionId);
  }
  return sessionId;
}

// Get current user ID if available
function getCurrentUserId() {
  const token = sessionStorage.getItem('access_token');
  return token ? 'authenticated' : 'anonymous';
}

// Get platform information
function getPlatformInfo() {
  return {
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
    isCapacitor: window.Capacitor !== undefined,
    platform: navigator.platform,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
}

// Format message with template literal support
function formatMessage(template, ...args) {
  if (typeof template === 'string' && args.length === 0) {
    return template;
  }
  
  if (Array.isArray(template)) {
    // Template literal usage: logger.info`User ${userId} performed action`
    return template.reduce((result, string, i) => {
      return result + string + (args[i] || '');
    }, '');
  }
  
  return template;
}

// Console output with styling for development
function outputToConsole(entry) {
  if (!isDevelopment) return;

  // Only show warnings, errors, and fatal logs - skip debug/info/trace for simplicity
  if (!['warn', 'error', 'fatal'].includes(entry.level)) {
    return;
  }

  const styles = {
    [LOG_LEVELS.WARN]: 'color: #orange',
    [LOG_LEVELS.ERROR]: 'color: #red',
    [LOG_LEVELS.FATAL]: 'color: #red; font-weight: bold',
  };

  const categoryEmojis = {
    [LOG_CATEGORIES.APP]: '🏠',
    [LOG_CATEGORIES.API]: '🌐',
    [LOG_CATEGORIES.AUTH]: '🔐',
    [LOG_CATEGORIES.NAVIGATION]: '🧭',
    [LOG_CATEGORIES.USER_ACTION]: '👆',
    [LOG_CATEGORIES.PERFORMANCE]: '⚡',
    [LOG_CATEGORIES.OFFLINE]: '📴',
    [LOG_CATEGORIES.SYNC]: '🔄',
    [LOG_CATEGORIES.COMPONENT]: '🧩',
    [LOG_CATEGORIES.HOOK]: '🪝',
    [LOG_CATEGORIES.ERROR]: '❌',
  };

  const emoji = categoryEmojis[entry.category] || '📝';
  const style = styles[entry.level] || '';

  console.log(`%c${emoji} [${entry.level.toUpperCase()}] ${entry.message}`, style);
}

// Send to Sentry with appropriate method
function sendToSentry(entry) {
  const { level, message, category, ...context } = entry;
  
  // Add category as tag for filtering
  Sentry.withScope((scope) => {
    scope.setTag('category', category);
    scope.setLevel(level);
    scope.setContext('log_entry', context);
    
    // Use appropriate Sentry method based on level
    if (level === LOG_LEVELS.ERROR || level === LOG_LEVELS.FATAL) {
      if (context.error) {
        scope.setContext('error_details', {
          message: context.error.message,
          stack: context.error.stack,
          name: context.error.name,
        });
        Sentry.captureException(context.error);
      } else {
        Sentry.captureMessage(message, level);
      }
    } else {
      // Use Sentry's structured logger for other levels
      if (Sentry.logger) {
        Sentry.logger[level](message, context);
      } else {
        // Fallback to captureMessage
        Sentry.captureMessage(message, level);
      }
    }
  });
}

// Core logging function
function log(level, messageTemplate, data = {}, category = LOG_CATEGORIES.APP, ...args) {
  const message = formatMessage(messageTemplate, ...args);
  const entry = createLogEntry(level, message, data, category);
  
  // Always output to console in development
  outputToConsole(entry);
  
  // Send to Sentry based on level and environment
  if (isProduction || level === LOG_LEVELS.ERROR || level === LOG_LEVELS.FATAL) {
    sendToSentry(entry);
  }
  
  return entry;
}

/**
 * Main logger interface with structured logging and Sentry integration
 * 
 * Provides logging methods for all severity levels with automatic Sentry
 * integration, session tracking, and development console output. Supports
 * template literals and contextual data for comprehensive debugging.
 * 
 * @namespace logger
 * @example
 * // Basic logging with categories
 * import logger, { LOG_CATEGORIES } from '@/shared/services/utils/logger.js';
 * 
 * logger.info('User logged in successfully', { userId: '123' }, LOG_CATEGORIES.AUTH);
 * logger.error('API call failed', { error, endpoint }, LOG_CATEGORIES.API);
 * logger.warn('Using cached data', { reason: 'offline' }, LOG_CATEGORIES.OFFLINE);
 * 
 * @example
 * // Template literal support
 * const userId = '123';
 * const action = 'login';
 * logger.info`User ${userId} performed ${action}`;
 * 
 * @example
 * // Error logging with context
 * try {
 *   await api.saveEvent(eventData);
 *   logger.info('Event saved successfully', { eventId: event.id }, LOG_CATEGORIES.API);
 * } catch (error) {
 *   logger.error('Failed to save event', { 
 *     error, 
 *     eventData: { id: event.id, title: event.title }
 *   }, LOG_CATEGORIES.ERROR);
 * }
 * 
 * @since 2.3.7
 */
export const logger = {
  /**
   * Log trace-level messages for detailed debugging
   * 
   * @param {string|Array} messageTemplate - Log message or template literal
   * @param {Object} [data={}] - Additional context data
   * @param {string} [category=LOG_CATEGORIES.APP] - Log category for filtering
   * @param {...*} args - Template literal arguments
   * @returns {Object} Created log entry
   * 
   * @example
   * logger.trace('Function entry', { params }, LOG_CATEGORIES.COMPONENT);
   */
  trace: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.TRACE, messageTemplate, data, category, ...args),
    
  /**
   * Log debug-level messages for development
   * 
   * @param {string|Array} messageTemplate - Log message or template literal
   * @param {Object} [data={}] - Additional context data
   * @param {string} [category=LOG_CATEGORIES.APP] - Log category for filtering
   * @param {...*} args - Template literal arguments
   * @returns {Object} Created log entry
   * 
   * @example
   * logger.debug('State updated', { newState }, LOG_CATEGORIES.HOOK);
   */
  debug: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.DEBUG, messageTemplate, data, category, ...args),
    
  /**
   * Log informational messages for general events
   * 
   * @param {string|Array} messageTemplate - Log message or template literal
   * @param {Object} [data={}] - Additional context data
   * @param {string} [category=LOG_CATEGORIES.APP] - Log category for filtering
   * @param {...*} args - Template literal arguments
   * @returns {Object} Created log entry
   * 
   * @example
   * logger.info('Data synced successfully', { recordCount: 25 }, LOG_CATEGORIES.SYNC);
   */
  info: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.INFO, messageTemplate, data, category, ...args),
    
  /**
   * Log warning messages for potential issues
   * 
   * @param {string|Array} messageTemplate - Log message or template literal
   * @param {Object} [data={}] - Additional context data
   * @param {string} [category=LOG_CATEGORIES.APP] - Log category for filtering
   * @param {...*} args - Template literal arguments
   * @returns {Object} Created log entry
   * 
   * @example
   * logger.warn('API response slow', { duration: 5000 }, LOG_CATEGORIES.PERFORMANCE);
   */
  warn: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.WARN, messageTemplate, data, category, ...args),
    
  /**
   * Log error messages that need attention
   * 
   * @param {string|Array} messageTemplate - Log message or template literal
   * @param {Object} [data={}] - Additional context data including error object
   * @param {string} [category=LOG_CATEGORIES.ERROR] - Log category for filtering
   * @param {...*} args - Template literal arguments
   * @returns {Object} Created log entry
   * 
   * @example
   * logger.error('Network request failed', { error, url }, LOG_CATEGORIES.API);
   */
  error: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.ERROR, messageTemplate, data, category, ...args),
    
  /**
   * Log fatal errors that may cause application failure
   * 
   * @param {string|Array} messageTemplate - Log message or template literal
   * @param {Object} [data={}] - Additional context data including error object
   * @param {string} [category=LOG_CATEGORIES.ERROR] - Log category for filtering
   * @param {...*} args - Template literal arguments
   * @returns {Object} Created log entry
   * 
   * @example
   * logger.fatal('Application crash', { error, stack }, LOG_CATEGORIES.ERROR);
   */
  fatal: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.FATAL, messageTemplate, data, category, ...args),
    
  /**
   * Format message template with arguments
   * 
   * @param {string|Array} template - Message template
   * @param {...*} args - Template arguments
   * @returns {string} Formatted message
   * 
   * @example
   * const msg = logger.fmt`User ${userId} saved event ${eventId}`;
   */
  fmt: (template, ...args) => formatMessage(template, ...args),
};

export default logger;
