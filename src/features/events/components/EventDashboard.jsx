import React, { useState, useEffect, useRef } from 'react';
import {
  getUserRoles,
  getListOfMembers,
  getAPIQueueStats,
} from '../../../shared/services/api/api.js';
import { getToken, generateOAuthUrl } from '../../../shared/services/auth/tokenService.js';
import { authHandler } from '../../../shared/services/auth/authHandler.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import EventCard from './EventCard.jsx';
import { SectionsList } from '../../sections';
import databaseService from '../../../shared/services/storage/database.js';
import { Alert } from '../../../shared/components/ui';
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

function EventDashboard({ onNavigateToMembers, onNavigateToAttendance }) {
  useAuth(); // Initialize auth hook
  const [sections, setSections] = useState([]);
  const [eventCards, setEventCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

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
    // Force loading to complete after any render
    setForceLoaded(true);
  }, []);

  // Override the loading condition completely
  const isActuallyLoading = loading && !forceLoaded;
  const [queueStats, setQueueStats] = useState({
    queueLength: 0,
    processing: false,
    totalRequests: 0,
  });
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
    let cleanupFn = null;

    // Unified data loading function - handles both initial load and refresh
    const loadEventCards = async (isRefresh = false) => {
      if (!mounted) return;

      try {
        const sectionsData = await databaseService.getSections();
        logger.debug('loadEventCards: Loaded sections', {
          sectionsCount: sectionsData.length,
          isRefresh,
        }, LOG_CATEGORIES.COMPONENT);

        if (sectionsData.length > 0 && mounted) {
          setSections(sectionsData);

          // Use consistent buildEventCards approach for both initial and refresh
          const cards = await buildEventCards(sectionsData, null); // Always cache-only
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

    // Handle sync completion events
    const handleDashboardDataComplete = async (syncStatus) => {
      if (!mounted) return;

      if (syncStatus.status === 'dashboard_complete') {
        logger.info('🎯 Dashboard data sync completed - refreshing event cards', {
          timestamp: syncStatus.timestamp,
        }, LOG_CATEGORIES.COMPONENT);

        await loadEventCards(true); // Refresh with same logic
      }
    };

    // Setup sync listener
    const setupSyncListener = async () => {
      try {
        const { default: syncService } = await import('../../../shared/services/storage/sync.js');
        syncService.addSyncListener(handleDashboardDataComplete);
        return () => syncService.removeSyncListener(handleDashboardDataComplete);
      } catch (error) {
        logger.error('Failed to setup sync listener', { error: error.message }, LOG_CATEGORIES.COMPONENT);
        return null;
      }
    };

    // Initialize: setup listener and load initial data
    const initialize = async () => {
      cleanupFn = await setupSyncListener();
      await loadEventCards(false); // Initial load
    };

    initialize();

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
      isMountedRef.current = false;
      if (backgroundSyncTimeoutIdRef.current) {
        clearTimeout(backgroundSyncTimeoutIdRef.current);
      }
      if (cleanupFn) {
        cleanupFn();
      }
      clearInterval(interval);
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

  const loadCachedData = async () => {
    try {
      // Load sections from cache
      const cachedSections = await databaseService.getSections();
      setSections(cachedSections);

      // Load events and build cards
      const cards = await buildEventCards(cachedSections);
      setEventCards(cards);

      // Set last sync time from storage
      const lastSyncEpoch = await UnifiedStorageService.getLastSync();
      if (lastSyncEpoch) {
        const lastSyncMs = Number(lastSyncEpoch);
        if (Number.isFinite(lastSyncMs)) {
          setLastSync(new Date(lastSyncMs));
        } else {
          // Fallback for old ISO string format
          setLastSync(new Date(lastSyncEpoch));
        }
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

  // Background sync that doesn't affect UI loading state
  const syncDataInBackground = async () => {
    // Skip sync entirely in demo mode to prevent loops
    const { isDemoMode } = await import('../../../config/demoMode.js');
    if (isDemoMode()) {
      logger.debug(
        'Demo mode: Skipping background sync entirely',
        {},
        LOG_CATEGORIES.SYNC,
      );
      return;
    }

    try {
      const syncDataToken = getToken();
      if (!syncDataToken) {
        return;
      }

      // 1. Fetch all sections
      const sectionsData = await getUserRoles(syncDataToken);
      setSections(sectionsData);
      await databaseService.saveSections(sectionsData);

      // 2. Fetch events for each section and build cards
      const cards = await buildEventCards(sectionsData, syncDataToken);
      setEventCards(cards);

      // 3. Proactively load member data in background (non-blocking)
      loadMemberDataInBackground(sectionsData, syncDataToken);

      // Update last sync time
      const now = new Date();
      setLastSync(now);
      await UnifiedStorageService.setLastSync(now.getTime().toString());

      if (import.meta.env.DEV) {
        logger.debug(
          'Background sync completed successfully',
          {},
          LOG_CATEGORIES.SYNC,
        );
      }
    } catch (err) {
      logger.error('Error in background sync', { error: err }, LOG_CATEGORIES.SYNC);

      // Check if auth failed and we have cached data - don't affect UI
      if (authHandler.hasAuthFailed() && sections.length > 0) {
        logger.info(
          'Auth failed during background sync but cached data available - continuing with cache',
        );
        // Don't set error or affect UI - background sync failure shouldn't disrupt user
      }
    }
  };

  // Manual sync function (triggered by user action)
  const syncData = async () => {
    // Skip sync entirely in demo mode to prevent loops
    const { isDemoMode } = await import('../../../config/demoMode.js');
    if (isDemoMode()) {
      logger.debug(
        'Demo mode: Skipping syncData entirely',
        {},
        LOG_CATEGORIES.SYNC,
      );
      return;
    }

    let dataSource = 'api'; // Track whether data came from API or cache

    try {
      // Starting sync process
      setError(null);

      const syncDataToken = getToken();
      if (import.meta.env.DEV) {
        logger.debug(
          'syncData: Token available',
          { hasToken: !!syncDataToken },
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
      // In demo mode, skip API call and return early
      const { isDemoMode } = await import('../../../config/demoMode.js');
      if (isDemoMode()) {
        logger.info(
          'Demo mode: Skipping getUserRoles API call',
          {},
          LOG_CATEGORIES.SYNC,
        );
        return; // Demo mode - just use cached data, no API calls
      }

      const sectionsData = await getUserRoles(syncDataToken);
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
      // In demo mode, force cache-only mode (no API calls)
      const token = isDemoMode ? null : syncDataToken;
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
      loadMemberDataInBackground(sectionsData, syncDataToken);

      // Update last sync time
      const now = new Date();
      setLastSync(now);
      await UnifiedStorageService.setLastSync(now.getTime().toString());

      // Data was successfully synced from API if we reached this point
      dataSource = 'api';
      if (import.meta.env.DEV) {
        logger.debug(
          'syncData: Sync completed successfully',
          { dataSource },
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
        setError(null); // Clear error since we can show cached data
        dataSource = 'cache'; // Explicitly mark as cached data

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

  const buildEventCards = async (sectionsData, token = null) => {
    logger.debug(
      'buildEventCards called',
      {
        sectionCount: sectionsData?.length || 0,
        mode: token ? 'API' : 'CACHE',
      },
      LOG_CATEGORIES.COMPONENT,
    );

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch events for all sections with optimized terms loading
    const allEvents = await fetchAllSectionEvents(sectionsData, token);

    // Filter for future events and events from last week
    const filteredEvents = filterEventsByDateRange(allEvents, oneWeekAgo);

    // Fetch attendance data for filtered events (with shared event checking)
    const attendanceMap = new Map();
    for (const event of filteredEvents) {
      try {
        const attendanceData = await fetchEventAttendance(
          event,
          token,
        );
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
            members = await getListOfMembers(involvedSections, currentToken);
            logger.info(
              'Successfully fetched members on-demand',
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
      {/* Header with sync info */}
      <div
        className="bg-white shadow-sm border-b border-gray-200 mb-6"
        data-oid="pprvno2"
      >
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4"
          data-oid="09tusng"
        >
          <div className="flex justify-between items-center" data-oid="3562u3z">
            <div data-oid="dk-vy.7">
              {/* Show queue stats if active */}
              {(queueStats.processing || queueStats.queueLength > 0) && (
                <div className="mt-2" data-oid="t::a22m">
                  <p className="text-xs text-blue-600" data-oid="mvnlyr9">
                    API Queue: {queueStats.processing ? 'Processing' : 'Idle'} •
                    {queueStats.queueLength} pending •{' '}
                    {queueStats.totalRequests} total
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
              <h2
                className="text-lg font-semibold text-gray-900 m-0"
                data-oid="96:-cg1"
              >
                Upcoming Events{' '}
                {eventCards.length > 0 && `(${eventCards.length})`}
              </h2>
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
