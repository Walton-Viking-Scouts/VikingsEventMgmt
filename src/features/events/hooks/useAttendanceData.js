import { useState, useEffect, useMemo } from 'react';
import { getVikingEventDataForEvents } from '../services/flexiRecordService.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { loadAllAttendanceFromDatabase } from '../../../shared/utils/attendanceHelpers_new.js';
import databaseService from '../../../shared/services/storage/database.js';

/**
 * Custom hook for loading and managing attendance data.
 * Reads all attendance (regular and shared) from the normalized IndexedDB store
 * via DatabaseService. Shared attendance records are identified by isSharedSection marker.
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

  useEffect(() => {
    loadAttendance();
  }, [events, members, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Loading attendance data from normalized store', {
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

        const regularAttendance = relevantAttendance.filter(r => !r.isSharedSection);
        const finalAttendance = [...regularAttendance];

        const regularSectionIds = new Set(regularAttendance.map(r => String(r.sectionid)));

        for (const event of events) {
          try {
            const eventAttendance = await databaseService.getAttendance(event.eventid);
            const sharedRecords = (eventAttendance || []).filter(r => r.isSharedSection === true);

            if (sharedRecords.length > 0) {
              const inaccessibleSectionRecords = sharedRecords
                .filter(attendee => !regularSectionIds.has(String(attendee.sectionid)))
                .map(attendee => ({
                  ...attendee,
                  eventid: event.eventid,
                  sectionid: Number(attendee.sectionid),
                  scoutid: Number(attendee.scoutid),
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

        const uniqueSectionIds = [...new Set(finalAttendance.map(r => Number(r.sectionid)))];
        const allMembers = await databaseService.getMembers(uniqueSectionIds);

        const memberMap = new Map(allMembers.map(m => [String(m.scoutid), m]));

        const combinedMembers = finalAttendance.map(record => {
          const member = memberMap.get(String(record.scoutid));
          return {
            ...member,
            ...record,
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
      logger.error('Error loading attendance from normalized store', {
        error: err.message,
        eventCount: events.length,
      }, LOG_CATEGORIES.COMPONENT);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


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

      const vikingEventMap = await getVikingEventDataForEvents(events, token, true);

      setVikingEventData(vikingEventMap);

    } catch (error) {
      logger.warn('Failed to load Viking Event data - supplementary data unavailable', {
        error: error.message,
        eventCount: events?.length,
      }, LOG_CATEGORIES.COMPONENT);
    }
  };

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

  /**
   * Gets Viking Event Management data for a specific member using optimized O(1) lookup
   * @param {number|string} scoutid - Scout identifier
   * @returns {Object|null} Viking event data or null
   */
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
