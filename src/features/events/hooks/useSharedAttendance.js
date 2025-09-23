import { useState, useEffect } from 'react';
import { getSharedEventAttendance } from '../../../shared/services/api/api.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { isDemoMode } from '../../../config/demoMode.js';
import { UnifiedStorageService } from '../../../shared/services/storage/unifiedStorageService.js';

export function useSharedAttendance(events, viewMode) {
  const [sharedAttendanceData, setSharedAttendanceData] = useState(null);
  const [loadingSharedAttendance, setLoadingSharedAttendance] = useState(false);
  const [hasSharedEvents, setHasSharedEvents] = useState(false);

  // Helper function to check for shared events asynchronously
  const checkForSharedEvents = async (eventsList) => {
    if (!eventsList) return false;

    for (const event of eventsList) {
      const prefix = isDemoMode() ? 'demo_' : '';
      const sharedMetadataKey = `${prefix}viking_shared_metadata_${event.eventid}`;
      const sharedMetadata = await UnifiedStorageService.get(sharedMetadataKey);

      if (sharedMetadata) {
        try {
          const metadata = typeof sharedMetadata === 'string' ? JSON.parse(sharedMetadata) : sharedMetadata;
          if (metadata._isSharedEvent === true) {
            return true;
          }
        } catch (error) {
          console.warn('Failed to parse shared metadata for event:', event.eventid, error);
        }
      }
    }

    return false;
  };

  // Check for shared events when events change
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

  // Debug logging for shared events

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
            // In demo mode, load shared attendance data from storage
            const sharedEvents = [];
            for (const event of events) {
              const prefix = 'demo_';
              const sharedMetadataKey = `${prefix}viking_shared_metadata_${event.eventid}`;
              const sharedMetadata = await UnifiedStorageService.get(sharedMetadataKey);

              if (sharedMetadata) {
                try {
                  const metadata = typeof sharedMetadata === 'string' ? JSON.parse(sharedMetadata) : sharedMetadata;
                  if (metadata._isSharedEvent === true) {
                    sharedEvents.push(event);
                  }
                } catch (error) {
                  console.warn('Failed to parse shared metadata for event:', event.eventid, error);
                }
              }
            }

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
            let sharedEvent = null;
            for (const event of events) {
              const metadata = await UnifiedStorageService.get(`viking_shared_metadata_${event.eventid}`);
              if (metadata) {
                try {
                  const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
                  if (parsed._isSharedEvent === true) {
                    sharedEvent = event;
                    break;
                  }
                } catch (e) {
                  console.warn('Failed to parse shared metadata for event:', event.eventid, e);
                }
              }
            }

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
              }
            } catch (cacheError) {
              console.warn('Failed to parse cached shared attendance data:', cacheError);
            }

            const token = getToken();
            let sharedData = null;

            // Try API call if we have a token
            if (token) {
              try {
                sharedData = await getSharedEventAttendance(sharedEvent.eventid, sharedEvent.sectionid, token);
                
                // Cache the API response for offline use
                if (sharedData) {
                  localStorage.setItem(cacheKey, JSON.stringify(sharedData));
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
              const combinedData = [];
              const sharedMetadataKey = `viking_shared_metadata_${sharedEvent.eventid}`;
              const sharedMetadata = await UnifiedStorageService.get(sharedMetadataKey);
              
              if (sharedMetadata) {
                try {
                  const metadata = typeof sharedMetadata === 'string' ? JSON.parse(sharedMetadata) : sharedMetadata;
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