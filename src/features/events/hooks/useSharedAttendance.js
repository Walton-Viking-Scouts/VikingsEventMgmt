import { useState, useEffect } from 'react';
import { getSharedEventAttendance } from '../../../shared/services/api/api.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { isDemoMode } from '../../../config/demoMode.js';

/**
 *
 * @param events
 * @param viewMode
 */
export function useSharedAttendance(events, viewMode) {
  const [sharedAttendanceData, setSharedAttendanceData] = useState(null);
  const [loadingSharedAttendance, setLoadingSharedAttendance] = useState(false);

  // Check if there are shared events by looking for shared metadata in localStorage
  const hasSharedEvents = events && events.some(event => {
    const prefix = isDemoMode() ? 'demo_' : '';
    const sharedMetadataKey = `${prefix}viking_shared_metadata_${event.eventid}`;
    const sharedMetadata = localStorage.getItem(sharedMetadataKey);
    
    if (sharedMetadata) {
      try {
        const metadata = JSON.parse(sharedMetadata);
        return metadata._isSharedEvent === true;
      } catch (error) {
        console.warn('Failed to parse shared metadata for event:', event.eventid, error);
        return false;
      }
    }
    
    return false;
  });

  // Debug logging for shared events
  console.log('🐛 SHARED EVENTS DEBUG:', {
    eventsCount: events?.length || 0,
    hasSharedEvents,
    eventDetails: events?.map(e => {
      const prefix = isDemoMode() ? 'demo_' : '';
      const sharedMetadataKey = `${prefix}viking_shared_metadata_${e.eventid}`;
      const sharedMetadata = localStorage.getItem(sharedMetadataKey);
      let isShared = false;
      
      if (sharedMetadata) {
        try {
          const metadata = JSON.parse(sharedMetadata);
          isShared = metadata._isSharedEvent === true;
        } catch (error) {
          // Ignore parse errors for debug logging
        }
      }
      
      return {
        name: e.eventname,
        eventid: e.eventid,
        sharedMetadataKey,
        hasMetadata: !!sharedMetadata,
        isShared,
      };
    }) || [],
  });

  useEffect(() => {
    console.log('🐛 useSharedAttendance useEffect triggered:', {
      viewMode,
      hasSharedEvents,
      sharedAttendanceData: !!sharedAttendanceData,
      isDemoMode: isDemoMode(),
      shouldLoad: viewMode === 'sharedAttendance' && hasSharedEvents && (!sharedAttendanceData || (Array.isArray(sharedAttendanceData) && sharedAttendanceData.length === 0)),
    });
    
    if (
      viewMode === 'sharedAttendance' &&
      hasSharedEvents &&
      !loadingSharedAttendance &&
      (!sharedAttendanceData || (Array.isArray(sharedAttendanceData) && sharedAttendanceData.length === 0))
    ) {
      console.log('🐛 Loading shared attendance data...');
      const loadSharedAttendance = async () => {
        setLoadingSharedAttendance(true);
        try {
          if (isDemoMode()) {
            console.log('🐛 Demo mode: Loading shared attendance from localStorage');
            // In demo mode, load shared attendance data from localStorage
            const sharedEvents = events.filter(event => {
              const prefix = 'demo_';
              const sharedMetadataKey = `${prefix}viking_shared_metadata_${event.eventid}`;
              const sharedMetadata = localStorage.getItem(sharedMetadataKey);
              
              if (sharedMetadata) {
                try {
                  const metadata = JSON.parse(sharedMetadata);
                  return metadata._isSharedEvent === true;
                } catch (error) {
                  console.warn('Failed to parse shared metadata for event:', event.eventid, error);
                  return false;
                }
              }
              
              return false;
            });

            // Load cached shared attendance data for demo mode
            const combinedData = [];
            sharedEvents.forEach(event => {
              const sharedAttendanceKey = `demo_viking_shared_attendance_${event.eventid}_${event.sectionid}_offline`;
              const sharedAttendanceData = localStorage.getItem(sharedAttendanceKey);
              
              if (sharedAttendanceData) {
                try {
                  const attendanceData = JSON.parse(sharedAttendanceData);
                  // Handle both direct array format and object with items property
                  if (Array.isArray(attendanceData)) {
                    combinedData.push(...attendanceData);
                  } else if (attendanceData && Array.isArray(attendanceData.items)) {
                    combinedData.push(...attendanceData.items);
                  }
                } catch (error) {
                  console.warn('Failed to parse shared attendance data for event:', event.eventid, error);
                }
              } else {
                // If shared attendance data doesn't exist, try to generate it from individual section data
                console.log('🐛 No shared attendance data found, attempting to generate from section data for event:', event.eventid);
                const sharedMetadataKey = `demo_viking_shared_metadata_${event.eventid}`;
                const sharedMetadata = localStorage.getItem(sharedMetadataKey);
                
                if (sharedMetadata) {
                  try {
                    const metadata = JSON.parse(sharedMetadata);
                    if (metadata._allSections) {
                      metadata._allSections.forEach(section => {
                        if (section.sectionid && section.eventid) {
                          const sectionAttendanceKey = `demo_viking_attendance_${section.eventid}_offline`;
                          const sectionAttendanceData = localStorage.getItem(sectionAttendanceKey);
                          
                          if (sectionAttendanceData) {
                            try {
                              const sectionData = JSON.parse(sectionAttendanceData);
                              if (Array.isArray(sectionData)) {
                                combinedData.push(...sectionData);
                              }
                            } catch (error) {
                              console.warn('Failed to parse section attendance data for section:', section.sectionid, error);
                            }
                          }
                        }
                      });
                    }
                  } catch (error) {
                    console.warn('Failed to parse shared metadata for event:', event.eventid, error);
                  }
                }
              }
            });

            setSharedAttendanceData(combinedData);
          } else {
            // Production mode - first try cache, then API, then generate from section data
            
            // Find the shared event (the one that has shared metadata)
            const sharedEvent = events.find(event => {
              const metadata = localStorage.getItem(`viking_shared_metadata_${event.eventid}`);
              if (metadata) {
                try {
                  const parsed = JSON.parse(metadata);
                  return parsed._isSharedEvent === true;
                } catch (e) {
                  return false;
                }
              }
              return false;
            });

            if (!sharedEvent) {
              console.warn('No shared event found');
              setSharedAttendanceData([]);
              return;
            }

            // First try to load from cache for offline support
            const cacheKey = `viking_shared_attendance_${sharedEvent.eventid}_${sharedEvent.sectionid}_offline`;
            let cachedData = null;

            try {
              const cached = localStorage.getItem(cacheKey);
              if (cached) {
                cachedData = JSON.parse(cached);
                console.log('🐛 Found cached shared attendance data');
              }
            } catch (cacheError) {
              console.warn('Failed to parse cached shared attendance data:', cacheError);
            }

            const token = getToken();
            let sharedData = null;

            // Try API call if we have a token
            if (token) {
              try {
                console.log('🐛 Fetching shared attendance from API...', {
                  eventId: sharedEvent.eventid,
                  sectionId: sharedEvent.sectionid,
                });
                sharedData = await getSharedEventAttendance(sharedEvent.eventid, sharedEvent.sectionid, token);
                
                // Cache the API response for offline use
                if (sharedData) {
                  localStorage.setItem(cacheKey, JSON.stringify(sharedData));
                  console.log('🐛 Cached shared attendance data for offline use');
                }
              } catch (apiError) {
                console.warn('API call failed, will use cached data if available:', apiError);
                // If API fails, fallback to cached data
                if (cachedData) {
                  sharedData = cachedData;
                } else {
                  console.warn('No cached data available, will attempt to generate from section data');
                }
              }
            } else {
              // No token - use cached data or try to generate
              console.warn('No authentication token available for shared attendance');
              if (cachedData) {
                sharedData = cachedData;
              } else {
                console.warn('No cached data available, will attempt to generate from section data');
              }
            }

            // If we still don't have data, try to generate it from section data
            if (!sharedData) {
              console.log('🐛 Attempting to generate shared attendance from section data');
              const combinedData = [];
              const sharedMetadataKey = `viking_shared_metadata_${sharedEvent.eventid}`;
              const sharedMetadata = localStorage.getItem(sharedMetadataKey);
              
              if (sharedMetadata) {
                try {
                  const metadata = JSON.parse(sharedMetadata);
                  if (metadata._allSections) {
                    metadata._allSections.forEach(section => {
                      if (section.receiving_eventid && section.receiving_eventid !== '0') {
                        const sectionAttendanceKey = `viking_attendance_${section.receiving_eventid}_offline`;
                        const sectionAttendanceData = localStorage.getItem(sectionAttendanceKey);
                        
                        if (sectionAttendanceData) {
                          try {
                            const sectionData = JSON.parse(sectionAttendanceData);
                            if (Array.isArray(sectionData)) {
                              combinedData.push(...sectionData);
                            }
                          } catch (error) {
                            console.warn('Failed to parse section attendance data for section:', section.sectionid, error);
                          }
                        }
                      }
                    });
                  }
                } catch (error) {
                  console.warn('Failed to parse shared metadata for event:', sharedEvent.eventid, error);
                }
              }
              
              if (combinedData.length > 0) {
                console.log('🐛 Successfully generated shared attendance from section data:', combinedData.length, 'records');
                // Cache the generated data for future use
                const generatedSharedData = { items: combinedData };
                localStorage.setItem(cacheKey, JSON.stringify(generatedSharedData));
                setSharedAttendanceData(combinedData);
                return;
              }
            }

            // Normalize data shape - UI expects array but API may return object with items
            if (sharedData) {
              const normalised = sharedData?.items
                ? sharedData.items
                : sharedData?.combined_attendance || [];
              
              setSharedAttendanceData(normalised);
            } else {
              console.warn('No shared attendance data available from any source');
              setSharedAttendanceData([]);
            }
          }
        } catch (error) {
          console.error('Error loading shared attendance:', error);
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