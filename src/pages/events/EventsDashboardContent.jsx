import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../contexts/notifications/NotificationContext';
import EventDashboard from '../../components/EventDashboard.jsx';
import AttendanceView from '../../components/AttendanceView.jsx';
import databaseService from '../../services/database.js';
import logger, { LOG_CATEGORIES } from '../../services/logger.js';
import { getUniqueSectionsFromEvents } from '../../utils/sectionHelpers.js';

function EventsDashboardContent() {
  const { notifyInfo, notifyError, notifyWarning } = useNotification();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('dashboard');
  const [navigationData, setNavigationData] = useState({});
  const [isSyncing] = useState(false);

  const handleNavigateToAttendance = async (events, members = null) => {
    if (isSyncing) {
      notifyInfo('Please wait for data sync to complete before viewing attendance details.', { duration: 4000 });
      return;
    }

    let membersData = members;
    if (!membersData) {
      const sectionsInvolved = Array.from(new Set(events.map((e) => e.sectionid)));
      try {
        membersData = await databaseService.getMembers(sectionsInvolved);
        if (!membersData || membersData.length === 0) {
          notifyWarning('Member data not yet available. Please wait for sync to complete or try refreshing.', { duration: 6000 });
          return;
        }
      } catch (error) {
        logger.error('Error loading cached members', { error: error.message, sectionsInvolved }, LOG_CATEGORIES.ERROR);
        notifyError('Unable to load member data for attendance view. Please try refreshing the page.');
        return;
      }
    }

    setNavigationData({ events, members: membersData });
    setCurrentView('attendance');
  };

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setNavigationData({});
  };

  const renderCurrentView = () => {
    switch (currentView) {
    case 'attendance': {
      const uniqueSections = getUniqueSectionsFromEvents(navigationData.events);
      return (
        <AttendanceView
          sections={uniqueSections}
          events={navigationData.events || []}
          members={navigationData.members || []}
          onBack={handleBackToDashboard}
        />
      );
    }
    default:
      return (
        <EventDashboard
          onNavigateToAttendance={handleNavigateToAttendance}
          onNavigateToSectionMovements={handleNavigateToSectionMovements}
        />
      );
    }
  };

  return renderCurrentView();
}

export default EventsDashboardContent;