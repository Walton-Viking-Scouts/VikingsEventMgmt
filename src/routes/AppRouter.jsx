import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppStateProvider } from '../shared/contexts/app';
import LoadingScreen from '../shared/components/LoadingScreen.jsx';
import ResponsiveLayout from '../shared/components/layout/ResponsiveLayout.jsx';
import TokenExpiredDialog from '../shared/components/TokenExpiredDialog.jsx';
import { useAuth } from '../features/auth/hooks';
import { lazyWithRetry } from '../shared/utils/lazyWithRetry.js';
import ErrorBoundary from '../shared/components/ErrorBoundary.jsx';

// URL-based routing is now the only routing system

// Lazy load main feature modules for better performance
const MoversPage = lazyWithRetry(() => import('../features/movements/components').then(module => ({ default: module.MoversPage })));
const SectionsPage = lazyWithRetry(() => import('../features/sections/components').then(module => ({ default: module.SectionsPage })));
const PhotoConsentPage = lazyWithRetry(() => import('../features/sections/components').then(module => ({ default: module.PhotoConsentPage })));
const YoungLeadersPage = lazyWithRetry(() => import('../features/young-leaders/components').then(module => ({ default: module.YoungLeadersPage })));
const EventsRouter = lazyWithRetry(() => import('../features/events/components').then(module => ({ default: module.EventsRouter })));
const WaterRotaRouter = lazyWithRetry(() => import('../features/water-rota/components').then(module => ({ default: module.WaterRotaRouter })));
const DataClearPage = lazyWithRetry(() => import('../features/admin/components').then(module => ({ default: module.DataClearPage })));

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

  /**
   * Header refresh: runs the SAME full sequence as the dashboard refresh and
   * post-login load. It previously refreshed reference data only, so a user
   * who hit it saw "refreshed" while events and attendance stayed stale.
   *
   * @returns {Promise<void>}
   */
  const handleRefresh = async () => {
    try {
      const { notifyWarning } = await import('../shared/utils/notifications.js');
      if (isOfflineMode) {
        notifyWarning('Offline - showing cached data. Reconnect to refresh.');
        return;
      }
      const { getToken } = await import('../shared/services/auth/tokenService.js');
      const { default: dataLoadingService } = await import('../shared/services/data/dataLoadingService.js');

      const token = getToken();
      if (token) {
        await dataLoadingService.loadAllDataAfterAuth(token);
      } else {
        notifyWarning('Sign in to OSM to refresh data.');
      }
    } catch (error) {
      const { default: logger, LOG_CATEGORIES } = await import('../shared/services/utils/logger.js');
      logger.error('Refresh failed', { error: error }, LOG_CATEGORIES.ERROR);
      const { notifyError } = await import('../shared/utils/notifications.js').catch(() => ({ notifyError: null }));
      if (notifyError) {
        notifyError(`Refresh failed: ${error.message}`);
      }
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
        <ErrorBoundary>
          <Suspense fallback={<LoadingScreen message="Loading application..." />}>
            <Routes>
              {/* Main application sections */}
              <Route path="/movers" element={<MoversPage />} />
              <Route path="/sections" element={<SectionsPage />} />
              <Route path="/photo-consent" element={<PhotoConsentPage />} />
              <Route path="/young-leaders" element={<YoungLeadersPage />} />
              <Route path="/events/*" element={<EventsRouter />} />
              <Route path="/water-rota/*" element={<WaterRotaRouter />} />
              <Route path="/clear" element={<DataClearPage />} />

              {/* Legacy route redirects */}
              <Route path="/dashboard" element={<Navigate to="/events" replace />} />
              <Route path="/" element={<Navigate to={`/events${window.location.search}`} replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
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