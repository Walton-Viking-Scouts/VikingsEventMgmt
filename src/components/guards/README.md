# Route Guards

This directory contains reusable route guard components and hooks for protecting routes based on authentication state and permissions.

## Components

### `RouteGuard`
Flexible route guard with configurable authentication levels:

```jsx
import { RouteGuard } from '../components/guards';

// Require offline-capable access (auth or cached data)
<RouteGuard authLevel="offline_capable">
  <MoversPage />
</RouteGuard>

// Require fresh authentication
<RouteGuard authLevel="authenticated">
  <EventsRegister />
</RouteGuard>

// Custom auth check
<RouteGuard 
  customAuthCheck={({ user, authState, hasCachedData }) => ({
    hasAccess: user?.role === 'admin',
    message: 'Admin access required'
  })}
>
  <AdminPanel />
</RouteGuard>
```

### `RequireAuth`
Simple authentication requirement:

```jsx
import { RequireAuth } from '../components/guards';

<RequireAuth>
  <ProtectedPage />
</RequireAuth>
```

### `RequireOfflineAccess`
Allow access with cached data or active authentication:

```jsx
import { RequireOfflineAccess } from '../components/guards';

<RequireOfflineAccess>
  <EventsPage />
</RequireOfflineAccess>
```

### `RequirePermission`
Permission-based access control:

```jsx
import { RequirePermission } from '../components/guards';

<RequirePermission permission="manage_events">
  <EventManagement />
</RequirePermission>
```

## Hooks

### `useRequireAuth()`
Programmatic authentication checking:

```jsx
import { useRequireAuth } from '../hooks/useRouteGuards';

function MyComponent() {
  const { isAuthenticated, authState, isLoading } = useRequireAuth('/login');
  
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return null; // Will redirect
  
  return <AuthenticatedContent />;
}
```

### `usePermissionGuard()`
Permission-based access:

```jsx
import { usePermissionGuard } from '../hooks/useRouteGuards';

function AdminComponent() {
  const { hasPermission, user } = usePermissionGuard('admin');
  
  if (!hasPermission) return null; // Will redirect
  
  return <AdminContent />;
}
```

## Authentication Levels

- `none` - No authentication required
- `any` - Any auth state or cached data sufficient
- `authenticated` - Fresh authentication required
- `offline_capable` - Auth or cached data access allowed
- `fresh_token` - Active token required

## Auth States

The guards integrate with the existing `useAuth` hook states:

- `no_data` - No authentication or cached data
- `cached_only` - Only cached data available
- `token_expired` - Token expired but cached data available
- `authenticated` - Fresh authentication token available