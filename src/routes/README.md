# URL-Based Routing System

This directory contains the new URL-based routing system for the Viking Event Management application, built with React Router v6. The system is designed for incremental migration from the existing state-based navigation.

## Feature Flag Control

The routing system is controlled by the `VITE_USE_URL_ROUTING` environment variable:

```bash
# .env
VITE_USE_URL_ROUTING=false  # Uses legacy state-based navigation (default)
VITE_USE_URL_ROUTING=true   # Enables new URL-based routing
```

## Route Hierarchy

```
/
├── / (redirect to /events)
├── /dashboard (redirect to /events)
├── /clear (redirect to /events)
├── /movers [🔒 offline_capable]
├── /sections [🔒 offline_capable]
└── /events/* [🔒 offline_capable]
    ├── / (dashboard - index route)
    ├── /overview
    ├── /register [🔒 authenticated]
    ├── /detail/:eventId
    └── /camp-groups [🔒 authenticated]
```

**Legend:**
- 🔒 = Route guard applied
- `offline_capable` = Allows access with authentication OR cached data
- `authenticated` = Requires fresh authentication token

## File Structure

```
src/routes/
├── README.md              # This documentation
├── AppRouter.jsx           # Main router with feature flag logic
├── LegacyApp.jsx          # Preserved legacy navigation system
└── ../pages/
    ├── events/
    │   ├── EventsRouter.jsx    # Nested events routing
    │   ├── EventsLayout.jsx    # Layout with Outlet for nested routes
    │   ├── EventsDashboardContent.jsx
    │   ├── EventsOverview.jsx
    │   ├── EventsRegister.jsx
    │   ├── EventsDetail.jsx
    │   └── EventsCampGroups.jsx
    ├── movers/
    │   └── MoversPage.jsx
    └── sections/
        └── SectionsPage.jsx
```

## Core Components

### AppRouter.jsx

The main routing component that handles feature flag logic:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RouteGuard } from '../components/guards';

function AppRouter() {
  if (!USE_URL_ROUTING) {
    return <LegacyApp />; // Fallback to legacy system
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/movers" element={
          <RouteGuard authLevel="offline_capable">
            <MoversPage />
          </RouteGuard>
        } />
        {/* ... other routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

### EventsRouter.jsx

Implements nested routing for the events section using React Router v6 patterns:

```jsx
import { Routes, Route } from 'react-router-dom';

function EventsRouter() {
  return (
    <Routes>
      {/* Parent route with layout */}
      <Route path="/" element={<EventsLayout />}>
        {/* Nested routes rendered via Outlet */}
        <Route index element={<EventsDashboardContent />} />
        <Route path="overview" element={<EventsOverview />} />
        <Route path="detail/:eventId" element={<EventsDetail />} />
        {/* ... guarded routes */}
      </Route>
    </Routes>
  );
}
```

### EventsLayout.jsx

Layout component that provides shared structure for nested routes:

```jsx
import { Outlet } from 'react-router-dom';

function EventsLayout() {
  return (
    <NotificationProvider>
      <ResponsiveLayout>
        {/* Shared layout elements */}
        <Outlet /> {/* Nested routes render here */}
      </ResponsiveLayout>
    </NotificationProvider>
  );
}
```

## Route Parameters

### Dynamic Event Details

The `/events/detail/:eventId` route accepts an `eventId` parameter:

```jsx
// Route definition
<Route path="detail/:eventId" element={<EventsDetail />} />

// Usage in component
import { useParams } from 'react-router-dom';

function EventsDetail() {
  const { eventId } = useParams();
  // eventId is available for API calls, data fetching, etc.
}
```

### URL Examples

```
/events/detail/demo_event_camp2024  # eventId = "demo_event_camp2024"
/events/detail/winter_camp_2024     # eventId = "winter_camp_2024"
```

## Route Guards

### Authentication Levels

The system supports multiple authentication levels to accommodate offline functionality:

1. **`none`** - No authentication required
2. **`any`** - Any auth state or cached data sufficient
3. **`offline_capable`** - Auth or cached data access allowed
4. **`authenticated`** - Fresh authentication required
5. **`fresh_token`** - Active token required

### Guard Implementation

```jsx
import { RouteGuard } from '../components/guards';

// Main sections - allow offline access
<RouteGuard authLevel="offline_capable">
  <MoversPage />
</RouteGuard>

// Write operations - require fresh authentication
<RouteGuard authLevel="authenticated">
  <EventsRegister />
</RouteGuard>

// Custom auth logic
<RouteGuard 
  customAuthCheck={({ user, authState, hasCachedData }) => ({
    hasAccess: user?.permissions?.includes('admin'),
    message: 'Admin access required'
  })}
>
  <AdminPanel />
</RouteGuard>
```

### Auth State Integration

Guards integrate with the existing `useAuth` hook authentication states:

- `no_data` - No authentication or cached data available
- `cached_only` - Only cached data available (offline mode)
- `token_expired` - Token expired but cached data available
- `authenticated` - Fresh authentication token available

## Navigation Patterns

### Programmatic Navigation

```jsx
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();
  
  // Navigate to events dashboard
  navigate('/events');
  
  // Navigate to specific event
  navigate(`/events/detail/${eventId}`);
  
  // Navigate with state
  navigate('/events/register', { 
    state: { from: location } 
  });
}
```

### Link Navigation

```jsx
import { Link } from 'react-router-dom';

// Basic navigation
<Link to="/events/overview">Events Overview</Link>

// Dynamic navigation
<Link to={`/events/detail/${event.eventId}`}>
  View Event Details
</Link>

## Error Handling & Fallbacks

### Route Not Found

```jsx
// In EventsRouter.jsx
<Route path="*" element={<Navigate to="/events" replace />} />

// In AppRouter.jsx
<Route path="/" element={<Navigate to="/events" replace />} />
```

### Authentication Failures

Route guards provide multiple fallback options:

```jsx
<RouteGuard 
  authLevel="authenticated"
  showLoginScreen={true}        // Show login screen (default)
  redirectTo="/events"          // Or redirect to different route
  fallbackComponent={<Custom />} // Or custom component
>
  <ProtectedComponent />
</RouteGuard>
```

## Migration Strategy

### Phase 1: Feature Flag (Current)
- URL routing behind feature flag
- Legacy system remains default
- Safe testing and validation

### Phase 2: Gradual Rollout
- Enable URL routing for specific user groups
- Monitor for issues and performance
- Gather user feedback

### Phase 3: Full Migration
- Set `VITE_USE_URL_ROUTING=true` as default
- Remove legacy routing code
- Clean up feature flag logic

### Phase 4: Enhancement
- Add advanced routing features
- Implement route-level code splitting
- Add breadcrumb navigation

## Backward Compatibility

The system maintains full backward compatibility:

1. **Feature Flag**: Legacy system remains available via environment variable
2. **State Preservation**: Existing authentication and data patterns unchanged
3. **Component Reuse**: All existing components work with new routing
4. **API Compatibility**: No changes to backend API integration

## Testing Strategy

### Route Guard Testing

```jsx
// Test authenticated access
it('should redirect to login when not authenticated', () => {
  render(<RouteGuard authLevel="authenticated"><ProtectedComponent /></RouteGuard>);
  // Assert redirect or login screen shown
});

// Test offline access
it('should allow access with cached data', () => {
  // Mock authState = 'cached_only'
  render(<RouteGuard authLevel="offline_capable"><OfflineComponent /></RouteGuard>);
  // Assert component renders
});
```

### Route Testing

```jsx
// Test route parameters
// Test route parameters
it('should extract eventId from URL', () => {
  render(
    <MemoryRouter initialEntries={['/events/detail/test_event_123']}>
      <Routes>
        <Route path="/events/detail/:eventId" element={<EventsDetail />} />
      </Routes>
    </MemoryRouter>
  );
  // Assert eventId is correctly parsed and used
});
## Performance Considerations

### Code Splitting

Future enhancement opportunity:

```jsx
// Lazy loading for route components
const EventsRegister = lazy(() => import('./EventsRegister.jsx'));

<Route path="register" element={
  <Suspense fallback={<LoadingSpinner />}>
    <RouteGuard authLevel="authenticated">
      <EventsRegister />
    </RouteGuard>
  </Suspense>
} />
```

### Bundle Size

Current route guards add minimal bundle size:
- Core guards: ~2KB gzipped
- React Router v6: Already included
- No additional dependencies

## Troubleshooting

### Common Issues

1. **Feature flag not working**: Check `.env` file and restart dev server
2. **Routes not matching**: Verify exact path patterns and nesting
3. **Guards not enforcing**: Check authentication state and guard configuration
4. **Nested routes not rendering**: Ensure `<Outlet />` is present in parent component

### Debug Tools

```jsx
// Add to components for debugging
import { useLocation, useParams } from 'react-router-dom';

function DebugInfo() {
  const location = useLocation();
  const params = useParams();
  
  console.log('Current location:', location);
  console.log('Route parameters:', params);
}
```

## Future Enhancements

1. **Breadcrumb Navigation**: Automatic breadcrumbs based on route hierarchy
2. **Route Transitions**: Smooth transitions between route changes  
3. **Deep Linking**: Support for complex state in URLs
4. **Route Caching**: Cache route components for performance
5. **Analytics**: Track route usage and performance metrics