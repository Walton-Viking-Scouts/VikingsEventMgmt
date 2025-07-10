// useAuth hook for managing authentication state in React
import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import authService from '../services/auth.js';

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
      console.log('🔍 Auth check - has token:', hasToken);
      
      if (hasToken) {
        // Validate the token with the API
        console.log('🔄 Validating token with API...');
        const isValid = await authService.validateToken();
        console.log('✓ Token validation result:', isValid);
                
        if (isValid) {
          setIsAuthenticated(true);
          const userInfo = authService.getUserInfo();
          setUser(userInfo);
          
          // Check if user is in offline mode with expired token
          const isTokenExpired = sessionStorage.getItem('token_expired') === 'true';
          setIsOfflineMode(isTokenExpired);
          
          if (isTokenExpired) {
            console.log('✅ User authenticated in offline mode (expired token with cached data)');
          } else {
            console.log('✅ User authenticated successfully');
          }
          
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
          // Token validation failed - clear everything and show login
          setIsAuthenticated(false);
          setUser(null);
          setIsOfflineMode(false);
          console.log('❌ Token validation failed - showing login');
          
          // Log authentication failure
          Sentry.addBreadcrumb({
            category: 'auth',
            message: 'Token validation failed',
            level: 'warning',
            data: {
              reason: 'token_validation_failed',
            },
          });
        }
      } else {
        // No token exists - show login
        setIsAuthenticated(false);
        setUser(null);
        console.log('🔐 No token found - showing login');
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
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
    checkAuth();

    // Listen for storage changes (in case user logs out in another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'access_token' || e.key === 'osm_blocked' || e.key === 'token_invalid') {
        console.log('🔄 Storage change detected, rechecking auth:', e.key);
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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
