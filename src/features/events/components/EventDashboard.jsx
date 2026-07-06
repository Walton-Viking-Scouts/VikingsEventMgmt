import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Removed API imports - UI only reads from IndexedDB
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { useAuth } from '../../auth/hooks/index.js';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import EventCard from './EventCard.jsx';
import databaseService from '../../../shared/services/storage/database.js';
import { Alert, RefreshButton } from '../../../shared/components/ui/index.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import IndexedDBService from '../../../shared/services/storage/indexedDBService.js';
import {
  fetchAllSectionEvents,
  fetchEventAttendance,
  groupEventsByName,
  buildEventCard,
  filterEventsByDateRange,
  expandSharedEvents,
} from '../../../shared/utils/eventDashboardHelpers.js';
import { notifyError, notifySuccess, notifyLoading, dismissToast } from '../../../shared/utils/notifications.js';
import { formatLastRefresh } from '../../../shared/utils/timeFormatting.js';
import { dedupAttendanceMapForEventGroup } from '../../../shared/utils/sharedEventAttendance.js';

function EventDashboard() {
  const navigate = useNavigate();
  const { lastSyncTime } = useAuth(); // Get shared lastSyncTime from auth context
  const [eventCards, setEventCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Unified data loading function - handles initial load from cache
    const loadEventCards = async () => {
      if (!mounted) return;

      // Initialize demo mode if enabled BEFORE loading sections
      try {
        const { isDemoMode, initializeDemoMode } = await import(
          '../../../config/demoMode.js'
        );
        if (isDemoMode()) {
          await initializeDemoMode();
        }
      } catch (demoError) {
        logger.warn('Demo mode initialization failed', {
          error: demoError.message,
        }, LOG_CATEGORIES.COMPONENT);
      }

      try {
        const sectionsData = await databaseService.getSections();
        logger.debug('loadEventCards: Loaded sections', {
          sectionsCount: sectionsData.length,
          sampleSections: sectionsData.slice(0, 3).map(s => ({
            id: s.sectionid,
            name: s.sectionname,
          })),
        }, LOG_CATEGORIES.COMPONENT);

        if (sectionsData.length > 0 && mounted) {
          // Build event cards from cache
          const cards = await buildEventCards(sectionsData);

          logger.debug('loadEventCards: Built event cards', {
            cardsCount: cards.length,
          }, LOG_CATEGORIES.COMPONENT);

          if (mounted) {
            setEventCards(cards);
            setLoading(false);

            const lastSyncRecord = await IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, 'viking_last_sync');
            const lastSyncEpoch = lastSyncRecord?.timestamp ?? null;
            if (lastSyncEpoch) {
              const lastSyncMs = Number(lastSyncEpoch);
              if (Number.isFinite(lastSyncMs)) {
                setLastSync(new Date(lastSyncMs));
              } else {
                setLastSync(new Date(lastSyncEpoch));
              }
            }
          }
        } else {
          logger.debug('loadEventCards: No sections found', {}, LOG_CATEGORIES.COMPONENT);
          if (mounted) {
            setEventCards([]);
            setLoading(false);
          }
        }
      } catch (error) {
        logger.error('Error loading event cards', {
          error: error.message,
        }, LOG_CATEGORIES.COMPONENT);
        if (mounted) {
          setLoading(false);
        }
      }
    };



    loadEventCards();

    return () => {
      mounted = false;
    };
  }, [lastSyncTime]); // Re-run when lastSyncTime changes after data load



  // Manual refresh handler — full data refresh, same sequence as post-login
  // load. Refreshes reference data (terms, roles, members), events,
  // attendance, and flexi records. The previous implementation skipped
  // reference + flexi which left member_section / flexi_data stale on iOS
  // after migration 003.
  const handleManualRefresh = async () => {
    if (refreshing) return;

    let syncingToastId = null;
    try {
      setRefreshing(true);
      setError(null);

      syncingToastId = notifyLoading('Syncing data from OSM...');
      logger.info('Manual refresh initiated from EventDashboard', {}, LOG_CATEGORIES.COMPONENT);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const dataLoadingService = (await import('../../../shared/services/data/dataLoadingService.js')).default;
      const result = await dataLoadingService.loadAllDataAfterAuth(token);

      const sectionsData = await databaseService.getSections();
      const cards = await buildEventCards(sectionsData);
      setEventCards(cards);
      setLastSync(new Date());

      let message = 'Data refreshed successfully';
      const summary = result?.results?.attendance?.details;
      if (summary) {
        message = `Refreshed ${summary.syncedEvents}/${summary.totalEvents} events (+ members + flexi)`;
      }
      if (syncingToastId) {
        dismissToast(syncingToastId);
        syncingToastId = null;
      }
      notifySuccess(message);

    } catch (error) {
      logger.error('Manual refresh failed', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);

      if (syncingToastId) {
        dismissToast(syncingToastId);
        syncingToastId = null;
      }
      notifyError(`Refresh failed: ${error.message}`);
      if (eventCards.length === 0) {
        setError(`Refresh failed: ${error.message}`);
      }
    } finally {
      setRefreshing(false);
    }
  };

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
    const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Fetch events for all sections from IndexedDB only
    const allEvents = await fetchAllSectionEvents(sectionsData);
    logger.debug('buildEventCards: Raw events from IndexedDB', {
      allEventsCount: allEvents.length,
      sampleEvents: allEvents.slice(0, 3).map(e => ({
        id: e.eventid,
        name: e.name,
        startdate: e.startdate,
        sectionid: e.sectionid,
      })),
    }, LOG_CATEGORIES.COMPONENT);

    // Filter for events from last week to 3 months from now
    const filteredEvents = filterEventsByDateRange(allEvents, oneWeekAgo, threeMonthsFromNow);
    logger.debug('buildEventCards: Filtered events by date range', {
      filteredCount: filteredEvents.length,
      totalCount: allEvents.length,
      oneWeekAgo: oneWeekAgo.toISOString(),
      threeMonthsFromNow: threeMonthsFromNow.toISOString(),
      now: now.toISOString(),
    }, LOG_CATEGORIES.COMPONENT);

    // Fetch attendance data for filtered events (with shared event checking)
    const attendanceMap = new Map();
    for (const event of filteredEvents) {
      try {
        const attendanceData = await fetchEventAttendance(event);

        logger.debug('Attendance data fetch result', {
          eventId: event.eventid,
          eventName: event.name,
          hasData: !!attendanceData,
          dataLength: attendanceData?.length || 0,
        }, LOG_CATEGORIES.COMPONENT);

        if (attendanceData) {
          attendanceMap.set(event.eventid, attendanceData);
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
    }


    // Expand shared events to include all sections
    const expandedEvents = expandSharedEvents(filteredEvents, attendanceMap);

    // Group events by name
    const eventGroups = groupEventsByName(expandedEvents);

    // Convert groups to cards with attendance data
    const cards = [];
    for (const [eventName, events] of eventGroups) {
      const dedupedByEventId = dedupAttendanceMapForEventGroup(events, attendanceMap);
      const eventsWithAttendance = events.map((event) => ({
        ...event,
        attendanceData: dedupedByEventId.get(String(event.eventid)) || [],
      }));

      const card = buildEventCard(eventName, eventsWithAttendance);
      // Store original events for navigation (preserves termid integrity)
      card.originalEvents = events;
      cards.push(card);
    }

    // Sort cards by earliest event date
    cards.sort((a, b) => a.earliestDate - b.earliestDate);

    logger.debug('buildEventCards: Final cards result', {
      cardsCount: cards.length,
      sampleCards: cards.slice(0, 3).map(c => ({
        id: c.id,
        name: c.name,
        eventCount: c.events?.length || 0,
        earliestDate: c.earliestDate,
      })),
    }, LOG_CATEGORIES.COMPONENT);

    return cards;
  };

  const handleViewAttendees = (eventCard) => {
    navigate(`/events/${encodeURIComponent(eventCard.name)}/attendance`);
  };

  // Only show full-screen loading if there's no cached data to display
  if (loading && (!eventCards || eventCards.length === 0)) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  if (error && (!eventCards || eventCards.length === 0)) {
    return (
      <Alert variant="error" className="m-4">
        <Alert.Title>Error Loading Dashboard</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
        <Alert.Actions>
          <button
            onClick={handleManualRefresh}
            type="button"
            className="inline-flex items-center justify-center rounded-md font-medium px-4 py-2 text-base bg-scout-blue text-white hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light active:bg-scout-blue-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Retry
          </button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Loading overlay when refreshing cached data */}
      {(loading || refreshing) && eventCards && eventCards.length > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 border border-scout-blue-light">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-scout-blue"></div>
          <span className="text-sm text-gray-700">Refreshing data...</span>
        </div>
      )}

      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        {/* Events Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm" id="events-panel">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="text-lg font-semibold text-gray-900 m-0"
                >
                    Upcoming Events{' '}
                  {eventCards.length > 0 && `(${eventCards.length})`}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                    Event attendance data with manual refresh control
                </p>
              </div>
              <RefreshButton
                onRefresh={handleManualRefresh}
                loading={refreshing}
                size="default"
              />
            </div>
            <div className="mt-2 text-xs text-gray-500">
                Last refreshed: {formatLastRefresh(lastSync)}
              {eventCards.length > 0 && (
                <span> • {eventCards.length} events</span>
              )}
            </div>
          </div>
          <div className="p-4">
            {eventCards.length > 0 ? (
              <div
                className="grid grid-cols-1 min-[830px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {eventCards.map((card) => (
                  <EventCard
                    key={card.id}
                    eventCard={card}
                    onViewAttendees={handleViewAttendees}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002-2V11M9 7h6"
                    />
                  </svg>
                </div>
                <h3
                  className="text-lg font-semibold text-gray-900 mb-2"
                >
                    No Upcoming Events
                </h3>
                <p className="text-gray-600 mb-4">
                  {!lastSync
                    ? 'Click "Sign in to OSM" in the header to retrieve event data.'
                    : 'No events found for the next week or events from the past week. Click "Sign in to OSM" in the header to get the latest data.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventDashboard;
