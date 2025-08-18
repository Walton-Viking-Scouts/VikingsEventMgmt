// Environment variable configuration and validation
// This module centralizes environment variable access and validates required variables

import { isDemoMode } from './demoMode.js';

// Required environment variables for basic functionality
// Skip validation in demo mode to allow public access
const requiredVars = [
  'VITE_API_URL',
  'VITE_OAUTH_CLIENT_ID',
];



// Validate required environment variables
// Skip validation in demo mode to allow public HTTP access
const missingVars = requiredVars.filter(key => !import.meta.env[key]);

if (missingVars.length > 0 && !isDemoMode()) {
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

// Export validated configuration
export const config = {
  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL,
  oauthClientId: import.meta.env.VITE_OAUTH_CLIENT_ID,
  
  // Optional Configuration
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  
  // Environment Detection - More robust for deployment
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  
  // Computed environment based on multiple factors
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
  console.log('   OAuth Client ID:', config.oauthClientId ? '***configured***' : '❌ missing');
  console.log('   Sentry DSN:', config.sentryDsn ? '***configured***' : 'not configured');
  console.log('   Environment:', config.actualEnvironment);
  console.log('   Vite Mode:', config.mode);
  console.log('   Local API:', config.isApiUrlLocal ? 'Yes' : 'No');
  console.log('   Secure API:', config.isApiUrlSecure ? 'Yes' : 'No');
}

export default config;
