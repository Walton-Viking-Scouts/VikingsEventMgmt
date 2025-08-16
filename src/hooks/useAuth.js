// useAuth hook for managing authentication state in React
import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import authService from '../services/auth.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import databaseService from '../services/database.js';

// Environment-specific configuration for token expiration monitoring
const TOKEN_CONFIG = {
  // Default token expiration time when OAuth server doesn't provide expires_in
  DEFAULT_EXPIRATION_SECONDS: import.meta.env.DEV ? 60 * 60 : 60 * 60, // 1 hour (both environments - OSM typical)
  
  // How often to check for token expiration (in milliseconds)
  CHECK_INTERVAL_MS: import.meta.env.DEV ? 30 * 1000 : 60 * 1000, // 30s dev, 60s prod
  
  // How early to warn about upcoming expiration (in milliseconds)
  EXPIRATION_WARNING_MS: import.meta.env.DEV ? 2 * 60 * 1000 : 5 * 60 * 1000, // 2min dev, 5min prod
};

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [authState, setAuthState] = useState('no_data'); // New: enhanced auth state
  const [lastSyncTime, setLastSyncTime] = useState(null); // New: track last sync

  // Helper function to check if token has expired based on stored expiration time
  const isTokenExpired = useCallback(() => {
    const expiresAt = sessionStorage.getItem('token_expires_at');
    if (!expiresAt) {
      // No expiration time stored - fall back to existing token_expired flag
      return sessionStorage.getItem('token_expired') === 'true';
    }
    
    const expirationTime = parseInt(expiresAt, 10);
    
    // Validate the parsed expiration time
    if (!Number.isFinite(expirationTime)) {
      logger.warn('Corrupt token expiration time detected, falling back to token_expired flag', {
        corruptValue: expiresAt,
        tokenExpiredFlag: sessionStorage.getItem('token_expired'),
      }, LOG_CATEGORIES.AUTH);
      
      // Treat corrupt expiration as expired and set flag for consistency
      const fallbackExpired = sessionStorage.getItem('token_expired') === 'true';
      if (!fallbackExpired) {
        logger.info('Setting token_expired flag due to corrupt expiration time', {
          corruptValue: expiresAt,
        }, LOG_CATEGORIES.AUTH);
        sessionStorage.setItem('token_expired', 'true');
        return true;
      }
      return fallbackExpired;
    }
    
    const now = Date.now();
    const timeUntilExpiry = expirationTime - now;
    const isExpired = timeUntilExpiry <= 0;
    
    // Log upcoming expiration as a warning
    if (!isExpired && timeUntilExpiry <= TOKEN_CONFIG.EXPIRATION_WARNING_MS) {
      logger.warn('Token will expire soon', {
        expiresAt: new Date(expirationTime).toISOString(),
        timeUntilExpiryMinutes: Math.round(timeUntilExpiry / (60 * 1000)),
      }, LOG_CATEGORIES.AUTH);
    }
    
    // If expired, set the token_expired flag for consistency with existing code
    if (isExpired && sessionStorage.getItem('token_expired') !== 'true') {
      logger.info('Token has expired based on stored expiration time', {
        expiresAt: new Date(expirationTime).toISOString(),
        expiredMinutesAgo: Math.round(-timeUntilExpiry / (60 * 1000)),
      }, LOG_CATEGORIES.AUTH);
      sessionStorage.setItem('token_expired', 'true');
    }
    
    return isExpired;
  }, []);

  // Helper function to determine auth state based on cached data and tokens
  const determineAuthState = useCallback(async (isAuth) => {
    try {
      // Check if we have any cached data
      const cachedSections = await databaseService.getSections();
      const hasCachedData = cachedSections && cachedSections.length > 0;
      
      // Get last sync time from cache
      const lastSync = localStorage.getItem('viking_last_sync');
      setLastSyncTime(lastSync);
      
      // Check if token has expired based on stored expiration time
      const tokenExpired = isTokenExpired();
      const hasValidToken = authService.isAuthenticated(); // This checks if token is valid (not expired)
      
      if (isAuth && hasValidToken && !tokenExpired) {
        return 'authenticated';
      } else if (isAuth && tokenExpired && hasCachedData) {
        return 'token_expired';
      } else if (hasCachedData) {
        return 'cached_only';
      } else {
        return 'no_data';
      }
    } catch (error) {
      logger.warn('Error determining auth state', { error: error.message }, LOG_CATEGORIES.ERROR);
      return isAuth ? 'authenticated' : 'no_data';
    }
  }, [isTokenExpired]);

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
          // Store the token and clean up URL with enhanced error handling
          sessionStorage.setItem('access_token', accessToken);
          // Clear any expired token flags when storing a new token
          sessionStorage.removeItem('token_expired');
          if (tokenType) {
            sessionStorage.setItem('token_type', tokenType);
          }
          
          // Store token expiration time for proactive monitoring
          let expirationTime;
          if (expiresIn) {
            // Use provided expires_in parameter
            expirationTime = Date.now() + (parseInt(expiresIn) * 1000);
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
        
        // Try to get fresh user info from API after successful OAuth
        try {
          const userInfo = await authService.fetchUserInfoFromAPI();
          if (userInfo) {
            authService.setUserInfo(userInfo);
            logger.info('User info fetched from API after OAuth', { userFirstname: userInfo.firstname }, LOG_CATEGORIES.AUTH);
          }
        } catch (userError) {
          logger.warn('Could not fetch fresh user info after OAuth, will use cached data if available', { error: userError?.message }, LOG_CATEGORIES.AUTH);
        }

        // Trigger a full data sync after successful OAuth to get fresh sections/events/members
        try {
          const { default: syncService } = await import('../services/sync.js');
          logger.info('Starting data sync after successful OAuth', {}, LOG_CATEGORIES.AUTH);
          await syncService.syncAll();
          logger.info('Data sync completed after OAuth', {}, LOG_CATEGORIES.AUTH);
        } catch (syncError) {
          logger.warn('Could not sync data after OAuth, using cached data', { error: syncError?.message }, LOG_CATEGORIES.AUTH);
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
        const userInfo = authService.getUserInfo();
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
        // Expired token but we have cached data - offline mode
        setIsAuthenticated(true); // Keep authenticated for UI purposes
        const userInfo = authService.getUserInfo();
        setUser(userInfo);
        setIsOfflineMode(true);
        
        // Note: Toast will be shown in App.jsx after loading completes
        
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
  }, [determineAuthState, isTokenExpired]); // determineAuthState already depends on isTokenExpired

  // Login function
  const login = useCallback(() => {
    const oauthUrl = authService.generateOAuthUrl();
    window.location.href = oauthUrl;
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setIsBlocked(false);
    
    // Recalculate auth state after logout
    const newAuthState = await determineAuthState(false);
    setAuthState(newAuthState);
  }, [determineAuthState]);

  // Set token (for OAuth callback handling)
  const setToken = useCallback((token) => {
    authService.setToken(token);
    checkAuth(); // Recheck auth after setting token
  }, [checkAuth]);

  // Check auth on mount and when storage changes
  useEffect(() => {
    let mounted = true;
    
    
    const initializeAuth = async () => {
      if (!mounted) return; // Prevent duplicate calls in StrictMode
      await checkAuth();
    };
    
    initializeAuth();

    // Listen for storage changes (in case user logs out in another tab)
    const handleStorageChange = (e) => {
      if (!mounted) return;
      if (e.key === 'access_token' || e.key === 'osm_blocked' || e.key === 'token_invalid') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkAuth, isTokenExpired]);

  // Listen for sync completion to update lastSyncTime
  useEffect(() => {
    let cleanupFn = null;
    
    const handleSyncComplete = (syncStatus) => {
      if (syncStatus.status === 'completed') {
        // Use the timestamp from sync status, or get from localStorage as fallback
        const timestamp = syncStatus.timestamp || localStorage.getItem('viking_last_sync');
        setLastSyncTime(timestamp);
        logger.debug('Updated lastSyncTime after sync completion', { timestamp }, LOG_CATEGORIES.AUTH);
      }
    };

    // Import and setup sync listener
    const setupSyncListener = async () => {
      try {
        const { default: syncService } = await import('../services/sync.js');
        syncService.addSyncListener(handleSyncComplete);
        
        return () => {
          syncService.removeSyncListener(handleSyncComplete);
        };
      } catch (error) {
        logger.error('Failed to setup sync listener in useAuth', { error: error.message }, LOG_CATEGORIES.ERROR);
        return null;
      }
    };

    setupSyncListener().then((cleanup) => {
      cleanupFn = cleanup;
    });

    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, []);

  // Periodic token expiration monitoring
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      return; // No token to monitor
    }

    // Check token expiration every minute
    const intervalId = setInterval(async () => {
      const tokenExpired = isTokenExpired();
      const currentAuthState = authState;
      
      // If token expired and we're not already in token_expired state
      if (tokenExpired && currentAuthState === 'authenticated') {
        logger.info('Token expired - updating auth state', {}, LOG_CATEGORIES.AUTH);
        
        // Determine new auth state
        // For token_expired state, we need to pass true to indicate we had a token (even if expired)
        const hasStoredToken = !!sessionStorage.getItem('access_token');
        const currentHasToken = hasStoredToken; // Use stored token presence, not validity
        const newAuthState = await determineAuthState(currentHasToken);
        setAuthState(newAuthState);
        setIsOfflineMode(true);
        
        // Check if we have cached data for user feedback
        try {
          const cachedSections = await databaseService.getSections();
          const hasCachedData = cachedSections && cachedSections.length > 0;
          
          if (hasCachedData) {
            logger.info('Token expired but cached data available - offline mode enabled', {}, LOG_CATEGORIES.AUTH);
          } else {
            logger.warn('Token expired with no cached data - user needs to re-authenticate', {}, LOG_CATEGORIES.AUTH);
          }
        } catch (error) {
          logger.warn('Could not check cached data after token expiration', { error: error.message }, LOG_CATEGORIES.ERROR);
        }
      }
    }, TOKEN_CONFIG.CHECK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isTokenExpired, authState, determineAuthState]);


  return {
    isAuthenticated,
    isLoading,
    user,
    isBlocked,
    isOfflineMode,
    authState,        // New: enhanced auth state
    lastSyncTime,     // New: last sync timestamp
    login,
    logout,
    setToken,
    checkAuth,
  };
}
