import React from 'react';
import { useAuth } from '../../../features/auth/hooks/useAuth.js';
import LoginScreen from '../LoginScreen.jsx';

function RouteGuard({ 
  children, 
  authLevel = 'none',
  showLoginScreen = true,
  requiredPermissions = [],
  fallbackComponent = null,
}) {
  const { authState, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen bg-gray-50"
        role="status"
        aria-live="polite"
        aria-label="Loading application"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-scout-blue"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
          <span className="sr-only">Please wait while we load the application</span>
        </div>
      </div>
    );
  }

  // Define access levels with granular permission checking
  const hasAccess = () => {
    switch (authLevel) {
    case 'none':
      return true; // No auth required
    case 'offline_capable':
      return authState === 'authenticated' || 
               authState === 'cached_only' || 
               authState === 'token_expired' ||
               (user && authState !== 'no_data');
    case 'authenticated': {
      const isAuthenticated = authState === 'authenticated' && user;
      
      // Check additional permissions if specified
      if (isAuthenticated && requiredPermissions.length > 0) {
        return requiredPermissions.every(permission => 
          user.permissions && user.permissions.includes(permission),
        );
      }
      
      return isAuthenticated;
    }
    default:
      return true;
    }
  };

  if (!hasAccess()) {
    // Use custom fallback component if provided
    if (fallbackComponent) {
      return fallbackComponent;
    }
    
    if (showLoginScreen) {
      const message = requiredPermissions.length > 0 
        ? `You need additional permissions to access this feature: ${requiredPermissions.join(', ')}`
        : 'Please sign in to access this feature';
      return <LoginScreen message={message} />;
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mb-4">
            <svg 
              className="mx-auto h-12 w-12 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Access Restricted
          </h3>
          <p className="text-gray-600">
            {requiredPermissions.length > 0 
              ? `You need additional permissions: ${requiredPermissions.join(', ')}`
              : 'You do not have permission to access this feature.'}
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default RouteGuard;