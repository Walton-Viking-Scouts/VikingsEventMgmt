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
        setIsLoading(false);
        return;
      }

      // Check if token exists and is valid
      if (authService.isAuthenticated()) {
        const isValid = await authService.validateToken();
                
        if (isValid) {
          setIsAuthenticated(true);
          const userInfo = authService.getUserInfo();
          setUser(userInfo);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
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
      if (e.key === 'access_token' || e.key === 'osm_blocked') {
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
