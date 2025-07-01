// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Import and initialize API mocking system
import { initializeAPIMocks } from './api-mocks';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Hide fetch/XHR requests from command log for cleaner output
const app = window.top;
if (!app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style');
  style.innerHTML = '.command-name-request, .command-name-xhr { display: none }';
  style.setAttribute('data-hide-command-log-request', '');
  app.document.head.appendChild(style);
}

// Global error handling
Cypress.on('uncaught:exception', (err, _runnable) => {
  // Returning false here prevents Cypress from failing the test
  // for certain expected errors in the application
  
  // Don't fail tests on network errors during offline testing
  if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
    return false;
  }
  
  // Don't fail on React development warnings
  if (err.message.includes('Warning:') || err.message.includes('React')) {
    return false;
  }
  
  // Don't fail on OSM API blocking messages (expected behavior)
  if (err.message.includes('BLOCKED') || err.message.includes('rate limit')) {
    return false;
  }
  
  // Allow other errors to fail the test
  return true;
});

// Initialize API mocking system for all tests
before(() => {
  console.log('🛡️ Initializing API mocking system...');
  initializeAPIMocks();
});

// Global before hook for all tests
beforeEach(() => {
  // Clear browser storage before each test
  cy.clearAllLocalStorage();
  cy.clearAllSessionStorage();
  cy.clearCookies();
  
  // Set up viewport for desktop tests by default
  cy.viewport(1280, 720);
  
  // Wait for app to be ready
  cy.intercept('GET', '/src/**').as('appAssets');
  
  // Ensure API mocks are active for each test
  initializeAPIMocks();
});
