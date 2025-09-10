import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import ResponsiveLayout from '../../../shared/components/layout/ResponsiveLayout.jsx';
import { notifyError, notifyInfo } from '../../../shared/utils/notifications.js';
import TokenExpiredDialog from '../../../shared/components/TokenExpiredDialog.jsx';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

function EventsLayoutContent() {
  const navigate = useNavigate();
  const {
    user,
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
  
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (isOfflineMode) {
      notifyInfo('Refresh is unavailable while offline.');
      return;
    }
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const { default: syncService } = await import('../../../shared/services/storage/sync.js');
      await syncService.syncAll();
    } catch (error) {
      logger.error('Manual refresh failed', { error: error.message }, LOG_CATEGORIES.ERROR);
      notifyError('Refresh failed. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  return (
    <div className="events-layout">
      <ResponsiveLayout
        user={user}
        onLogout={logout}
        onLogin={login}
        onRefresh={handleRefresh}
        currentView="events"
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        isRefreshing={isRefreshing}
      >
        <MainNavigation onNavigateToSectionMovements={handleNavigateToSectionMovements} />
        {/* This is where nested route components will render */}
        <Outlet />
      </ResponsiveLayout>
      
      {/* Token expiration user choice dialog */}
      <TokenExpiredDialog
        isOpen={showTokenExpiredDialog}
        onReLogin={handleReLogin}
        onStayOffline={handleStayOffline}
        hasCachedData={hasCachedData}
      />
    </div>
  );
}

function EventsLayout() {
  return <EventsLayoutContent />;
}

export default EventsLayout;