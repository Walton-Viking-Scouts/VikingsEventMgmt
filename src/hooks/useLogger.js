// React hooks for logging functionality
import { useEffect, useRef, useCallback } from 'react';
import { 
  logger, 
  apiLogger, 
  userLogger, 
  navigationLogger, 
  authLogger, 
  performanceLogger,
  errorLogger,
  LOG_CATEGORIES 
} from '../services/loggerUtils.js';

// Hook for component lifecycle logging
export function useComponentLogger(componentName, props = {}) {
  const mountTimeRef = useRef(null);
  
  useEffect(() => {
    mountTimeRef.current = Date.now();
    navigationLogger.componentMount(componentName, props);
    
    return () => {
      const mountDuration = Date.now() - mountTimeRef.current;
      navigationLogger.componentUnmount(componentName);
      
      // Log long-lived components for performance monitoring
      if (mountDuration > 30000) { // 30 seconds
        performanceLogger.memoryUsage(`${componentName} unmount after ${mountDuration}ms`);
      }
    };
  }, [componentName]);
  
  // Return logger functions scoped to this component
  return {
    logUserAction: useCallback((action, data = {}) => {
      userLogger.click(action, { component: componentName, ...data });
    }, [componentName]),
    
    logError: useCallback((error, context = {}) => {
      errorLogger.componentError(componentName, error, context);
    }, [componentName]),
    
    logInfo: useCallback((message, data = {}) => {
      logger.info(`${componentName}: ${message}`, { component: componentName, ...data }, LOG_CATEGORIES.COMPONENT);
    }, [componentName]),
    
    logDebug: useCallback((message, data = {}) => {
      logger.debug(`${componentName}: ${message}`, { component: componentName, ...data }, LOG_CATEGORIES.COMPONENT);
    }, [componentName])
  };
}

// Hook for API call logging
export function useApiLogger() {
  return {
    logRequest: useCallback((endpoint, options = {}) => {
      return apiLogger.requestStart(endpoint, options);
    }, []),
    
    logSuccess: useCallback((endpoint, requestId, response, data) => {
      apiLogger.requestSuccess(endpoint, requestId, response, data);
    }, []),
    
    logError: useCallback((endpoint, requestId, error, response = null) => {
      apiLogger.requestError(endpoint, requestId, error, response);
    }, []),
    
    logRateLimit: useCallback((endpoint, requestId, rateLimitInfo) => {
      apiLogger.rateLimited(endpoint, requestId, rateLimitInfo);
    }, [])
  };
}

// Hook for performance timing
export function usePerformanceLogger() {
  const timingsRef = useRef(new Map());
  
  const startTiming = useCallback((operation) => {
    const timingId = performanceLogger.startTiming(operation);
    timingsRef.current.set(operation, timingId);
    return timingId;
  }, []);
  
  const endTiming = useCallback((operation) => {
    const timingId = timingsRef.current.get(operation);
    if (timingId) {
      const duration = performanceLogger.endTiming(operation, timingId);
      timingsRef.current.delete(operation);
      return duration;
    }
    return 0;
  }, []);
  
  // Cleanup timings on unmount
  useEffect(() => {
    return () => {
      timingsRef.current.clear();
    };
  }, []);
  
  return {
    startTiming,
    endTiming,
    logMemoryUsage: useCallback((context) => {
      performanceLogger.memoryUsage(context);
    }, [])
  };
}

// Hook for navigation logging
export function useNavigationLogger() {
  const previousLocationRef = useRef(window.location.pathname);
  
  useEffect(() => {
    const currentLocation = window.location.pathname;
    if (previousLocationRef.current !== currentLocation) {
      navigationLogger.navigate(previousLocationRef.current, currentLocation, 'programmatic');
      previousLocationRef.current = currentLocation;
    }
  });
  
  return {
    logNavigation: useCallback((to, method = 'link') => {
      const from = window.location.pathname;
      navigationLogger.navigate(from, to, method);
    }, []),
    
    logPageLoad: useCallback((page, loadTime) => {
      navigationLogger.pageLoad(page, loadTime);
    }, [])
  };
}

// Hook for form logging
export function useFormLogger(formName) {
  return {
    logSubmit: useCallback((formData) => {
      userLogger.formSubmit(formName, formData);
    }, [formName]),
    
    logValidationError: useCallback((errors) => {
      userLogger.formError(formName, errors);
    }, [formName]),
    
    logFieldInteraction: useCallback((fieldName, value) => {
      logger.debug(`Form field interaction: ${formName}.${fieldName}`, {
        formName,
        fieldName,
        hasValue: !!value,
        valueLength: value ? value.toString().length : 0
      }, LOG_CATEGORIES.USER_ACTION);
    }, [formName])
  };
}

// Hook for authentication logging
export function useAuthLogger() {
  return {
    logLoginAttempt: useCallback((method) => {
      authLogger.loginAttempt(method);
    }, []),
    
    logLoginSuccess: useCallback((method, userInfo) => {
      authLogger.loginSuccess(method, userInfo);
    }, []),
    
    logLoginFailure: useCallback((method, error) => {
      authLogger.loginFailure(method, error);
    }, []),
    
    logLogout: useCallback((method = 'manual') => {
      authLogger.logout(method);
    }, []),
    
    logTokenRefresh: useCallback((success, error = null) => {
      authLogger.tokenRefresh(success, error);
    }, [])
  };
}

// Hook for offline/sync logging
export function useOfflineLogger() {
  return {
    logNetworkChange: useCallback((isOnline) => {
      offlineLogger.networkStatusChange(isOnline);
    }, []),
    
    logSyncStart: useCallback((dataType) => {
      offlineLogger.syncStart(dataType);
    }, []),
    
    logSyncSuccess: useCallback((dataType, recordCount) => {
      offlineLogger.syncSuccess(dataType, recordCount);
    }, []),
    
    logSyncError: useCallback((dataType, error) => {
      offlineLogger.syncError(dataType, error);
    }, [])
  };
}

// Hook for error boundary logging
export function useErrorLogger() {
  return {
    logError: useCallback((error, errorInfo, context = {}) => {
      errorLogger.boundaryError('ErrorBoundary', error, { ...errorInfo, ...context });
    }, []),
    
    logComponentError: useCallback((componentName, error, context = {}) => {
      errorLogger.componentError(componentName, error, context);
    }, []),
    
    logHookError: useCallback((hookName, error) => {
      errorLogger.hookError(hookName, error);
    }, [])
  };
}

// General logging hook with all utilities
export function useLogger(context = {}) {
  return {
    trace: useCallback((message, data = {}) => {
      logger.trace(message, { ...context, ...data });
    }, [context]),
    
    debug: useCallback((message, data = {}) => {
      logger.debug(message, { ...context, ...data });
    }, [context]),
    
    info: useCallback((message, data = {}) => {
      logger.info(message, { ...context, ...data });
    }, [context]),
    
    warn: useCallback((message, data = {}) => {
      logger.warn(message, { ...context, ...data });
    }, [context]),
    
    error: useCallback((message, data = {}) => {
      logger.error(message, { ...context, ...data });
    }, [context]),
    
    fatal: useCallback((message, data = {}) => {
      logger.fatal(message, { ...context, ...data });
    }, [context])
  };
}