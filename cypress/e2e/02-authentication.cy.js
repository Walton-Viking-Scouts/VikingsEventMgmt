describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should show login screen when not authenticated', () => {
    cy.get('[data-testid="login-screen"]').should('be.visible');
    cy.contains('Login with OSM').should('be.visible');
    cy.get('[data-testid="login-button"]').should('be.enabled');
  });

  it('should handle successful authentication', () => {
    // Mock successful authentication
    cy.login({ mockAuth: true });
    
    // Should redirect to dashboard
    cy.get('[data-testid="dashboard"]').should('be.visible');
    cy.get('[data-testid="login-screen"]').should('not.exist');
  });

  it('should display user information when logged in', () => {
    cy.login({ mockAuth: true });
    
    // Should show user greeting
    cy.contains('Hi, Test').should('be.visible');
    cy.get('[data-testid="user-menu"]').should('be.visible');
  });

  it('should handle logout functionality', () => {
    cy.login({ mockAuth: true });
    
    // Verify logged in state
    cy.get('[data-testid="dashboard"]').should('be.visible');
    
    // Logout
    cy.logout();
    
    // Should return to login screen
    cy.get('[data-testid="login-screen"]').should('be.visible');
  });

  it('should handle blocked OSM API gracefully', () => {
    cy.mockOSMBlocked();
    cy.login({ mockAuth: true });
    
    // Should show blocked screen
    cy.get('[data-testid="blocked-screen"]').should('be.visible');
    cy.contains('blocked').should('be.visible');
  });

  it('should persist authentication across page reloads', () => {
    cy.login({ mockAuth: true });
    cy.get('[data-testid="dashboard"]').should('be.visible');
    
    // Reload page
    cy.reload();
    
    // Should still be authenticated
    cy.get('[data-testid="dashboard"]').should('be.visible');
    cy.get('[data-testid="login-screen"]').should('not.exist');
  });

  it('should handle token expiration', () => {
    cy.login({ mockAuth: true });
    
    // Mock expired token by clearing storage
    cy.window().then((win) => {
      win.sessionStorage.removeItem('access_token');
    });
    
    cy.reload();
    
    // Should return to login screen
    cy.get('[data-testid="login-screen"]').should('be.visible');
  });

  it('should show loading state during authentication', () => {
    cy.visit('/');
    
    // Should show loading screen initially
    cy.get('[data-testid="loading-screen"]').should('be.visible');
    cy.contains('Checking authentication').should('be.visible');
  });
});