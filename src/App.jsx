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
import { getUniqueSectionsFromEvents } from './utils/sectionHelpers.js';
import { logout as clearAllStorage } from './services/auth.js';

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
      const timeoutId = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
      
      // Store timeout ID for potential cleanup
      notification.timeoutId = timeoutId;
    }
  }, []);

  // Helper function to remove notifications
  const removeNotification = (id) => {
    setNotifications((prev) => {
      const notification = prev.find((n) => n.id === id);
      if (notification?.timeoutId) {
        clearTimeout(notification.timeoutId);
      }
      return prev.filter((n) => n.id !== id);
    });
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
      
      const offlineMessage = 
        authState === 'token_expired' || authState === 'cached_only'
          ? 'Your authentication has expired, but you can still access cached data. Connect to WiFi and refresh to re-authenticate with OSM.'
          : 'You are currently offline. You can still access cached data. Connect to WiFi and refresh to sync changes.';
      
      addNotification(
        'info', 
        `Offline Mode${userName}: ${offlineMessage}`,
        8000, // Show for 8 seconds
      );
    }
  }, [isLoading, isOfflineMode, user, addNotification]);

  // Listen for sync status changes
  useEffect(() => {
    let cleanup = null;

    const setupSyncListener = async () => {
      try {
        const { default: syncService } = await import('./services/sync.js');
        
        const handleSyncStatus = (status) => {
          setIsSyncing(status.status === 'syncing');
        };
        
        syncService.addSyncListener(handleSyncStatus);
        
        cleanup = () => {
          syncService.removeSyncListener(handleSyncStatus);
        };
      } catch (error) {
        logger.error('Failed to setup sync listener', { error: error.message }, LOG_CATEGORIES.ERROR);
      }
    };

    setupSyncListener();

    // Return cleanup function that will be called on unmount
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
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
      const sectionsInvolved = Array.from(new Set(events.map((e) => e.sectionid)));
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

    // Set new navigation data (will replace any existing data)
    setNavigationData({ events, members: membersData });
    setCurrentView('attendance');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setNavigationData({}); // Restore: Clear navigation data for proper state management
  };

  // Clear Storage View component for troubleshooting
  const ClearStorageView = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">Clear All Storage</h2>
        <p className="text-gray-600 mb-6 text-center">
          This will clear all cached data and reset the application to its initial state. 
          You will need to log in again after clearing storage.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => {
              clearAllStorage();
              addNotification('success', 'All storage cleared successfully. Reloading...', 2000);
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 2000);
            }}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Clear All Storage & Reload
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

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

    switch (currentView) {
    case 'attendance': {
      const uniqueSections = getUniqueSectionsFromEvents(navigationData.events);
      
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

                    <Route
                      path="/clear"
                      element={<ClearStorageView />}
                      data-oid="clear-storage"
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
