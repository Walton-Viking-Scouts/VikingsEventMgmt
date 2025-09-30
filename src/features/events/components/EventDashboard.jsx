import React, { useState, useEffect, useRef } from 'react';
// Removed API imports - UI only reads from IndexedDB
import { getToken, generateOAuthUrl } from '../../../shared/services/auth/tokenService.js';
import { authHandler } from '../../../shared/services/auth/authHandler.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import EventCard from './EventCard.jsx';
import { SectionsList } from '../../sections';
import databaseService from '../../../shared/services/storage/database.js';
import { Alert, RefreshButton } from '../../../shared/components/ui';
import ConfirmModal from '../../../shared/components/ui/ConfirmModal';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { UnifiedStorageService } from '../../../shared/services/storage/unifiedStorageService.js';
import {
  fetchAllSectionEvents,
  fetchEventAttendance,
  groupEventsByName,
  buildEventCard,
  filterEventsByDateRange,
  expandSharedEvents,
} from '../../../shared/utils/eventDashboardHelpers.js';
import dataLoadingService from '../../../shared/services/data/dataLoadingService.js';
import { notifyError, notifySuccess } from '../../../shared/utils/notifications.js';
import { formatLastRefresh } from '../../../shared/utils/timeFormatting.js';

function EventDashboard({ onNavigateToMembers, onNavigateToAttendance }) {
  useAuth(); // Initialize auth hook
  const [sections, setSections] = useState([]);
  const [eventCards, setEventCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Debug: Expose sections.length globally for console debugging
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.debugSectionsLength = sections.length;
      window.debugEventCardsLength = eventCards.length;
      window.debugLoading = loading;
    }
  }, [sections.length, eventCards.length, loading]);

  // Override loading state for design mode compatibility
  const [forceLoaded, setForceLoaded] = useState(false);

  useEffect(() => {
    // Only bypass loading spinner in development/design mode
    if (import.meta.env.DEV) {
      setForceLoaded(true);
    }
  }, []);

  const isActuallyLoading = import.meta.env.DEV ? (loading && !forceLoaded) : loading;
  const [loadingAttendees, setLoadingAttendees] = useState(null); // Track which event card is loading attendees
  const [loadingSection, setLoadingSection] = useState(null); // Track which section is loading members

  // Simple view toggle state
  const [currentView] = useState('events'); // 'events' or 'sections'

  // Section selection state for the Sections card
  const [selectedSections, setSelectedSections] = useState([]);

  // Handle section selection for the Sections card
  const handleSectionToggleForCard = (section) => {
    setSelectedSections((prev) => {
      const isSelected = prev.some((s) => s.sectionid === section.sectionid);
      if (isSelected) {
        return prev.filter((s) => s.sectionid !== section.sectionid);
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

  // Component mount tracking and timeout management
  const isMountedRef = useRef(false);
  const backgroundSyncTimeoutIdRef = useRef(null);


  useEffect(() => {
    let mounted = true;
    isMountedRef.current = true;

    // Unified data loading function - handles both initial load and refresh
    const loadEventCards = async (isRefresh = false) => {
      if (!mounted) return;

      // Initialize demo mode if enabled BEFORE loading sections
      if (!isRefresh) {
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
      }

      try {
        const sectionsData = await databaseService.getSections();
        logger.debug('loadEventCards: Loaded sections', {
          sectionsCount: sectionsData.length,
          isRefresh,
          sampleSections: sectionsData.slice(0, 3).map(s => ({
            id: s.sectionid,
            name: s.sectionname,
          })),
        }, LOG_CATEGORIES.COMPONENT);

        if (sectionsData.length > 0 && mounted) {
          setSections(sectionsData);

          // Use consistent buildEventCards approach for both initial and refresh
          const cards = await buildEventCards(sectionsData); // Always cache-only

          // UI is cache-only - no API calls

          logger.debug('loadEventCards: Built event cards', {
            cardsCount: cards.length,
            isRefresh,
          }, LOG_CATEGORIES.COMPONENT);

          if (mounted) {
            setEventCards(cards);
            setLoading(false);

            // Set last sync time from storage
            if (!isRefresh) {
              const lastSyncEpoch = await UnifiedStorageService.getLastSync();
              if (lastSyncEpoch) {
                const lastSyncMs = Number(lastSyncEpoch);
                if (Number.isFinite(lastSyncMs)) {
                  setLastSync(new Date(lastSyncMs));
                } else {
                  setLastSync(new Date(lastSyncEpoch));
                }
              }
            }
          }
        } else {
          logger.debug('loadEventCards: No sections found', { isRefresh }, LOG_CATEGORIES.COMPONENT);
          if (mounted) {
            setEventCards([]);
            setLoading(false);
          }
        }
      } catch (error) {
        logger.error('Error loading event cards', {
          error: error.message,
          isRefresh,
        }, LOG_CATEGORIES.COMPONENT);
        if (mounted && !isRefresh) {
          setLoading(false);
        }
      }
    };



    // Initialize: load initial data
    const initialize = async () => {
      await loadEventCards(false); // Initial load
    };

    initialize();


    return () => {
      mounted = false;
      isMountedRef.current = false;
      if (backgroundSyncTimeoutIdRef.current) {
        clearTimeout(backgroundSyncTimeoutIdRef.current);
      }
    };
  }, []); // Run once



  // Background initialization - doesn't affect UI loading state
  const loadInitialDataInBackground = async () => {
    try {
      setError(null); // Clear any previous errors, but don't affect loading state

      // Initialize demo mode if enabled (moved from main.jsx)
      const { isDemoMode, initializeDemoMode } = await import(
        '../../../config/demoMode.js'
      );
      if (isDemoMode()) {
        await initializeDemoMode();
      } else {
        // Clean up any demo cache data when not in demo mode
        const { cleanupDemoCache } = await import('../../../shared/utils/cacheCleanup.js');
        cleanupDemoCache();
      }

      // Check if we have offline data
      const hasOfflineData = await databaseService.hasOfflineData();

      // Check if data is recent enough (less than 30 minutes old)
      const lastSyncEpoch = await UnifiedStorageService.getLastSync();
      const lastSyncMs = Number(lastSyncEpoch);
      const isDataFresh =
        lastSyncEpoch &&
        Number.isFinite(lastSyncMs) &&
        Date.now() - lastSyncMs < 30 * 60 * 1000; // 30 minutes

      if (hasOfflineData && isDataFresh) {
        // Data is fresh - no need to sync
        if (import.meta.env.DEV) {
          logger.debug('Background check: Data is fresh, no sync needed', {}, LOG_CATEGORIES.COMPONENT);
        }
        return;
      } else if (hasOfflineData && !isDataFresh) {
        // Stale cached data - auto-sync in background
        if (import.meta.env.DEV) {
          logger.debug('Background check: Data is stale, will sync in background', {}, LOG_CATEGORIES.COMPONENT);
        }

        // Auto-sync in background only if auth hasn't failed
        backgroundSyncTimeoutIdRef.current = setTimeout(async () => {
          try {
            if (!isMountedRef.current) return;

            if (authHandler.hasAuthFailed()) {
              return;
            }

            const backgroundToken = getToken();
            if (!backgroundToken) {
              return;
            }

            // No automatic sync - user must manually refresh
          } catch (error) {
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
        // No cached data - attempt sync but don't affect loading state if cache load already succeeded
        if (import.meta.env.DEV) {
          logger.debug(
            'Background check: No cached data found - attempting sync',
            {},
            LOG_CATEGORIES.COMPONENT,
          );
        }

        if (authHandler.hasAuthFailed()) {
          if (eventCards.length === 0) {
            // Only set error if we have no cached data to show
            setError(
              'Authentication expired and no cached data available. Please reconnect to OSM.',
            );
          }
          return;
        }

        const syncToken = getToken();
        if (!syncToken) {
          if (import.meta.env.DEV) {
            logger.debug(
              'Background sync skipped - no token available',
              {},
              LOG_CATEGORIES.COMPONENT,
            );
          }
          return;
        }

        // No automatic sync - user must manually refresh
      }
    } catch (err) {
      logger.error(
        'Error in background initialization',
        { error: err },
        LOG_CATEGORIES.COMPONENT,
      );

      // Only set error if we have no cached data to show
      if (eventCards.length === 0) {
        setError(err.message);
      }
    }
  };

  // Manual refresh function - runs in background without affecting UI
  const loadInitialData = async () => {
    // Don't change loading state - keep showing cached data during refresh
    try {
      await loadInitialDataInBackground();
    } catch (error) {
      logger.error('Manual refresh failed', { error: error.message }, LOG_CATEGORIES.ERROR);
      // Don't affect UI on error - just log it
    }
  };

  // Manual refresh handler using dataLoadingService orchestrator
  const handleManualRefresh = async () => {
    if (refreshing) return;

    try {
      setRefreshing(true);
      setError(null);

      logger.info('Manual refresh initiated from EventDashboard', {}, LOG_CATEGORIES.COMPONENT);

      // Get authentication token
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Step 1: Use dataLoadingService to refresh event and attendance data
      const refreshResult = await dataLoadingService.refreshEventData(token);

      if (refreshResult.success) {
        logger.info('Event data refresh completed successfully', {
          summary: refreshResult.summary,
        }, LOG_CATEGORIES.COMPONENT);

        // Step 2: Reload sections data and trigger rebuild of event cards
        const sectionsData = await databaseService.getSections();
        setSections(sectionsData);

        // Step 3: Build fresh event cards
        const cards = await buildEventCards(sectionsData);
        setEventCards(cards);

        // Step 4: Update last sync time
        setLastSync(new Date());

        // Step 5: Show success notification based on orchestrator results
        let message = 'Event data refreshed successfully';

        // Try to extract attendance details if available
        const attendanceResult = refreshResult.results?.attendance;
        if (attendanceResult?.details) {
          message = `Refreshed ${attendanceResult.details.syncedEvents}/${attendanceResult.details.totalEvents} events`;
        } else if (refreshResult.hasErrors && refreshResult.summary?.successful > 0) {
          message = `Partially refreshed (${refreshResult.summary.successful}/${refreshResult.summary.total} operations succeeded)`;
        }

        notifySuccess(message);
      } else {
        // Handle errors from orchestrator
        const errorMessages = refreshResult.errors?.map(err => err.message) || ['Refresh failed'];
        throw new Error(errorMessages.join(', '));
      }

    } catch (error) {
      logger.error('Manual refresh failed', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);

      notifyError(`Refresh failed: ${error.message}`);
      setError(`Refresh failed: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  // Format last refresh time following SimpleAttendanceViewer pattern



  // Load member data proactively in background
  const _loadMemberDataInBackground = async (sectionsData, token) => {
    try {
      if (!token || authHandler.hasAuthFailed()) {
        return;
      }

      // Members are loaded by Reference Data Service - no need to call API here
      // Data is already available in IndexedDB
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
      const sectionIds = Array.from(
        new Set(eventCard.events.map((event) => event.sectionid)),
      );

      // Stage 3: On-demand member loading with guaranteed data
      let members = [];
      try {
        // First, try to load from cache
        members = await databaseService.getMembers(sectionIds);

        if (members.length === 0) {
          logger.info(
            'No cached members found - fetching on-demand',
            {
              sectionIds,
              eventName: eventCard.name,
            },
            LOG_CATEGORIES.COMPONENT,
          );

          // No cached members - fetch immediately
          const currentToken = getToken();
          if (!currentToken) {
            const oauthUrl = generateOAuthUrl();
            window.location.href = oauthUrl;
            return;
          }

          // Find the corresponding section objects for these IDs
          const involvedSections = sections.filter((section) =>
            sectionIds.includes(section.sectionid),
          );

          try {
            // Get members from IndexedDB instead of API call
            const sectionIds = involvedSections.map(s => s.sectionid);
            members = await databaseService.getMembers(sectionIds);
            logger.info(
              'Successfully loaded members from IndexedDB',
              {
                memberCount: members.length,
                sectionCount: involvedSections.length,
              },
              LOG_CATEGORIES.COMPONENT,
            );
          } catch (apiError) {
            // Check if it's an authentication error
            if (
              apiError &&
              typeof apiError === 'object' &&
              (apiError.status === 401 ||
                apiError.status === 403 ||
                apiError.message?.includes('Invalid access token') ||
                apiError.message?.includes('Token expired') ||
                apiError.message?.includes('Unauthorized'))
            ) {
              const oauthUrl = generateOAuthUrl();
              window.location.href = oauthUrl;
              return;
            }
            throw apiError; // Re-throw non-auth errors
          }
        } else {
          logger.info(
            'Using cached members for attendance view',
            {
              memberCount: members.length,
              sectionIds,
            },
            LOG_CATEGORIES.COMPONENT,
          );
        }
      } catch (cacheErr) {
        logger.warn(
          'Error accessing member cache',
          { error: cacheErr.message },
          LOG_CATEGORIES.COMPONENT,
        );
        // Continue with empty members array - better than failing completely
      }

      // Navigate to attendance view with original events (preserves termid integrity)
      const eventsToNavigate = eventCard.originalEvents || eventCard.events;
      onNavigateToAttendance(eventsToNavigate, members);
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

  if (isActuallyLoading) {
    return <LoadingScreen message="Loading dashboard..." data-oid="g6pwk17" />;
  }

  if (error) {
    return (
      <Alert variant="error" className="m-4" data-oid="3oq.x.h">
        <Alert.Title data-oid="d:fjt2d">Error Loading Dashboard</Alert.Title>
        <Alert.Description data-oid="4uunsvb">{error}</Alert.Description>
        <Alert.Actions data-oid="bd0v.w-">
          <button
            onClick={loadInitialData}
            type="button"
            className="inline-flex items-center justify-center rounded-md font-medium px-4 py-2 text-base bg-scout-blue text-white hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light active:bg-scout-blue-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            data-oid="ahnj4wa"
          >
            Retry
          </button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-oid="c47cc:8">

      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        data-oid="zza2fzu"
      >
        {/* Sections Card */}
        {currentView === 'sections' && (
          <div className="mb-8" id="sections-panel" data-testid="sections-list" data-oid="883.3lx">
            <SectionsList
              sections={sections}
              selectedSections={selectedSections}
              onSectionToggle={handleSectionToggleForCard}
              loadingSection={loadingSection}
              allSections={sections}
              data-oid="dmp670d"
            />
          </div>
        )}

        {/* Events Card */}
        {currentView === 'events' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm" id="events-panel" data-oid="ve3fjt:">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg" data-oid="gycj.jl">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-lg font-semibold text-gray-900 m-0"
                    data-oid="96:-cg1"
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
            <div className="p-4" data-oid="tw4z.r8">
              {eventCards.length > 0 ? (
                <div
                  className="grid grid-cols-1 min-[830px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6"
                  data-oid="0lg715h"
                >
                  {eventCards.map((card) => (
                    <EventCard
                      key={card.id}
                      eventCard={card}
                      onViewAttendees={handleViewAttendees}
                      loading={loadingAttendees === card.id}
                      data-oid="9uno.dz"
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12" data-oid="h2.dcru">
                  <div className="text-gray-500 mb-4" data-oid="04h4e3l">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      data-oid="vbk6.13"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002-2V11M9 7h6"
                        data-oid="n_dlzww"
                      />
                    </svg>
                  </div>
                  <h3
                    className="text-lg font-semibold text-gray-900 mb-2"
                    data-oid="dvun05:"
                  >
                    No Upcoming Events
                  </h3>
                  <p className="text-gray-600 mb-4" data-oid="p1iqx11">
                    {!lastSync
                      ? 'Click "Sign in to OSM" in the header to retrieve event data.'
                      : 'No events found for the next week or events from the past week. Click "Sign in to OSM" in the header to get the latest data.'}
                  </p>
                </div>
              )}
            </div>
          </div>
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
            setLoadingSection(null);
          })
        }
        data-oid="7pfgrfw"
      />

    </div>
  );
}

export default EventDashboard;
