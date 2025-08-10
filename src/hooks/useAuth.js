// useAuth hook for managing authentication state in React
import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import authService from '../services/auth.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

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
        logger.error('Error parsing URL parameters in auth flow', { 
          error: urlError.message,
          url: window.location.href,
          search: window.location.search,
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
              full: window.location.href,
              search: window.location.search,
              pathname: window.location.pathname,
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
              tags: {
                section: 'auth',
                operation: 'url_cleanup',
                category: 'auth',
                severity: 'warning',
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
                storageAvailable: typeof(Storage) !== 'undefined',
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
    } catch (error) {
      logger.error('Error checking authentication', { error: error.message }, LOG_CATEGORIES.ERROR);
      setIsAuthenticated(false);
      setUser(null);
      
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
  }, []);

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
  }, [checkAuth]);

  return {
    isAuthenticated,
    isLoading,
    user,
    isBlocked,
    isOfflineMode,
    login,
    logout,
    setToken,
    checkAuth,
  };
}
