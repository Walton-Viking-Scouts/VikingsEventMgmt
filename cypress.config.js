import { defineConfig } from 'cypress';

export default defineConfig({
  // Cypress Cloud configuration
  projectId: 'ehjysh', // Your actual project ID
  
  e2e: {
    baseUrl: 'http://localhost:3001',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    requestTimeout: 8000,
    responseTimeout: 8000,
    pageLoadTimeout: 15000,
    taskTimeout: 10000,
    
    // Cypress Cloud specific settings
    experimentalStudio: true,
    experimentalRunAllSpecs: true,
    
    // Test file patterns
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // Environment variables
    env: {
      apiUrl: 'https://vikings-osm-event-manager.onrender.com',
      mobileBreakpoint: 768,
      tabletBreakpoint: 1024
    },
    
    setupNodeEvents(on, config) {
      // Add any plugin setup here
      
      // Task for setting network conditions (offline testing)
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        
        // Simulate offline conditions
        setOffline() {
          // This will be used with custom commands
          return null;
        },
        
        setOnline() {
          // This will be used with custom commands
          return null;
        }
      });
      
      return config;
    },
  },
  
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
  },
  
  // Global configuration
  retries: {
    runMode: 2,
    openMode: 0,
  },
  
  // Browser configuration
  chromeWebSecurity: false,
  modifyObstructiveCode: false,
  
  // File and folder paths
  downloadsFolder: 'cypress/downloads',
  fixturesFolder: 'cypress/fixtures',
  screenshotsFolder: 'cypress/screenshots',
  videosFolder: 'cypress/videos'
});