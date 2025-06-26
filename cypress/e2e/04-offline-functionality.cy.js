describe('Offline Functionality', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.login({ mockAuth: true });
    cy.mockOSMSuccess();
  });

  describe('Network Detection', () => {
    it('should detect when going offline', () => {
      // Start online
      cy.get('[data-testid="offline-indicator"]').should('not.exist');
      
      // Go offline
      cy.goOffline();
      
      // Should show offline indicator
      cy.get('[data-testid="offline-indicator"]').should('be.visible');
      cy.contains('Offline Mode').should('be.visible');
    });

    it('should detect when coming back online', () => {
      // Go offline first
      cy.goOffline();
      cy.get('[data-testid="offline-indicator"]').should('be.visible');
      
      // Go back online
      cy.goOnline();
      
      // Offline indicator should disappear
      cy.get('[data-testid="offline-indicator"]').should('not.exist');
    });

    it('should show sync button when online', () => {
      cy.get('[data-testid="sync-button"]').should('be.visible');
    });
  });

  describe('Data Caching', () => {
    it('should cache sections data when online', () => {
      // Load sections data
      cy.get('[data-testid="section-item"]').should('have.length.greaterThan', 0);
      
      // Check that data is cached
      cy.checkOfflineData('sections');
    });

    it('should cache events data when loaded', () => {
      // Navigate to events
      cy.get('[data-testid="section-item"]').first().click();
      cy.get('[data-testid="event-item"]').should('have.length.greaterThan', 0);
      
      // Check that events are cached
      cy.window().then((win) => {
        const cached = win.localStorage.getItem('viking_events_123_offline');
        expect(cached).to.not.be.null;
      });
    });

    it('should cache attendance data when loaded', () => {
      // Navigate to attendance
      cy.get('[data-testid="section-item"]').first().click();
      cy.get('[data-testid="event-item"]').first().click();
      cy.get('[data-testid="view-attendance-button"]').click();
      
      // Should show attendance data
      cy.get('[data-testid="attendance-table"]').should('be.visible');
      
      // Check that attendance is cached
      cy.window().then((win) => {
        const cached = win.localStorage.getItem('viking_attendance_501_offline');
        expect(cached).to.not.be.null;
      });
    });
  });

  describe('Offline Data Access', () => {
    it('should work offline after loading data online', () => {
      // Load data while online
      cy.get('[data-testid="section-item"]').first().click();
      cy.get('[data-testid="event-item"]').first().click();
      
      // Go offline
      cy.goOffline();
      
      // Navigate back to sections
      cy.get('[data-testid="back-button"]').click();
      cy.get('[data-testid="back-button"]').click();
      
      // Should still show sections from cache
      cy.get('[data-testid="section-item"]').should('have.length.greaterThan', 0);
      
      // Should work to navigate to events offline
      cy.get('[data-testid="section-item"]').first().click();
      cy.get('[data-testid="event-item"]').should('have.length.greaterThan', 0);
    });

    it('should handle offline API calls gracefully', () => {
      cy.goOffline();
      
      // Mock offline API responses
      cy.intercept('GET', '**/get-user-roles', { forceNetworkError: true }).as('offlineAPI');
      
      // Should still work with cached data
      cy.reload();
      cy.login({ mockAuth: true });
      
      // Should show cached sections if available
      cy.get('body').should('not.contain', 'Network Error');
    });
  });

  describe('Sync Functionality', () => {
    it('should show sync status during synchronization', () => {
      // Trigger manual sync
      cy.get('[data-testid="sync-button"]').click();
      
      // Should show sync in progress
      cy.get('[data-testid="sync-status"]').should('be.visible');
      cy.contains('Syncing').should('be.visible');
    });

    it('should auto-sync when coming back online', () => {
      // Go offline then online
      cy.goOffline();
      cy.goOnline();
      
      // Should trigger auto-sync
      cy.get('[data-testid="sync-status"]').should('be.visible');
    });

    it('should handle sync errors gracefully', () => {
      // Mock sync error
      cy.intercept('GET', '**/get-user-roles', { statusCode: 500 }).as('syncError');
      
      cy.get('[data-testid="sync-button"]').click();
      
      // Should show error message
      cy.get('[data-testid="sync-status"]').should('contain', 'failed');
    });
  });

  describe('Offline User Experience', () => {
    it('should show helpful offline messages', () => {
      cy.goOffline();
      
      cy.get('[data-testid="offline-indicator"]').should('be.visible');
      cy.contains('Using cached data').should('be.visible');
    });

    it('should disable online-only features when offline', () => {
      cy.goOffline();
      
      // Sync button should be disabled or show different state
      cy.get('[data-testid="sync-button"]').should('be.disabled');
    });

    it('should maintain app functionality when offline', () => {
      // Load some data first
      cy.get('[data-testid="section-item"]').first().click();
      cy.get('[data-testid="event-item"]').first().click();
      
      // Go offline
      cy.goOffline();
      
      // Navigation should still work
      cy.get('[data-testid="back-button"]').click();
      cy.get('[data-testid="event-item"]').should('be.visible');
      
      cy.get('[data-testid="back-button"]').click();
      cy.get('[data-testid="section-item"]').should('be.visible');
    });
  });

  describe('Storage Limits', () => {
    it('should handle storage quota gracefully', () => {
      // This would test what happens when localStorage fills up
      // For now, just verify storage is being used
      cy.window().then((win) => {
        const storageUsed = JSON.stringify(win.localStorage).length;
        expect(storageUsed).to.be.greaterThan(0);
      });
    });
  });
});