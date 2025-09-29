import { useState, useEffect, useMemo } from 'react';
import { getVikingEventDataForEvents } from '../services/flexiRecordService.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { isDemoMode } from '../../../config/demoMode.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import attendanceDataService from '../../../shared/services/data/attendanceDataService.js';

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

      // Use attendanceDataService as the single source of truth
      // This ensures consistency with dashboard and eliminates duplicate API calls
      logger.info('Loading attendance data via attendanceDataService', {
        eventCount: events.length,
        eventIds: events.map(e => e.eventid),
      }, LOG_CATEGORIES.COMPONENT);

      const allAttendanceData = await attendanceDataService.getAttendanceData(false);

      if (allAttendanceData && allAttendanceData.length > 0) {
        // Filter to only include events we're interested in
        const eventIds = new Set(events.map(e => e.eventid));
        const relevantAttendance = allAttendanceData.filter(record => eventIds.has(record.eventid));

        logger.info('Filtered attendance data for current events', {
          totalCached: allAttendanceData.length,
          relevantRecords: relevantAttendance.length,
          eventIds: Array.from(eventIds),
        }, LOG_CATEGORIES.COMPONENT);

        setAttendanceData(relevantAttendance);
      } else {
        // No cached data available - force refresh from API
        logger.info('No cached attendance data found, forcing refresh', {}, LOG_CATEGORIES.COMPONENT);

        const refreshedData = await attendanceDataService.getAttendanceData(true);

        if (refreshedData && refreshedData.length > 0) {
          const eventIds = new Set(events.map(e => e.eventid));
          const relevantAttendance = refreshedData.filter(record => eventIds.has(record.eventid));

          logger.info('Loaded fresh attendance data', {
            totalFresh: refreshedData.length,
            relevantRecords: relevantAttendance.length,
          }, LOG_CATEGORIES.COMPONENT);

          setAttendanceData(relevantAttendance);
        } else {
          setAttendanceData([]);
        }
      }

      // Load Viking Event Management data (fresh when possible, cache as fallback)
      await loadVikingEventData();

    } catch (err) {
      logger.error('Error loading attendance via attendanceDataService', {
        error: err.message,
        eventCount: events.length,
      }, LOG_CATEGORIES.COMPONENT);
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
      const vikingEventMap = await getVikingEventDataForEvents(events, token, true);
      
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

  // Enhanced attendance data with Viking Event data attached
  const enhancedAttendanceData = useMemo(() => {
    if (!attendanceData || attendanceData.length === 0 || vikingEventLookup.size === 0) {
      return attendanceData;
    }

    return attendanceData.map(record => {
      const vikingData = vikingEventLookup.get(record.scoutid);
      return {
        ...record,
        vikingEventData: vikingData || null,
      };
    });
  }, [attendanceData, vikingEventLookup]);

  // Get Viking Event Management data for a specific member using optimized O(1) lookup
  const getVikingEventDataForMember = (scoutid) => {
    return vikingEventLookup.get(scoutid) || null;
  };

  return {
    attendanceData: enhancedAttendanceData,
    vikingEventData,
    loading,
    error,
    loadVikingEventData,
    getVikingEventDataForMember,
  };
}