import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
// TODO: Move useAuth hook to shared layer to avoid circular dependency
// import { useAuth } from '../../../features/auth/hooks/useAuth.js';
import LoginScreen from '../LoginScreen.jsx';

function RequireAuth({ 
  children, 
  redirectTo = '/',
  showLoginScreen = true,
  fallbackComponent = null,
}) {
  // TODO: Temporarily disable auth functionality due to circular dependency
  const authState = 'authenticated'; // Mock for now
  const isLoading = false;
  const user = { id: 1 }; // Mock user
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-scout-blue"></div>
      </div>
    );
  }

  const isAuthenticated = authState !== 'no_data' || !!user;

  if (!isAuthenticated) {
    if (showLoginScreen) {
      return <LoginScreen message="Please sign in to access this feature" />;
    }

    if (fallbackComponent) {
      return fallbackComponent;
    }

    return (
      <Navigate 
        to={redirectTo} 
        state={{ 
          from: location,
          message: 'Please sign in to access this feature',
        }} 
        replace 
      />
    );
  }

  return children;
}

export default RequireAuth;