import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import ResponsiveLayout from './components/ResponsiveLayout.jsx';
import BlockedScreen from './components/BlockedScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import EventDashboard from './components/EventDashboard.jsx';
import AttendanceView from './components/AttendanceView.jsx';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Notification system state
  const [notifications, setNotifications] = useState([]);

  // Helper function to add notifications
  const addNotification = useCallback((type, message, duration = 5000) => {
    const id = Date.now();
    const notification = { id, type, message, duration };

    setNotifications((prev) => [...prev, notification]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  }, []);

  // Helper function to remove notifications
  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Refresh function - triggers a data refresh via sync service
  const handleRefresh = async () => {
    // Short-circuit when offline for better UX
    if (isOfflineMode) {
      addNotification('info', 'Refresh is unavailable while offline.');
      return;
    }
    // Prevent concurrent refreshes
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      // Import sync service dynamically to avoid circular dependencies
      const { default: syncService } = await import('./services/sync.js');
      // Trigger comprehensive data sync
      await syncService.syncAll();
      logger.info('Manual refresh completed successfully', {}, LOG_CATEGORIES.APP);
      addNotification('success', 'Data refreshed successfully');
    } catch (error) {
      logger.error('Manual refresh failed', { error: error.message, stack: error.stack }, LOG_CATEGORIES.ERROR);
      // Avoid leaking raw error messages to end users
      addNotification('error', 'Refresh failed. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Show offline toast when loading completes and we're in offline mode
  useEffect(() => {
    if (!isLoading && isOfflineMode && user) {
      const userName = user?.firstname ? `, ${user.firstname}` : '';
      addNotification(
        'info', 
        `Offline Mode${userName}: Using cached data. Your authentication has expired - sign in to refresh.`,
        8000, // Show for 8 seconds
      );
      
      logger.debug('Offline mode toast notification shown', {
        hasUserInfo: !!user,
        userName: user?.firstname || 'Unknown',
      }, LOG_CATEGORIES.AUTH);
    }
  }, [isLoading, isOfflineMode, user, addNotification]);

  // Listen for sync status changes
  useEffect(() => {
    const setupSyncListener = async () => {
      try {
        const { default: syncService } = await import('./services/sync.js');
        
        const handleSyncStatus = (status) => {
          setIsSyncing(status.status === 'syncing');
        };
        
        syncService.addSyncListener(handleSyncStatus);
        
        return () => {
          syncService.removeSyncListener(handleSyncStatus);
        };
      } catch (error) {
        logger.error('Failed to setup sync listener', { error: error.message }, LOG_CATEGORIES.ERROR);
      }
    };

    setupSyncListener();
  }, []);

  const handleNavigateToAttendance = async (events, members = null) => {
    // If sync is in progress, show a helpful message and don't navigate
    if (isSyncing) {
      addNotification(
        'info',
        'Please wait for data sync to complete before viewing attendance details.',
        4000,
      );
      return;
    }

    // If members are provided (from fresh API call), use them
    // Otherwise, load cached members data for the attendance view
    let membersData = members;

    if (!membersData) {
      const sectionsInvolved = [...new Set(events.map((e) => e.sectionid))];
      try {
        membersData = await databaseService.getMembers(sectionsInvolved);
        
        // If no cached members found, the sync might not have completed yet
        if (!membersData || membersData.length === 0) {
          addNotification(
            'warning',
            'Member data not yet available. Please wait for sync to complete or try refreshing.',
            6000,
          );
          return;
        }
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
        return;
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
    // Helper to extract unique sections from events
    const getUniqueSections = (events) => {
      if (!events || !Array.isArray(events)) return [];
      
      const sectionMap = new Map();
      events.forEach((event) => {
        if (event.sectionid && !sectionMap.has(event.sectionid)) {
          sectionMap.set(event.sectionid, {
            sectionid: event.sectionid,
            sectionname: event.sectionname,
          });
        }
      });
      return Array.from(sectionMap.values());
    };

    switch (currentView) {
    case 'attendance': {
      const uniqueSections = getUniqueSections(navigationData.events);
      
      return (
        <AttendanceView
          sections={uniqueSections}
          events={navigationData.events || []}
          members={navigationData.members || []} // Loaded from cache
          onBack={handleBackToDashboard}
          data-oid="zrtob7_"
        />
      );
    }
    default:
      return (
        <EventDashboard
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
                isRefreshing={isRefreshing}
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
