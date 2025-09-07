import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppStateProvider } from '../contexts/app';

// Feature flag for gradual rollout
const USE_URL_ROUTING = import.meta.env.VITE_USE_URL_ROUTING === 'true';

// Import the existing App component for legacy mode
import LegacyApp from './LegacyApp.jsx';

// Import page components for the new routing system
import MoversPage from '../pages/movers/MoversPage.jsx';
import SectionsPage from '../pages/sections/SectionsPage.jsx';
import EventsRouter from '../pages/events/EventsRouter.jsx';
import DataClearPage from '../components/DataClearPage.jsx';

// Import route guards
import { RouteGuard } from '../components/guards';

function AppRouter() {
  // Feature flag controls migration from state-based to URL-based routing
  // Set VITE_USE_URL_ROUTING=true in .env to enable new routing system
  if (!USE_URL_ROUTING) {
    // Return the existing app with state-based navigation
    return <LegacyApp />;
  }

  // New URL-based routing system with React Router v6 and AppStateProvider
  return (
    <BrowserRouter>
      <AppStateProvider>
        <Routes>
          {/* Main application sections - no auth requirements, pages handle login internally */}
          <Route 
            path="/movers" 
            element={
              <RouteGuard authLevel="none">
                <MoversPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="/sections" 
            element={
              <RouteGuard authLevel="none">
                <SectionsPage />
              </RouteGuard>
            } 
          />
          {/* Events section with nested routing - wildcard captures sub-routes */}
          <Route 
            path="/events/*" 
            element={
              <RouteGuard authLevel="none">
                <EventsRouter />
              </RouteGuard>
            } 
          />
          
          {/* Data clearing route */}
          <Route 
            path="/clear" 
            element={<DataClearPage />} 
          />
          
          {/* Legacy route redirects for backward compatibility */}
          <Route path="/dashboard" element={<Navigate to="/events" replace />} />
          <Route path="/" element={<Navigate to={`/events${window.location.search}`} replace />} />
        </Routes>
      </AppStateProvider>
    </BrowserRouter>
  );
}

export default AppRouter;