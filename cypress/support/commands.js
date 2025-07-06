// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom commands for Vikings Event Management testing

// Login command for authenticated tests
Cypress.Commands.add('login', (options = {}) => {
  const { skipUI = false, mockAuth = true } = options;
  
  if (mockAuth) {
    // Mock authentication for testing without actual OSM login
    cy.window().then((win) => {
      win.sessionStorage.setItem('access_token', 'mock_token_for_testing');
      win.sessionStorage.setItem('user_info', JSON.stringify({
        firstname: 'Test',
        lastname: 'User',
        fullname: 'Test User',
      }));
    });
    
    if (!skipUI) {
      cy.reload();
      cy.wait(1000); // eslint-disable-line cypress/no-unnecessary-waiting
    }
  } else {
    // Real login flow (requires actual OSM credentials)
    cy.get('[data-testid="login-button"]').click();
    // Note: This would require handling OAuth flow in a real scenario
  }
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="logout-button"]').click();
  cy.get('[data-testid="login-screen"]').should('be.visible');
});

// Responsive testing commands
Cypress.Commands.add('testMobile', () => {
  cy.viewport(375, 667); // iPhone SE size
});

Cypress.Commands.add('testTablet', () => {
  cy.viewport(768, 1024); // iPad size
});

Cypress.Commands.add('testDesktop', () => {
  cy.viewport(1280, 720); // Desktop size
});

// Check if element is in mobile or desktop layout
Cypress.Commands.add('shouldBeMobileLayout', () => {
  cy.get('[data-testid="mobile-layout"]').should('be.visible');
  cy.get('[data-testid="desktop-sidebar"]').should('not.exist');
});

Cypress.Commands.add('shouldBeDesktopLayout', () => {
  cy.get('[data-testid="desktop-header"]').should('be.visible');
  cy.get('[data-testid="desktop-sidebar"]').should('exist');
});

// Wait for app to be ready
Cypress.Commands.add('waitForApp', () => {
  cy.get('[data-testid="loading-screen"]').should('not.exist');
  cy.get('[data-testid="app-ready"]').should('exist');
});

// Network testing commands
Cypress.Commands.add('goOffline', () => {
  cy.window().then((win) => {
    // Mock offline status
    cy.stub(win.navigator, 'onLine').value(false);
    
    // Dispatch offline event
    win.dispatchEvent(new Event('offline'));
  });
  
  // Verify offline indicator appears
  cy.get('[data-testid="offline-indicator"]').should('be.visible');
});

Cypress.Commands.add('goOnline', () => {
  cy.window().then((win) => {
    // Mock online status
    cy.stub(win.navigator, 'onLine').value(true);
    
    // Dispatch online event
    win.dispatchEvent(new Event('online'));
  });
});

// API mocking commands
Cypress.Commands.add('mockApiSuccess', (endpoint, fixture) => {
  cy.intercept('GET', `**/api/${endpoint}`, { fixture }).as(`mock${endpoint}`);
});

Cypress.Commands.add('mockApiError', (endpoint, statusCode = 500) => {
  cy.intercept('GET', `**/api/${endpoint}`, {
    statusCode,
    body: { error: 'Mock API Error' },
  }).as(`mockError${endpoint}`);
});

// OSM API specific mocks
Cypress.Commands.add('mockOSMBlocked', () => {
  cy.intercept('GET', '**/get-user-roles', {
    statusCode: 429,
    body: { 
      error: 'OSM API BLOCKED',
      message: 'API access temporarily blocked',
    },
  }).as('mockOSMBlocked');
});

Cypress.Commands.add('mockOSMSuccess', () => {
  cy.intercept('GET', '**/get-user-roles', {
    fixture: 'sections.json',
  }).as('mockSections');
  
  cy.intercept('GET', '**/get-events*', {
    fixture: 'events.json',
  }).as('mockEvents');
  
  cy.intercept('GET', '**/get-event-attendance*', {
    fixture: 'attendance.json',
  }).as('mockAttendance');
  
  cy.intercept('GET', '**/get-list-of-members*', {
    fixture: 'members.json',
  }).as('mockMembers');
});

// Members API specific mocks
Cypress.Commands.add('mockMembersSuccess', () => {
  cy.intercept('GET', '**/get-list-of-members*', {
    fixture: 'members.json',
  }).as('mockMembersSuccess');
});

Cypress.Commands.add('mockMembersError', (statusCode = 500) => {
  cy.intercept('GET', '**/get-list-of-members*', {
    statusCode,
    body: { error: 'Mock Members API Error' },
  }).as('mockMembersError');
});

// Form testing helpers
Cypress.Commands.add('selectSection', (sectionName) => {
  cy.get('[data-testid="section-item"]').contains(sectionName).click();
});

Cypress.Commands.add('selectEvent', (eventName) => {
  cy.get('[data-testid="event-item"]').contains(eventName).click();
});

// Print testing
Cypress.Commands.add('triggerPrint', () => {
  cy.window().then((win) => {
    cy.stub(win, 'print').as('printStub');
  });
  
  cy.get('[data-testid="print-button"]').click();
  cy.get('@printStub').should('have.been.called');
});

// Local storage testing
Cypress.Commands.add('checkOfflineData', (dataType) => {
  cy.window().then((win) => {
    const data = win.localStorage.getItem(`viking_${dataType}_offline`);
    expect(data).to.not.be.null;
    expect(JSON.parse(data)).to.have.length.greaterThan(0);
  });
});

// Members offline testing
Cypress.Commands.add('checkOfflineMembers', (sectionIds) => {
  cy.window().then((win) => {
    const key = `viking_members_${sectionIds.join('_')}_offline`;
    const data = win.localStorage.getItem(key);
    expect(data).to.not.be.null;
    const members = JSON.parse(data);
    expect(members).to.have.length.greaterThan(0);
    expect(members[0]).to.have.property('scoutid');
    expect(members[0]).to.have.property('firstname');
    expect(members[0]).to.have.property('lastname');
  });
});

Cypress.Commands.add('seedOfflineMembers', (sectionIds, membersData) => {
  cy.window().then((win) => {
    const key = `viking_members_${sectionIds.join('_')}_offline`;
    win.localStorage.setItem(key, JSON.stringify(membersData));
  });
});

// SQLite testing (for Capacitor)
Cypress.Commands.add('checkSQLiteData', (tableName) => {
  // This would need to be implemented with Capacitor-specific testing
  // For now, we'll check localStorage fallback
  cy.checkOfflineData(tableName);
});

// Combined offline test for members workflow
Cypress.Commands.add('testMembersOfflineWorkflow', (sectionIds) => {
  // First seed some offline data
  const mockMembers = [
    {
      scoutid: 1,
      firstname: 'John',
      lastname: 'Doe',
      sectionid: sectionIds[0],
      sectionname: 'Beavers',
      section: 'beavers',
      sections: ['Beavers'],
    },
    {
      scoutid: 2,
      firstname: 'Jane',
      lastname: 'Smith',
      sectionid: sectionIds[0],
      sectionname: 'Beavers',
      section: 'beavers',
      sections: ['Beavers'],
    },
  ];
  
  cy.seedOfflineMembers(sectionIds, mockMembers);
  
  // Go offline
  cy.goOffline();
  
  // Navigate to members
  cy.get('[data-testid="members-button"]').click();
  
  // Verify cached members are displayed
  cy.get('[data-testid="member-item"]').should('have.length', 2);
  cy.get('[data-testid="member-item"]').first().should('contain', 'John Doe');
  cy.get('[data-testid="member-item"]').last().should('contain', 'Jane Smith');
  
  // Verify offline data is being used
  cy.checkOfflineMembers(sectionIds);
});

// Accessibility testing helpers
Cypress.Commands.add('checkA11y', () => {
  // Basic accessibility checks
  cy.get('img').should('have.attr', 'alt');
  cy.get('button').should('be.focusable');
  cy.get('input').should('have.attr', 'aria-label').or('have.attr', 'placeholder');
});

// Performance testing
Cypress.Commands.add('measurePageLoad', () => {
  cy.window().then((win) => {
    const loadTime = win.performance.timing.loadEventEnd - win.performance.timing.navigationStart;
    expect(loadTime).to.be.lessThan(3000); // 3 second maximum
  });
});
