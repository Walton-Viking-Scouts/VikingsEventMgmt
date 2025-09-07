import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../../../shared/components/ui';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import AttendanceView from './AttendanceView.jsx';
import databaseService from '../../../shared/services/storage/database.js';
import { getUniqueSectionsFromEvents } from '../../../shared/utils/sectionHelpers.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { useAppState } from '../../../shared/contexts/app';
import { useURLSync } from '../../../shared/hooks/useURLSync.js';

function EventsDetail() {
  const { eventId: eventName } = useParams();
  const { state } = useAppState();
  const { navigateWithState, updateNavigationData } = useURLSync();
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadEventData = async () => {
      try {
        setLoading(true);
        
        if (!eventName) {
          setError('Event name not provided');
          return;
        }

        const decodedEventName = decodeURIComponent(eventName);
        
        // Load all events from database
        const allEvents = await databaseService.getEvents();
        
        // Filter events by name to get all sections for this event
        const eventsByName = allEvents.filter(event => event.name === decodedEventName);
        
        if (!eventsByName || eventsByName.length === 0) {
          setError(`Event "${decodedEventName}" not found`);
          return;
        }

        setEvents(eventsByName);

        // Load members for all sections involved in this event
        const sectionsInvolved = Array.from(new Set(eventsByName.map((e) => e.sectionid)));
        const membersData = await databaseService.getMembers(sectionsInvolved);
        setMembers(membersData || []);

        // Update app state with current event data for URL synchronization
        updateNavigationData({
          events: eventsByName,
          members: membersData || [],
          selectedEvent: decodedEventName,
        });

      } catch (err) {
        logger.error('Failed to load event detail data', { 
          error: err.message, 
          eventName: eventName, 
        }, LOG_CATEGORIES.ERROR);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadEventData();
  }, [eventName, updateNavigationData]);

  // Restore state from context if available (e.g., when navigating back from other pages)
  useEffect(() => {
    if (state.navigationData.events && state.navigationData.members) {
      const contextEvents = state.navigationData.events;
      const contextMembers = state.navigationData.members;
      
      // Check if context data matches current event
      if (contextEvents.length > 0 && contextEvents[0].name === decodeURIComponent(eventName)) {
        setEvents(contextEvents);
        setMembers(contextMembers);
        setLoading(false);
        
        logger.debug('Event detail state restored from context', {
          eventName: contextEvents[0].name,
          eventsCount: contextEvents.length,
          membersCount: contextMembers.length,
        }, LOG_CATEGORIES.APP);
      }
    }
  }, [state.navigationData, eventName]);

  const handleBackToOverview = () => {
    // Navigate to overview preserving current state in URL parameters
    navigateWithState('/events/overview', {
      preserveParams: true,
      state: { events, members },
    });
  };

  if (loading) {
    return <LoadingScreen message="Loading event details..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <div className="text-red-600">
              <h2 className="text-lg font-semibold mb-2">Error Loading Event Details</h2>
              <p>{error}</p>
              <button
                onClick={() => navigateWithState('/events')}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Event Not Found</h3>
              <p className="text-gray-600 mb-4">
                The event &quot;{eventName}&quot; could not be found.
              </p>
              <Link
                to="/events"
                className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Events Dashboard
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Get unique sections for display
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
              Event Detail
            </span>
            <Link
              to="/events/camp-groups"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-1 text-sm font-medium"
            >
              Camp Groups
            </Link>
          </nav>
        </div>

        {/* Event Detail Header */}
        <Card className="p-6 mb-6">
          <div className="mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{events[0].name}</h2>
                <p className="text-gray-600 mt-1">
                  Event details and attendance across {events.length} section{events.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={handleBackToOverview}
                className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark text-sm"
              >
                Back to Overview
              </button>
            </div>
          </div>

          {/* Event Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Sections</div>
              <div className="text-2xl font-bold text-gray-900">{events.length}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Event Date</div>
              <div className="text-lg font-semibold text-gray-900">
                {events[0].startdate ? new Date(events[0].startdate).toLocaleDateString() : 'Not specified'}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Members</div>
              <div className="text-2xl font-bold text-gray-900">{members.length}</div>
            </div>
          </div>

          {/* Sections Involved */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sections Involved</h3>
            <div className="flex flex-wrap gap-2">
              {uniqueSections.map((section) => (
                <span
                  key={section.sectionid}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-scout-blue text-white"
                >
                  {section.sectionname}
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* Attendance Data Section */}
        <AttendanceView
          sections={uniqueSections}
          events={events}
          members={members}
          onBack={handleBackToOverview}
        />
      </div>
    </div>
  );
}

export default EventsDetail;