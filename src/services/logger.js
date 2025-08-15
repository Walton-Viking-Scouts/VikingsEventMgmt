// Centralized logging service for Vikings Event Management Mobile
import * as Sentry from '@sentry/react';
import { config } from '../config/env.js';

// Environment configuration - Use robust detection from config
const isDevelopment = config.actualEnvironment === 'development';
const isProduction = config.actualEnvironment === 'production';

// Log levels
export const LOG_LEVELS = {
  TRACE: 'trace',
  DEBUG: 'debug', 
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
};

// Log categories for filtering and organization
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
  
  const styles = {
    [LOG_LEVELS.TRACE]: 'color: #gray',
    [LOG_LEVELS.DEBUG]: 'color: #blue', 
    [LOG_LEVELS.INFO]: 'color: #green',
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
  
  // Simple console log - no detailed object logging to prevent data leakage
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

// Logger interface
export const logger = {
  // Template literal support: logger.info`Message with ${variable}`
  trace: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.TRACE, messageTemplate, data, category, ...args),
    
  debug: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.DEBUG, messageTemplate, data, category, ...args),
    
  info: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.INFO, messageTemplate, data, category, ...args),
    
  warn: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.WARN, messageTemplate, data, category, ...args),
    
  error: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.ERROR, messageTemplate, data, category, ...args),
    
  fatal: (messageTemplate, data, category, ...args) => 
    log(LOG_LEVELS.FATAL, messageTemplate, data, category, ...args),
    
  // Convenience methods for common patterns
  fmt: (template, ...args) => formatMessage(template, ...args),
};

export default logger;
