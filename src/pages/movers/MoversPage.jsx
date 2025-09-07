import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionMovementTracker } from '../../components/sectionMovements';
import { useAuth } from '../../hooks/useAuth.js';
import ResponsiveLayout from '../../components/ResponsiveLayout.jsx';
import { NotificationProvider } from '../../adapters';
import { useNotification } from '../../contexts/notifications/NotificationContext';
import ToastContainer from '../../components/notifications/ToastContainer';
import MainNavigation from '../../components/MainNavigation.jsx';

function MoversPageContent() {
  const {
    user,
    isOfflineMode,
    authState,
    lastSyncTime,
    login,
    logout,
  } = useAuth();
  
  const { notifications, remove } = useNotification();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (isOfflineMode) {
      return;
    }
    setIsRefreshing(true);
    try {
      const { default: syncService } = await import('../../services/sync.js');
      await syncService.syncAll();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/events');
  };

  const handleNavigateToSectionMovements = () => {
    // Already on movers page, but keep for consistency
    navigate('/movers');
  };

  return (
    <div className="movers-page">
      <ToastContainer toasts={notifications} onDismiss={remove} />
      <ResponsiveLayout
        user={user}
        onLogout={logout}
        onLogin={login}
        onRefresh={handleRefresh}
        currentView="section-movements"
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        isRefreshing={isRefreshing}
      >
        <MainNavigation onNavigateToSectionMovements={handleNavigateToSectionMovements} />
        <SectionMovementTracker onBack={handleBackToDashboard} />
      </ResponsiveLayout>
    </div>
  );
}

function MoversPage() {
  return (
    <NotificationProvider>
      <MoversPageContent />
    </NotificationProvider>
  );
}

export default MoversPage;