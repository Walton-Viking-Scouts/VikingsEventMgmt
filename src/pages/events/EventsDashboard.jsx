import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import ResponsiveLayout from '../../components/ResponsiveLayout.jsx';
import EventDashboard from '../../components/EventDashboard.jsx';
import AttendanceView from '../../components/AttendanceView.jsx';
import { NotificationProvider } from '../../adapters';
import { useNotification } from '../../contexts/notifications/NotificationContext';
import ToastContainer from '../../components/notifications/ToastContainer';
import databaseService from '../../services/database.js';
import logger, { LOG_CATEGORIES } from '../../services/logger.js';
import { getUniqueSectionsFromEvents } from '../../utils/sectionHelpers.js';

function EventsDashboardContent() {
  const {
    user,
    isOfflineMode,
    authState,
    lastSyncTime,
    login,
    logout,
  } = useAuth();
  
  const { notifications, notifyInfo, notifyError, notifyWarning, remove } = useNotification();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('dashboard');
  const [navigationData, setNavigationData] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing] = useState(false);

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

  const handleNavigateToAttendance = async (events, members = null) => {
    if (isSyncing) {
      notifyInfo('Please wait for data sync to complete before viewing attendance details.', { duration: 4000 });
      return;
    }

    let membersData = members;
    if (!membersData) {
      const sectionsInvolved = Array.from(new Set(events.map((e) => e.sectionid)));
      try {
        membersData = await databaseService.getMembers(sectionsInvolved);
        if (!membersData || membersData.length === 0) {
          notifyWarning('Member data not yet available. Please wait for sync to complete or try refreshing.', { duration: 6000 });
          return;
        }
      } catch (error) {
        logger.error('Error loading cached members', { error: error.message, sectionsInvolved }, LOG_CATEGORIES.ERROR);
        notifyError('Unable to load member data for attendance view. Please try refreshing the page.');
        return;
      }
    }

    setNavigationData({ events, members: membersData });
    setCurrentView('attendance');
  };

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setNavigationData({});
  };

  const renderCurrentView = () => {
    switch (currentView) {
    case 'attendance': {
      const uniqueSections = getUniqueSectionsFromEvents(navigationData.events);
      return (
        <AttendanceView
          sections={uniqueSections}
          events={navigationData.events || []}
          members={navigationData.members || []}
          onBack={handleBackToDashboard}
        />
      );
    }
    default:
      return (
        <EventDashboard
          onNavigateToAttendance={handleNavigateToAttendance}
          onNavigateToSectionMovements={handleNavigateToSectionMovements}
        />
      );
    }
  };

  return (
    <div className="events-dashboard">
      <ToastContainer toasts={notifications} onDismiss={remove} />
      <ResponsiveLayout
        user={user}
        onLogout={logout}
        onLogin={login}
        onRefresh={handleRefresh}
        currentView={currentView}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        isRefreshing={isRefreshing}
      >
        {renderCurrentView()}
      </ResponsiveLayout>
    </div>
  );
}

function EventsDashboard() {
  return (
    <NotificationProvider>
      <EventsDashboardContent />
    </NotificationProvider>
  );
}

export default EventsDashboard;