import { useState, useEffect } from 'react';
import { getSharedEventAttendance } from '../../../shared/services/api/api.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { isDemoMode } from '../../../config/demoMode.js';

export function useSharedAttendance(events, viewMode) {
  const [sharedAttendanceData, setSharedAttendanceData] = useState(null);
  const [loadingSharedAttendance, setLoadingSharedAttendance] = useState(false);

  // Check if there are shared events
  const hasSharedEvents = events && events.some(event => 
    event.shared === true || event.shared === 'true',
  );

  useEffect(() => {
    if (
      viewMode === 'sharedAttendance' &&
      hasSharedEvents &&
      !sharedAttendanceData &&
      !isDemoMode()
    ) {
      const loadSharedAttendance = async () => {
        setLoadingSharedAttendance(true);
        try {
          const token = await getToken();
          if (!token) {
            console.warn('No authentication token available for shared attendance');
            return;
          }

          // Get shared attendance for all shared events
          const sharedEvents = events.filter(event => 
            event.shared === true || event.shared === 'true',
          );

          const sharedAttendancePromises = sharedEvents.map(event =>
            getSharedEventAttendance(event.eventid, token),
          );

          const results = await Promise.allSettled(sharedAttendancePromises);
          
          // Combine all successful results
          const combinedData = results
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value)
            .flat();

          setSharedAttendanceData(combinedData);
        } catch (error) {
          console.error('Error loading shared attendance:', error);
          setSharedAttendanceData([]);
        } finally {
          setLoadingSharedAttendance(false);
        }
      };

      loadSharedAttendance();
    }
  }, [viewMode, hasSharedEvents, sharedAttendanceData, events]);

  return {
    sharedAttendanceData,
    loadingSharedAttendance,
    hasSharedEvents,
  };
}