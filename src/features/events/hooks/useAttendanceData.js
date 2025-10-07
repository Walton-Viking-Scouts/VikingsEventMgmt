import { useState, useEffect, useMemo } from 'react';
import { getVikingEventDataForEvents } from '../services/flexiRecordService.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { loadAllAttendanceFromDatabase } from '../../../shared/utils/attendanceHelpers_new.js';
import databaseService from '../../../shared/services/storage/database.js';

/**
 * Custom hook for loading and managing attendance data
 *
 * @param {Array} events - Array of event data
 * @param {Array} members - Array of member data
 * @param {number} refreshTrigger - Optional trigger to force reload
 * @returns {Object} Hook state and functions
 */
export function useAttendanceData(events, members = [], refreshTrigger = 0) {
  const [attendanceData, setAttendanceData] = useState([]);
  const [mergedMembers, setMergedMembers] = useState(members);
  const [vikingEventData, setVikingEventData] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load attendance data when events change or refresh is triggered
  useEffect(() => {
    loadAttendance();
  }, [events, members, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Loading attendance data from IndexedDB', {
        eventCount: events.length,
        eventIds: events.map(e => e.eventid),
      }, LOG_CATEGORIES.COMPONENT);

      const allAttendanceData = await loadAllAttendanceFromDatabase();

      if (allAttendanceData && allAttendanceData.length > 0) {
        const eventIds = new Set(events.map(e => String(e.eventid)));
        const relevantAttendance = allAttendanceData.filter(record => eventIds.has(String(record.eventid)));

        logger.info('Filtered attendance data for current events', {
          totalCached: allAttendanceData.length,
          relevantRecords: relevantAttendance.length,
          eventIds: Array.from(eventIds),
        }, LOG_CATEGORIES.COMPONENT);

        const { UnifiedStorageService } = await import('../../../shared/services/storage/unifiedStorageService.js');

        // Start with regular attendance (has full data: Yes, No, Invited, Not Invited)
        const finalAttendance = [...relevantAttendance];

        // Check for shared attendance to add inaccessible sections
        // Create Set of sectionids we have regular attendance for (across all events)
        // Convert to strings to avoid type mismatch issues
        const regularSectionIds = new Set(relevantAttendance.map(r => String(r.sectionid)));

        for (const event of events) {
          const sharedKey = `viking_shared_attendance_${event.eventid}_${event.sectionid}_offline`;
          try {
            const sharedData = await UnifiedStorageService.get(sharedKey);
            const sharedAttendance = sharedData?.items || sharedData?.combined_attendance;

            if (sharedAttendance && Array.isArray(sharedAttendance) && sharedAttendance.length > 0) {
              // Only add shared attendance from sections we DON'T have regular data for
              const inaccessibleSectionRecords = sharedAttendance
                .filter(attendee => !regularSectionIds.has(String(attendee.sectionid)))
                .map(attendee => ({
                  ...attendee,
                  eventid: event.eventid,
                  sectionid: Number(attendee.sectionid), // Normalize to number
                  scoutid: Number(attendee.scoutid), // Normalize to number
                  firstname: attendee.firstname || attendee.first_name,
                  lastname: attendee.lastname || attendee.last_name,
                  _isSharedSection: true,
                }));

              finalAttendance.push(...inaccessibleSectionRecords);
            }
          } catch (sharedError) {
            logger.debug('No shared attendance found for event', {
              eventId: event.eventid,
              error: sharedError.message,
            }, LOG_CATEGORIES.COMPONENT);
          }
        }

        // Load member data using the SAME working function as Sections page
        // This ensures contact_groups and all other fields are properly loaded
        const uniqueSectionIds = [...new Set(finalAttendance.map(r => Number(r.sectionid)))];
        const allMembers = await databaseService.getMembers(uniqueSectionIds);

        // Create map for quick lookup and merge with attendance data
        const memberMap = new Map(allMembers.map(m => [String(m.scoutid), m]));

        // Build combined members with attendance data overlaying member data
        const combinedMembers = finalAttendance.map(record => {
          const member = memberMap.get(String(record.scoutid));
          return {
            ...member, // Member data from database (includes contact_groups, sections, etc.)
            ...record, // Attendance record fields (eventid, attendance status, etc.)
          };
        });

        setMergedMembers(combinedMembers);
        setAttendanceData(finalAttendance);
      } else {
        setMergedMembers(members);
        setAttendanceData([]);
      }

      await loadVikingEventData();

    } catch (err) {
      logger.error('Error loading attendance from IndexedDB', {
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
    members: mergedMembers,
    vikingEventData,
    loading,
    error,
    loadVikingEventData,
    getVikingEventDataForMember,
  };
}

export default useAttendanceData;