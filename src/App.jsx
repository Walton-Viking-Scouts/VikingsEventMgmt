import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import ResponsiveLayout from './components/ResponsiveLayout.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import BlockedScreen from './components/BlockedScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import EventDashboard from './components/EventDashboard.jsx';
import AttendanceView from './components/AttendanceView.jsx';
import MembersList from './components/MembersList.jsx';
import _syncService from './services/sync.js';
import databaseService from './services/database.js';
import logger, { LOG_CATEGORIES } from './services/logger.js';
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
        logger.error('Error loading cached members', { error: error.message }, LOG_CATEGORIES.ERROR);
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
        logger.error('Error loading cached members', { error: error.message }, LOG_CATEGORIES.ERROR);
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

  // OAuth callback processing moved to useAuth hook to fix race condition

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
