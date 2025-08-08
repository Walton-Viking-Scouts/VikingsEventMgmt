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
      // FIRST: Check for OAuth callback parameters in URL
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      const tokenType = urlParams.get('token_type');
      
      if (accessToken) {
        // Store the token and clean up URL
        sessionStorage.setItem('access_token', accessToken);
        if (tokenType) {
          sessionStorage.setItem('token_type', tokenType);
        }
        
        // Clean the URL without reloading
        const url = new URL(window.location);
        url.searchParams.delete('access_token');
        url.searchParams.delete('token_type');
        window.history.replaceState({}, '', url);
        
        logger.info('OAuth callback processed successfully', { tokenStored: true }, LOG_CATEGORIES.AUTH);
        
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
