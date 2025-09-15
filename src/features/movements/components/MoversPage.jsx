import React from 'react';
import { useNavigate } from 'react-router-dom';
import SectionMovementTracker from './SectionMovementTracker.jsx';
import { MainNavigation } from '../../../shared/components/layout';

function MoversPage() {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate('/events');
  };

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  return (
    <>
      <MainNavigation onNavigateToSectionMovements={handleNavigateToSectionMovements} />
      <SectionMovementTracker onBack={handleBackToDashboard} />
    </>
  );
}

export default MoversPage;