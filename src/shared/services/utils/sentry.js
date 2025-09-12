// Sentry configuration for Vikings Event Management Mobile
import * as Sentry from '@sentry/react';
import packageJson from '../../../../package.json';
import { config } from '../../../config/env.js';

// Environment configuration - Use robust detection from config
const environment = config.actualEnvironment;
const release = packageJson.version;
const sentryDsn = config.sentryDsn;

// Initialize Sentry
/**
 *
 */
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
    environment: environment,
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
  
  // NOTE: Do not set user context during initialization as it can cause 
  // "t is not a function" errors in mobile/Capacitor environments.
  // User context is set in auth.js when login is successful.
}

// Get the logger instance
export const logger = Sentry.logger;

// Utility functions for common Sentry operations
export const /**
 *
 */
  sentryUtils = {
  // Capture exceptions with rich context
    captureException: (error, { tags, contexts, extra, user, level } = {}) => {
      try {
        Sentry.withScope((scope) => {
          if (level) scope.setLevel(level);
          if (user) scope.setUser(user);
          if (tags) scope.setTags(tags);
          if (extra) scope.setExtras(extra);
          if (contexts) {
            Object.entries(contexts).forEach(([name, ctx]) => scope.setContext(name, ctx));
          }
          Sentry.captureException(error);
        });
      } catch (sentryError) {
        console.error('Failed to capture exception to Sentry:', sentryError);
      }
    },
  
    // Capture messages with level and optional context
    captureMessage: (message, level = 'info', { tags, contexts, extra, user } = {}) => {
      try {
        Sentry.withScope((scope) => {
          scope.setLevel(level);
          if (user) scope.setUser(user);
          if (tags) scope.setTags(tags);
          if (extra) scope.setExtras(extra);
          if (contexts) {
            Object.entries(contexts).forEach(([name, ctx]) => scope.setContext(name, ctx));
          }
          Sentry.captureMessage(message);
        });
      } catch (sentryError) {
        console.error('Failed to capture message to Sentry:', sentryError);
      }
    },
  
    // Set user context
    setUser: (user) => {
      Sentry.setUser(user);
    },
  
    // Clear Sentry scope to avoid cross-user leakage
    clearScope: () => {
      Sentry.setUser(null);
      Sentry.setTags({});
      Sentry.setExtras({});
      Sentry.setContext('user', null);
    // Note: clearBreadcrumbs and setFingerprint are not available as global functions in v8
    // These were scope-specific methods that are no longer needed with the new API
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
