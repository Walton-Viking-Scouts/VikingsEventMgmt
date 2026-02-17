import { useState, useEffect } from 'react';
import { getSharedEventAttendance } from '../../../shared/services/api/api/events.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { isDemoMode } from '../../../config/demoMode.js';
import databaseService from '../../../shared/services/storage/database.js';
import { safeGetItem } from '../../../shared/utils/storageUtils.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

/**
 * Hook for loading shared attendance data.
 * Reads shared event metadata from the normalized shared_event_metadata store
 * via DatabaseService. Falls back to demo localStorage reads in demo mode.
 *
 * @param {Array} events - Array of event objects
 * @param {string} viewMode - Current view mode
 * @returns {Object} Shared attendance state
 */
export function useSharedAttendance(events, viewMode) {
  const [sharedAttendanceData, setSharedAttendanceData] = useState(null);
  const [loadingSharedAttendance, setLoadingSharedAttendance] = useState(false);
  const [hasSharedEvents, setHasSharedEvents] = useState(false);

  /**
   * Checks whether any event in the list has shared event metadata
   * @param {Array} eventsList - Events to check
   * @returns {Promise<boolean>} True if shared events exist
   */
  const checkForSharedEvents = async (eventsList) => {
    if (!eventsList) return false;

    if (isDemoMode()) {
      for (const event of eventsList) {
        const sharedMetadataKey = `demo_viking_shared_metadata_${event.eventid}`;
        const sharedMetadata = safeGetItem(sharedMetadataKey);
        if (sharedMetadata) {
          try {
            const metadata = typeof sharedMetadata === 'string' ? JSON.parse(sharedMetadata) : sharedMetadata;
            if (metadata._isSharedEvent === true) {
              return true;
            }
          } catch (parseError) {
            logger.debug('Failed to parse shared attendance data', {
              error: parseError.message,
            }, LOG_CATEGORIES.COMPONENT);
          }
        }
      }
      return false;
    }

    for (const event of eventsList) {
      const metadata = await databaseService.getSharedEventMetadata(event.eventid);
      if (metadata && metadata.isSharedEvent === true) {
        return true;
      }
    }

    return false;
  };

  useEffect(() => {
    let isMounted = true;

    const updateSharedEventsStatus = async () => {
      const hasShared = await checkForSharedEvents(events);
      if (isMounted) {
        setHasSharedEvents(hasShared);
      }
    };

    updateSharedEventsStatus();

    return () => {
      isMounted = false;
    };
  }, [events]);

  useEffect(() => {
    if (
      viewMode === 'sharedAttendance' &&
      hasSharedEvents &&
      !loadingSharedAttendance &&
      (!sharedAttendanceData || (Array.isArray(sharedAttendanceData) && sharedAttendanceData.length === 0))
    ) {
      const loadSharedAttendance = async () => {
        setLoadingSharedAttendance(true);
        try {
          if (isDemoMode()) {
            const combinedData = [];
            for (const event of events) {
              const sharedAttendanceKey = `demo_viking_shared_attendance_${event.eventid}_${event.sectionid}_offline`;
              const sharedAttendanceRaw = safeGetItem(sharedAttendanceKey);

              if (sharedAttendanceRaw) {
                try {
                  const attendanceData = typeof sharedAttendanceRaw === 'string' ? JSON.parse(sharedAttendanceRaw) : sharedAttendanceRaw;
                  if (Array.isArray(attendanceData)) {
                    combinedData.push(...attendanceData);
                  } else if (attendanceData && Array.isArray(attendanceData.items)) {
                    combinedData.push(...attendanceData.items);
                  }
                } catch (parseError) {
                  logger.debug('Failed to parse shared attendance data', {
                    error: parseError.message,
                  }, LOG_CATEGORIES.COMPONENT);
                }
              }
            }
            setSharedAttendanceData(combinedData);
          } else {
            let sharedEvent = null;
            for (const event of events) {
              const metadata = await databaseService.getSharedEventMetadata(event.eventid);
              if (metadata && metadata.isSharedEvent === true) {
                sharedEvent = event;
                break;
              }
            }

            if (!sharedEvent) {
              setSharedAttendanceData([]);
              return;
            }

            const sharedRecords = await databaseService.getAttendance(sharedEvent.eventid);
            const cachedShared = (sharedRecords || []).filter(r => r.isSharedSection === true);

            const token = getToken();
            let sharedData = null;

            if (token) {
              try {
                sharedData = await getSharedEventAttendance(sharedEvent.eventid, sharedEvent.sectionid, token);
              } catch (apiError) {
                logger.debug('Shared attendance API call failed, using cached', {
                  eventId: sharedEvent.eventid,
                  error: apiError.message,
                }, LOG_CATEGORIES.COMPONENT);
                if (cachedShared.length > 0) {
                  setSharedAttendanceData(cachedShared);
                  return;
                }
              }
            } else if (cachedShared.length > 0) {
              setSharedAttendanceData(cachedShared);
              return;
            }

            if (sharedData) {
              const normalised = sharedData?.items
                ? sharedData.items
                : sharedData?.combined_attendance || [];

              setSharedAttendanceData(normalised);
            } else if (cachedShared.length > 0) {
              setSharedAttendanceData(cachedShared);
            } else {
              setSharedAttendanceData([]);
            }
          }
        } catch (error) {
          logger.warn('Failed to load shared attendance', {
            error: error.message,
          }, LOG_CATEGORIES.COMPONENT);
          setSharedAttendanceData([]);
        } finally {
          setLoadingSharedAttendance(false);
        }
      };

      loadSharedAttendance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, hasSharedEvents, events]);

  return {
    sharedAttendanceData,
    loadingSharedAttendance,
    hasSharedEvents,
  };
}
