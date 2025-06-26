import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import ResponsiveLayout from './components/ResponsiveLayout.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import BlockedScreen from './components/BlockedScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import Dashboard from './pages/Dashboard.jsx';
import syncService from './services/sync.js';
import SentryTestButton from './components/SentryTestButton.jsx';
import './App.css';

function App() {
  const { isAuthenticated, isLoading, user, isBlocked, login, logout } = useAuth();

  useEffect(() => {
    // Setup auto-sync when app loads
    syncService.setupAutoSync();
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  if (isBlocked) {
    return <BlockedScreen />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen onLogin={login} />
        <SentryTestButton />
      </>
    );
  }

  return (
    <div className="App" data-testid="app">
      <Router>
        <ResponsiveLayout user={user} onLogout={logout}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </ResponsiveLayout>
      </Router>
      <SentryTestButton />
    </div>
  );
}

export default App;