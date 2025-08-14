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
      
      
      // Validate event data integrity
      const hasInvalidEvents = events.some(event => !event.sectionid || event.termid === null || event.termid === undefined);
      if (events.length > 0 && hasInvalidEvents) {
        console.error('🚫 Invalid events detected:', events.filter(event => !event.sectionid || event.termid === null || event.termid === undefined));
        setError('Invalid event data detected. Please refresh the page to reload.');
        return;
      }
      
      const allAttendance = [];
      
      // Check cache for attendance data using proper cache keys
      for (const event of events) {
        // Validate that event has required fields (should be included from eventDashboardHelpers)
        if (!event.sectionid || !event.termid || !event.eventid) {
          console.warn('Event missing required fields:', {
            name: event.name,
            sectionid: event.sectionid,
            termid: event.termid,
            eventid: event.eventid,
            availableKeys: Object.keys(event),
          });
          continue; // Skip this event
        }
        
        // Check if we have cached attendance data for this specific event
        const cacheKey = `viking_attendance_${event.sectionid}_${event.termid}_${event.eventid}_offline`;
        let cachedAttendance = null;
        
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            cachedAttendance = JSON.parse(cached);
            console.log(`Found cached attendance for event ${event.name}:`, cachedAttendance.length, 'records');
          }
        } catch (error) {
          console.warn('Failed to parse cached attendance data:', error);
        }
        
        if (cachedAttendance && Array.isArray(cachedAttendance)) {
          // Use cached attendance data
          const attendanceWithEvent = cachedAttendance.map(record => ({
            ...record,
            eventid: event.eventid,
            eventname: event.name,
            eventdate: event.startdate,
            sectionid: event.sectionid,
            sectionname: event.sectionname,
          }));
          allAttendance.push(...attendanceWithEvent);
        } else {
          // Fallback to API call if no cached data
          // NOTE: termid should already be in event object from eventDashboardHelpers
          try {
            const token = getToken();
            if (!token) {
              console.warn(`No token available for API call for event ${event.name}`);
              continue;
            }
            
            const attendance = await getEventAttendance(
              event.sectionid, 
              event.eventid, 
              event.termid, // Use termid from event (no need to fetch again)
              token,
            );
            
            if (attendance && Array.isArray(attendance)) {
              // Add event info to each attendance record
              const attendanceWithEvent = attendance.map(record => ({
                ...record,
                eventid: event.eventid,
                eventname: event.name,
                eventdate: event.startdate,
                sectionid: event.sectionid,
                sectionname: event.sectionname,
              }));
              allAttendance.push(...attendanceWithEvent);
            }
          } catch (eventError) {
            console.warn(`Error loading attendance for event ${event.name}:`, eventError);
          }
        }
      }
      
      setAttendanceData(allAttendance);
      
      // Load Viking Event Management data (fresh when possible, cache as fallback)
      await loadVikingEventData();
      
    } catch (err) {
      console.error('Error loading attendance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load Viking Event Management flexirecord data (fresh preferred, cache fallback)
  const loadVikingEventData = async () => {
    try {
      const token = getToken();
      
      // Enhanced logging for debugging deployed environment issues
      console.log('useAttendanceData: Loading Viking Event data', {
        eventsCount: events?.length || 0,
        hasToken: !!token,
        tokenLength: token?.length || 0,
        eventSections: events?.map(e => ({ sectionid: e.sectionid, termid: e.termid })) || [],
      });
      
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
      
      console.log('useAttendanceData: Viking Event data loaded successfully', {
        sectionsWithData: Array.from(vikingEventMap.entries())
          .filter(([_, data]) => data !== null)
          .map(([sectionId, _]) => sectionId),
        totalSections: vikingEventMap.size,
      });
      
      setVikingEventData(vikingEventMap);
      
    } catch (error) {
      console.error('useAttendanceData: Error loading Viking Event Management data', {
        error: error.message,
        stack: error.stack,
        eventsCount: events?.length || 0,
      });
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