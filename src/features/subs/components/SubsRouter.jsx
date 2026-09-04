import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import SubsSummaryPage from './SubsSummaryPage.jsx';
import SubsSectionPage from './SubsSectionPage.jsx';

/**
 * Nested router for the Subs feature: the all-sections summary (default) and
 * the per-section drill-down, with unknown paths falling back to the summary.
 *
 * @returns {JSX.Element} Subs routes under /subs
 */
function SubsRouter() {
  const navigate = useNavigate();

  return (
    <>
      <MainNavigation onNavigateToSectionMovements={() => navigate('/movers')} />
      <Routes>
        <Route index element={<SubsSummaryPage />} />
        <Route path=":sectionId" element={<SubsSectionPage />} />
        <Route path="*" element={<Navigate to="/subs" replace />} />
      </Routes>
    </>
  );
}

export default SubsRouter;
