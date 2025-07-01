// Environment variable configuration and validation
// This module centralizes environment variable access and validates required variables

// Required environment variables for basic functionality
const requiredVars = [
  'VITE_API_URL',
  'VITE_OAUTH_CLIENT_ID',
];

// Optional environment variables with defaults
// const optionalVars = {
//   VITE_SENTRY_DSN: null // Error tracking (optional)
// };

// Validate required environment variables
const missingVars = requiredVars.filter(key => !import.meta.env[key]);

if (missingVars.length > 0) {
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
  
  // Environment Detection
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  
  // Computed Values
  isApiUrlLocal: apiUrl?.includes('localhost'),
  isApiUrlSecure: apiUrl?.startsWith('https://'),
};

// Log configuration in development
if (import.meta.env.DEV) {
  console.log('🔧 Environment Configuration:');
  console.log('   API URL:', config.apiUrl);
  console.log('   OAuth Client ID:', config.oauthClientId ? '***configured***' : '❌ missing');
  console.log('   Sentry DSN:', config.sentryDsn ? '***configured***' : 'not configured');
  console.log('   Environment:', config.mode);
  console.log('   Local API:', config.isApiUrlLocal ? 'Yes' : 'No');
  console.log('   Secure API:', config.isApiUrlSecure ? 'Yes' : 'No');
}

export default config;
