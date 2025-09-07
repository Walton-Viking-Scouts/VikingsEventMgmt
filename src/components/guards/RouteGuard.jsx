import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import LoginScreen from '../LoginScreen.jsx';

function RouteGuard({ 
  children,
  authLevel = 'any',
  permission = null,
  redirectTo = '/',
  showLoginScreen = true,
  fallbackComponent = null,
  customAuthCheck = null,
}) {
  const { user, authState, isLoading, hasCachedData } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-scout-blue"></div>
      </div>
    );
  }

  let hasAccess = false;
  let message = 'Access denied';

  if (customAuthCheck) {
    const result = customAuthCheck({ user, authState, hasCachedData });
    hasAccess = result.hasAccess;
    message = result.message || message;
  } else {
    switch (authLevel) {
    case 'none':
      hasAccess = true;
      break;
      
    case 'any':
      hasAccess = authState !== 'no_data' || !!user || hasCachedData;
      message = 'Please sign in to access this feature';
      break;
      
    case 'authenticated':
      hasAccess = authState === 'authenticated' && !!user;
      message = 'Please sign in with fresh credentials to access this feature';
      break;
      
    case 'offline_capable':
      hasAccess = authState === 'authenticated' || 
                 authState === 'cached_only' || 
                 authState === 'token_expired' ||
                 hasCachedData;
      message = 'Please sign in to access cached data';
      break;
      
    case 'fresh_token':
      hasAccess = authState === 'authenticated' && !!user;
      message = 'Please refresh your authentication to access this feature';
      break;
      
    default:
      hasAccess = false;
      message = 'Invalid authentication level specified';
    }

    if (hasAccess && permission && (!user?.permissions?.includes(permission))) {
      hasAccess = false;
      message = `You don't have the required permission: ${permission}`;
    }
  }

  if (!hasAccess) {
    if (showLoginScreen && (authLevel === 'any' || authLevel === 'authenticated' || authLevel === 'fresh_token')) {
      return <LoginScreen message={message} />;
    }

    if (fallbackComponent) {
      return fallbackComponent;
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

export default RouteGuard;