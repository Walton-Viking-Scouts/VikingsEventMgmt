import React from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import RotaBoardPage from './RotaBoardPage.jsx';
import MyCommitmentsPage from './MyCommitmentsPage.jsx';

/**
 * Segmented control switching between the board and the personal view.
 *
 * @returns {JSX.Element} Board | My week toggle
 */
function ViewSwitch() {
  const base = 'flex-1 text-center py-1.5 rounded-md text-sm font-medium transition-colors';
  return (
    <div className="max-w-3xl mx-auto px-4 pt-3">
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Rota views">
        <NavLink
          to="/water-rota"
          end
          role="tab"
          className={({ isActive }) =>
            `${base} ${isActive ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-800'}`
          }
        >
          Board
        </NavLink>
        <NavLink
          to="/water-rota/me"
          role="tab"
          className={({ isActive }) =>
            `${base} ${isActive ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-800'}`
          }
        >
          My week
        </NavLink>
      </div>
    </div>
  );
}

/**
 * Nested router for the Water Rota feature: board (default) and My week,
 * with unknown paths falling back to the board. The setup wizard route is
 * added by its own PR.
 *
 * @returns {JSX.Element} Water rota routes under /water-rota
 */
function WaterRotaRouter() {
  const navigate = useNavigate();

  return (
    <>
      <MainNavigation onNavigateToSectionMovements={() => navigate('/movers')} />
      <ViewSwitch />
      <Routes>
        <Route index element={<RotaBoardPage />} />
        <Route path="me" element={<MyCommitmentsPage />} />
        <Route path="*" element={<Navigate to="/water-rota" replace />} />
      </Routes>
    </>
  );
}

export default WaterRotaRouter;
