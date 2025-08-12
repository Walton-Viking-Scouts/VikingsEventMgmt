import React, { useState, useEffect } from 'react';
import {
  getUserRoles,
  getListOfMembers,
  getAPIQueueStats,
} from '../services/api.js';
import { getToken, generateOAuthUrl } from '../services/auth.js';
import { authHandler } from '../services/simpleAuthHandler.js';
import LoadingScreen from './LoadingScreen.jsx';
import SectionsList from './SectionsList.jsx';
import EventCard from './EventCard.jsx';
import databaseService from '../services/database.js';
import { Button, Alert, Card } from './ui';
import ConfirmModal from './ui/ConfirmModal';
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import {
  fetchAllSectionEvents,
  fetchEventAttendance,
  groupEventsByName,
  buildEventCard,
  filterEventsByDateRange,
} from '../utils/eventDashboardHelpers.js';

function EventDashboard({ onNavigateToMembers, onNavigateToAttendance }) {
  const [sections, setSections] = useState([]);
  const [eventCards, setEventCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [queueStats, setQueueStats] = useState({
    queueLength: 0,
    processing: false,
    totalRequests: 0,
  });
  const [loadingAttendees, setLoadingAttendees] = useState(null); // Track which event card is loading attendees
  const [loadingSection, setLoadingSection] = useState(null); // Track which section is loading members
  const [isOfflineMode, setIsOfflineMode] = useState(false); // Track if we're in offline mode due to auth failure
  
  // Simple view toggle state
  const [currentView, setCurrentView] = useState('events'); // 'events' or 'sections'
  
  // Section selection state for the Sections card
  const [selectedSections, setSelectedSections] = useState([]);

  // Handle section selection for the Sections card
  const handleSectionToggleForCard = (section) => {
    setSelectedSections(prev => {
      const isSelected = prev.some(s => s.sectionid === section.sectionid);
      if (isSelected) {
        return prev.filter(s => s.sectionid !== section.sectionid);
      } else {
        return [...prev, section];
      }
    });
  };

  // Modal state for confirmation dialogs
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState({
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });

  useEffect(() => {
    let mounted = true;

    const initializeDashboard = async () => {
      if (!mounted) return; // Prevent duplicate calls in StrictMode

      // Additional StrictMode protection: use a global flag to prevent multiple initializations
      const initKey = 'eventdashboard_initializing';
      if (sessionStorage.getItem(initKey) === 'true') {
        return; // Skip duplicate initialization
      }

      try {
        sessionStorage.setItem(initKey, 'true');
        await loadInitialData();

        if (!mounted) return; // Check again after async operation
      } finally {
        // Clear the flag after initialization completes (success or failure)
        sessionStorage.removeItem(initKey);
      }
    };

    initializeDashboard();

    // Update queue stats every second
    const interval = setInterval(() => {
      if (!mounted) return;
      const stats = getAPIQueueStats();
      if (stats) {
        setQueueStats(stats);
      }
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if we have offline data
      const hasOfflineData = await databaseService.hasOfflineData();

      // Check if data is recent enough (less than 30 minutes old)
      const lastSyncTime = localStorage.getItem('viking_last_sync');
      const isDataFresh =
        lastSyncTime &&
        Date.now() - new Date(lastSyncTime).getTime() < 30 * 60 * 1000; // 30 minutes

      // EventDashboard initialization - minimal logging

      if (hasOfflineData && isDataFresh) {
        // Recent cached data available - use cache
        // Using fresh cached data
        await loadCachedData();
      } else if (hasOfflineData && !isDataFresh) {
        // Stale cached data - load cache first, then auto-sync in background
        // Using stale cached data, will sync in background
        await loadCachedData();

        // Auto-sync in background only if auth hasn't failed
        setTimeout(async () => {
          try {
            if (authHandler.hasAuthFailed()) {
              setIsOfflineMode(true);
              return;
            }

            const token = getToken();
            if (!token) {
              return;
            }

            // Starting background sync
            await syncData();
          } catch (error) {
            // Error handling is now done in the API layer via simple auth handler
            // Don't show error - this is background sync
            if (import.meta.env.DEV) {
              logger.debug(
                'Background sync failed',
                { error: error.message },
                LOG_CATEGORIES.COMPONENT,
              );
            }
          }
        }, 1000);
      } else {
        // No cached data - check if we should attempt sync
        if (import.meta.env.DEV) {
          logger.debug(
            'No cached data found - attempting sync',
            {},
            LOG_CATEGORIES.COMPONENT,
          );
        }

        if (authHandler.hasAuthFailed()) {
          if (import.meta.env.DEV) {
            logger.debug(
              'Sync skipped - auth already failed',
              {},
              LOG_CATEGORIES.COMPONENT,
            );
          }
          setError(
            'Authentication expired and no cached data available. Please reconnect to OSM.',
          );
          setIsOfflineMode(true);
          return;
        }

        const token = getToken();
        if (!token) {
          if (import.meta.env.DEV) {
            logger.debug(
              'Sync skipped - no token available',
              {},
              LOG_CATEGORIES.COMPONENT,
            );
          }
          return;
        }

        if (import.meta.env.DEV) {
          logger.debug(
            'Starting fresh data sync',
            {},
            LOG_CATEGORIES.COMPONENT,
          );
        }
        await syncData();
      }
    } catch (err) {
      logger.error(
        'Error loading initial data',
        { error: err },
        LOG_CATEGORIES.COMPONENT,
      );

      // Check if this is an auth error and we have some cached sections
      const cachedSections = await databaseService
        .getSections()
        .catch(() => []);
      if (
        (err.status === 401 ||
          err.status === 403 ||
          err.message?.includes('Authentication failed')) &&
        cachedSections.length > 0
      ) {
        logger.info(
          'Auth error during initial load but cached data available - enabling offline mode',
        );
        setSections(cachedSections);
        setIsOfflineMode(true);

        // Try to load cached event cards
        try {
          const cards = await buildEventCards(cachedSections);
          setEventCards(cards);
        } catch (cardError) {
          logger.warn('Failed to build cached event cards', {
            error: cardError,
          });
        }

        // Set last sync time from localStorage if available
        const lastSyncTime = localStorage.getItem('viking_last_sync');
        if (lastSyncTime) {
          setLastSync(new Date(lastSyncTime));
        }
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCachedData = async () => {
    try {
      // Load sections from cache
      const cachedSections = await databaseService.getSections();
      setSections(cachedSections);

      // Load events and build cards
      const cards = await buildEventCards(cachedSections);
      setEventCards(cards);

      // Set last sync time from localStorage
      const lastSyncTime = localStorage.getItem('viking_last_sync');
      if (lastSyncTime) {
        setLastSync(new Date(lastSyncTime));
      }
    } catch (err) {
      logger.error(
        'Error loading cached data',
        { error: err },
        LOG_CATEGORIES.COMPONENT,
      );
      throw err;
    }
  };

  // Only function that triggers OSM API calls - user must explicitly click sync button
  const syncData = async () => {
    try {
      // Starting sync process
      setError(null);
      setIsOfflineMode(false);

      const token = getToken();
      if (import.meta.env.DEV) {
        logger.debug(
          'syncData: Token available',
          { hasToken: !!token },
          LOG_CATEGORIES.SYNC,
        );
      }

      // 1. Fetch all sections
      if (import.meta.env.DEV) {
        logger.debug(
          'syncData: Fetching user roles/sections',
          {},
          LOG_CATEGORIES.SYNC,
        );
      }
      const sectionsData = await getUserRoles(token);
      if (import.meta.env.DEV) {
        logger.debug(
          'syncData: Received sections',
          { count: sectionsData.length },
          LOG_CATEGORIES.SYNC,
        );
      }
      setSections(sectionsData);
      await databaseService.saveSections(sectionsData);

      // 2. Fetch events for each section and build cards
      if (import.meta.env.DEV) {
        logger.debug('syncData: Building event cards', {}, LOG_CATEGORIES.SYNC);
      }
      const cards = await buildEventCards(sectionsData, token);
      if (import.meta.env.DEV) {
        logger.debug(
          'syncData: Built event cards',
          { count: cards.length },
          LOG_CATEGORIES.SYNC,
        );
      }
      setEventCards(cards);

      // 3. Proactively load member data in background (non-blocking)
      loadMemberDataInBackground(sectionsData, token);

      // Update last sync time
      const now = new Date();
      setLastSync(now);
      localStorage.setItem('viking_last_sync', now.toISOString());

      // Check if we used cached data (auth failure would have been caught earlier)
      const usedCachedData = authHandler.hasAuthFailed();
      if (import.meta.env.DEV) {
        logger.debug(
          usedCachedData
            ? 'syncData: Loaded cached data (offline mode)'
            : 'syncData: Sync completed successfully',
          {},
          LOG_CATEGORIES.SYNC,
        );
      }
    } catch (err) {
      logger.error('Error syncing data', { error: err }, LOG_CATEGORIES.SYNC);

      // Check if auth failed and we have cached data
      if (authHandler.hasAuthFailed() && sections.length > 0) {
        logger.info(
          'Auth failed but cached data available - enabling offline mode',
        );
        setIsOfflineMode(true);
        setError(null); // Clear error since we can show cached data

        // Load cached event cards instead of making more API calls
        try {
          const cards = await buildEventCards(sections); // Use cached sections, no token
          setEventCards(cards);
        } catch (cardError) {
          logger.warn('Failed to build cached event cards after auth error', {
            error: cardError,
          });
        }
      } else {
        setError(err.message);
      }
    }
  };

  // Load member data proactively in background
  const loadMemberDataInBackground = async (sectionsData, token) => {
    try {
      if (!token || authHandler.hasAuthFailed()) {
        return;
      }

      // Use getListOfMembers which already handles caching properly
      await getListOfMembers(sectionsData, token);
    } catch (error) {
      // Don't show error to user - this is background loading
      logger.warn(
        'Background member loading failed',
        {
          error: error.message,
          sectionCount: sectionsData.length,
        },
        LOG_CATEGORIES.COMPONENT,
      );
    }
  };

  // Reconnect function to handle authentication refresh
  const handleReconnect = () => {
    logger.info('User requested reconnection - redirecting to OAuth');
    const oauthUrl = generateOAuthUrl();
    window.location.href = oauthUrl;
  };

  const buildEventCards = async (sectionsData, token = null) => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch events for all sections with optimized terms loading
    const allEvents = await fetchAllSectionEvents(sectionsData, token);

    // Filter for future events and events from last week
    const filteredEvents = filterEventsByDateRange(allEvents, oneWeekAgo);

    // Fetch attendance data for filtered events
    for (const event of filteredEvents) {
      try {
        const attendanceData = await fetchEventAttendance(event, token);
        event.attendanceData = attendanceData;
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

    // Group events by name
    const eventGroups = groupEventsByName(filteredEvents);

    // Convert groups to cards
    const cards = [];
    for (const [eventName, events] of eventGroups) {
      const card = buildEventCard(eventName, events);
      cards.push(card);
    }

    // Sort cards by earliest event date
    cards.sort((a, b) => a.earliestDate - b.earliestDate);

    return cards;
  };

  const _handleSectionSelect = async (section) => {
    try {
      // Set loading state for this specific section
      setLoadingSection(section.sectionid);

      // Try to load cached members first
      let members = [];
      try {
        members = await databaseService.getMembers([section.sectionid]);
      } catch (cacheError) {
        // Ignore cache errors - will fallback to empty array
      }
      if (members.length > 0) {
        onNavigateToMembers(section, members);
      } else {
        // No cached data - ask user if they want to fetch from OSM
        setConfirmModalData({
          title: 'Fetch Member Data',
          message: `No member data found for "${section.sectionname}".\n\nWould you like to connect to OSM to fetch member data?`,
          onConfirm: () => {
            setShowConfirmModal(false);
            // Redirect to OSM OAuth since we know the token is expired/invalid
            const oauthUrl = generateOAuthUrl();
            window.location.href = oauthUrl;
          },
          onCancel: () => {
            setShowConfirmModal(false);
            setLoadingSection(null);
            // Handle cancel - show empty members screen for this specific section
            onNavigateToMembers(section, []);
          },
          confirmText: 'Fetch Data',
          cancelText: 'Use Empty',
        });
        setShowConfirmModal(true);

        // The modal will handle the user's response
        return;
      }
    } catch (err) {
      logger.error(
        'Error loading members for section',
        {
          error: err,
          sectionId: section.sectionid,
          sectionName: section.sectionname,
        },
        LOG_CATEGORIES.COMPONENT,
      );
      setError(`Failed to load members: ${err.message}`);

      // Fallback to empty members screen
      onNavigateToMembers(section, []);
    } finally {
      // Clear loading state
      setLoadingSection(null);
    }
  };

  const handleViewAttendees = async (eventCard) => {
    try {
      // Set loading state for this specific event card
      setLoadingAttendees(eventCard.id);

      // Extract all unique section IDs from the events in this card
      const sectionIds = [
        ...new Set(eventCard.events.map((event) => event.sectionid)),
      ];

      // Try to load from cache first
      let members = [];
      try {
        members = await databaseService.getMembers(sectionIds);
      } catch (cacheErr) {
        // Find the corresponding section objects for these IDs
        const involvedSections = sections.filter((section) =>
          sectionIds.includes(section.sectionid),
        );

        // Fallback to API call
        const token = getToken();
        if (!token) {
          const oauthUrl = generateOAuthUrl();
          window.location.href = oauthUrl;
          return;
        }

        try {
          members = await getListOfMembers(involvedSections, token);
        } catch (apiError) {
          // Check if it's an authentication error
          if (
            apiError.status === 401 ||
            apiError.status === 403 ||
            apiError.message.includes('Invalid access token') ||
            apiError.message.includes('Token expired') ||
            apiError.message.includes('Unauthorized')
          ) {
            const oauthUrl = generateOAuthUrl();
            window.location.href = oauthUrl;
            return;
          }
          throw apiError; // Re-throw non-auth errors
        }
      }

      // Navigate to attendance view with both events and members
      onNavigateToAttendance(eventCard.events, members);
    } catch (err) {
      logger.error(
        'Error loading members for attendance view',
        {
          error: err,
          eventName: eventCard.name,
          eventCount: eventCard.events.length,
        },
        LOG_CATEGORIES.COMPONENT,
      );
      setError(`Failed to load members: ${err.message}`);
    } finally {
      // Clear loading state
      setLoadingAttendees(null);
    }
  };


  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4">
        <Alert.Title>Error Loading Dashboard</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
        <Alert.Actions>
          <Button variant="scout-blue" onClick={loadInitialData} type="button">
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with sync info */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              {/* Clean tab-style navigation */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setCurrentView('events')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    currentView === 'events'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📅 Events
                </button>
                <button
                  onClick={() => setCurrentView('sections')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    currentView === 'sections'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  👥 Sections
                </button>
              </div>
              
              {/* Show queue stats if active */}
              {(queueStats.processing || queueStats.queueLength > 0) && (
                <div className="mt-2">
                  <p className="text-xs text-blue-600">
                    API Queue: {queueStats.processing ? 'Processing' : 'Idle'} •
                    {queueStats.queueLength} pending •{' '}
                    {queueStats.totalRequests} total
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isOfflineMode && (
                <Button
                  variant="scout-green"
                  onClick={handleReconnect}
                  type="button"
                  className="flex items-center gap-2"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Reconnect
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Sections Card */}
        {currentView === 'sections' && (
          <div className="mb-8" data-testid="sections-list">
            <SectionsList
              sections={sections}
              selectedSections={selectedSections}
              onSectionToggle={handleSectionToggleForCard}
              showContinueButton={false}
              loadingSection={loadingSection}
            />
          </div>
        )}

        {/* Events Card */}
        {currentView === 'events' && (
          <Card>
            <Card.Header>
              <Card.Title>
                Upcoming Events {eventCards.length > 0 && `(${eventCards.length})`}
              </Card.Title>
            </Card.Header>

            <Card.Body>
              {eventCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {eventCards.map((card) => (
                    <EventCard
                      key={card.id}
                      eventCard={card}
                      onViewAttendees={handleViewAttendees}
                      loading={loadingAttendees === card.id}
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Upcoming Events
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {!lastSync
                      ? 'Click "Sign in to OSM" in the header to retrieve event data.'
                      : 'No events found for the next week or events from the past week. Click "Sign in to OSM" in the header to get the latest data.'}
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title={confirmModalData.title}
        message={confirmModalData.message}
        confirmText={confirmModalData.confirmText}
        cancelText={confirmModalData.cancelText}
        onConfirm={confirmModalData.onConfirm}
        onCancel={
          confirmModalData.onCancel ||
          (() => {
            setShowConfirmModal(false);
            // Safe fallback - only navigate if we have a valid section
            if (loadingSection && sections.length > 0) {
              const section = sections.find(
                (s) => s.sectionid === loadingSection,
              );
              if (section) {
                onNavigateToMembers(section, []);
              }
            }
          })
        }
      />
    </div>
  );
}

export default EventDashboard;
