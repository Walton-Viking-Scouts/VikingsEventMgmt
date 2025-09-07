import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import LoginScreen from '../LoginScreen.jsx';

function RequirePermission({ 
  children, 
  permission,
  redirectTo = '/',
  showLoginScreen = true,
  unauthorizedMessage = 'You don\'t have permission to access this feature',
  loginMessage = 'Please sign in to access this feature',
}) {
  const { user, authState, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-scout-blue"></div>
      </div>
    );
  }

  if (!user || authState === 'no_data') {
    if (showLoginScreen) {
      return <LoginScreen message={loginMessage} />;
    }

    return (
      <Navigate 
        to={redirectTo} 
        state={{ 
          from: location,
          message: loginMessage,
        }} 
        replace 
      />
    );
  }

  const hasPermission = !permission || user.permissions?.includes(permission);

  if (!hasPermission) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ 
          from: location,
          message: unauthorizedMessage,
        }} 
        replace 
      />
    );
  }

  return children;
}

export default RequirePermission;