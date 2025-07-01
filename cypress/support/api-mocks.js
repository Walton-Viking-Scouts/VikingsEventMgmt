// API Mocking System for Vikings Event Management
// This file ensures NO real API calls are made during Cypress testing

/**
 * Global API interceptor that blocks ALL real API calls and provides mock responses
 * This prevents accidental API usage during CI/CD and local testing
 */

// Environment detection
const isCI = Cypress.env('CI') || Cypress.env('CYPRESS_CI') || false;
const enableMocking = Cypress.env('ENABLE_API_MOCKING') !== 'false'; // Default to true

console.log('🛡️ API Mocking Configuration:', {
  isCI,
  enableMocking,
  environment: Cypress.env('NODE_ENV'),
});

/**
 * Initialize all API mocks
 * This function should be called in e2e.js to ensure all tests use mocks
 */
export function initializeAPIMocks() {
  if (!enableMocking) {
    console.warn('⚠️ API mocking is DISABLED - real API calls may be made!');
    return;
  }

  console.log('🔧 Initializing API mocks for all endpoints...');

  // Block ALL requests to OSM Event Manager backend
  cy.intercept('GET', '**/api/auth/**', mockAuthEndpoints).as('mockAuth');
  cy.intercept('POST', '**/api/auth/**', mockAuthEndpoints).as('mockAuthPost');
  
  // OSM API proxy endpoints
  cy.intercept('GET', '**/api/ext/members/contact/grid/**', mockUserRoles).as('mockUserRoles');
  cy.intercept('GET', '**/api/ext/events/**', mockEvents).as('mockEvents');
  cy.intercept('GET', '**/api/ext/sections/**', mockSections).as('mockSections');
  
  // Catch-all for any other backend API calls
  cy.intercept('GET', '**/api/**', mockGenericAPI).as('mockGenericAPI');
  cy.intercept('POST', '**/api/**', mockGenericAPI).as('mockGenericAPIPost');
  
  // Block direct OSM API calls (should never happen, but safety net)
  cy.intercept('GET', '**onlinescoutmanager.co.uk/**', blockDirectOSMCalls).as('blockOSM');
  cy.intercept('POST', '**onlinescoutmanager.co.uk/**', blockDirectOSMCalls).as('blockOSMPost');
  
  // Block any other external API calls
  cy.intercept('GET', 'https://**', (req) => {
    if (req.url.includes('localhost') || req.url.includes('127.0.0.1')) {
      req.continue(); // Allow local development server
    } else {
      console.warn('🚫 Blocked external API call:', req.url);
      req.reply({
        statusCode: 200,
        body: { error: 'External API blocked during testing', url: req.url },
      });
    }
  }).as('blockExternal');
}

/**
 * Mock authentication endpoints
 */
function mockAuthEndpoints(req) {
  console.log('🔐 Mocking auth endpoint:', req.url);
  
  if (req.url.includes('/callback')) {
    return req.reply({
      statusCode: 200,
      body: {
        access_token: 'mock_access_token_for_testing',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read',
      },
    });
  }
  
  if (req.url.includes('/user')) {
    return req.reply({
      statusCode: 200,
      body: {
        id: 'test_user_123',
        firstname: 'Test',
        lastname: 'User',
        fullname: 'Test User',
        email: 'test@example.com',
      },
    });
  }
  
  return req.reply({
    statusCode: 200,
    body: { message: 'Mocked auth response' },
  });
}

/**
 * Mock user roles endpoint (sections data)
 */
function mockUserRoles(req) {
  console.log('👤 Mocking user roles endpoint:', req.url);
  
  return req.reply({
    statusCode: 200,
    body: {
      identifier: 'getUserRoles',
      data: {
        '123': {
          'sectionid': '123',
          'sectionname': '1st Test Scout Group - Beavers',
          'section': 'beavers',
          'sectionType': 'Colony',
          'level': 'READ',
        },
        '456': {
          'sectionid': '456', 
          'sectionname': '1st Test Scout Group - Cubs',
          'section': 'cubs',
          'sectionType': 'Pack',
          'level': 'READ',
        },
        '789': {
          'sectionid': '789',
          'sectionname': '1st Test Scout Group - Scouts', 
          'section': 'scouts',
          'sectionType': 'Troop',
          'level': 'READ',
        },
      },
      meta: {
        structure: {},
        permissions: {},
      },
    },
  });
}

/**
 * Mock events endpoint
 */
function mockEvents(req) {
  console.log('📅 Mocking events endpoint:', req.url);
  
  return req.reply({
    statusCode: 200,
    body: {
      identifier: 'getEvents',
      data: {
        'event1': {
          'eventid': 'event1',
          'name': 'Weekly Meeting',
          'startdate': '2024-01-15',
          'starttime': '19:00:00',
          'enddate': '2024-01-15', 
          'endtime': '20:30:00',
          'location': 'Scout Hut',
          'notes': 'Regular weekly meeting',
        },
        'event2': {
          'eventid': 'event2', 
          'name': 'Camping Weekend',
          'startdate': '2024-01-20',
          'starttime': '18:00:00',
          'enddate': '2024-01-21',
          'endtime': '16:00:00', 
          'location': 'Camp Site',
          'notes': 'Annual camping trip',
        },
      },
      meta: {
        structure: {},
        permissions: {},
      },
    },
  });
}

/**
 * Mock sections endpoint
 */
function mockSections(req) {
  console.log('🏛️ Mocking sections endpoint:', req.url);
  
  return req.reply({
    statusCode: 200,
    body: {
      identifier: 'getSections',
      data: {
        '123': {
          'sectionid': '123',
          'sectionname': '1st Test Scout Group - Beavers',
          'section': 'beavers',
        },
        '456': {
          'sectionid': '456',
          'sectionname': '1st Test Scout Group - Cubs', 
          'section': 'cubs',
        },
      },
    },
  });
}

/**
 * Generic API mock for any unhandled endpoints
 */
function mockGenericAPI(req) {
  console.log('🔧 Mocking generic API endpoint:', req.url);
  
  return req.reply({
    statusCode: 200,
    body: {
      message: 'Mocked API response',
      endpoint: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Block direct OSM API calls (should never happen)
 */
function blockDirectOSMCalls(req) {
  console.error('🚨 BLOCKED DIRECT OSM API CALL:', req.url);
  console.error('This should never happen! Check your API configuration.');
  
  return req.reply({
    statusCode: 403,
    body: {
      error: 'Direct OSM API calls are blocked during testing',
      url: req.url,
      message: 'All API calls should go through the backend proxy',
    },
  });
}

/**
 * Rate limiting mock responses
 */
export function mockRateLimitedResponse(req) {
  return req.reply({
    statusCode: 429,
    body: {
      error: 'OSM API BLOCKED',
      message: 'API access temporarily blocked (mocked)',
      _rateLimitInfo: {
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 3600,
      },
    },
  });
}

/**
 * Mock offline responses
 */
export function mockOfflineResponse(req) {
  return req.reply({
    statusCode: 0, // Network error
    forceNetworkError: true,
  });
}

/**
 * Helper to enable/disable mocking based on environment
 */
export function shouldUseMocks() {
  return enableMocking;
}
