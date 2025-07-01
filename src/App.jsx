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
      
      // Trigger auth check
      window.location.reload();
    }

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
