// useAuth hook for managing authentication state in React
import { useState, useEffect, useCallback } from 'react';
import authService from '../services/auth.js';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);

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
          console.log('✅ User authenticated successfully');
        } else {
          // Token validation failed - clear everything and show login
          setIsAuthenticated(false);
          setUser(null);
          console.log('❌ Token validation failed - showing login');
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
    login,
    logout,
    setToken,
    checkAuth,
  };
}
