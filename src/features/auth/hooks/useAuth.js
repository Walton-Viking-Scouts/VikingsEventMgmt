// useAuth hook for managing authentication state in React
import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import authService, { generateOAuthUrl, getAndClearReturnPath } from '../services/auth.js';
import { isTokenExpired } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import databaseService from '../../../shared/services/storage/database.js';
import { UnifiedStorageService } from '../../../shared/services/storage/unifiedStorageService.js';
import dataLoadingService from '../../../shared/services/data/dataLoadingService.js';

// Environment-specific configuration for token expiration monitoring
const TOKEN_CONFIG = {
  // Default token expiration time when OAuth server doesn't provide expires_in
  DEFAULT_EXPIRATION_SECONDS: 60 * 60, // 1 hour (OSM typical)
  
  // How often to check for token expiration (in milliseconds)
  CHECK_INTERVAL_MS: import.meta.env.DEV ? 30 * 1000 : 60 * 1000, // 30s dev, 60s prod
};

// Helper function to broadcast auth changes across tabs
const broadcastAuthSync = () => {
  try {
    // Use localStorage to signal other tabs to refresh auth state
    localStorage.setItem('auth_sync', String(Date.now()));
    localStorage.removeItem('auth_sync');
  } catch {
    // localStorage not available, silently fail
  }
};

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [authState, setAuthState] = useState('no_data'); // New: enhanced auth state
  const [lastSyncTime, setLastSyncTime] = useState(null); // New: track last sync
  
  // Token expiration dialog state
  const [showTokenExpiredDialog, setShowTokenExpiredDialog] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [hasHandledExpiredToken, setHasHandledExpiredToken] = useState(false);


  // Helper function to determine auth state based on cached data and tokens
  const determineAuthState = useCallback(async (isAuth) => {
    try {
      // Check if we have any cached data
      const cachedSections = await databaseService.getSections();
      const hasCache = cachedSections && cachedSections.length > 0;
      
      // Get last sync time from storage
      const lastSync = await UnifiedStorageService.getLastSync();
      setLastSyncTime(typeof lastSync === 'string' ? parseInt(lastSync, 10) : lastSync);
      
      // Check if token has expired based on stored expiration time
      const tokenExpired = isTokenExpired();
      const hasValidToken = authService.isAuthenticated(); // This checks if token is valid (not expired)
      
      // Check if user was previously authenticated (has stored user info)
      const userInfo = await authService.getUserInfo();
      const hasPreviousAuth = !!userInfo;
      
      if (isAuth && hasValidToken && !tokenExpired) {
        return 'authenticated';
      } else if (tokenExpired && hasCache) {
        // Token expired but we have cached data - show sign in option
        return 'token_expired';
      } else if (hasCache && hasPreviousAuth) {
        // User has cached data and was previously authenticated - likely token expired or cleared
        return 'token_expired';
      } else if (hasCache) {
        return 'cached_only';
      } else if (hasPreviousAuth && hasValidToken && !hasCache) {
        // Has valid token and user info but no cached data - likely cache was cleared
        // Clear user info to force fresh login
        authService.clearUserInfo();
        return 'no_data';
      } else {
        return 'no_data';
      }
    } catch (error) {
      logger.warn('Error determining auth state', { error: error.message }, LOG_CATEGORIES.ERROR);
      return isAuth ? 'authenticated' : 'no_data';
    }
  }, []);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // FIRST: Check for OAuth callback parameters in URL with enhanced error handling
      let urlParams;
      let accessToken;
      let tokenType;
      let expiresIn;
      
      try {
        urlParams = new URLSearchParams(window.location.search);
        accessToken = urlParams.get('access_token');
        tokenType = urlParams.get('token_type');
        expiresIn = urlParams.get('expires_in');
        
        // Debug: Log all OAuth parameters we receive
        if (accessToken && import.meta.env.DEV) {
          const allParams = {};
          for (const [key, value] of urlParams.entries()) {
            if (key === 'access_token') {
              allParams[key] = '[REDACTED]';
            } else {
              allParams[key] = value;
            }
          }
          logger.debug('OAuth callback parameters received', allParams, LOG_CATEGORIES.AUTH);
        }
      } catch (urlError) {
        // Redact sensitive query params before logging
        let safeHref = '<unavailable>';
        let safeSearch = '<unavailable>';
        try {
          const loc = typeof window !== 'undefined' ? window.location : null;
          if (loc) {
            const safeUrl = new URL(loc.href);
            const redactKeys = ['access_token','token','token_type','id_token','refresh_token','auth','code'];
            redactKeys.forEach(k => {
              if (safeUrl.searchParams.has(k)) safeUrl.searchParams.set(k, '[REDACTED]');
            });
            safeHref = safeUrl.toString();
            safeSearch = safeUrl.search;
          }
        } catch (redactError) {
          // Silently fail - redaction is best effort
        }
        logger.error('Error parsing URL parameters in auth flow', {
          error: urlError.message,
          url: safeHref,
          search: safeSearch,
        }, LOG_CATEGORIES.ERROR);
        
        // Capture this specific error with enhanced context
        Sentry.captureException(urlError, {
          tags: {
            section: 'auth',
            operation: 'url_parsing',
            category: 'auth',
          },
          contexts: {
            url: {
              full: safeHref,
              search: safeSearch,
              pathname: typeof window !== 'undefined' ? window.location.pathname : '<unavailable>',
            },
          },
        });
      }
      
      if (accessToken) {
        try {
          // Store the token via service to reset auth handler and Sentry context
          authService.setToken(accessToken);
          // Notify other tabs
          broadcastAuthSync();
          // Clear any expired/invalid token flags when storing a new token
          sessionStorage.removeItem('token_expired');
          sessionStorage.removeItem('token_invalid');
          // Reset the handled flag when we get a new token
          setHasHandledExpiredToken(false);
          // Clear any stored token expiration choices
          localStorage.removeItem('token_expiration_choice');
          if (tokenType) {
            sessionStorage.setItem('token_type', tokenType);
          }
          
          // Store token expiration time for proactive monitoring
          let expirationTime;
          if (expiresIn) {
            // Use provided expires_in parameter
            expirationTime = Date.now() + (parseInt(expiresIn, 10) * 1000);
            logger.info('Token expiration time stored from OAuth response', { 
              expiresInSeconds: expiresIn,
              expiresAt: new Date(expirationTime).toISOString(),
            }, LOG_CATEGORIES.AUTH);
          } else {
            // Fallback: OSM tokens typically expire after 1 hour
            expirationTime = Date.now() + (TOKEN_CONFIG.DEFAULT_EXPIRATION_SECONDS * 1000);
            logger.info('Token expiration time estimated (OSM default)', { 
              expiresInSeconds: TOKEN_CONFIG.DEFAULT_EXPIRATION_SECONDS,
              expiresAt: new Date(expirationTime).toISOString(),
              note: 'expires_in not provided by OAuth server, using configured default expiration',
            }, LOG_CATEGORIES.AUTH);
          }
          
          sessionStorage.setItem('token_expires_at', expirationTime.toString());
          
          // Clean the URL without reloading - this is a critical operation that can fail
          try {
            const url = new URL(window.location);
            url.searchParams.delete('access_token');
            url.searchParams.delete('token_type');
            url.searchParams.delete('expires_in');
            window.history.replaceState({}, '', url);
            
            logger.info('OAuth callback processed successfully', { 
              tokenStored: true,
              urlCleaned: true,
            }, LOG_CATEGORIES.AUTH);
            
            // Check if we should restore user to their previous page
            const returnPath = getAndClearReturnPath();
            if (returnPath && returnPath !== '/' && returnPath !== window.location.pathname + window.location.search + window.location.hash) {
              logger.info('Restoring user to previous page after OAuth', { 
                returnPath,
                currentPath: window.location.pathname + window.location.search + window.location.hash, 
              }, LOG_CATEGORIES.AUTH);
              
              // Use a small delay to ensure token processing is complete
              setTimeout(() => {
                window.history.replaceState({}, '', returnPath);
                // Nudge Router to react to the URL change without a full reload
                try {
                  window.dispatchEvent(new window.PopStateEvent('popstate'));
                } catch {
                  window.dispatchEvent(new Event('popstate'));
                }
              }, 100);
            }
          } catch (urlCleanError) {
            // URL cleaning failed but token is stored - continue
            logger.warn('Failed to clean URL after OAuth callback, but token stored', { 
              error: urlCleanError.message,
              tokenStored: true,
            }, LOG_CATEGORIES.AUTH);
            
            Sentry.captureException(urlCleanError, {
              level: 'warning',
              tags: {
                section: 'auth',
                operation: 'url_cleanup',
                category: 'auth',
              },
            });
          }
        } catch (tokenStorageError) {
          // Token storage failed - this is critical
          logger.error('Failed to store OAuth tokens', { 
            error: tokenStorageError.message,
            hasAccessToken: !!accessToken,
            hasTokenType: !!tokenType,
          }, LOG_CATEGORIES.ERROR);
          
          Sentry.captureException(tokenStorageError, {
            tags: {
              section: 'auth',
              operation: 'token_storage',
              category: 'auth',
            },
            contexts: {
              auth: {
                hasAccessToken: !!accessToken,
                hasTokenType: !!tokenType,
                storageAvailable: (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'),
              },
            },
          });
        }
        
        // Load all data after successful OAuth (non-blocking)
        try {
          logger.info('Starting comprehensive data load after successful OAuth', {}, LOG_CATEGORIES.AUTH);

          const allDataResults = await dataLoadingService.loadAllDataAfterAuth(accessToken);

          if (allDataResults.success) {
            logger.info('Comprehensive data load completed', {
              summary: allDataResults.summary,
            }, LOG_CATEGORIES.AUTH);
          } else {
            logger.warn('Comprehensive data load had issues', {
              summary: allDataResults.summary,
              hasErrors: allDataResults.hasErrors,
            }, LOG_CATEGORIES.AUTH);
          }

          // Update last sync time after data load completes
          const syncTime = Date.now();
          await UnifiedStorageService.setLastSync(syncTime);
          setLastSyncTime(syncTime);

          // Show user message only if critical errors exist
          if (allDataResults.hasErrors && allDataResults.errors?.some(e => e.category === 'reference')) {
            const { getLoadingResultMessage } = await import('../../../shared/services/referenceData/referenceDataService.js');
            const referenceData = allDataResults?.results?.reference ?? allDataResults;
            const userMessage = getLoadingResultMessage(referenceData);
            if (userMessage) {
              const { notifyWarning } = await import('../../../shared/utils/notifications.js');
              notifyWarning(userMessage);
            }
          }
        } catch (dataLoadError) {
          logger.warn('Could not load application data after OAuth', {
            error: dataLoadError?.message,
          }, LOG_CATEGORIES.AUTH);
        }
      }
      // Check if blocked first
      if (authService.isBlocked()) {
        setIsBlocked(true);
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      // Clear blocked state if not blocked
      setIsBlocked(false);

      // Check if token exists (including expired tokens stored in sessionStorage)
      const hasValidToken = authService.isAuthenticated();
      const hasStoredToken = !!sessionStorage.getItem('access_token'); // Check for any stored token
      const tokenExpired = isTokenExpired();
      

      
      if (hasValidToken) {
        // Valid token - normal authenticated state
        setIsAuthenticated(true);
        const userInfo = await authService.getUserInfo();
        if (import.meta.env.DEV) {
          logger.debug('useAuth: Valid token - setting user info', { hasUserInfo: !!userInfo }, LOG_CATEGORIES.AUTH);
        }
        setUser(userInfo);
        setIsOfflineMode(false);
        
        
        // Log successful authentication
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'User authentication successful',
          level: 'info',
          data: {
            hasUserInfo: !!userInfo,
            userFullname: userInfo?.fullname || 'Unknown',
            isOfflineMode: false,
          },
        });


      } else if (hasStoredToken && tokenExpired) {
        try {
          const cachedSections = await databaseService.getSections();
          const hasCached = cachedSections && cachedSections.length > 0;
          if (hasCached) {
            // Expired token but we have cached data - offline mode
            setIsAuthenticated(true); // Keep authenticated for UI purposes
            const userInfo = await authService.getUserInfo();
            if (import.meta.env.DEV) {
              logger.debug('useAuth: Offline mode - setting user info', { hasUserInfo: !!userInfo }, LOG_CATEGORIES.AUTH);
            }
            setUser(userInfo);
            setIsOfflineMode(true);
            
            // Log offline mode
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'User authentication successful (offline mode)',
              level: 'info',
              data: {
                hasUserInfo: !!userInfo,
                userFullname: userInfo?.fullname || 'Unknown',
                isOfflineMode: true,
              },
            });
          } else {
            // No cache → require re-auth
            setIsAuthenticated(false);
            setUser(null);
            setIsOfflineMode(false);
          }
        } catch {
          // On error determining cache, prefer safe default: not authenticated
          setIsAuthenticated(false);
          setUser(null);
          setIsOfflineMode(false);
        }
      } else {
        // No token exists - show login
        setIsAuthenticated(false);
        setUser(null);
        setIsOfflineMode(false);
      }
      
      // Determine and set the enhanced auth state
      // For authState determination, consider both valid and expired tokens as "having a token"
      const currentHasToken = hasValidToken || (hasStoredToken && tokenExpired);
      const newAuthState = await determineAuthState(currentHasToken);
      setAuthState(newAuthState);
      
    } catch (error) {
      logger.error('Error checking authentication', { error: error.message }, LOG_CATEGORIES.ERROR);
      setIsAuthenticated(false);
      setUser(null);
      setAuthState('no_data'); // Fallback to no_data state on error
      
      // Log authentication error
      Sentry.captureException(error, {
        tags: {
          section: 'auth',
          operation: 'check_authentication',
        },
        extra: {
          hasToken: !!authService.getToken(),
          isBlocked: authService.isBlocked(),
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [determineAuthState]);

  // Login function
  const login = useCallback(() => {
    const oauthUrl = generateOAuthUrl();
    window.location.href = oauthUrl;
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    authService.logout();
    broadcastAuthSync();
    setIsAuthenticated(false);
    setUser(null);
    setIsBlocked(false);
    
    // Clear token expiration choice so user gets the dialog again if they log back in
    localStorage.removeItem('token_expiration_choice');
    setHasHandledExpiredToken(false);
    
    // Recalculate auth state after logout
    const newAuthState = await determineAuthState(false);
    setAuthState(newAuthState);
  }, [determineAuthState]);

  // Set token (for OAuth callback handling)
  const setToken = useCallback((token) => {
    authService.setToken(token);
    broadcastAuthSync();
    checkAuth(); // Recheck auth after setting token
  }, [checkAuth]);

  // Check auth on mount and when storage changes
  useEffect(() => {
    let mounted = true;
    
    
    const initializeAuth = async () => {
      if (!mounted) return; // Prevent duplicate calls in StrictMode
      
      // Check if user has already made a choice about expired token
      const existingChoice = localStorage.getItem('token_expiration_choice');
      if (existingChoice) {
        setHasHandledExpiredToken(true);
      }
      
      await checkAuth();
    };
    
    initializeAuth();

    // Listen for storage changes (in case user logs out in another tab)
    const handleStorageChange = (e) => {
      if (!mounted) return;
      if (e.storageArea === localStorage && (e.key === 'auth_sync' || e.key === 'osm_blocked')) {
        checkAuth();
      }
    };

    // Listen for custom auth clear events (from data clear page or other components)
    const handleAuthClear = async (e) => {
      if (!mounted) return;
      logger.info('Auth clear event received', {
        source: e.detail?.source || 'unknown',
      }, LOG_CATEGORIES.AUTH);

      // Execute logout logic directly
      await logout();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth:clear', handleAuthClear);
    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:clear', handleAuthClear);
    };
  }, [checkAuth, logout]);


  // Helper function to check cached data and show expiration dialog
  const checkAndShowExpirationDialog = useCallback(async () => {
    const hasStoredToken = !!sessionStorage.getItem('access_token');
    const tokenExpired = isTokenExpired();
    const hasStoredChoice = localStorage.getItem('token_expiration_choice');
    
    if (hasStoredToken && tokenExpired && !showTokenExpiredDialog && !hasHandledExpiredToken && !hasStoredChoice) {
      logger.info('Token expired - showing user choice dialog', {}, LOG_CATEGORIES.AUTH);
      
      // Check if we have cached data for user choice
      try {
        const cachedSections = await databaseService.getSections();
        const hasCached = cachedSections && cachedSections.length > 0;
        setHasCachedData(hasCached);
        
        // Show the user choice dialog instead of automatically switching to offline
        setShowTokenExpiredDialog(true);
        
        logger.info('Token expired - awaiting user choice', { 
          hasCachedData: hasCached, 
        }, LOG_CATEGORIES.AUTH);
      } catch (error) {
        logger.warn('Could not check cached data after token expiration', { 
          error: error.message, 
        }, LOG_CATEGORIES.ERROR);
        // Still show dialog even if cached check fails
        setShowTokenExpiredDialog(true);
      }
    }
  }, [showTokenExpiredDialog, hasHandledExpiredToken]);

  // Check for immediate token expiration on auth state changes
  useEffect(() => {
    if (authState === 'token_expired') {
      checkAndShowExpirationDialog();
    }
  }, [authState, checkAndShowExpirationDialog]);

  // Periodic token expiration monitoring
  useEffect(() => {
    if (!sessionStorage.getItem('access_token')) {
      return; // No token to monitor
    }

    // Check token expiration every minute (as safety net)
    const intervalId = setInterval(async () => {
      await checkAndShowExpirationDialog();
    }, TOKEN_CONFIG.CHECK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [authState, showTokenExpiredDialog, hasHandledExpiredToken, checkAndShowExpirationDialog]);

  // Handler for when user chooses to re-login after token expiration
  const handleReLogin = useCallback(async () => {
    logger.info('User chose to re-login after token expiration', {}, LOG_CATEGORIES.AUTH);
    setShowTokenExpiredDialog(false);
    setHasHandledExpiredToken(true);
    // Store the choice so it persists across refreshes
    localStorage.setItem('token_expiration_choice', 'relogin');
    
    try {
      // Generate OAuth URL with return path storage
      const oauthUrl = generateOAuthUrl(true);
      
      logger.info('Redirecting to OAuth for re-authentication', { 
        storedReturnPath: true, 
      }, LOG_CATEGORIES.AUTH);
      
      // Redirect to OAuth
      window.location.href = oauthUrl;
    } catch (error) {
      logger.error('Error redirecting to OAuth after token expiration', { 
        error: error.message, 
      }, LOG_CATEGORIES.ERROR);
    }
  }, []);

  // Handler for when user chooses to stay offline after token expiration
  const handleStayOffline = useCallback(async () => {
    logger.info('User chose to stay offline after token expiration', {}, LOG_CATEGORIES.AUTH);
    setShowTokenExpiredDialog(false);
    setHasHandledExpiredToken(true);
    // Store the choice so it persists across refreshes
    localStorage.setItem('token_expiration_choice', 'offline');
    
    try {
      // Update auth state to reflect token expiration and offline mode
      const hadToken = !!sessionStorage.getItem('access_token');
      const newAuthState = await determineAuthState(hadToken);
      setAuthState(newAuthState);
      setIsOfflineMode(true);
      // Mirror offline branch in checkAuth
      setIsAuthenticated(true);
      const userInfo = await authService.getUserInfo();
      setUser(userInfo);
      
      logger.info('Switched to offline mode per user choice', { 
        newAuthState,
        hasCachedData: hasCachedData, 
      }, LOG_CATEGORIES.AUTH);
    } catch (error) {
      logger.error('Error switching to offline mode', { 
        error: error.message, 
      }, LOG_CATEGORIES.ERROR);
    }
  }, [determineAuthState, hasCachedData]);

  return {
    isAuthenticated,
    isLoading,
    user,
    isBlocked,
    isOfflineMode,
    authState,        // New: enhanced auth state
    lastSyncTime,     // New: last sync timestamp
    
    // Token expiration dialog
    showTokenExpiredDialog,
    hasCachedData,
    handleReLogin,
    handleStayOffline,
    
    login,
    logout,
    setToken,
    checkAuth,
  };
}

export default useAuth;
