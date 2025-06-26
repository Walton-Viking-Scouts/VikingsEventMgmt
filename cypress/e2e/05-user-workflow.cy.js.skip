describe('User Workflow - Event Management', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.login({ mockAuth: true });
    cy.mockOSMSuccess();
  });

  describe('Section Selection', () => {
    it('should display available sections', () => {
      cy.get('[data-testid="sections-list"]').should('be.visible');
      cy.get('[data-testid="section-item"]').should('have.length.greaterThan', 0);
      
      // Should show section information
      cy.contains('1st Walton Scouts').should('be.visible');
      cy.contains('1st Walton Cubs').should('be.visible');
    });

    it('should show section badge counts', () => {
      cy.get('[data-testid="sections-list"] .badge').should('be.visible');
      cy.get('[data-testid="sections-list"] .badge').should('contain.text', 'section');
    });

    it('should allow section selection', () => {
      cy.selectSection('1st Walton Scouts');
      
      // Should navigate to events list
      cy.get('[data-testid="events-list"]').should('be.visible');
      cy.get('[data-testid="section-item"]').should('not.exist');
    });

    it('should handle sections with different permissions', () => {
      // All sections should be clickable in our mock data
      cy.get('[data-testid="section-item"]').each(($section) => {
        cy.wrap($section).should('not.have.class', 'disabled');
      });
    });
  });

  describe('Event Selection', () => {
    beforeEach(() => {
      cy.selectSection('1st Walton Scouts');
    });

    it('should display events for selected section', () => {
      cy.get('[data-testid="events-list"]').should('be.visible');
      cy.get('[data-testid="event-item"]').should('have.length.greaterThan', 0);
      
      // Should show event details
      cy.contains('Summer Camp 2024').should('be.visible');
      cy.contains('Group Meeting').should('be.visible');
    });

    it('should show event selection counter', () => {
      cy.get('[data-testid="selected-events-badge"]').should('contain', '0 selected');
      
      // Select an event
      cy.get('[data-testid="event-item"]').first().click();
      cy.get('[data-testid="selected-events-badge"]').should('contain', '1 selected');
    });

    it('should allow multiple event selection', () => {
      // Select multiple events
      cy.get('[data-testid="event-item"]').eq(0).click();
      cy.get('[data-testid="event-item"]').eq(1).click();
      
      cy.get('[data-testid="selected-events-badge"]').should('contain', '2 selected');
      
      // Deselect one event
      cy.get('[data-testid="event-item"]').eq(0).click();
      cy.get('[data-testid="selected-events-badge"]').should('contain', '1 selected');
    });

    it('should show view attendance button when events selected', () => {
      cy.get('[data-testid="view-attendance-button"]').should('not.exist');
      
      cy.get('[data-testid="event-item"]').first().click();
      cy.get('[data-testid="view-attendance-button"]').should('be.visible');
    });

    it('should allow navigation back to sections', () => {
      cy.get('[data-testid="back-button"]').click();
      cy.get('[data-testid="sections-list"]').should('be.visible');
    });
  });

  describe('Attendance Viewing', () => {
    beforeEach(() => {
      cy.selectSection('1st Walton Scouts');
      cy.get('[data-testid="event-item"]').first().click();
      cy.get('[data-testid="view-attendance-button"]').click();
    });

    it('should display attendance data', () => {
      cy.get('[data-testid="attendance-view"]').should('be.visible');
      cy.get('[data-testid="attendance-table"]').should('be.visible');
    });

    it('should show attendance summary statistics', () => {
      // Should have summary view by default
      cy.get('[data-testid="summary-tab"]').should('have.class', 'active');
      cy.get('[data-testid="attendance-summary"]').should('be.visible');
      
      // Should show member names and attendance rates
      cy.contains('Alice Johnson').should('be.visible');
      cy.contains('Bob Smith').should('be.visible');
    });

    it('should allow switching between summary and detailed views', () => {
      // Start with summary view
      cy.get('[data-testid="summary-tab"]').should('have.class', 'active');
      
      // Switch to detailed view
      cy.get('[data-testid="detailed-tab"]').click();
      cy.get('[data-testid="detailed-tab"]').should('have.class', 'active');
      cy.get('[data-testid="attendance-detailed"]').should('be.visible');
      
      // Switch back to summary
      cy.get('[data-testid="summary-tab"]').click();
      cy.get('[data-testid="summary-tab"]').should('have.class', 'active');
    });

    it('should show attendance statistics with badges', () => {
      // Should show attendance rate badges
      cy.get('.badge-success, .badge-primary, .badge-danger').should('have.length.greaterThan', 0);
    });

    it('should display event information', () => {
      cy.get('[data-testid="event-badge"]').should('be.visible');
      cy.contains('1 event').should('be.visible');
    });

    it('should allow navigation back to events', () => {
      cy.get('[data-testid="back-button"]').click();
      cy.get('[data-testid="events-list"]').should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should handle no sections gracefully', () => {
      cy.intercept('GET', '**/get-user-roles', { body: {} }).as('emptySections');
      
      cy.reload();
      cy.login({ mockAuth: true });
      
      cy.get('[data-testid="no-sections"]').should('be.visible');
      cy.contains('No sections found').should('be.visible');
    });

    it('should handle no events gracefully', () => {
      cy.intercept('GET', '**/get-events*', { body: { items: [] } }).as('emptyEvents');
      
      cy.selectSection('1st Walton Scouts');
      
      cy.get('[data-testid="no-events"]').should('be.visible');
      cy.contains('No events found').should('be.visible');
    });

    it('should handle API errors with retry options', () => {
      cy.intercept('GET', '**/get-events*', { statusCode: 500 }).as('eventsError');
      
      cy.selectSection('1st Walton Scouts');
      
      cy.get('[data-testid="error-container"]').should('be.visible');
      cy.get('[data-testid="retry-button"]').should('be.visible').click();
    });
  });

  describe('Loading States', () => {
    it('should show loading states during data fetching', () => {
      // Mock slow API response
      cy.intercept('GET', '**/get-events*', { 
        body: { fixture: 'events.json' },
        delay: 1000 
      }).as('slowEvents');
      
      cy.selectSection('1st Walton Scouts');
      
      // Should show loading screen
      cy.get('[data-testid="loading-screen"]').should('be.visible');
      cy.contains('Loading events').should('be.visible');
      
      // Should disappear when loaded
      cy.wait('@slowEvents');
      cy.get('[data-testid="loading-screen"]').should('not.exist');
    });
  });

  describe('Complete User Journey', () => {
    it('should complete full workflow from login to attendance', () => {
      // Already logged in from beforeEach
      
      // Step 1: Select section
      cy.get('[data-testid="section-item"]').should('be.visible');
      cy.selectSection('1st Walton Scouts');
      
      // Step 2: Select event
      cy.get('[data-testid="event-item"]').should('be.visible');
      cy.get('[data-testid="event-item"]').first().click();
      
      // Step 3: View attendance
      cy.get('[data-testid="view-attendance-button"]').click();
      cy.get('[data-testid="attendance-view"]').should('be.visible');
      
      // Step 4: Navigate back through the flow
      cy.get('[data-testid="back-button"]').click(); // Back to events
      cy.get('[data-testid="events-list"]').should('be.visible');
      
      cy.get('[data-testid="back-button"]').click(); // Back to sections
      cy.get('[data-testid="sections-list"]').should('be.visible');
    });
  });
});