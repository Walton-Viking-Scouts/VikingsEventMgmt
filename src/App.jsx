import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import ResponsiveLayout from './components/ResponsiveLayout.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import BlockedScreen from './components/BlockedScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import EventDashboard from './components/EventDashboard.jsx';
import AttendanceView from './components/AttendanceView.jsx';
import MembersList from './components/MembersList.jsx';
import syncService from './services/sync.js';
import databaseService from './services/database.js';
import { Alert } from './components/ui';
import './App.css';

function App() {
  const { isAuthenticated, isLoading, user, isBlocked, isOfflineMode, login, logout } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [navigationData, setNavigationData] = useState({});
  
  // Notification system state
  const [notifications, setNotifications] = useState([]);
  
  // Helper function to add notifications
  const addNotification = (type, message, duration = 5000) => {
    const id = Date.now();
    const notification = { id, type, message, duration };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };
  
  // Helper function to remove notifications
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNavigateToMembers = async (section, members = null) => {
    // If members are provided (from fresh API call), use them
    // Otherwise, load cached members data for the selected section
    let membersData = members;
    
    if (!membersData) {
      try {
        membersData = await databaseService.getMembers([section.sectionid]);
      } catch (error) {
        console.error('Error loading cached members:', error);
        addNotification('error', 'Unable to load member data. Please try refreshing the page.');
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
      const sectionsInvolved = [...new Set(events.map(e => e.sectionid))];
      try {
        membersData = await databaseService.getMembers(sectionsInvolved);
      } catch (error) {
        console.error('Error loading cached members:', error);
        addNotification('error', 'Unable to load member data for attendance view. Please try refreshing the page.');
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

  useEffect(() => {
    // Check for OAuth callback parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const tokenType = urlParams.get('token_type');
    
    if (accessToken) {
      // Store the token and clean up URL
      sessionStorage.setItem('access_token', accessToken);
      if (tokenType) {
        sessionStorage.setItem('token_type', tokenType);
      }
      
      // Clean the URL without reloading
      const url = new URL(window.location);
      url.searchParams.delete('access_token');
      url.searchParams.delete('token_type');
      window.history.replaceState({}, '', url);
      
      // No post-login sync - let dashboard handle data loading
      const triggerPostLoginSync = async () => {
        // Force refresh to update UI - dashboard will handle data loading
        window.location.reload();
      };
      
      // Small delay to let token be set properly
      setTimeout(triggerPostLoginSync, 100);
    }
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  if (isBlocked) {
    return <BlockedScreen />;
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
    case 'members':
      return (
        <MembersList
          sections={navigationData.section ? [navigationData.section] : []}
          members={navigationData.members || []} // Loaded from cache
          onBack={handleBackToDashboard}
        />
      );
    case 'attendance':
      return (
        <AttendanceView
          sections={navigationData.events ? [...new Set(navigationData.events.map(e => ({ sectionid: e.sectionid, sectionname: e.sectionname })))] : []}
          events={navigationData.events || []}
          members={navigationData.members || []} // Loaded from cache
          onBack={handleBackToDashboard}
        />
      );
    default:
      return (
        <EventDashboard
          onNavigateToMembers={handleNavigateToMembers}
          onNavigateToAttendance={handleNavigateToAttendance}
        />
      );
    }
  };

  return (
    <div className="App" data-testid="app">
      <Router>
        <ResponsiveLayout user={user} onLogout={logout} onLogin={login} currentView={currentView} isOfflineMode={isOfflineMode}>
          <Routes>
            <Route path="/" element={renderCurrentView()} />
            <Route path="/dashboard" element={renderCurrentView()} />
          </Routes>
        </ResponsiveLayout>
      </Router>
      
      {/* Notification System */}
      <div className="fixed top-4 right-4 z-50 space-y-2" style={{ maxWidth: '400px' }}>
        {notifications.map(notification => (
          <Alert
            key={notification.id}
            variant={notification.type}
            dismissible={true}
            onDismiss={() => removeNotification(notification.id)}
            className="shadow-lg"
          >
            {notification.message}
          </Alert>
        ))}
      </div>
    </div>
  );
}

export default App;
