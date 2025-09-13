// Environment variable configuration and validation
// This module centralizes environment variable access and validates required variables

/* global URLSearchParams */

// Required environment variables for basic functionality
// Skip validation in demo mode to allow public access
// OAuth client ID removed - now handled server-side for security
const requiredVars = [
  'VITE_API_URL',
];

// Helper function to check demo mode safely
/**
 * Checks if the application is running in demo mode based on URL parameters or hostname patterns.
 * Demo mode allows the app to run without required environment variables for public demonstrations.
 * 
 * @returns {boolean} True if demo mode is detected, false otherwise
 * @since 1.0.0
 * @example
 * if (isInDemoMode()) {
 *   console.log('Running in demo mode - using sample data');
 * }
 */
function isInDemoMode() {
  try {
    // Lazy import to avoid circular dependencies
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('demo') === 'true' || urlParams.get('mode') === 'demo') {
        return true;
      }
      if (window.location.hostname && window.location.hostname.startsWith('demo.')) {
        return true;
      }
      if (window.location.pathname && window.location.pathname.startsWith('/demo')) {
        return true;
      }
    }
  } catch {
    // Ignore errors in test environment
  }
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

// Validate required environment variables
// Skip validation in demo mode to allow public HTTP access
const missingVars = requiredVars.filter(key => !import.meta.env[key]);

if (missingVars.length > 0 && !isInDemoMode()) {
  const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
  console.error('❌ Environment Configuration Error:', errorMessage);
  
  // In development, show helpful error message
  if (import.meta.env.DEV) {
    console.error('🔧 To fix this:');
    console.error('1. Create a .env file in the project root');
    console.error('2. Add the missing variables:');
    missingVars.forEach(varName => {
      console.error(`   ${varName}=your_value_here`);
    });
    console.error('3. Restart the development server');
    
    // Don't crash in development, just warn
    console.warn('⚠️ Continuing with missing variables - app may not work correctly');
  } else {
    // In production, this is a critical error
    throw new Error(errorMessage);
  }
}

// Validate URL format for API_URL
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl && !apiUrl.match(/^https?:\/\/.+/)) {
  console.warn('⚠️ VITE_API_URL should be a valid HTTP/HTTPS URL');
}

/**
 * Application configuration object with validated environment variables.
 * Contains API configuration, environment detection, and computed values.
 * 
 * @type {object}
 * @property {string} apiUrl - API base URL from VITE_API_URL
 * @property {string} sentryDsn - Sentry DSN for error tracking (optional)
 * @property {boolean} isDev - True in development mode
 * @property {boolean} isProd - True in production mode
 * @property {string} mode - Vite build mode
 * @property {string} actualEnvironment - Computed environment based on hostname and build mode
 * @property {boolean} isApiUrlLocal - True if API URL uses localhost
 * @property {boolean} isApiUrlSecure - True if API URL uses HTTPS
 * @since 1.0.0
 * @example
 * import { config } from './config/env.js';
 * console.log('API URL:', config.apiUrl);
 * console.log('Environment:', config.actualEnvironment);
 */

/**
 * Validated application configuration object containing all environment-specific settings
 * @type {object}
 * @property {string} apiUrl - Base URL for API endpoints
 * @property {string} sentryDsn - Sentry DSN for error tracking
 * @property {string} mapboxAccessToken - Mapbox access token for maps
 * @property {string} actualEnvironment - Current environment (development/staging/production)
 */
// eslint-disable-next-line jsdoc/require-jsdoc
export const config = {
  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL,
  
  // Optional Configuration
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  
  // Environment Detection - More robust for deployment
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  
  // Computed environment based on multiple factors
  /**
     * Computes the actual environment based on build mode and hostname patterns.
     * Checks production build flag, deployment hostnames, and localhost patterns.
     * 
     * @returns {string} Environment name ('production', 'development', or Vite mode)
     * @since 1.0.0
     */
  actualEnvironment: (() => {
    // Check if we're in a production build
    if (import.meta.env.PROD) return 'production';
    
    // Check hostname patterns for deployed environments
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      const hostname = window.location.hostname;
      if (hostname.includes('.onrender.com') || 
          hostname.includes('.netlify.app') || 
          hostname.includes('.vercel.app') ||
          hostname === 'vikingeventmgmt.onrender.com') {
        return 'production';
      }
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      }
    }
    
    // Fallback to Vite's mode
    return import.meta.env.MODE || 'development';
  })(),
  
  // Computed Values
  isApiUrlLocal: apiUrl?.includes('localhost'),
  isApiUrlSecure: apiUrl?.startsWith('https://'),
};

// Log configuration in development
if (config.actualEnvironment === 'development') {
  console.log('🔧 Environment Configuration:');
  console.log('   API URL:', config.apiUrl);
  console.log('   OAuth Client ID:', '***handled by backend***');
  console.log('   Sentry DSN:', config.sentryDsn ? '***configured***' : 'not configured');
  console.log('   Environment:', config.actualEnvironment);
  console.log('   Vite Mode:', config.mode);
  console.log('   Local API:', config.isApiUrlLocal ? 'Yes' : 'No');
  console.log('   Secure API:', config.isApiUrlSecure ? 'Yes' : 'No');
}

/**
 * Default export of the application configuration object.
 * @type {object}
 * @since 1.0.0
 */
export default config;
