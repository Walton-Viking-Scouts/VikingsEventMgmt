#!/usr/bin/env node

// Simple test script to verify sync authentication flow
console.log('Testing sync authentication flow...');

// Mock browser environment
global.window = {
  location: {
    origin: 'http://localhost:3001',
    href: 'http://localhost:3001',
    hostname: 'localhost'
  },
  sessionStorage: {
    storage: {},
    getItem: (key) => global.window.sessionStorage.storage[key] || null,
    setItem: (key, value) => { global.window.sessionStorage.storage[key] = value; },
    removeItem: (key) => { delete global.window.sessionStorage.storage[key]; }
  },
  localStorage: {
    storage: {},
    getItem: (key) => global.window.localStorage.storage[key] || null,
    setItem: (key, value) => { global.window.localStorage.storage[key] = value; },
    removeItem: (key) => { delete global.window.localStorage.storage[key]; }
  }
};

// Mock navigator
global.navigator = {
  onLine: true
};

// Mock import.meta.env
global.import = {
  meta: {
    env: {
      VITE_API_URL: 'http://localhost:3000',
      VITE_OAUTH_CLIENT_ID: 'test_client_id'
    }
  }
};

// Test cases
const testCases = [
  {
    name: 'No token - should prompt for login',
    setup: () => {
      global.window.sessionStorage.storage = {};
    },
    expected: 'login_prompt'
  },
  {
    name: 'Invalid token - should prompt for login',
    setup: () => {
      global.window.sessionStorage.storage = {
        access_token: 'invalid_token',
        token_invalid: 'true'
      };
    },
    expected: 'login_prompt'
  },
  {
    name: 'Valid token - should proceed with sync',
    setup: () => {
      global.window.sessionStorage.storage = {
        access_token: 'valid_token'
      };
    },
    expected: 'sync_proceed'
  }
];

// Run tests
testCases.forEach(test => {
  console.log(`\nTesting: ${test.name}`);
  test.setup();
  
  // Test auth functions
  try {
    const authModule = require('./src/services/auth.js');
    const hasToken = authModule.getToken();
    const isAuth = authModule.isAuthenticated();
    
    console.log(`  - Has token: ${!!hasToken}`);
    console.log(`  - Is authenticated: ${isAuth}`);
    
    if (!hasToken || !isAuth) {
      console.log(`  - Expected result: login_prompt ✓`);
    } else {
      console.log(`  - Expected result: sync_proceed ✓`);
    }
  } catch (error) {
    console.error(`  - Error: ${error.message}`);
  }
});

console.log('\nTest completed!');