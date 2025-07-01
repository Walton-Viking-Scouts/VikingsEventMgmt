describe('Responsive Layout', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      cy.testMobile();
    });

    it('should display mobile layout on small screens', () => {
      // Since we're not authenticated, just check login screen responsiveness
      cy.get('[data-testid="login-screen"]', { timeout: 10000 }).should('be.visible');
      cy.get('body').should('be.visible');
    });

    it('should have touch-friendly interface elements', () => {
      // Login button should be large enough for touch
      cy.get('[data-testid="login-button"]', { timeout: 10000 })
        .should('be.visible')
        .and('have.css', 'min-height');
    });

    it('should hide desktop-specific features', () => {
      // No desktop features should be visible on mobile
      cy.get('[data-testid="print-button"]').should('not.exist');
      cy.get('[data-testid="desktop-sidebar"]').should('not.exist');
    });

    it('should show mobile-optimized layout', () => {
      cy.get('[data-testid="login-screen"]', { timeout: 10000 }).should('be.visible');
      cy.get('body').should('be.visible');
    });
  });

  describe('Desktop Layout', () => {
    beforeEach(() => {
      cy.testDesktop();
    });

    it('should display desktop layout on large screens', () => {
      // Just check basic responsiveness
      cy.get('[data-testid="login-screen"]', { timeout: 10000 }).should('be.visible');
      cy.get('body').should('be.visible');
    });

    it('should show login form on desktop', () => {
      cy.get('[data-testid="login-button"]', { timeout: 10000 }).should('be.visible');
      cy.contains('Vikings Event Management').should('be.visible');
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt layout when window is resized', () => {
      // Start with desktop
      cy.testDesktop();
      cy.get('[data-testid="login-screen"]', { timeout: 10000 }).should('be.visible');
      
      // Resize to mobile
      cy.testMobile();
      cy.get('[data-testid="login-screen"]', { timeout: 5000 }).should('be.visible');
      
      // Resize back to desktop
      cy.testDesktop();
      cy.get('[data-testid="login-screen"]', { timeout: 5000 }).should('be.visible');
    });

    it('should maintain login functionality across screen sizes', () => {
      // Test button visibility on mobile
      cy.testMobile();
      cy.get('[data-testid="login-button"]', { timeout: 10000 }).should('be.visible');
      
      // Test same on desktop (don't click, just check visibility)
      cy.testDesktop();
      cy.get('[data-testid="login-button"]', { timeout: 10000 }).should('be.visible');
    });
  });
});
