// Specialized logging utilities for common frontend scenarios
import logger, { LOG_CATEGORIES } from './logger.js';

// API Call Logging
export const apiLogger = {
  // Log API request start
  requestStart: (endpoint, options = {}) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info(`API Request: ${endpoint}`, {
      requestId,
      endpoint,
      method: options.method || 'GET',
      hasAuth: !!options.headers?.Authorization,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.API);
    
    return requestId;
  },
  
  // Log successful API response
  requestSuccess: (endpoint, requestId, response, responseData) => {
    logger.info(`API Success: ${endpoint}`, {
      requestId,
      endpoint,
      status: response.status,
      responseSize: JSON.stringify(responseData || {}).length,
      duration: Date.now() - parseInt(requestId.split('_')[1]),
      hasData: !!responseData,
      dataKeys: responseData ? Object.keys(responseData) : [],
    }, LOG_CATEGORIES.API);
  },
  
  // Log API errors
  requestError: (endpoint, requestId, error, response = null) => {
    logger.error(`API Error: ${endpoint}`, {
      requestId,
      endpoint,
      error: error.message,
      status: response?.status,
      statusText: response?.statusText,
      duration: Date.now() - parseInt(requestId.split('_')[1]),
      stack: error.stack,
    }, LOG_CATEGORIES.API);
  },
  
  // Log rate limiting
  rateLimited: (endpoint, requestId, rateLimitInfo) => {
    logger.warn(`API Rate Limited: ${endpoint}`, {
      requestId,
      endpoint,
      rateLimitInfo,
    }, LOG_CATEGORIES.API);
  },
};

// User Action Logging
export const userLogger = {
  // User interactions
  click: (element, context = {}) => {
    logger.info(`User clicked: ${element}`, {
      element,
      context,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.USER_ACTION);
  },
  
  // Form interactions
  formSubmit: (formName, formData = {}) => {
    logger.info(`Form submitted: ${formName}`, {
      formName,
      fieldCount: Object.keys(formData).length,
      fields: Object.keys(formData),
    }, LOG_CATEGORIES.USER_ACTION);
  },
  
  formError: (formName, errors) => {
    logger.warn(`Form validation errors: ${formName}`, {
      formName,
      errors,
      errorCount: Array.isArray(errors) ? errors.length : Object.keys(errors).length,
    }, LOG_CATEGORIES.USER_ACTION);
  },
  
  // Search and filter actions
  search: (query, filters = {}) => {
    logger.info(`User search: "${query}"`, {
      query,
      filters,
      queryLength: query.length,
      hasFilters: Object.keys(filters).length > 0,
    }, LOG_CATEGORIES.USER_ACTION);
  },
};

// Navigation Logging
export const navigationLogger = {
  // Page/route navigation
  navigate: (from, to, method = 'unknown') => {
    logger.info(`Navigation: ${from} → ${to}`, {
      from,
      to,
      method, // 'link', 'button', 'programmatic', 'back', 'forward'
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.NAVIGATION);
  },
  
  // Page load timing
  pageLoad: (page, loadTime) => {
    logger.info(`Page loaded: ${page}`, {
      page,
      loadTime,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.PERFORMANCE);
  },
  
  // Component mount/unmount
  componentMount: (componentName, props = {}) => {
    logger.debug(`Component mounted: ${componentName}`, {
      componentName,
      propCount: Object.keys(props).length,
      props: isDevelopment() ? props : {},
    }, LOG_CATEGORIES.COMPONENT);
  },
  
  componentUnmount: (componentName) => {
    logger.debug(`Component unmounted: ${componentName}`, {
      componentName,
    }, LOG_CATEGORIES.COMPONENT);
  },
};

// Authentication Logging
export const authLogger = {
  // Login/logout events
  loginAttempt: (method) => {
    logger.info(`Login attempt: ${method}`, {
      method,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.AUTH);
  },
  
  loginSuccess: (method, userInfo = {}) => {
    logger.info(`Login successful: ${method}`, {
      method,
      hasUserInfo: !!userInfo,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.AUTH);
  },
  
  loginFailure: (method, error) => {
    logger.warn(`Login failed: ${method}`, {
      method,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.AUTH);
  },
  
  logout: (method = 'manual') => {
    logger.info(`User logout: ${method}`, {
      method,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.AUTH);
  },
  
  tokenRefresh: (success, error = null) => {
    if (success) {
      logger.debug('Token refreshed successfully', {}, LOG_CATEGORIES.AUTH);
    } else {
      logger.warn('Token refresh failed', {
        error: error?.message,
      }, LOG_CATEGORIES.AUTH);
    }
  },
};

// Performance Logging
export const performanceLogger = {
  // Timing measurements
  startTiming: (operation) => {
    const timingId = `timing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${operation}_start`);
    }
    
    logger.debug(`Performance timing started: ${operation}`, {
      timingId,
      operation,
    }, LOG_CATEGORIES.PERFORMANCE);
    
    return timingId;
  },
  
  endTiming: (operation, timingId) => {
    let duration = 0;
    
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${operation}_end`);
      performance.measure(operation, `${operation}_start`, `${operation}_end`);
      
      const measure = performance.getEntriesByName(operation)[0];
      duration = measure ? measure.duration : 0;
      
      // Clean up performance marks
      performance.clearMarks(`${operation}_start`);
      performance.clearMarks(`${operation}_end`);
      performance.clearMeasures(operation);
    }
    
    logger.info(`Performance timing: ${operation}`, {
      timingId,
      operation,
      duration: Math.round(duration),
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.PERFORMANCE);
    
    return duration;
  },
  
  // Memory usage
  memoryUsage: (context = '') => {
    if (typeof performance !== 'undefined' && performance.memory) {
      logger.debug(`Memory usage${context ? `: ${context}` : ''}`, {
        context,
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      }, LOG_CATEGORIES.PERFORMANCE);
    }
  },
};

// Offline/Sync Logging
export const offlineLogger = {
  // Network status changes
  networkStatusChange: (isOnline) => {
    logger.info(`Network status: ${isOnline ? 'online' : 'offline'}`, {
      isOnline,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.OFFLINE);
  },
  
  // Data sync events
  syncStart: (dataType) => {
    logger.info(`Sync started: ${dataType}`, {
      dataType,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.SYNC);
  },
  
  syncSuccess: (dataType, recordCount) => {
    logger.info(`Sync successful: ${dataType}`, {
      dataType,
      recordCount,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.SYNC);
  },
  
  syncError: (dataType, error) => {
    logger.error(`Sync failed: ${dataType}`, {
      dataType,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.SYNC);
  },
};

// Error Logging
export const errorLogger = {
  // Component errors
  componentError: (componentName, error, errorInfo = {}) => {
    logger.error(`Component error: ${componentName}`, {
      componentName,
      error: error.message,
      stack: error.stack,
      errorInfo,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.ERROR);
  },
  
  // Hook errors
  hookError: (hookName, error) => {
    logger.error(`Hook error: ${hookName}`, {
      hookName,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.HOOK);
  },
  
  // Boundary errors
  boundaryError: (boundaryName, error, errorInfo) => {
    logger.fatal(`Error boundary caught: ${boundaryName}`, {
      boundaryName,
      error: error.message,
      stack: error.stack,
      errorInfo,
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.ERROR);
  },
};

// Utility functions
function isDevelopment() {
  return import.meta.env.NODE_ENV === 'development';
}

// Export all utilities
export {
  logger as default,
  LOG_CATEGORIES,
} from './logger.js';
