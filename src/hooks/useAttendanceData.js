import { useState, useEffect, useMemo } from 'react';
import { getEventAttendance, fetchMostRecentTermId } from '../services/api.js';
import { getVikingEventDataForEvents } from '../services/flexiRecordService.js';
import { getToken } from '../services/auth.js';

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
      
      const allAttendance = [];
      
      // Check if events already have cached attendance data
      for (const event of events) {
        if (event.attendanceData && Array.isArray(event.attendanceData)) {
          // Use cached attendance data
          const attendanceWithEvent = event.attendanceData.map(record => ({
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
          try {
            const token = getToken();
            
            // If termid is missing, get it from API
            let termId = event.termid;
            if (!termId) {
              termId = await fetchMostRecentTermId(event.sectionid, token);
            }
            
            if (termId) {
              const attendance = await getEventAttendance(
                event.sectionid, 
                event.eventid, 
                termId, 
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
            } else {
              console.warn(`No termid found for event ${event.name} in section ${event.sectionid}`);
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
      
      // Load Viking Event Management data for all sections
      // getVikingEventDataForEvents handles section-term combinations correctly
      const vikingEventMap = await getVikingEventDataForEvents(events, token);
      setVikingEventData(vikingEventMap);
      
    } catch (error) {
      console.warn('Error loading Viking Event Management data:', error);
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