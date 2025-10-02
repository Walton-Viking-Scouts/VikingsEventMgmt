import { useAuth } from './useAuth.jsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

export function useRequireAuth(redirectTo = '/') {
  const { authState, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    const shouldRedirect = authState === 'no_data' && !user;
    
    if (shouldRedirect) {
      navigate(redirectTo, {
        state: { from: location },
        replace: true,
      });
    }
  }, [authState, isLoading, user, navigate, redirectTo, location]);

  return {
    isAuthenticated: authState !== 'no_data' || !!user,
    authState,
    isLoading,
    user,
  };
}

export function useRequireOfflineAccess() {
  const { authState, isLoading, hasCachedData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    const hasAccess = authState === 'authenticated' || 
                     authState === 'cached_only' || 
                     authState === 'token_expired' ||
                     hasCachedData;
    
    if (!hasAccess) {
      navigate('/', {
        state: { 
          from: location,
          message: 'Please sign in to access this feature',
        },
        replace: true,
      });
    }
  }, [authState, isLoading, hasCachedData, navigate, location]);

  return {
    hasAccess: authState === 'authenticated' || 
               authState === 'cached_only' || 
               authState === 'token_expired' ||
               hasCachedData,
    authState,
    isLoading,
    canRefresh: authState === 'authenticated',
  };
}

export function usePermissionGuard(requiredPermission) {
  const { user, authState, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!user || authState === 'no_data') {
      navigate('/', {
        state: { 
          from: location,
          message: 'Authentication required',
        },
        replace: true,
      });
      return;
    }

    if (requiredPermission && !user.permissions?.includes(requiredPermission)) {
      navigate('/', {
        state: { 
          from: location,
          message: 'Insufficient permissions',
        },
        replace: true,
      });
    }
  }, [user, authState, isLoading, requiredPermission, navigate, location]);

  return {
    hasPermission: requiredPermission ? (user?.permissions?.includes(requiredPermission) ?? false) : true,
    user,
    authState,
    isLoading,
  };
}