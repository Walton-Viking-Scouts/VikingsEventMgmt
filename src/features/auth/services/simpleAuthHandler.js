/**
 * @file Simple Authentication Error Handler
 * 
 * Provides minimal authentication error handling to prevent multiple 403/401 errors
 * and provide clear UX feedback. Acts as a circuit breaker pattern for API calls
 * when authentication failures occur.
 * 
 * @module simpleAuthHandler
 * @version 2.3.7
 * @since 2.3.7
 * @author Vikings Event Management Team
 */

/**
 * Simple authentication error handler implementing circuit breaker pattern
 * 
 * Tracks authentication failures across API calls and prevents cascading errors
 * by blocking subsequent API calls after the first authentication failure. 
 * Provides callback mechanism for components to react to auth failures.
 * 
 * @class SimpleAuthHandler
 * @example
 * // Check before making API call
 * if (authHandler.shouldMakeAPICall()) {
 *   const response = await fetch('/api/data');
 *   const isAuthOk = authHandler.handleAPIResponse(response, 'getData');
 *   if (!isAuthOk) {
 *     // Handle auth failure
 *   }
 * }
 * 
 * @example
 * // Set up auth error callback
 * authHandler.onAuthError = () => {
 *   notifyError('Authentication failed. Please log in again.');
 *   navigate('/login');
 * };
 * 
 * @example
 * // Reset after new token
 * authHandler.reset();
 * const token = await getNewToken();
 * // Can now make API calls again
 * 
 * @since 2.3.7
 */
class SimpleAuthHandler {
  constructor() {
    this.hasShownAuthError = false;
    this.onAuthError = null; // Callback for components to react to auth failures
  }

  /**
   * Handle API response and track authentication failures
   * 
   * Examines HTTP response status codes for authentication errors (401/403) and
   * implements circuit breaker logic to prevent cascading auth failures. Sets
   * internal state to block future API calls and triggers auth error callback.
   * 
   * @param {Response} response - Fetch response object from API call
   * @param {string} _apiName - Name of the API call for logging (unused in current implementation)
   * @returns {boolean} True if authentication is valid, false if auth failed
   * 
   * @example
   * // Check API response after fetch
   * const response = await fetch('/api/sections', { headers: { Authorization: `Bearer ${token}` } });
   * const isAuthOk = authHandler.handleAPIResponse(response, 'getSections');
   * if (!isAuthOk) {
   *   // Authentication failed - stop making API calls
   *   return null;
   * }
   * const data = await response.json();
   * 
   * @example
   * // Wrapper function for API calls
   * const apiCall = async (url, options, apiName) => {
   *   const response = await fetch(url, options);
   *   if (!authHandler.handleAPIResponse(response, apiName)) {
   *     throw new Error('Authentication failed');
   *   }
   *   return response.json();
   * };
   * 
   * @since 2.3.7
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
   * Check if we should make an API call (circuit breaker pattern)
   * 
   * Determines whether it's safe to make API calls based on previous authentication
   * failures. Implements circuit breaker pattern to prevent cascading failures
   * when authentication has already failed in the current session.
   * 
   * @returns {boolean} True if safe to make API calls, false if blocked due to auth failure
   * 
   * @example
   * // Check before expensive API operation
   * if (authHandler.shouldMakeAPICall()) {
   *   const data = await loadSectionsData();
   *   setState(data);
   * } else {
   *   console.log('Skipping API call - auth already failed');
   *   setState(cachedData);
   * }
   * 
   * @example
   * // Conditional data fetching
   * const fetchUserData = async () => {
   *   if (!authHandler.shouldMakeAPICall()) {
   *     return getCachedUserData();
   *   }
   *   
   *   try {
   *     const response = await fetch('/api/user');
   *     if (authHandler.handleAPIResponse(response, 'getUser')) {
   *       return await response.json();
   *     }
   *   } catch (error) {
   *     console.error('API call failed:', error);
   *   }
   *   
   *   return getCachedUserData();
   * };
   * 
   * @since 2.3.7
   */
  shouldMakeAPICall() {
    if (!this.hasShownAuthError) {
      return true;
    }
    // Skipping API call - authentication already failed this session
    return false;
  }

  /**
   * Reset authentication error state
   * 
   * Clears the circuit breaker state to allow API calls again. Should be called
   * when user obtains a new authentication token, reconnects, or when starting
   * a fresh session. Enables recovery from authentication failures.
   * 
   * @example
   * // Reset after successful login
   * const handleLogin = async (token) => {
   *   setToken(token);
   *   authHandler.reset(); // Clear previous auth failures
   *   notifySuccess('Login successful');
   * };
   * 
   * @example
   * // Reset when switching demo mode
   * const enableDemoMode = () => {
   *   authHandler.reset(); // Allow API calls in demo mode
   *   setDemoMode(true);
   * };
   * 
   * @example
   * // Reset on app initialization
   * useEffect(() => {
   *   if (hasValidToken()) {
   *     authHandler.reset(); // Start fresh session
   *   }
   * }, []);
   * 
   * @since 2.3.7
   */
  reset() {
    // Resetting auth error state
    this.hasShownAuthError = false;
  }

  /**
   * Check if authentication has failed this session
   * 
   * Returns the current circuit breaker state indicating whether authentication
   * errors have occurred. Used to determine if the application should show
   * offline mode indicators or prevent certain user actions.
   * 
   * @returns {boolean} True if authentication has failed in current session
   * 
   * @example
   * // Show offline indicator
   * const StatusBar = () => (
   *   <div className="status-bar">
   *     {authHandler.hasAuthFailed() && (
   *       <div className="offline-warning">
   *         Operating in offline mode
   *       </div>
   *     )}
   *   </div>
   * );
   * 
   * @example
   * // Disable save operations when offline
   * const handleSave = () => {
   *   if (authHandler.hasAuthFailed()) {
   *     notifyWarning('Cannot save while offline');
   *     return;
   *   }
   *   performSave();
   * };
   * 
   * @example
   * // Conditional feature access
   * const canAccessFeature = () => {
   *   return isAuthenticated() && !authHandler.hasAuthFailed();
   * };
   * 
   * @since 2.3.7
   */
  hasAuthFailed() {
    return this.hasShownAuthError;
  }
}

// Export singleton instance
export const authHandler = new SimpleAuthHandler();

export default authHandler;