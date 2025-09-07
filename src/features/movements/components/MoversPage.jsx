import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionMovementTracker } from './';
import { useAuth } from '../../auth/hooks';
import { ResponsiveLayout, MainNavigation } from '../../../shared/components/layout';
import { NotificationProvider } from '../../../shared/adapters';
import { useNotification } from '../../../shared/contexts/notifications/NotificationContext';
import ToastContainer from '../../../shared/components/notifications/ToastContainer';
import TokenExpiredDialog from '../../../shared/components/TokenExpiredDialog.jsx';

function MoversPageContent() {
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
  
  const { notifications, remove } = useNotification();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (isOfflineMode) {
      return;
    }
    setIsRefreshing(true);
    try {
      const { default: syncService } = await import('../../../shared/services/storage/sync.js');
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

function MoversPage() {
  return (
    <NotificationProvider>
      <MoversPageContent />
    </NotificationProvider>
  );
}

export default MoversPage;