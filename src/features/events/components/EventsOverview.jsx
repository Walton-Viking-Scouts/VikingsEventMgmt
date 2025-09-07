import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../../../shared/components/ui';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import { useAttendanceData } from '../hooks/useAttendanceData.js';
import databaseService from '../../../shared/services/storage/database.js';
import { getUniqueSectionsFromEvents } from '../../../shared/utils/sectionHelpers.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { useAppState } from '../../../shared/contexts/app';
import { useURLSync } from '../../../shared/hooks/useURLSync.js';

function EventsOverview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useAppState();
  const { navigateWithState, updateNavigationData } = useURLSync();
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get events data from navigation state or load from database
  useEffect(() => {
    const loadEventsData = async () => {
      try {
        setLoading(true);
        
        // Try to get events from context first, then router state, then database
        let eventsData = null;
        let membersData = null;

        // 1. Check app state context
        if (state.navigationData.events && state.navigationData.events.length > 0) {
          eventsData = state.navigationData.events;
          membersData = state.navigationData.members || [];
          logger.debug('Events overview loaded from app state context', {
            eventsCount: eventsData.length,
            membersCount: membersData.length,
          }, LOG_CATEGORIES.APP);
        }
        // 2. Check router location state
        else if (location.state?.events && location.state.events.length > 0) {
          eventsData = location.state.events;
          membersData = location.state.members || [];
          logger.debug('Events overview loaded from router state', {
            eventsCount: eventsData.length,
            membersCount: membersData.length,
          }, LOG_CATEGORIES.APP);
        }
        // 3. Fallback: load from database
        else {
          eventsData = await databaseService.getEvents();
          if (eventsData && eventsData.length > 0) {
            const sectionsInvolved = Array.from(new Set(eventsData.map((e) => e.sectionid)));
            membersData = await databaseService.getMembers(sectionsInvolved);
          }
          logger.debug('Events overview loaded from database', {
            eventsCount: eventsData?.length || 0,
            membersCount: membersData?.length || 0,
          }, LOG_CATEGORIES.APP);
        }

        setEvents(eventsData || []);
        setMembers(membersData || []);

        // Update context with loaded data for URL synchronization
        if (eventsData && eventsData.length > 0) {
          updateNavigationData({
            events: eventsData,
            members: membersData || [],
          });
        }
      } catch (err) {
        logger.error('Failed to load events data for overview', { error: err.message }, LOG_CATEGORIES.ERROR);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadEventsData();
  }, [location.state, state.navigationData, updateNavigationData]);

  // Use attendance data hook for summary statistics
  const {
    attendanceData,
    loading: attendanceLoading,
    error: attendanceError,
  } = useAttendanceData(events);

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    if (!events.length || !members.length || !attendanceData.length) {
      return { sections: [], totals: { yes: 0, no: 0, invited: 0, notInvited: 0, total: 0 } };
    }

    const uniqueSections = getUniqueSectionsFromEvents(events);
    const sections = [];
    const totals = { yes: 0, no: 0, invited: 0, notInvited: 0, total: 0 };

    uniqueSections.forEach(section => {
      const sectionMembers = members.filter(m => m.sectionid === section.sectionid);
      const sectionAttendance = attendanceData.filter(a => 
        sectionMembers.some(m => m.scoutid === parseInt(a.scoutid, 10)),
      );

      const sectionStats = {
        name: section.sectionname,
        yes: sectionAttendance.filter(a => a.attending === 'yes').length,
        no: sectionAttendance.filter(a => a.attending === 'no').length,
        invited: sectionAttendance.filter(a => a.attending === 'yes' || a.attending === 'no').length,
        notInvited: sectionMembers.length - sectionAttendance.length,
        total: sectionMembers.length,
      };

      sections.push(sectionStats);
      
      totals.yes += sectionStats.yes;
      totals.no += sectionStats.no;
      totals.invited += sectionStats.invited;
      totals.notInvited += sectionStats.notInvited;
      totals.total += sectionStats.total;
    });

    return { sections, totals };
  }, [events, members, attendanceData]);

  if (loading || attendanceLoading) {
    return <LoadingScreen message="Loading events overview..." />;
  }

  if (error || attendanceError) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <div className="text-red-600">
              <h2 className="text-lg font-semibold mb-2">Error Loading Overview</h2>
              <p>{error || attendanceError}</p>
              <button
                onClick={() => navigate('/events')}
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

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <Link
              to="/events/overview"
              className="border-scout-blue text-scout-blue border-b-2 py-2 px-1 text-sm font-medium"
            >
              Overview
            </Link>
            <Link
              to="/events/register"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-1 text-sm font-medium"
            >
              Register
            </Link>
            <Link
              to="/events/camp-groups"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-1 text-sm font-medium"
            >
              Camp Groups
            </Link>
          </nav>
        </div>

        {/* Overview Content */}
        <Card className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Events Overview</h2>
            <p className="text-gray-600 mt-1">
              Summary of attendance across all events and sections
            </p>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 110 2h-1v9a2 2 0 01-2 2H8a2 2 0 01-2-2V9H5a1 1 0 110-2h3zM9 3h6v4H9V3zm0 6h6v9H9V9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Events Available</h3>
              <p className="text-gray-600 mb-4">
                No events found. Make sure you&apos;re connected and data has been synced.
              </p>
              <Link
                to="/events"
                className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Summary Statistics Table */}
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Section
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-green-700 uppercase tracking-wider">
                      Attending
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-red-700 uppercase tracking-wider">
                      Not Attending
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-scout-blue uppercase tracking-wider">
                      Invited
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Not Invited
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {summaryStats.sections.map((section, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {section.name}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-green-700 font-semibold">
                        {section.yes}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-red-700 font-semibold">
                        {section.no}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-scout-blue font-semibold">
                        {section.invited}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-gray-600 font-semibold">
                        {section.notInvited}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-gray-900 font-semibold">
                        {section.total}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                      Total
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-green-700">
                      {summaryStats.totals.yes}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-red-700">
                      {summaryStats.totals.no}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-scout-blue">
                      {summaryStats.totals.invited}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-gray-600">
                      {summaryStats.totals.notInvited}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                      {summaryStats.totals.total}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Additional Quick Stats */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{summaryStats.totals.yes}</div>
                  <div className="text-sm text-gray-600">Attending</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-700">{summaryStats.totals.no}</div>
                  <div className="text-sm text-gray-600">Not Attending</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-scout-blue">{summaryStats.totals.invited}</div>
                  <div className="text-sm text-gray-600">Total Invited</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{summaryStats.totals.total}</div>
                  <div className="text-sm text-gray-600">Total Members</div>
                </Card>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default EventsOverview;