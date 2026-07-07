// Simple Authentication Error Handler
// Circuit breaker for authentication failures.
// Trips on 401 (token invalid/expired) only. 403 is a per-endpoint permission
// problem — one section lacking flexi access must not kill all API traffic.

class SimpleAuthHandler {
  constructor() {
    this.hasShownAuthError = false;
    this.onAuthError = null; // Callback for components to react to auth failures
  }

  /**
   * Handle API response and track authentication failures
   * @param {Response} response - Fetch response object
   * @returns {boolean} - true if auth is OK, false if auth failed
   */
  handleAPIResponse(response) {
    if (response.status === 401) {
      if (!this.hasShownAuthError) {
        this.hasShownAuthError = true;

        // Notify components about auth failure
        if (this.onAuthError) {
          this.onAuthError();
        }
      }
      return false; // Signal auth failure
    }
    return true; // Auth OK (403 handled per-endpoint as a permission error)
  }

  /**
   * Check if we should make an API call (simple circuit breaker)
   * @returns {boolean} - true if safe to make API calls
   */
  shouldMakeAPICall() {
    return !this.hasShownAuthError;
  }

  /**
   * Reset auth error state (call when user gets new token or reconnects)
   */
  reset() {
    this.hasShownAuthError = false;
  }

  /**
   * Check if authentication has failed this session
   * @returns {boolean}
   */
  hasAuthFailed() {
    return this.hasShownAuthError;
  }
}

// Export singleton instance
export const authHandler = new SimpleAuthHandler();

export default authHandler;
