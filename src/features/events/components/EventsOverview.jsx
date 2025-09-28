import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import EventCard from './EventCard.jsx';
import databaseService from '../../../shared/services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import {
  fetchAllSectionEvents,
  fetchEventAttendance,
  groupEventsByName,
  buildEventCard,
  filterEventsByDateRange,
  expandSharedEvents,
} from '../../../shared/utils/eventDashboardHelpers.js';
import { useAuth } from '../../auth/hooks/useAuth.js';

function EventsOverview({ onNavigateToAttendance: _onNavigateToAttendance }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { lastSyncTime } = useAuth();
  const [eventCards, setEventCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingAttendees, setLoadingAttendees] = useState(null);

  // Build event cards similar to EventDashboard
  useEffect(() => {
    const buildEventCardsFromCache = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load sections from cache
        const sections = await databaseService.getSections();
        
        if (sections && sections.length > 0) {
          logger.debug('Building event cards from cached data', {
            sectionsCount: sections.length,
          }, LOG_CATEGORIES.APP);
          
          // UI is cache-only - no API calls
          const cards = await buildEventCards(sections);
          setEventCards(cards);
          
          logger.debug('Event cards built successfully', {
            cardsCount: cards.length,
          }, LOG_CATEGORIES.APP);
        } else {
          logger.debug('No cached sections found', {}, LOG_CATEGORIES.APP);
          setEventCards([]);
        }
      } catch (err) {
        logger.error('Failed to build event cards for overview', { error: err.message }, LOG_CATEGORIES.ERROR);
        setError(err.message);
        setEventCards([]);
      } finally {
        setLoading(false);
      }
    };

    buildEventCardsFromCache();
  }, [location.state, lastSyncTime]);

  // Build event cards function - cache-only mode
  const buildEventCards = async (sectionsData) => {
    logger.debug(
      'buildEventCards called - cache-only mode',
      {
        sectionCount: sectionsData?.length || 0,
      },
      LOG_CATEGORIES.COMPONENT,
    );

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch events for all sections from IndexedDB only
    const allEvents = await fetchAllSectionEvents(sectionsData);

    // Filter for future events and events from last week
    const filteredEvents = filterEventsByDateRange(allEvents, oneWeekAgo, now);

    // Fetch attendance data for filtered events from IndexedDB only (parallel execution)
    const attendanceMap = new Map();
    const attendancePromises = filteredEvents.map(async (event) => {
      try {
        const attendanceData = await fetchEventAttendance(event);
        if (attendanceData) {
          return { eventId: event.eventid, data: attendanceData };
        }
      } catch (err) {
        logger.error(
          'Error fetching attendance for event {eventId}',
          {
            error: err,
            eventId: event.eventid,
            eventName: event.name,
          },
          LOG_CATEGORIES.COMPONENT,
        );
      }
      return null;
    });

    const attendanceResults = await Promise.all(attendancePromises);
    attendanceResults.forEach(result => {
      if (result) {
        attendanceMap.set(result.eventId, result.data);
      }
    });

    // Expand shared events to include all sections
    const expandedEvents = expandSharedEvents(filteredEvents, attendanceMap);

    // Group events by name
    const eventGroups = groupEventsByName(expandedEvents);

    // Convert groups to cards with attendance data
    const cards = [];
    for (const [eventName, events] of eventGroups) {
      // Enrich events with attendance data without mutating originals
      const eventsWithAttendance = events.map((event) => ({
        ...event,
        attendanceData: attendanceMap.get(event.eventid) || [],
      }));

      const card = buildEventCard(eventName, eventsWithAttendance);
      // Store original events for navigation (preserves termid integrity)
      card.originalEvents = events;
      cards.push(card);
    }

    // Sort cards by earliest event date
    cards.sort((a, b) => a.earliestDate - b.earliestDate);

    return cards;
  };

  // Handle view attendees - copied from EventDashboard
  const handleViewAttendees = async (eventCard) => {
    try {
      // Set loading state for this specific event card
      setLoadingAttendees(eventCard.id);

      // Navigate to attendance view with state
      const eventsToNavigate = eventCard.originalEvents || eventCard.events;
      navigate('/events/detail/' + encodeURIComponent(eventCard.name), {
        state: {
          events: eventsToNavigate,
          members: [], // Will be loaded in detail view
        },
      });
    } catch (err) {
      logger.error(
        'Error navigating to attendance view',
        {
          error: err,
          eventName: eventCard.name,
          eventCount: eventCard.events.length,
        },
        LOG_CATEGORIES.COMPONENT,
      );
      setError(`Failed to navigate: ${err.message}`);
    } finally {
      // Clear loading state
      setLoadingAttendees(null);
    }
  };


  if (loading) {
    return <LoadingScreen message="Loading events overview..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-red-600">
              <h2 className="text-lg font-semibold mb-2">Error Loading Overview</h2>
              <p>{error}</p>
              <button
                onClick={() => navigate('/events')}
                className="mt-4 px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Events Dashboard
              </button>
            </div>
          </div>
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

        {/* Events Overview Content */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Events Overview</h2>
            <p className="text-gray-600 mt-1">
              Upcoming events grouped by name with attendance data
            </p>
          </div>

          {eventCards.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002-2V11M9 7h6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Upcoming Events</h3>
              <p className="text-gray-600 mb-4">
                No events found for the next week or events from the past week. Make sure you&apos;re connected and data has been synced.
              </p>
              <Link
                to="/events"
                className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Events Dashboard
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[830px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {eventCards.map((card) => (
                <EventCard
                  key={card.id}
                  eventCard={card}
                  onViewAttendees={handleViewAttendees}
                  loading={loadingAttendees === card.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventsOverview;