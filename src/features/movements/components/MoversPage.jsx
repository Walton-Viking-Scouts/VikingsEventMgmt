import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionMovementTracker } from './';
import { MainNavigation } from '../../../shared/components/layout';

/**
 * Movers page component for managing section movements
 * @returns {JSX.Element} Movers page component
 */
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