import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppStateProvider } from '../shared/contexts/app';
import LoadingScreen from '../shared/components/LoadingScreen.jsx';
import ResponsiveLayout from '../shared/components/layout/ResponsiveLayout.jsx';
import TokenExpiredDialog from '../shared/components/TokenExpiredDialog.jsx';
import { useAuth } from '../features/auth/hooks';

// URL-based routing is now the only routing system

// Lazy load main feature modules for better performance
const MoversPage = React.lazy(() => import('../features/movements/components').then(module => ({ default: module.MoversPage })));
const SectionsPage = React.lazy(() => import('../features/sections/components').then(module => ({ default: module.SectionsPage })));
const EventsRouter = React.lazy(() => import('../features/events/components').then(module => ({ default: module.EventsRouter })));
const DataClearPage = React.lazy(() => import('../features/admin/components').then(module => ({ default: module.DataClearPage })));

// Import route guards (keep synchronous for security)
import { RouteGuard } from '../shared/components/guards';

/**
 * Internal routing component that handles authenticated Scout management interface.
 *
 * This component manages the core Scout application interface with authentication,
 * offline capabilities, and responsive layout. It provides the main navigation
 * structure for Scout leaders to manage sections, events, and member movements
 * while handling both online and offline operational modes.
 *
 * The component integrates authentication state, data synchronization, token
 * management, and responsive layout to deliver a seamless Scout management
 * experience across different devices and network conditions.
 *
 * @component
 * @returns {ReactElement} The authenticated Scout management interface with routing
 * @description Provides Scout-themed UI components and navigation patterns
 * @description Includes offline-aware functionality with cached data support
 * @since 1.0.0
 * @example
 * // Used internally by AppRouter - not directly imported
 * // Handles authenticated routes like:
 * // /movers - Member movement tracking
 * // /sections - Scout section management  
 * // /events/* - Event management and attendance
 * // /clear - Administrative data management
 * @example
 * // Authentication states handled:
 * // - Loading: Shows authentication check screen
 * // - Authenticated: Shows full Scout interface
 * // - Offline: Shows cached data with sync options
 * // - Token expired: Shows re-authentication dialog
 * @example
 * // Scout workflow integration:
 * // 1. Section management (Beavers, Cubs, Scouts, Venturers, Rovers)
 * // 2. Member movement tracking between sections
 * // 3. Event creation and attendance management
 * // 4. Offline data synchronization with OSM API
 * // 5. Administrative tools for Scout leaders
 */
function AppContent() {
  const {
    isLoading,
    user,
    // isBlocked, // Currently unused - may be implemented later for blocking UI
    isOfflineMode,
    authState,
    lastSyncTime,
    showTokenExpiredDialog,
    hasCachedData,
    handleReLogin,
    handleStayOffline,
    login,
    logout,
  } = useAuth();


  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  const handleRefresh = async () => {
    if (isOfflineMode) {
      return;
    }
    try {
      const { default: syncService } = await import('../shared/services/storage/sync.js');
      await syncService.syncAll();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  return (
    <>
      <ResponsiveLayout
        user={user}
        onLogout={logout}
        onLogin={login}
        onRefresh={handleRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        isRefreshing={false}
      >
        <Suspense fallback={<LoadingScreen message="Loading application..." />}>
          <Routes>
            {/* Main application sections */}
            <Route 
              path="/movers" 
              element={
                <RouteGuard authLevel="none">
                  <MoversPage />
                </RouteGuard>
              } 
            />
            <Route 
              path="/sections" 
              element={
                <RouteGuard authLevel="none">
                  <SectionsPage />
                </RouteGuard>
              } 
            />
            <Route 
              path="/events/*" 
              element={
                <RouteGuard authLevel="none">
                  <EventsRouter />
                </RouteGuard>
              } 
            />
            <Route 
              path="/clear" 
              element={
                <RouteGuard authLevel="none">
                  <DataClearPage />
                </RouteGuard>
              } 
            />
            
            {/* Legacy route redirects */}
            <Route path="/dashboard" element={<Navigate to="/events" replace />} />
            <Route path="/" element={<Navigate to={`/events${window.location.search}`} replace />} />
          </Routes>
        </Suspense>
      </ResponsiveLayout>

      {/* Token expiration dialog */}
      <TokenExpiredDialog
        isOpen={showTokenExpiredDialog}
        onReLogin={handleReLogin}
        onStayOffline={handleStayOffline}
        hasCachedData={hasCachedData}
      />
    </>
  );
}

/**
 * Main application router for the Viking Event Management Scout application.
 *
 * This is the primary routing component that establishes the browser-based navigation
 * system for Scout event management. It wraps the application in essential providers
 * for state management and routing, creating the foundation for offline-first
 * Scout operations and OSM API integration.
 *
 * The router handles all URL-based navigation, OAuth authentication flows, and
 * provides the context infrastructure needed for Scout section management,
 * member movements, and event coordination across the entire application.
 *
 * @component
 * @returns {ReactElement} The complete Scout application routing system with providers
 * @description Provides Scout-themed UI components and navigation patterns
 * @description Includes offline-aware functionality with cached data support
 * @since 1.0.0
 * @example
 * // Primary usage as the main routing component
 * import AppRouter from './routes/AppRouter.jsx';
 * 
 * function App() {
 *   return (
 *     <>
 *       <AppRouter />
 *       <Toaster />
 *     </>
 *   );
 * }
 * @example
 * // Supported Scout management routes:
 * // /events - Main Scout event management dashboard
 * // /events/create - Create new Scout events  
 * // /events/:id - View/edit specific Scout event
 * // /movers - Member movement tracking between sections
 * // /sections - Scout section overview (Beavers, Cubs, etc.)
 * // /clear - Administrative data management tools
 * @example
 * // OAuth and authentication flow handling:
 * // 1. Automatic OSM OAuth callback processing
 * // 2. Token storage and refresh management
 * // 3. Offline mode with cached Scout data
 * // 4. Token expiration and re-authentication
 * // 5. Scout group context and permissions
 * @example
 * // Context providers enabled:
 * // - AppStateProvider: Global Scout application state
 * // - BrowserRouter: URL-based navigation
 * // - Authentication context: User and session management
 * // - Offline capabilities: Cached data and sync status
 */
function AppRouter() {
  // URL-based routing with OAuth processing
  return (
    <BrowserRouter>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </BrowserRouter>
  );
}

export default AppRouter;