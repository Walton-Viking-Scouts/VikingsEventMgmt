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
const YoungLeadersPage = React.lazy(() => import('../features/young-leaders/components').then(module => ({ default: module.YoungLeadersPage })));
const EventsRouter = React.lazy(() => import('../features/events/components').then(module => ({ default: module.EventsRouter })));
const DataClearPage = React.lazy(() => import('../features/admin/components').then(module => ({ default: module.DataClearPage })));

// Import route guards (keep synchronous for security)
import { RouteGuard } from '../shared/components/guards';

// Internal component that uses auth and notifications
function AppContent() {
  const {
    isLoading,
    user,
    isBlocked: _isBlocked,
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
              path="/young-leaders"
              element={
                <RouteGuard authLevel="none">
                  <YoungLeadersPage />
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