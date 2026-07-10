import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import RotaBoardPage from './RotaBoardPage.jsx';

/**
 * Nested router for the Water Rota feature. The board is the default view;
 * My-week and setup routes are added by their own PRs and unknown paths
 * fall back to the board.
 *
 * @returns {JSX.Element} Water rota routes under /water-rota
 */
function WaterRotaRouter() {
  const navigate = useNavigate();

  return (
    <>
      <MainNavigation onNavigateToSectionMovements={() => navigate('/movers')} />
      <Routes>
        <Route index element={<RotaBoardPage />} />
        <Route path="*" element={<Navigate to="/water-rota" replace />} />
      </Routes>
    </>
  );
}

export default WaterRotaRouter;
