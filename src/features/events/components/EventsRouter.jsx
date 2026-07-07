import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import EventDashboard from './EventDashboard.jsx';
import EventAttendancePage from './EventAttendancePage.jsx';
import SimpleAttendanceViewer from './SimpleAttendanceViewer.jsx';

function EventsRouter() {
  const navigate = useNavigate();

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  return (
    <>
      <MainNavigation onNavigateToSectionMovements={handleNavigateToSectionMovements} />
      <Routes>
        <Route index element={<EventDashboard />} />

        {/* URL-addressable attendance view: survives reloads and back-swipe */}
        <Route path=":eventName/attendance/:tab?" element={<EventAttendancePage />} />

        <Route path="attendance-viewer" element={<SimpleAttendanceViewer />} />

        {/* Catch-all redirect for unknown nested routes */}
        <Route path="*" element={<Navigate to="/events" replace />} />
      </Routes>
    </>
  );
}

export default EventsRouter;
