// Sentry configuration for Vikings Event Management Mobile
import * as Sentry from "@sentry/react";

// Environment configuration
const environment = import.meta.env.NODE_ENV || 'development';
const release = import.meta.env.VITE_APP_VERSION || '1.0.0';
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

// Initialize Sentry
export function initSentry() {
  // Don't initialize Sentry if DSN is not provided
  if (!sentryDsn) {
    console.warn('Sentry DSN not provided, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    
    environment,
    release: `vikings-eventmgmt-mobile@${release}`,
    
    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    
    // Enable experimental features
    _experiments: {
      enableLogs: true,
    },
    
    // Integrations
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),
      
      // Console logging integration
      Sentry.consoleLoggingIntegration({ 
        levels: ["log", "error", "warn", "info"] 
      }),
      
      // Replay integration for debugging (only in production)
      ...(environment === 'production' ? [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        })
      ] : []),
    ],
    
    // Session replay sample rate
    replaysSessionSampleRate: environment === 'production' ? 0.1 : 0.0,
    replaysOnErrorSampleRate: 1.0,
    
    // Custom error filtering
    beforeSend(event, hint) {
      // Filter out development errors
      if (environment === 'development') {
        console.group('🔍 Sentry Event');
        console.log('Event:', event);
        console.log('Hint:', hint);
        console.groupEnd();
      }
      
      // Filter out network errors during offline mode
      if (event.exception) {
        const originalException = hint.originalException;
        if (originalException && originalException.message && 
            (originalException.message.includes('NetworkError') || 
             originalException.message.includes('Failed to fetch'))) {
          return null; // Don't send to Sentry
        }
      }
      
      return event;
    },
    
    // Initial scope configuration
    initialScope: {
      tags: {
        component: 'mobile-app',
        platform: 'react-capacitor',
      },
      context: {
        app: {
          name: 'Vikings Event Management Mobile',
          version: release,
        },
      },
    },
  });
  
  // Configure user context if available
  const token = sessionStorage.getItem('access_token');
  if (token) {
    try {
      // You might want to decode the token to get user info
      Sentry.setUser({
        id: 'authenticated-user',
        segment: 'mobile-app-users',
      });
    } catch {
      // Ignore token parsing errors
    }
  }
}

// Get the logger instance
export const logger = Sentry.logger;

// Utility functions for common Sentry operations
export const sentryUtils = {
  // Capture exceptions with context
  captureException: (error, context = {}) => {
    Sentry.withScope((scope) => {
      // Add context to the scope
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      
      Sentry.captureException(error);
    });
  },
  
  // Capture messages with level
  captureMessage: (message, level = 'info', context = {}) => {
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      
      Sentry.captureMessage(message);
    });
  },
  
  // Set user context
  setUser: (user) => {
    Sentry.setUser(user);
  },
  
  // Add breadcrumb
  addBreadcrumb: (breadcrumb) => {
    Sentry.addBreadcrumb(breadcrumb);
  },
  
  // Performance monitoring utilities
  startSpan: Sentry.startSpan,
  
  // Create transaction for long-running operations
  createTransaction: (name, operation = 'custom') => {
    return Sentry.startSpan({
      op: operation,
      name: name,
    });
  },
};

export default Sentry;