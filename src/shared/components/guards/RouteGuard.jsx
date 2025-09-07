import React from 'react';
import { useAuth } from '../../../features/auth/hooks/useAuth.js';
import LoginScreen from '../LoginScreen.jsx';

function RouteGuard({ 
  children, 
  authLevel = 'none',
  showLoginScreen = true 
}) {
  const { authState, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-scout-blue"></div>
      </div>
    );
  }

  // Define access levels
  const hasAccess = () => {
    switch (authLevel) {
      case 'none':
        return true; // No auth required
      case 'offline_capable':
        return authState === 'authenticated' || 
               authState === 'cached_only' || 
               authState === 'token_expired' ||
               (user && authState !== 'no_data');
      case 'authenticated':
        return authState === 'authenticated' && user;
      default:
        return true;
    }
  };

  if (!hasAccess()) {
    if (showLoginScreen) {
      return <LoginScreen message="Please sign in to access this feature" />;
    }
    return null;
  }

  return children;
}

export default RouteGuard;