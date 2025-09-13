import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import EventsContainer from './EventsContainer.jsx';

/**
 * Scout events routing component providing navigation structure and route management.
 * Integrates main navigation with Scout event views and handles cross-feature navigation
 * including section movements integration for comprehensive Scout group management.
 * 
 * @returns {JSX.Element} Scout events router with navigation and route configuration
 */
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
        
        {/* Catch-all redirect for unknown nested routes */}
        <Route path="*" element={<Navigate to="/events" replace />} />
      </Routes>
    </>
  );
}

export default EventsRouter;