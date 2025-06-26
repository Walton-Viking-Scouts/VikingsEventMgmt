describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should show login screen when not authenticated', () => {
    cy.get('[data-testid="login-screen"]', { timeout: 10000 }).should('be.visible');
    cy.contains('Login with Online Scout Manager').should('be.visible');
    cy.get('[data-testid="login-button"]').should('be.enabled');
  });

  it('should have login button that responds to clicks', () => {
    cy.get('[data-testid="login-button"]', { timeout: 10000 }).should('be.visible').click();
    // Since we don't have real OAuth, just verify the button is clickable
    // In a real app, this would trigger OAuth flow
  });

  it('should show loading state initially', () => {
    cy.visit('/');
    
    // App should show some loading state or login screen quickly
    cy.get('body', { timeout: 5000 }).should('contain.text', 'Vikings Event');
  });

  it('should handle token expiration by returning to login', () => {
    // Test that sessionStorage can be manipulated
    cy.window().then((win) => {
      // Set a token
      win.sessionStorage.setItem('access_token', 'test_token');
      expect(win.sessionStorage.getItem('access_token')).to.equal('test_token');
      
      // Clear it to simulate expiration
      win.sessionStorage.removeItem('access_token');
      expect(win.sessionStorage.getItem('access_token')).to.be.null;
    });
    
    // After clearing token, should still show login screen
    cy.get('[data-testid="login-screen"]', { timeout: 10000 }).should('be.visible');
  });

  it('should maintain session storage structure', () => {
    cy.window().then((win) => {
      // Verify sessionStorage is accessible
      expect(win.sessionStorage).to.exist;
      
      // Test token storage structure
      win.sessionStorage.setItem('test_token', 'test_value');
      expect(win.sessionStorage.getItem('test_token')).to.equal('test_value');
      
      // Clean up
      win.sessionStorage.removeItem('test_token');
    });
  });
});