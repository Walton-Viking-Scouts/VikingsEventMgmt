import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import EventsContainer from './EventsContainer.jsx';
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
        {/* Default events route - uses state-based navigation like LegacyApp */}
        <Route index element={<EventsContainer />} />

        {/* Simple attendance viewer for demonstrating AttendanceDataService */}
        <Route path="attendance-viewer" element={<SimpleAttendanceViewer />} />

        {/* Catch-all redirect for unknown nested routes */}
        <Route path="*" element={<Navigate to="/events" replace />} />
      </Routes>
    </>
  );
}

export default EventsRouter;