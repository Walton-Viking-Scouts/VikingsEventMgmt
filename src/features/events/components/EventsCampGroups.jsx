import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Card } from '../../../shared/components/ui';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import CampGroupsView from './CampGroupsView.jsx';
import { useAttendanceData } from '../hooks/useAttendanceData.js';
import databaseService from '../../../shared/services/storage/database.js';
import { getUniqueSectionsFromEvents } from '../../../shared/utils/sectionHelpers.js';
import { useNotification } from '../../../shared/contexts/notifications/NotificationContext';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

function EventsCampGroups() {
  const location = useLocation();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { _notifyInfo, notifyError, _notifyWarning } = useNotification();

  const {
    attendanceData,
    loading: attendanceLoading,
    error: attendanceError,
    _loadVikingEventData,
  } = useAttendanceData(events);

  useEffect(() => {
    const loadEventsData = async () => {
      try {
        setLoading(true);
        
        const stateEvents = location.state?.events;
        const stateMembers = location.state?.members;
        
        if (stateEvents && stateEvents.length > 0) {
          setEvents(stateEvents);
          setMembers(stateMembers || []);
        } else {
          const eventsData = await databaseService.getEvents();
          setEvents(eventsData || []);
          
          if (eventsData && eventsData.length > 0) {
            const sectionsInvolved = Array.from(new Set(eventsData.map((e) => e.sectionid)));
            const membersData = await databaseService.getMembers(sectionsInvolved);
            setMembers(membersData || []);
          }
        }
      } catch (err) {
        logger.error('Failed to load events data for camp groups', { error: err.message }, LOG_CATEGORIES.ERROR);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadEventsData();
  }, [location.state]);

  const getSummaryStats = () => {
    if (!attendanceData || !members) return [];
    
    return attendanceData.map((record) => {
      const memberData = members.find(m => parseInt(m.scoutid, 10) === parseInt(record.scoutid, 10));
      if (!memberData) return null;

      const shouldIncludeInSummary = (record) => {
        const memberDetails = members.find(
          (m) => parseInt(m.scoutid, 10) === parseInt(record.scoutid, 10),
        );
        if (!memberDetails) return true;

        const personType = memberDetails.person_type;
        return personType !== 'Leaders' && personType !== 'Young Leaders';
      };

      if (!shouldIncludeInSummary(record)) return null;

      return {
        scoutid: memberData.scoutid,
        name: `${memberData.firstname} ${memberData.lastname}`,
        person_type: memberData.person_type,
        patrol_id: memberData.patrol_id,
        patrolid: memberData.patrolid,
        vikingEventData: record.vikingEventData,
        events: memberData.events,
      };
    }).filter(Boolean);
  };

  const handleBackToDashboard = () => {
    navigate('/events');
  };

  const handleNavigateToRegister = () => {
    navigate('/events/register', { state: { events, members } });
  };

  if (loading || attendanceLoading) {
    return <LoadingScreen message="Loading camp groups..." />;
  }

  if (error || attendanceError) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <div className="text-red-600">
              <h2 className="text-lg font-semibold mb-2">Error Loading Camp Groups</h2>
              <p>{error || attendanceError}</p>
              <button
                onClick={handleBackToDashboard}
                className="mt-4 px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Events Dashboard
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 110 2h-1v9a2 2 0 01-2 2H8a2 2 0 01-2-2V9H5a1 1 0 110-2h3zM9 3h6v4H9V3zm0 6h6v9H9V9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Events Available</h3>
              <p className="text-gray-600 mb-4">
                No events found for camp group management.
              </p>
              <button
                onClick={handleBackToDashboard}
                className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Dashboard
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const summaryStats = getSummaryStats();
  const uniqueSections = getUniqueSectionsFromEvents(events);

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <Link
              to="/events/overview"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-1 text-sm font-medium"
            >
              Overview
            </Link>
            <Link
              to="/events/register"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-1 text-sm font-medium"
            >
              Register
            </Link>
            <span className="border-scout-blue text-scout-blue border-b-2 py-2 px-1 text-sm font-medium">
              Camp Groups
            </span>
          </nav>
        </div>

        {/* Camp Groups Header */}
        <Card className="p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Camp Groups Management</h2>
              <p className="text-gray-600 mt-1">
                Manage camp group assignments for event attendees
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleNavigateToRegister}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                View Register
              </button>
              <button
                onClick={handleBackToDashboard}
                className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark text-sm"
              >
                Back to Dashboard
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Events</div>
              <div className="text-2xl font-bold text-gray-900">{events.length}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Sections</div>
              <div className="text-2xl font-bold text-gray-900">{uniqueSections.length}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Eligible Members</div>
              <div className="text-2xl font-bold text-gray-900">{summaryStats.length}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Assigned to Groups</div>
              <div className="text-2xl font-bold text-gray-900">
                {summaryStats.filter(member => member.vikingEventData?.CampGroup).length}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm text-gray-600">
              Note: Leaders and Young Leaders are automatically excluded from camp group assignments.
            </div>
          </div>
        </Card>

        {/* Camp Groups Management */}
        <Card className="p-6">
          <CampGroupsView
            events={events}
            attendees={summaryStats}
            members={members}
            onError={(errorMsg) => {
              logger.error('Camp groups error', { error: errorMsg }, LOG_CATEGORIES.ERROR);
              notifyError(`Camp groups error: ${errorMsg}`);
            }}
          />
        </Card>
      </div>
    </div>
  );
}

export default EventsCampGroups;