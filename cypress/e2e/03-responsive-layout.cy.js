describe('Responsive Layout', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.login({ mockAuth: true });
    cy.mockOSMSuccess();
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      cy.testMobile();
    });

    it('should display mobile layout on small screens', () => {
      cy.shouldBeMobileLayout();
      cy.get('[data-testid="mobile-header"]').should('be.visible');
      cy.get('[data-testid="mobile-container"]').should('be.visible');
    });

    it('should have touch-friendly interface elements', () => {
      // Buttons should be large enough for touch
      cy.get('button').should('have.css', 'min-height', '44px');
      
      // Touch targets should be well spaced
      cy.get('[data-testid="section-item"]').should('have.css', 'padding').and('not.equal', '0px');
    });

    it('should hide desktop-specific features', () => {
      cy.get('[data-testid="print-button"]').should('not.exist');
      cy.get('[data-testid="desktop-sidebar"]').should('not.exist');
      cy.get('[data-testid="desktop-nav"]').should('not.exist');
    });

    it('should show mobile-optimized navigation', () => {
      cy.get('[data-testid="mobile-header"]').should('be.visible');
      cy.get('.mobile-layout').should('exist');
    });
  });

  describe('Desktop Layout', () => {
    beforeEach(() => {
      cy.testDesktop();
    });

    it('should display desktop layout on large screens', () => {
      cy.shouldBeDesktopLayout();
      cy.get('[data-testid="desktop-header"]').should('be.visible');
      cy.get('[data-testid="desktop-sidebar"]').should('be.visible');
    });

    it('should show desktop navigation features', () => {
      cy.get('[data-testid="desktop-nav"]').should('be.visible');
      cy.get('[data-testid="print-button"]').should('be.visible');
      cy.get('[data-testid="sidebar-toggle"]').should('be.visible');
    });

    it('should allow sidebar toggle functionality', () => {
      // Sidebar should be open by default
      cy.get('[data-testid="desktop-sidebar"]').should('have.class', 'open');
      
      // Click toggle button
      cy.get('[data-testid="sidebar-toggle"]').click();
      
      // Sidebar should close
      cy.get('[data-testid="desktop-sidebar"]').should('have.class', 'closed');
      
      // Click again to reopen
      cy.get('[data-testid="sidebar-toggle"]').click();
      cy.get('[data-testid="desktop-sidebar"]').should('have.class', 'open');
    });

    it('should have functional print button', () => {
      cy.triggerPrint();
    });

    it('should show sidebar navigation menu', () => {
      cy.get('[data-testid="sidebar-nav"]').should('be.visible');
      cy.get('[data-testid="sidebar-link"]').should('have.length.greaterThan', 0);
      
      // Check for expected navigation items
      cy.contains('Dashboard').should('be.visible');
      cy.contains('Events').should('be.visible');
      cy.contains('Reports').should('be.visible');
    });
  });

  describe('Tablet Layout', () => {
    beforeEach(() => {
      cy.testTablet();
    });

    it('should handle tablet breakpoint appropriately', () => {
      // At tablet size, should still show mobile-friendly layout
      // but with more space utilization
      cy.get('body').should('be.visible');
      
      // Should be responsive to tablet dimensions
      cy.viewport(768, 1024);
      cy.get('.mobile-layout, .desktop-layout').should('exist');
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt layout when window is resized', () => {
      // Start with desktop
      cy.testDesktop();
      cy.shouldBeDesktopLayout();
      
      // Resize to mobile
      cy.testMobile();
      cy.shouldBeMobileLayout();
      
      // Resize back to desktop
      cy.testDesktop();
      cy.shouldBeDesktopLayout();
    });

    it('should maintain functionality across different screen sizes', () => {
      // Test core functionality on mobile
      cy.testMobile();
      cy.get('[data-testid="section-item"]').first().click();
      cy.get('[data-testid="events-list"]').should('be.visible');
      
      // Test same functionality on desktop
      cy.testDesktop();
      cy.visit('/'); // Reload to get desktop layout
      cy.login({ mockAuth: true });
      cy.get('[data-testid="section-item"]').first().click();
      cy.get('[data-testid="events-list"]').should('be.visible');
    });
  });

  describe('Print Styles', () => {
    beforeEach(() => {
      cy.testDesktop();
    });

    it('should have print-optimized styles', () => {
      // Check that print styles exist
      cy.get('head').should('contain.html', '@media print');
      
      // Trigger print and verify print button exists
      cy.get('[data-testid="print-button"]').should('be.visible');
    });
  });
});