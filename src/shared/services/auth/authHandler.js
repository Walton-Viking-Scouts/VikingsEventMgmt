// Simple Authentication Error Handler
// Minimal solution to prevent multiple 403 errors and provide clear UX

/**
 * Simple authentication error handler for Viking Event Management
 * 
 * Provides circuit breaker pattern for API authentication failures,
 * preventing repeated 403/401 errors and improving user experience.
 * Tracks authentication state and notifies components of failures.
 */
class SimpleAuthHandler {
  constructor() {
    this.hasShownAuthError = false;
    this.onAuthError = null; // Callback for components to react to auth failures
  }

  /**
   * Handle API response and track authentication failures
   * @param {Response} response - Fetch response object
   * @param {string} _apiName - Name of the API call for logging (currently unused)
   * @returns {boolean} true if auth is OK, false if auth failed
   */
  handleAPIResponse(response, _apiName) {
    if (response.status === 401 || response.status === 403) {
      if (!this.hasShownAuthError) {
        this.hasShownAuthError = true;
        // Authentication failed - blocked further API calls this session
        
        // Notify components about auth failure
        if (this.onAuthError) {
          this.onAuthError();
        }
      }
      return false; // Signal auth failure
    }
    return true; // Auth OK
  }

  /**
   * Check if we should make an API call (simple circuit breaker)
   * @returns {boolean} true if safe to make API calls
   */
  shouldMakeAPICall() {
    if (!this.hasShownAuthError) {
      return true;
    }
    // Skipping API call - authentication already failed this session
    return false;
  }

  /**
   * Reset auth error state (call when user gets new token or reconnects)
   * @returns {void}
   */
  reset() {
    // Resetting auth error state
    this.hasShownAuthError = false;
  }

  /**
   * Check if authentication has failed this session
   * @returns {boolean} true if authentication has failed
   */
  hasAuthFailed() {
    return this.hasShownAuthError;
  }
}

// Export singleton instance
export const authHandler = new SimpleAuthHandler();

export default authHandler;