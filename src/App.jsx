import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import ResponsiveLayout from './components/ResponsiveLayout.jsx';
import BlockedScreen from './components/BlockedScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import EventDashboard from './components/EventDashboard.jsx';
import AttendanceView from './components/AttendanceView.jsx';
import MembersList from './components/MembersList.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import databaseService from './services/database.js';
import logger, { LOG_CATEGORIES } from './services/logger.js';
import { Alert } from './components/ui';
import './App.css';

function App() {
  const {
    isLoading,
    user,
    isBlocked,
    isOfflineMode,
    authState,
    lastSyncTime,
    login,
    logout,
  } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [navigationData, setNavigationData] = useState({});

  // Refresh function - triggers a data refresh via sync service
  const handleRefresh = async () => {
    try {
      // Import sync service dynamically to avoid circular dependencies
      const { default: syncService } = await import('./services/sync.js');
      
      // Trigger comprehensive data sync
      await syncService.syncAll();
      
      logger.info('Manual refresh completed successfully', {}, LOG_CATEGORIES.APP);
      
      addNotification('success', 'Data refreshed successfully');
    } catch (error) {
      logger.error('Manual refresh failed', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);
      
      addNotification('error', `Refresh failed: ${error.message}`);
    }
  };

  // Notification system state
  const [notifications, setNotifications] = useState([]);

  // Helper function to add notifications
  const addNotification = (type, message, duration = 5000) => {
    const id = Date.now();
    const notification = { id, type, message, duration };

    setNotifications((prev) => [...prev, notification]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };

  // Helper function to remove notifications
  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNavigateToMembers = async (section, members = null) => {
    // If members are provided (from fresh API call), use them
    // Otherwise, load cached members data for the selected section
    let membersData = members;

    if (!membersData) {
      try {
        membersData = await databaseService.getMembers([section.sectionid]);
      } catch (error) {
        logger.error(
          'Error loading cached members',
          { error: error.message, sectionId: section.sectionid },
          LOG_CATEGORIES.ERROR,
        );
        addNotification(
          'error',
          'Unable to load member data. Please try refreshing the page.',
        );
        membersData = [];
      }
    }

    setNavigationData({ section, members: membersData });
    setCurrentView('members');
  };

  const handleNavigateToAttendance = async (events, members = null) => {
    // If members are provided (from fresh API call), use them
    // Otherwise, load cached members data for the attendance view
    let membersData = members;

    if (!membersData) {
      const sectionsInvolved = [...new Set(events.map((e) => e.sectionid))];
      try {
        membersData = await databaseService.getMembers(sectionsInvolved);
      } catch (error) {
        logger.error(
          'Error loading cached members',
          { error: error.message, sectionsInvolved },
          LOG_CATEGORIES.ERROR,
        );
        addNotification(
          'error',
          'Unable to load member data for attendance view. Please try refreshing the page.',
        );
        membersData = [];
      }
    }

    setNavigationData({ events, members: membersData });
    setCurrentView('attendance');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setNavigationData({});
  };

  // OAuth callback processing moved to useAuth hook to fix race condition

  if (isLoading) {
    return (
      <LoadingScreen message="Checking authentication..." data-oid="82rsimx" />
    );
  }

  if (isBlocked) {
    return <BlockedScreen data-oid="8np6w_z" />;
  }

  // Always show dashboard - authentication is now contextual via header
  // No more blocking LoginScreen!

  const renderCurrentView = () => {
    switch (currentView) {
    case 'members':
      return (
        <MembersList
          sections={navigationData.section ? [navigationData.section] : []}
          members={navigationData.members || []} // Loaded from cache
          onBack={handleBackToDashboard}
          data-oid="xohl2s0"
        />
      );

    case 'attendance':
      return (
        <AttendanceView
          sections={
            navigationData.events
              ? [
                ...new Set(
                  navigationData.events.map((e) => ({
                    sectionid: e.sectionid,
                    sectionname: e.sectionname,
                  })),
                ),
              ]
              : []
          }
          events={navigationData.events || []}
          members={navigationData.members || []} // Loaded from cache
          onBack={handleBackToDashboard}
          data-oid="zrtob7_"
        />
      );

    default:
      return (
        <EventDashboard
          onNavigateToMembers={handleNavigateToMembers}
          onNavigateToAttendance={handleNavigateToAttendance}
          data-oid="zfo-c6t"
        />
      );
    }
  };

  return (
    <ErrorBoundary name="App" logProps={false} data-oid="b3kc7nt">
      <div className="App" data-testid="app" data-oid="bmzu2xc">
        <ErrorBoundary name="Router" logProps={false} data-oid="bx5pemu">
          <Router data-oid="ztwbw:3">
            <ErrorBoundary
              name="ResponsiveLayout"
              logProps={false}
              data-oid="1y4:f9s"
            >
              <ResponsiveLayout
                user={user}
                onLogout={logout}
                onLogin={login}
                onRefresh={handleRefresh}
                currentView={currentView}
                isOfflineMode={isOfflineMode}
                authState={authState}
                lastSyncTime={lastSyncTime}
                data-oid="2c61drc"
              >
                <ErrorBoundary
                  name="Routes"
                  logProps={false}
                  data-oid=":m15jt7"
                >
                  <Routes data-oid="c3k12d.">
                    <Route
                      path="/"
                      element={renderCurrentView()}
                      data-oid="ibytcl:"
                    />

                    <Route
                      path="/dashboard"
                      element={renderCurrentView()}
                      data-oid="z8vjxij"
                    />
                  </Routes>
                </ErrorBoundary>
              </ResponsiveLayout>
            </ErrorBoundary>
          </Router>
        </ErrorBoundary>

        {/* Notification System */}
        <ErrorBoundary
          name="NotificationSystem"
          logProps={false}
          data-oid="sqerlt5"
        >
          <div
            className="fixed top-4 right-4 z-50 space-y-2"
            style={{ maxWidth: '400px' }}
            data-oid="qcv7.ct"
          >
            {notifications.map((notification) => (
              <Alert
                key={notification.id}
                variant={notification.type}
                dismissible={true}
                onDismiss={() => removeNotification(notification.id)}
                className="shadow-lg"
                data-oid="tzwwc4s"
              >
                {notification.message}
              </Alert>
            ))}
          </div>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}

export default App;
