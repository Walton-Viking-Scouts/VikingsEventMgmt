// useAuth hook for managing authentication state in React
import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import authService from '../services/auth.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import databaseService from '../services/database.js';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [authState, setAuthState] = useState('no_data'); // New: enhanced auth state
  const [lastSyncTime, setLastSyncTime] = useState(null); // New: track last sync

  // Helper function to determine auth state based on cached data and tokens
  const determineAuthState = useCallback(async (isAuth, isOffline) => {
    try {
      // Check if we have any cached data
      const cachedSections = await databaseService.getSections();
      const hasCachedData = cachedSections && cachedSections.length > 0;
      
      // Get last sync time from cache
      const lastSync = localStorage.getItem('last_sync_time');
      setLastSyncTime(lastSync);
      
      if (isAuth && !isOffline) {
        return 'authenticated';
      } else if (isAuth && isOffline) {
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
  }, []);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // FIRST: Check for OAuth callback parameters in URL with enhanced error handling
      let urlParams;
      let accessToken;
      let tokenType;
      
      try {
        urlParams = new URLSearchParams(window.location.search);
        accessToken = urlParams.get('access_token');
        tokenType = urlParams.get('token_type');
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
          if (tokenType) {
            sessionStorage.setItem('token_type', tokenType);
          }
          
          // Clean the URL without reloading - this is a critical operation that can fail
          try {
            const url = new URL(window.location);
            url.searchParams.delete('access_token');
            url.searchParams.delete('token_type');
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
        
        // Fetch user info immediately after token storage
        try {
          const userInfo = await authService.fetchUserInfo();
          if (userInfo) {
            authService.setUserInfo(userInfo);
            logger.info('User info fetched after OAuth', { userFirstname: userInfo.firstname }, LOG_CATEGORIES.AUTH);
          }
        } catch (userError) {
          logger.warn('Could not fetch user info after OAuth, using fallback', { error: userError?.message }, LOG_CATEGORIES.AUTH);
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

      // Check if token exists
      const hasToken = authService.isAuthenticated();
      
      if (hasToken) {
        // Skip redundant token validation - just trust the token exists
        // Real validation happens on first actual API call (getUserRoles, etc.)
        
        setIsAuthenticated(true);
        const userInfo = authService.getUserInfo();
        setUser(userInfo);
        
        // Check if user is in offline mode with expired token
        const isTokenExpired = sessionStorage.getItem('token_expired') === 'true';
        setIsOfflineMode(isTokenExpired);
        
        // Token expiry is already handled by setting isOfflineMode above
        
        // Log successful authentication
        Sentry.addBreadcrumb({
          category: 'auth',
          message: isTokenExpired ? 'User authentication successful (offline mode)' : 'User authentication successful',
          level: 'info',
          data: {
            hasUserInfo: !!userInfo,
            userFullname: userInfo?.fullname || 'Unknown',
            isOfflineMode: isTokenExpired,
          },
        });
      } else {
        // No token exists - show login
        setIsAuthenticated(false);
        setUser(null);
      }
      
      // Determine and set the enhanced auth state
      const currentHasToken = authService.isAuthenticated();
      const newAuthState = await determineAuthState(currentHasToken, sessionStorage.getItem('token_expired') === 'true');
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
    const oauthUrl = authService.generateOAuthUrl();
    window.location.href = oauthUrl;
  }, []);

  // Logout function
  const logout = useCallback(() => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setIsBlocked(false);
  }, []);

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
  }, [checkAuth, determineAuthState]);

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
