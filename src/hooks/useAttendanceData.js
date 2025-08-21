import { useState, useEffect, useMemo } from 'react';
import { getEventAttendance } from '../services/api.js';
import { getVikingEventDataForEvents } from '../services/flexiRecordService.js';
import { getToken } from '../services/auth.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

/**
 * Custom hook for loading and managing attendance data
 * 
 * @param {Array} events - Array of event data
 * @returns {Object} Hook state and functions
 */
export function useAttendanceData(events) {
  const [attendanceData, setAttendanceData] = useState([]);
  const [vikingEventData, setVikingEventData] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load attendance data when events change
  useEffect(() => {
    loadAttendance();
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Skip API calls in demo mode - only use cached data
      const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
      if (isDemoMode) {
        logger.debug('Demo mode: Skipping API calls, using cached attendance only', {}, LOG_CATEGORIES.COMPONENT);
      }
      
      // Validate event data integrity
      const hasInvalidEvents = events.some(event => !event.sectionid || event.termid === null || event.termid === undefined);
      if (events.length > 0 && hasInvalidEvents) {
        if (import.meta.env.DEV) {
          console.error('🚫 Invalid events detected:', events.filter(event => !event.sectionid || event.termid === null || event.termid === undefined));
        }
        setError('Invalid event data detected. Please refresh the page to reload.');
        return;
      }
      
      const allAttendance = [];
      const sectionSpecificAttendanceData = [];
      const token = getToken();
      
      
      // Load attendance data for each event
      for (const event of events) {
        // Validate that event has required fields (should be included from eventDashboardHelpers)
        if (!event.sectionid || !event.termid || !event.eventid) {
          if (import.meta.env.DEV) {
            console.warn('Event missing required fields:', {
              name: event.name,
              sectionid: event.sectionid,
              termid: event.termid,
              eventid: event.eventid,
              availableKeys: Object.keys(event),
            });
          }
          continue; // Skip this event
        }
        
        // Check if we have cached attendance data for this specific event
        const cacheKey = `viking_attendance_${event.sectionid}_${event.termid}_${event.eventid}_offline`;
        let attendanceResponse = null;
        
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const cachedAttendance = JSON.parse(cached);
            attendanceResponse = { items: cachedAttendance };
            if (import.meta.env.DEV) {
              console.log(`Found cached attendance for event ${event.name}:`, cachedAttendance.length, 'records');
            }
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('Failed to parse cached attendance data:', error);
          }
        }
        
        if (!attendanceResponse && token && !isDemoMode) {
          // Fallback to API call if no cached data (skip in demo mode)
          try {
            const attendanceItems = await getEventAttendance(
              event.sectionid, 
              event.eventid, 
              event.termid,
              token,
            );
            
            attendanceResponse = { items: attendanceItems || [] };
          } catch (eventError) {
            if (import.meta.env.DEV) {
              console.warn(`Error loading attendance for event ${event.name}:`, eventError);
            }
            attendanceResponse = { items: [] };
          }
        }
        
        if (attendanceResponse && attendanceResponse.items) {
          // Add event info to each attendance record
          const attendanceWithEvent = attendanceResponse.items.map(record => ({
            ...record,
            eventid: event.eventid,
            eventname: event.name,
            eventdate: event.startdate,
            sectionid: event.sectionid,
            sectionname: event.sectionname,
          }));
          
          // Store section-specific data for potential shared event merging
          sectionSpecificAttendanceData.push({
            ...attendanceResponse,
            items: attendanceWithEvent,
            eventId: event.eventid,
            sectionId: event.sectionid,
          });
          
          allAttendance.push(...attendanceWithEvent);
        }
      }
      
      // Process attendance data for events
      if (sectionSpecificAttendanceData.length > 0) {
        await processAttendanceData(
          sectionSpecificAttendanceData, 
          allAttendance,
          events,
        );
      } else {
        setAttendanceData(allAttendance);
      }
      
      // Load Viking Event Management data (fresh when possible, cache as fallback)
      await loadVikingEventData();
      
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Error loading attendance:', err);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Process attendance data for events
  const processAttendanceData = async (
    sectionSpecificAttendanceData, 
    allAttendance,
    events,
  ) => {
    try {
      // Group attendance data by event ID
      const eventAttendanceMap = new Map();
      sectionSpecificAttendanceData.forEach(data => {
        if (!eventAttendanceMap.has(data.eventId)) {
          eventAttendanceMap.set(data.eventId, []);
        }
        eventAttendanceMap.get(data.eventId).push(data);
      });
      
      const finalAttendanceData = [];
      
      // Process each unique event
      for (const [eventId, eventAttendanceDataArray] of eventAttendanceMap.entries()) {
        const eventData = events.find(e => e.eventid === eventId);
        if (!eventData) continue;
        
        // Process event attendance data (shared events are handled in eventDashboardHelpers)
        const sectionAttendees = eventAttendanceDataArray.flatMap(data => data.items || []);
        finalAttendanceData.push(...sectionAttendees);
      }
      
      logger.info('Attendance data processing completed', {
        totalAttendees: finalAttendanceData.length,
        originalCount: allAttendance.length,
      }, LOG_CATEGORIES.COMPONENT);
      
      setAttendanceData(finalAttendanceData);
      
    } catch (error) {
      logger.error('Error in shared event merging, using original data', {
        error: error.message,
      }, LOG_CATEGORIES.COMPONENT);
      
      // Fallback to original attendance data
      setAttendanceData(allAttendance);
    }
  };

  // Load Viking Event Management flexirecord data (fresh preferred, cache fallback)
  const loadVikingEventData = async () => {
    try {
      const token = getToken();
      
      // Enhanced logging for debugging deployed environment issues
      if (import.meta.env.DEV) {
        console.log('useAttendanceData: Loading Viking Event data', {
          eventsCount: events?.length || 0,
          hasToken: !!token,
          tokenLength: token?.length || 0,
          eventSections: events?.map(e => ({ sectionid: e.sectionid, termid: e.termid })) || [],
        });
      }
      
      if (!token) {
        logger.info(
          'useAttendanceData: No token available for FlexiRecord loading; attempting cache-only read',
          {},
          LOG_CATEGORIES.APP,
        );
        try {
          // forceRefresh=false to use only local cache
          const cachedMap = await getVikingEventDataForEvents(events, null, false);
          if (cachedMap) {
            setVikingEventData(cachedMap);
          }
        } catch (cacheErr) {
          logger.warn(
            'useAttendanceData: Cache-only Viking Event data load failed',
            { error: cacheErr.message },
            LOG_CATEGORIES.APP,
          );
        }
        return;
      }
      
      // Load Viking Event Management data for all sections
      // getVikingEventDataForEvents handles section-term combinations correctly
      const vikingEventMap = await getVikingEventDataForEvents(events, token);
      
      if (import.meta.env.DEV) {
        console.log('useAttendanceData: Viking Event data loaded successfully', {
          sectionsWithData: Array.from(vikingEventMap.entries())
            .filter(([_, data]) => data !== null)
            .map(([sectionId, _]) => sectionId),
          totalSections: vikingEventMap.size,
        });
      }
      
      setVikingEventData(vikingEventMap);
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('useAttendanceData: Error loading Viking Event Management data', {
          error: error.message,
          stack: error.stack,
          eventsCount: events?.length || 0,
        });
      }
      // Don't set error state as this is supplementary data
    }
  };

  // Create a memoized lookup map for Viking Event data to improve performance
  // Builds once when vikingEventData changes, provides O(1) lookups instead of O(n×m) searches
  const vikingEventLookup = useMemo(() => {
    const lookup = new Map();
    for (const [, sectionData] of vikingEventData.entries()) {
      if (sectionData && sectionData.items) {
        sectionData.items.forEach(item => {
          lookup.set(item.scoutid, item);
        });
      }
    }
    return lookup;
  }, [vikingEventData]);

  // Get Viking Event Management data for a specific member using optimized O(1) lookup
  const getVikingEventDataForMember = (scoutid) => {
    return vikingEventLookup.get(scoutid) || null;
  };

  return {
    attendanceData,
    vikingEventData,
    loading,
    error,
    loadVikingEventData,
    getVikingEventDataForMember,
  };
}