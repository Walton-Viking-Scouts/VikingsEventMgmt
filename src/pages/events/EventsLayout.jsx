import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import ResponsiveLayout from '../../components/ResponsiveLayout.jsx';
import { NotificationProvider } from '../../adapters';
import { useNotification } from '../../contexts/notifications/NotificationContext';
import ToastContainer from '../../components/notifications/ToastContainer';
import MainNavigation from '../../components/MainNavigation.jsx';
import logger, { LOG_CATEGORIES } from '../../services/logger.js';

function EventsLayoutContent() {
  const navigate = useNavigate();
  const {
    user,
    isOfflineMode,
    authState,
    lastSyncTime,
    login,
    logout,
  } = useAuth();
  
  const { notifications, notifyInfo, notifyError, remove } = useNotification();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (isOfflineMode) {
      notifyInfo('Refresh is unavailable while offline.');
      return;
    }
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const { default: syncService } = await import('../../services/sync.js');
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
      <ToastContainer toasts={notifications} onDismiss={remove} />
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
    </div>
  );
}

function EventsLayout() {
  return (
    <NotificationProvider>
      <EventsLayoutContent />
    </NotificationProvider>
  );
}

export default EventsLayout;