import React, { useState, useEffect } from 'react';
import { getUserRoles, getEvents, getMostRecentTermId, getEventAttendance, getListOfMembers, getAPIQueueStats } from '../services/api.js';
import { getToken } from '../services/auth.js';
import LoadingScreen from './LoadingScreen.jsx';
import SectionsList from './SectionsList.jsx';
import EventCard from './EventCard.jsx';
import databaseService from '../services/database.js';
import { Button, Alert } from './ui';
import ConfirmModal from './ui/ConfirmModal';

function EventDashboard({ onNavigateToMembers, onNavigateToAttendance }) {
  const [sections, setSections] = useState([]);
  const [eventCards, setEventCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [queueStats, setQueueStats] = useState({ queueLength: 0, processing: false, totalRequests: 0 });
  const [developmentMode, setDevelopmentMode] = useState(false);
  const [loadingAttendees, setLoadingAttendees] = useState(null); // Track which event card is loading attendees
  const [loadingSection, setLoadingSection] = useState(null); // Track which section is loading members
  
  // Modal state for confirmation dialogs
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState({
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });

  useEffect(() => {
    loadInitialData();
    // Check for development mode
    const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
    setDevelopmentMode(isDev);
    
    // Update queue stats every second
    const interval = setInterval(() => {
      setQueueStats(getAPIQueueStats());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if we have offline data
      const hasOfflineData = await databaseService.hasOfflineData();
      
      // Check if data is recent enough (less than 30 minutes old)
      const lastSyncTime = localStorage.getItem('viking_last_sync');
      const isDataFresh = lastSyncTime && 
        (Date.now() - new Date(lastSyncTime).getTime()) < 30 * 60 * 1000; // 30 minutes
      
      console.log('Cache freshness check:', {
        hasOfflineData,
        lastSyncTime,
        isDataFresh,
        timeSinceLastSync: lastSyncTime ? Math.round((Date.now() - new Date(lastSyncTime).getTime()) / 60000) : 'N/A',
      });
      
      if (hasOfflineData) {
        // Always load from cache if available - no automatic syncing
        console.log('Loading cached data (no automatic sync)');
        await loadCachedData();
      } else {
        // No cached data, user will need to sync manually
        console.log('No cached data available - user needs to sync manually');
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError(err.message);
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
      console.error('Error loading cached data:', err);
      throw err;
    }
  };

  // Only function that triggers OSM API calls - user must explicitly click sync button
  const syncData = async () => {
    try {
      setSyncing(true);
      setError(null);
      
      const token = getToken();
      
      // 1. Fetch all sections
      const sectionsData = await getUserRoles(token);
      setSections(sectionsData);
      await databaseService.saveSections(sectionsData);
      
      // 2. Fetch members data for all sections (needed for attendance modals and members screen)
      console.log('Fetching members data for all sections...');
      // Add delay before members calls to prevent rapid API calls
      const memberDelay = developmentMode ? 2000 : 1000; // Longer delay in development
      await new Promise(resolve => setTimeout(resolve, memberDelay));
      await getListOfMembers(sectionsData, token);
      console.log('Members data cached successfully');
      
      // 3. Fetch events for each section and build cards
      const cards = await buildEventCards(sectionsData, token);
      setEventCards(cards);
      
      // Update last sync time
      const now = new Date();
      setLastSync(now);
      localStorage.setItem('viking_last_sync', now.toISOString());
      
    } catch (err) {
      console.error('Error syncing data:', err);
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const buildEventCards = async (sectionsData, token = null) => {
    const cards = [];
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Group events by name
    const eventGroups = new Map();
    
    for (const section of sectionsData) {
      try {
        let events = [];
        
        if (token) {
          // Add delay between sections to prevent rapid API calls
          const sectionDelay = developmentMode ? 1500 : 800; // Longer delay in development
          await new Promise(resolve => setTimeout(resolve, sectionDelay));
          
          // Fetch from API
          const termId = await getMostRecentTermId(section.sectionid, token);
          if (termId) {
            // Add delay before events call
            const eventDelay = developmentMode ? 1000 : 500; // Longer delay in development
            await new Promise(resolve => setTimeout(resolve, eventDelay));
            const sectionEvents = await getEvents(section.sectionid, termId, token);
            if (sectionEvents && Array.isArray(sectionEvents)) {
              events = sectionEvents.map(event => ({
                ...event,
                sectionid: section.sectionid,
                sectionname: section.sectionname,
                termid: termId,
              }));
              
              // Save to cache (with termid included)
              await databaseService.saveEvents(section.sectionid, events);
            }
          }
        } else {
          // Load from cache
          const cachedEvents = await databaseService.getEvents(section.sectionid);
          events = cachedEvents.map(event => ({
            ...event,
            sectionname: section.sectionname,
            // If termid is missing from cache, we'll need to get it later
            termid: event.termid || null,
          }));
        }
        
        // Filter for future events and events from last week
        const filteredEvents = events.filter(event => {
          const eventDate = new Date(event.startdate);
          return eventDate >= oneWeekAgo;
        });
        
        // Fetch attendance data for filtered events
        for (const event of filteredEvents) {
          if (token) {
            try {
              // Add delay between attendance calls to prevent rapid API calls
              const attendanceDelay = developmentMode ? 1200 : 600; // Longer delay in development
              await new Promise(resolve => setTimeout(resolve, attendanceDelay));
              
              // If termid is missing, get it from API
              let termId = event.termid;
              if (!termId) {
                // Add delay before termid call
                const termIdDelay = developmentMode ? 600 : 300;
                await new Promise(resolve => setTimeout(resolve, termIdDelay));
                termId = await getMostRecentTermId(event.sectionid, token);
                event.termid = termId; // Update the event object
              }
              
              if (termId) {
                // Add delay before attendance call
                const finalDelay = developmentMode ? 800 : 400;
                await new Promise(resolve => setTimeout(resolve, finalDelay));
                const attendanceData = await getEventAttendance(
                  event.sectionid, 
                  event.eventid, 
                  termId, 
                  token,
                );
                
                if (attendanceData) {
                  await databaseService.saveAttendance(event.eventid, attendanceData);
                  event.attendanceData = attendanceData;
                }
              }
            } catch (err) {
              console.error(`Error fetching attendance for event ${event.eventid}:`, err);
            }
          } else {
            // Load from cache
            const cachedAttendance = await databaseService.getAttendance(event.eventid);
            event.attendanceData = cachedAttendance;
          }
        }
        
        // Group events by name
        for (const event of filteredEvents) {
          const eventName = event.name;
          if (!eventGroups.has(eventName)) {
            eventGroups.set(eventName, []);
          }
          eventGroups.get(eventName).push(event);
        }
        
      } catch (err) {
        console.error(`Error processing section ${section.sectionid}:`, err);
      }
    }
    
    // Convert groups to cards and sort by earliest event date
    for (const [eventName, events] of eventGroups) {
      // Sort events within group by date
      events.sort((a, b) => new Date(a.startdate) - new Date(b.startdate));
      
      // Create card with earliest event date for sorting
      const card = {
        id: `${eventName}-${events[0].eventid}`,
        name: eventName,
        events: events,
        earliestDate: new Date(events[0].startdate),
        sections: [...new Set(events.map(e => e.sectionname))],
      };
      
      cards.push(card);
    }
    
    // Sort cards by earliest event date
    cards.sort((a, b) => a.earliestDate - b.earliestDate);
    
    return cards;
  };

  const handleSectionSelect = async (section) => {
    try {
      // Set loading state for this specific section
      setLoadingSection(section.sectionid);
      
      console.log(`Checking cached members for section: ${section.sectionname}`);
      
      // Try to load cached members first
      let members = [];
      try {
        members = await databaseService.getMembers([section.sectionid]);
      } catch (cacheError) {
        console.log('No cached members found');
      }
      
      if (members.length > 0) {
        console.log(`Using ${members.length} cached members for section "${section.sectionname}"`);
        onNavigateToMembers(section, members);
      } else {
        // No cached data - ask user if they want to fetch from OSM
        setConfirmModalData({
          title: 'Fetch Member Data',
          message: `No member data found for "${section.sectionname}".\n\nWould you like to connect to OSM to fetch member data?`,
          onConfirm: async () => {
            setShowConfirmModal(false);
            console.log(`Fetching fresh members for section: ${section.sectionname}`);
            const token = getToken();
            const freshMembers = await getListOfMembers([section], token);
            console.log(`Loaded ${freshMembers.length} members for section "${section.sectionname}"`);
            onNavigateToMembers(section, freshMembers);
          },
          confirmText: 'Fetch Data',
          cancelText: 'Use Empty'
        });
        setShowConfirmModal(true);
        
        // The modal will handle the user's response
        return;
      }
      
    } catch (err) {
      console.error('Error loading members for section:', err);
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
      const sectionIds = [...new Set(eventCard.events.map(event => event.sectionid))];
      
      console.log(`Loading members for ${sectionIds.length} sections involved in "${eventCard.name}":`, 
        sectionIds,
      );
      
      // Try to load from cache first
      let members = [];
      try {
        members = await databaseService.getMembers(sectionIds);
        console.log(`Loaded ${members.length} members from cache for event "${eventCard.name}"`);
      } catch (cacheErr) {
        console.log('No cached members found, fetching from API...');
        
        // Find the corresponding section objects for these IDs
        const involvedSections = sections.filter(section => 
          sectionIds.includes(section.sectionid),
        );
        
        // Fallback to API call
        const token = getToken();
        members = await getListOfMembers(involvedSections, token);
        console.log(`Loaded ${members.length} members from API for event "${eventCard.name}"`);
      }
      
      // Navigate to attendance view with both events and members
      onNavigateToAttendance(eventCard.events, members);
      
    } catch (err) {
      console.error('Error loading members for attendance view:', err);
      setError(`Failed to load members: ${err.message}`);
    } finally {
      // Clear loading state
      setLoadingAttendees(null);
    }
  };

  const formatLastSync = (date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
          <Button 
            variant="scout-blue"
            onClick={loadInitialData}
            type="button"
          >
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
              <h1 className="text-2xl font-bold text-gray-900">Event Dashboard</h1>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  Last updated: {formatLastSync(lastSync)}
                  {!lastSync && ' (Never synced)'}
                </p>
                {(queueStats.processing || queueStats.queueLength > 0) && (
                  <p className="text-xs text-blue-600">
                    API Queue: {queueStats.processing ? 'Processing' : 'Idle'} • 
                    {queueStats.queueLength} pending • {queueStats.totalRequests} total
                  </p>
                )}
                {developmentMode && (
                  <p className="text-xs text-orange-600">
                    🚧 Development mode: Extended delays active
                  </p>
                )}
                {!lastSync && (
                  <p className="text-xs text-amber-600">
                    📡 No data cached - click Sync to load from OSM
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="scout-blue"
              onClick={syncData}
              disabled={syncing}
              type="button"
              className="flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Sync from OSMing...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync from OSM
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Sections selector */}
        <div className="mb-8">
          <SectionsList 
            sections={sections}
            selectedSections={[]} // No selection needed, just for display
            onSectionToggle={handleSectionSelect}
            showContinueButton={false}
            loadingSection={loadingSection}
          />
        </div>

        {/* Event Cards */}
        <div className="space-y-6">
          {eventCards.length > 0 ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upcoming Events ({eventCards.length})
              </h2>
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
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002-2V11M9 7h6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Upcoming Events</h3>
              <p className="text-gray-600 mb-4">
                {!lastSync 
                  ? 'Click "Sync" to retrieve event data from OSM.' 
                  : 'No events found for the next week or events from the past week. Try syncing to get the latest data.'
                }
              </p>
              <Button
                variant="scout-blue"
                onClick={syncData}
                disabled={syncing}
                type="button"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title={confirmModalData.title}
        message={confirmModalData.message}
        confirmText={confirmModalData.confirmText}
        cancelText={confirmModalData.cancelText}
        onConfirm={confirmModalData.onConfirm}
        onCancel={() => {
          setShowConfirmModal(false);
          // Handle cancel - show empty members screen
          onNavigateToMembers(sections.find(s => s.sectionid === loadingSection), []);
        }}
      />
    </div>
  );
}

export default EventDashboard;