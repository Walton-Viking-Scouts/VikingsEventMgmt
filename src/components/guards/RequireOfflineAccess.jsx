import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import LoginScreen from '../LoginScreen.jsx';

function RequireOfflineAccess({ 
  children, 
  redirectTo = '/',
  showLoginScreen = true,
  message = 'Please sign in to access cached data',
}) {
  const { authState, isLoading, hasCachedData } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-scout-blue"></div>
      </div>
    );
  }

  const hasAccess = authState === 'authenticated' || 
                   authState === 'cached_only' || 
                   authState === 'token_expired' ||
                   hasCachedData;

  if (!hasAccess) {
    if (showLoginScreen) {
      return <LoginScreen message={message} />;
    }

    return (
      <Navigate 
        to={redirectTo} 
        state={{ 
          from: location,
          message,
        }} 
        replace 
      />
    );
  }

  return children;
}

export default RequireOfflineAccess;