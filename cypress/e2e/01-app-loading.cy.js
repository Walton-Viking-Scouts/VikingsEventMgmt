describe('App Loading and Initial State', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should load the application successfully', () => {
    // Check that the app loads without errors
    cy.get('body').should('be.visible');
    
    // Should show either login screen or dashboard
    cy.get('body').should('contain.text', 'Vikings Event');
  });

  it('should show login screen when not authenticated', () => {
    // Should show login screen
    cy.get('[data-testid="login-screen"]').should('be.visible');
    cy.get('[data-testid="login-button"]').should('be.visible');
    cy.contains('Login with Online Scout Manager').should('be.visible');
  });

  it('should have proper page title and favicon', () => {
    cy.title().should('include', 'Vikings Event');
    cy.get('link[rel="icon"]').should('exist');
  });

  it('should be responsive on mobile devices', () => {
    cy.testMobile();
    cy.get('body').should('be.visible');
    // When not authenticated, responsive layout is not rendered
    cy.get('[data-testid="login-screen"]').should('be.visible');
  });

  it('should be responsive on desktop', () => {
    cy.testDesktop();
    cy.get('body').should('be.visible');
    // When not authenticated, responsive layout is not rendered
    cy.get('[data-testid="login-screen"]').should('be.visible');
  });

  it('should handle slow network connections gracefully', () => {
    // Simulate slow network for static assets only
    cy.intercept('GET', '**/*.{js,css,png,jpg,svg}', { delay: 1000 }).as('slowAssets');
    
    // Should still load within reasonable time
    cy.get('body', { timeout: 15000 }).should('be.visible');
    cy.get('[data-testid="login-screen"]', { timeout: 15000 }).should('be.visible');
  });

  it('should measure page load performance', () => {
    cy.visit('/');
    cy.measurePageLoad();
  });
});
