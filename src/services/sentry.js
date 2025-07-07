// Sentry configuration for Vikings Event Management Mobile
import * as Sentry from '@sentry/react';
import packageJson from '../../package.json';
import { config } from '../config/env.js';

// Environment configuration
const environment = import.meta.env.NODE_ENV || 'development';
const release = packageJson.version;
const sentryDsn = config.sentryDsn;

// Initialize Sentry
export function initSentry() {
  // Don't initialize Sentry if DSN is not provided
  if (!sentryDsn) {
    console.warn('Sentry DSN not provided, skipping initialization');
    return;
  }

  console.log('🔧 Initializing Sentry with DSN:', sentryDsn ? 'Present' : 'Missing');
  console.log('🔧 Environment:', environment);

  Sentry.init({
    dsn: sentryDsn,
    
    environment,
    release: `vikings-eventmgmt-mobile@${release}`,
    
    // Performance monitoring - disabled to prevent OAuth interference
    tracesSampleRate: 0,
    
    // Enable experimental features
    _experiments: {
      enableLogs: true,
    },
    
    // Integrations
    integrations: [
      // Browser tracing for performance monitoring - disabled for OAuth compatibility
      // Sentry.browserTracingIntegration({
      //   // Don't track external OAuth URLs as requests - this prevents
      //   // Sentry from intercepting window.location.href navigation to OSM
      //   traceFetch: false,
      //   traceXHR: false,
      // }),
      
      // Console logging integration
      Sentry.consoleLoggingIntegration({ 
        levels: ['log', 'error', 'warn', 'info'], 
      }),
      
      // Replay integration for debugging (only in production)
      ...(environment === 'production' ? [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
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
        console.log('📤 Sending to Sentry...');
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
  
  console.log('✅ Sentry initialized successfully');
  
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
