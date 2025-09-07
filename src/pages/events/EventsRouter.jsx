import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import EventsLayout from './EventsLayout.jsx';
import EventsDashboardContent from './EventsDashboardContent.jsx';
import EventsOverview from './EventsOverview.jsx';
import EventsRegister from './EventsRegister.jsx';
import EventsDetail from './EventsDetail.jsx';
import EventsCampGroups from './EventsCampGroups.jsx';

// Import route guards
import { RouteGuard } from '../../components/guards';

function EventsRouter() {
  return (
    <Routes>
      {/* Parent route with layout that provides Outlet for nested routes */}
      <Route path="/" element={<EventsLayout />}>
        {/* Default events route - dashboard (index route matches parent path exactly) */}
        <Route index element={<EventsDashboardContent />} />
        
        {/* Events sub-pages with varying authentication requirements */}
        <Route path="overview" element={<EventsOverview />} />
        
        {/* Write operations require fresh authentication */}
        <Route 
          path="register" 
          element={
            <RouteGuard authLevel="authenticated">
              <EventsRegister />
            </RouteGuard>
          } 
        />
        
        {/* Dynamic route parameter for event details - uses event name */}
        <Route path="detail/:eventId" element={<EventsDetail />} />
        
        {/* Group management requires fresh authentication */}
        <Route 
          path="camp-groups" 
          element={
            <RouteGuard authLevel="authenticated">
              <EventsCampGroups />
            </RouteGuard>
          } 
        />
        
        {/* Catch-all redirect for unknown nested routes */}
        <Route path="*" element={<Navigate to="/events" replace />} />
      </Route>
    </Routes>
  );
}

export default EventsRouter;