import React, { useState } from 'react';
import EventDashboard from './EventDashboard.jsx';
import { EventAttendance } from './attendance';
import { notifyError, notifyWarning } from '../../../shared/utils/notifications.js';
import databaseService from '../../../shared/services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

function EventsContainer() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [navigationData, setNavigationData] = useState({});
  // Notification handlers are now imported directly

  const handleNavigateToAttendance = async (events, members = null) => {
    try {
      // If members are provided (from fresh API call), use them
      // Otherwise, load cached members data for the attendance view
      let membersData = members;

      if (!membersData) {
        const sectionsInvolved = Array.from(
          new Set(events.map((e) => e.sectionid)),
        );

        membersData = await databaseService.getMembers(sectionsInvolved);

        // If no cached members found, show warning
        if (!membersData || membersData.length === 0) {
          notifyWarning(
            'Member data not yet available. Please wait for sync to complete or try refreshing.',
            { duration: 6000 },
          );
          return;
        }
      }

      // Set new navigation data (will replace any existing data)
      setNavigationData({ events, members: membersData });
      setCurrentView('attendance');
    } catch (error) {
      logger.error(
        'Error loading cached members',
        { error: error.message },
        LOG_CATEGORIES.ERROR,
      );
      notifyError(
        'Unable to load member data for attendance view. Please try refreshing the page.',
      );
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setNavigationData({}); // Clear navigation data for proper state management
  };

  const renderCurrentView = () => {
    switch (currentView) {
    case 'attendance':
      return (
        <EventAttendance
          events={navigationData.events || []}
          members={navigationData.members || []}
          onBack={handleBackToDashboard}
        />
      );
    default:
      return (
        <EventDashboard
          onNavigateToAttendance={handleNavigateToAttendance}
        />
      );
    }
  };

  return renderCurrentView();
}

export default EventsContainer;