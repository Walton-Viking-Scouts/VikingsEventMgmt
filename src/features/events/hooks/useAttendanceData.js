import { useState, useEffect, useMemo } from 'react';
import { getVikingEventDataForEvents } from '../services/flexiRecordService.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { loadAllAttendanceFromDatabase } from '../../../shared/utils/attendanceHelpers_new.js';

/**
 * Custom hook for loading and managing attendance data
 *
 * @param {Array} events - Array of event data
 * @param {number} refreshTrigger - Optional trigger to force reload
 * @returns {Object} Hook state and functions
 */
export function useAttendanceData(events, refreshTrigger = 0) {
  const [attendanceData, setAttendanceData] = useState([]);
  const [vikingEventData, setVikingEventData] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load attendance data when events change or refresh is triggered
  useEffect(() => {
    loadAttendance();
  }, [events, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

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

        // Load shared attendance and merge with regular attendance
        const { UnifiedStorageService } = await import('../../../shared/services/storage/unifiedStorageService.js');
        const mergedAttendance = [...relevantAttendance];

        console.log('🔍 useAttendanceData: Checking for shared attendance', {
          eventCount: events.length,
          events: events.map(e => ({ id: e.eventid, section: e.sectionid, name: e.name })),
        });

        for (const event of events) {
          const sharedKey = `viking_shared_attendance_${event.eventid}_${event.sectionid}_offline`;
          try {
            const sharedData = await UnifiedStorageService.get(sharedKey);
            const sharedAttendance = sharedData?.items || sharedData?.combined_attendance;

            console.log('🔍 useAttendanceData: Shared data check', {
              eventId: event.eventid,
              eventName: event.name,
              sharedKey,
              hasSharedData: !!sharedData,
              sharedDataKeys: sharedData ? Object.keys(sharedData) : [],
              sharedAttendanceLength: sharedAttendance?.length || 0,
            });

            if (sharedAttendance && Array.isArray(sharedAttendance)) {
              // Get sections from regular attendance to exclude duplicates
              const regularSections = new Set(
                relevantAttendance
                  .filter(r => r.eventid === event.eventid)
                  .map(r => r.sectionid),
              );

              // Get unique scout IDs from regular attendance for this event
              const regularScoutIds = new Set(
                relevantAttendance
                  .filter(r => r.eventid === event.eventid)
                  .map(r => String(r.scoutid)),
              );

              // Create synthetic records for shared attendance (only "Yes" attendees from sections we don't have)
              const syntheticRecords = sharedAttendance
                .filter(attendee => {
                  const isYes = attendee.attending === 'Yes';
                  const notInRegular = !regularScoutIds.has(String(attendee.scoutid));
                  const fromOtherSection = !regularSections.has(attendee.sectionid);
                  return isYes && notInRegular && fromOtherSection;
                })
                .map(attendee => ({
                  ...attendee,
                  scoutid: `synthetic-${attendee.scoutid}`,
                  eventid: event.eventid,
                }));

              mergedAttendance.push(...syntheticRecords);

              console.log('✅ useAttendanceData: Merged shared attendance', {
                eventId: event.eventid,
                eventName: event.name,
                sharedTotalYes: sharedAttendance.filter(a => a.attending === 'Yes').length,
                regularSections: [...regularSections],
                regularScoutCount: regularScoutIds.size,
                syntheticCount: syntheticRecords.length,
                totalAttendance: mergedAttendance.length,
                syntheticSections: [...new Set(syntheticRecords.map(r => r.sectionname))],
                sampleSharedRecord: sharedAttendance.filter(a => a.attending === 'Yes')[0],
                sampleSyntheticRecord: syntheticRecords[0],
              });
            }
          } catch (sharedError) {
            console.log('⚠️ useAttendanceData: No shared attendance', {
              eventId: event.eventid,
              eventName: event.name,
              error: sharedError.message,
            });
          }
        }

        console.log('✅ useAttendanceData: Final merged attendance', {
          regularCount: relevantAttendance.length,
          totalCount: mergedAttendance.length,
          syntheticCount: mergedAttendance.length - relevantAttendance.length,
        });

        setAttendanceData(mergedAttendance);
      } else {
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

export default useAttendanceData;