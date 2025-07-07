// API service for Viking Event Management Mobile
// React version of the original API module with enhanced mobile support and offline capabilities

import databaseService from './database.js';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { sentryUtils, logger } from './sentry.js';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://vikings-osm-backend.onrender.com';

console.log('Using Backend URL:', BACKEND_URL);

// Network status checking
let isOnline = true;

async function checkNetworkStatus() {
  if (Capacitor.isNativePlatform()) {
    const status = await Network.getStatus();
    isOnline = status.connected;
  } else {
    isOnline = navigator.onLine;
  }
  return isOnline;
}

// Listen for network changes
if (Capacitor.isNativePlatform()) {
  Network.addListener('networkStatusChange', status => {
    isOnline = status.connected;
    console.log('Network status changed:', status.connected ? 'Online' : 'Offline');
  });
} else {
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('Network status: Online');
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    console.log('Network status: Offline');
  });
}

// Check if OSM API access is blocked
function checkIfBlocked() {
  if (sessionStorage.getItem('osm_blocked') === 'true') {
    throw new Error('OSM API access has been blocked. Please contact the system administrator.');
  }
}

// Enhanced rate limit monitoring
function logRateLimitInfo(responseData, apiName) {
  if (responseData && responseData._rateLimitInfo) {
    const info = responseData._rateLimitInfo;
        
    if (info.osm) {
      const osm = info.osm;
      const percentUsed = osm.limit > 0 ? ((osm.limit - osm.remaining) / osm.limit * 100).toFixed(1) : 0;
            
      console.group(`🔄 ${apiName} Rate Limit Status`);
      console.log('📊 OSM API:', {
        remaining: `${osm.remaining}/${osm.limit}`,
        percentUsed: `${percentUsed}%`,
        window: osm.window || 'per hour',
        available: osm.available,
        rateLimited: osm.rateLimited || false,
      });
            
      if (osm.remaining < 20 && osm.limit > 0) {
        console.warn(`⚠️ OSM rate limit warning for ${apiName}: Only ${osm.remaining} requests remaining (${percentUsed}% used)!`);
      }
            
      if (osm.remaining < 10 && osm.limit > 0) {
        console.error(`🚨 CRITICAL: Only ${osm.remaining} OSM requests remaining for ${apiName}! (${percentUsed}% used)`);
      }
    }
        
    if (info.backend) {
      const backend = info.backend;
      const backendPercentUsed = backend.limit > 0 ? (((backend.limit - backend.remaining) / backend.limit) * 100).toFixed(1) : 0;
            
      console.log('🖥️ Backend API:', {
        remaining: `${backend.remaining}/${backend.limit}`,
        percentUsed: `${backendPercentUsed}%`,
        window: backend.window || 'per minute',
      });
    }
        
    console.groupEnd();
  } else {
    console.log(`📊 ${apiName}: No rate limit info available`);
  }
}

// Enhanced API response handler with Sentry monitoring
async function handleAPIResponseWithRateLimit(response, apiName) {
  // Add breadcrumb for API call
  sentryUtils.addBreadcrumb({
    type: 'http',
    level: 'info',
    message: `API call: ${apiName}`,
    data: {
      method: response.request?.method || 'GET',
      url: response.url,
      status_code: response.status,
    },
  });

  if (response.status === 429) {
    const errorData = await response.json().catch(() => ({}));
        
    // Log rate limiting to Sentry
    logger.warn(logger.fmt`Rate limit hit for API: ${apiName}`, {
      api: apiName,
      status: response.status,
      retryAfter: errorData.rateLimitInfo?.retryAfter,
    });
        
    if (errorData.rateLimitInfo) {
      const retryAfter = errorData.rateLimitInfo.retryAfter || 'unknown time';
      console.warn(`🚫 ${apiName} rate limited by OSM. Backend managing retry. Wait: ${retryAfter}s`);
            
      if (errorData.rateLimitInfo.retryAfter) {
        throw new Error(`OSM API rate limit exceeded. Please wait ${errorData.rateLimitInfo.retryAfter} seconds before trying again.`);
      } else {
        throw new Error('OSM API rate limit exceeded. Please wait before trying again.');
      }
    } else {
      console.warn(`🚫 ${apiName} rate limited. Backend managing request flow.`);
      throw new Error('Rate limited. The backend is managing request flow to prevent blocking.');
    }
  }
    
  if (response.status === 401 || response.status === 403) {
    console.warn(`🔐 Authentication error on ${apiName}: ${response.status}`);
    // Will be handled by auth service
    const error = new Error('Authentication failed');
    error.status = response.status;
    throw error;
  }
    
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        
    if (errorMessage && typeof errorMessage === 'string') {
      const errorLower = errorMessage.toLowerCase();
      if (errorLower.includes('blocked') || errorLower.includes('permanently blocked')) {
        console.error(`🚨 CRITICAL: OSM API BLOCKED on ${apiName}!`, errorMessage);
        sessionStorage.setItem('osm_blocked', 'true');
        throw new Error(`OSM API BLOCKED: ${errorMessage}`);
      }
    }
        
    console.error(`❌ ${apiName} API error:`, errorMessage);
    throw new Error(`${apiName} failed: ${errorMessage}`);
  }
    
  try {
    const data = await response.json();
    logRateLimitInfo(data, apiName);
    return data;
  } catch {
    console.error(`❌ ${apiName} returned invalid JSON`);
    throw new Error(`${apiName} returned invalid response`);
  }
}

// API functions
export async function getTerms(token) {
  try {
    // Check network status first
    await checkNetworkStatus();
    
    // If offline, get from localStorage
    if (!isOnline) {
      console.log('Offline - getting terms from localStorage');
      const cachedTerms = localStorage.getItem('viking_terms_offline');
      return cachedTerms ? JSON.parse(cachedTerms) : {};
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-terms`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await handleAPIResponseWithRateLimit(response, 'getTerms');
    const terms = data || {};
    
    // Cache terms data for offline use
    localStorage.setItem('viking_terms_offline', JSON.stringify(terms));
    
    return terms;

  } catch (error) {
    console.error('Error fetching terms:', error);
    
    // If online request fails, try localStorage as fallback
    if (isOnline) {
      console.log('Online request failed - trying localStorage as fallback');
      try {
        const cachedTerms = localStorage.getItem('viking_terms_offline');
        return cachedTerms ? JSON.parse(cachedTerms) : {};
      } catch (cacheError) {
        console.error('Cache fallback also failed:', cacheError);
      }
    }
    
    throw error;
  }
}

export async function getMostRecentTermId(sectionId, token) {
  try {
    const terms = await getTerms(token);
    if (!terms || !terms[sectionId]) {
      console.warn(`No terms found for section ${sectionId}`);
      return null;
    }

    const mostRecentTerm = terms[sectionId].reduce((latest, term) => {
      const termEndDate = new Date(term.enddate);
      const latestEndDate = latest ? new Date(latest.enddate) : new Date(0);
      return termEndDate > latestEndDate ? term : latest;
    }, null);

    if (!mostRecentTerm) {
      console.warn(`No valid term found for section ${sectionId}`);
      return null;
    }

    console.log(`Most recent term found for section ${sectionId}:`, mostRecentTerm);
    return mostRecentTerm.termid;

  } catch (error) {
    console.error(`Error fetching most recent term ID for section ${sectionId}:`, error);
    throw error;
  }
}

export async function getUserRoles(token) {
  return sentryUtils.startSpan(
    {
      op: 'http.client',
      name: 'GET /api/ext/members/contact/grid/?action=getUserRoles',
    },
    async (span) => {
      try {
        // Add context to span
        span.setAttribute('api.endpoint', 'getUserRoles');
        span.setAttribute('offline_capable', true);
                
        logger.debug('Fetching user roles', { hasToken: !!token });
                
        // Check network status first
        await checkNetworkStatus();
        span.setAttribute('network.online', isOnline);
                
        // If offline, try to get from local database
        if (!isOnline) {
          logger.info('Offline mode - retrieving sections from local database');
          span.setAttribute('data.source', 'local_database');
                    
          const sections = await databaseService.getSections();
          return sections;
        }

        if (!token) {
          throw new Error('No authentication token');
        }

        span.setAttribute('data.source', 'api');
        logger.debug('Making API request for user roles');

        const response = await fetch(`${BACKEND_URL}/get-user-roles`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await handleAPIResponseWithRateLimit(response, 'getUserRoles');

        if (!data || typeof data !== 'object') {
          logger.warn('Invalid data received from getUserRoles API');
          return [];
        }

        const sections = Object.keys(data)
          .filter(key => !isNaN(key))
          .map(key => data[key])
          .filter(item => item && typeof item === 'object')
          .map(item => ({
            sectionid: item.sectionid,
            sectionname: item.sectionname,
            section: item.section,
            sectiontype: item.section, // Map section to sectiontype for database
            isDefault: item.isDefault === '1',
            permissions: item.permissions,
          }));

        // Save to local database when online
        if (sections.length > 0) {
          await databaseService.saveSections(sections);
          logger.info(logger.fmt`Saved ${sections.length} sections to local database`);
        }

        span.setAttribute('sections.count', sections.length);
        return sections;

      } catch (error) {
        logger.error('Error fetching user roles', { 
          error: error.message,
          isOnline,
          hasToken: !!token, 
        });
                
        // Capture exception with context
        sentryUtils.captureException(error, {
          api: {
            endpoint: 'getUserRoles',
            online: isOnline,
            hasToken: !!token,
          },
        });
                
        // If online request fails, try local database as fallback
        if (isOnline) {
          logger.info('Online request failed - trying local database as fallback');
          span.setAttribute('fallback.used', true);
                    
          try {
            const sections = await databaseService.getSections();
            span.setAttribute('fallback.successful', true);
            return sections;
          } catch (dbError) {
            logger.error('Database fallback also failed', { error: dbError.message });
            span.setAttribute('fallback.successful', false);
          }
        }
                
        throw error;
      }
    },
  );
}

export async function getEvents(sectionId, termId, token) {
  try {
    // Check network status first
    await checkNetworkStatus();
        
    // If offline, get from local database
    if (!isOnline) {
      console.log('Offline - getting events from local database');
      const events = await databaseService.getEvents(sectionId);
      return events;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-events?sectionid=${sectionId}&termid=${termId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await handleAPIResponseWithRateLimit(response, 'getEvents');
    // Events are in the 'items' property of the response
    const events = (data && data.items) ? data.items : [];
    
    console.log(`getEvents API returned ${events.length} events for section ${sectionId}`);

    // Save to local database when online (even if empty to cache the result)
    await databaseService.saveEvents(sectionId, events);
    console.log(`Attempted to save ${events.length} events to storage for section ${sectionId}`);

    return events;

  } catch (error) {
    console.error(`Error fetching events for section ${sectionId} and term ${termId}:`, error);
        
    // If online request fails, try local database as fallback
    if (isOnline) {
      console.log('Online request failed - trying local database as fallback');
      try {
        const events = await databaseService.getEvents(sectionId);
        return events;
      } catch (dbError) {
        console.error('Database fallback also failed:', dbError);
      }
    }
        
    throw error;
  }
}

export async function getEventAttendance(sectionId, eventId, termId, token) {
  try {
    // Check network status first
    await checkNetworkStatus();
        
    // If offline, get from local database
    if (!isOnline) {
      console.log('Offline - getting attendance from local database');
      const attendance = await databaseService.getAttendance(eventId);
      return attendance;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-event-attendance?sectionid=${sectionId}&termid=${termId}&eventid=${eventId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await handleAPIResponseWithRateLimit(response, 'getEventAttendance');
    // Attendance is in the 'items' property of the response
    const attendance = (data && data.items) ? data.items : [];

    // Save to local database when online
    if (attendance.length > 0) {
      await databaseService.saveAttendance(eventId, attendance);
    }

    return attendance;

  } catch (error) {
    console.error(`Error fetching event attendance for event ${eventId}:`, error);
        
    // If online request fails, try local database as fallback
    if (isOnline) {
      console.log('Online request failed - trying local database as fallback');
      try {
        const attendance = await databaseService.getAttendance(eventId);
        return attendance;
      } catch (dbError) {
        console.error('Database fallback also failed:', dbError);
      }
    }
        
    throw error;
  }
}

export async function getFlexiRecords(sectionId, token, archived = 'n') {
  try {
    checkIfBlocked();
        
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-flexi-records?sectionid=${sectionId}&archived=${archived}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await handleAPIResponseWithRateLimit(response, 'getFlexiRecords');
        
    if (data && data._rateLimitInfo) {
      const { _rateLimitInfo, ...flexiData } = data;
      return flexiData || { identifier: null, label: null, items: [] };
    }
        
    return data || { identifier: null, label: null, items: [] };

  } catch (error) {
    console.error('Error fetching flexi records:', error);
    throw error;
  }
}

export async function getSingleFlexiRecord(flexirecordid, sectionid, termid, token) {
  try {
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-single-flexi-record?flexirecordid=${flexirecordid}&sectionid=${sectionid}&termid=${termid}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'getSingleFlexiRecord');
        
    if (data && data._rateLimitInfo) {
      const { _rateLimitInfo, ...flexiData } = data;
      return flexiData || { identifier: null, items: [] };
    }
        
    return data || { identifier: null, items: [] };
        
  } catch (error) {
    console.error('Error fetching single flexi record:', error);
    throw error;
  }
}

export async function getFlexiStructure(extraid, sectionid, termid, token) {
  try {
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-flexi-structure?flexirecordid=${extraid}&sectionid=${sectionid}&termid=${termid}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 
      },
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'getFlexiStructure');
    return data || null;
        
  } catch (error) {
    console.error('Error fetching flexi structure:', error);
    throw error;
  }
}

export async function getStartupData(token) {
  try {
    // Check network status first
    await checkNetworkStatus();
    
    // If offline, get from localStorage
    if (!isOnline) {
      console.log('Offline - getting startup data from localStorage');
      const cachedStartupData = localStorage.getItem('viking_startup_data_offline');
      return cachedStartupData ? JSON.parse(cachedStartupData) : null;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-startup-data`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 
      },
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'getStartupData');
    const startupData = data || null;
    
    // Cache startup data for offline use
    if (startupData) {
      localStorage.setItem('viking_startup_data_offline', JSON.stringify(startupData));
    }
    
    return startupData;
        
  } catch (error) {
    console.error('Error fetching startup data:', error);
    
    // If online request fails, try localStorage as fallback
    if (isOnline) {
      console.log('Online request failed - trying localStorage as fallback');
      try {
        const cachedStartupData = localStorage.getItem('viking_startup_data_offline');
        return cachedStartupData ? JSON.parse(cachedStartupData) : null;
      } catch (cacheError) {
        console.error('Cache fallback also failed:', cacheError);
      }
    }
    
    throw error;
  }
}

export async function updateFlexiRecord(sectionid, scoutid, flexirecordid, columnid, value, token) {
  try {
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/update-flexi-record`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 
      },
      body: JSON.stringify({
        sectionid,
        scoutid,
        flexirecordid,
        columnid,
        value,
      }),
    });
        
    const data = await handleAPIResponseWithRateLimit(response, 'updateFlexiRecord');
    return data || null;
        
  } catch (error) {
    console.error('Error updating flexi record:', error);
    throw error;
  }
}

export async function getMembersGrid(sectionId, termId, token) {
  try {
    // Check network status first
    await checkNetworkStatus();
    
    // If offline, get from local database (fallback to old format)
    if (!isOnline) {
      console.log('Offline - getting members from local database');
      const cachedMembers = await databaseService.getMembers([sectionId]);
      return cachedMembers;
    }

    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${BACKEND_URL}/get-members-grid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        section_id: sectionId,
        term_id: termId,
      }),
    });

    const data = await handleAPIResponseWithRateLimit(response, 'getMembersGrid');
    
    // Transform the grid data into a more usable format
    if (data && data.data && data.data.members) {
      return data.data.members.map(member => {
        // Map patrol_id to person type
        let person_type = 'Young People'; // default
        if (member.patrol_id === -2) {
          person_type = 'Leaders';
        } else if (member.patrol_id === -3) {
          person_type = 'Young Leaders';
        }
        
        // The backend now provides flattened fields, so we can use them directly
        // All custom_data fields are now available as flattened properties like:
        // primary_contact_1_email_1, primary_contact_1_phone_1, etc.
        
        return {
          // Core member info
          scoutid: member.member_id,
          member_id: member.member_id,
          firstname: member.first_name,
          lastname: member.last_name,
          date_of_birth: member.date_of_birth,
          age: member.age,
          
          // Section info
          sectionid: member.section_id,
          patrol: member.patrol,
          patrol_id: member.patrol_id,
          person_type: person_type, // New field for person classification
          started: member.started,
          joined: member.joined,
          active: member.active,
          end_date: member.end_date,
          
          // Photo info
          photo_guid: member.photo_guid,
          has_photo: member.pic,
          
          // All flattened custom fields are now available directly on the member object
          // No need to extract them - they're already flattened by the backend
          ...member, // Spread all fields including flattened custom_data fields
          
          // Keep grouped contact data for backward compatibility
          contact_groups: member.contact_groups,
        };
      });
    }

    return [];

  } catch (error) {
    console.error(`Error fetching members grid for section ${sectionId}:`, error);
    
    // If online request fails, try local database as fallback
    if (isOnline) {
      console.log('Online request failed - trying local database as fallback');
      try {
        const cachedMembers = await databaseService.getMembers([sectionId]);
        return cachedMembers;
      } catch (dbError) {
        console.error('Database fallback also failed:', dbError);
      }
    }
    
    throw error;
  }
}

// Note: extractContactField and extractEmergencyContacts functions removed
// The backend now provides all custom_data fields as flattened properties
// using the actual group names and column labels from OSM metadata

export async function getListOfMembers(sections, token) {
  // Check network status first
  await checkNetworkStatus();
  const sectionIds = sections.map(s => s.sectionid);
  
  // If offline, return cached members
  if (!isOnline) {
    logger.info('Offline mode - retrieving members from local database');
    try {
      const cachedMembers = await databaseService.getMembers(sectionIds);
      return cachedMembers;
    } catch (error) {
      logger.error('Failed to get cached members:', error);
      throw new Error('Unable to retrieve members while offline');
    }
  }

  // Online mode - use new getMembersGrid for richer data
  const memberMap = new Map(); // For deduplication by scoutid
  
  for (const section of sections) {
    try {
      const termId = await getMostRecentTermId(section.sectionid, token);
      if (!termId) continue;
      
      // Use the new getMembersGrid API for comprehensive data
      const members = await getMembersGrid(section.sectionid, termId, token);
      
      members.forEach(member => {
        if (member && member.scoutid) {
          const scoutId = member.scoutid;
          
          if (memberMap.has(scoutId)) {
            // Member already exists, add section to their sections list
            const existingMember = memberMap.get(scoutId);
            if (!existingMember.sections) {
              existingMember.sections = [existingMember.sectionname];
            }
            if (!existingMember.sections.includes(section.sectionname)) {
              existingMember.sections.push(section.sectionname);
            }
          } else {
            // New member, add to map with section info
            memberMap.set(scoutId, {
              ...member,
              sectionname: section.sectionname,
              section: section.section,
              sections: [section.sectionname], // Track all sections this member belongs to
            });
          }
        }
      });
      
    } catch (sectionError) {
      console.warn(`Failed to fetch members for section ${section.sectionid}:`, sectionError);
      // Continue with other sections
    }
  }
  
  // Convert map back to array
  const members = Array.from(memberMap.values());
  
  // Cache the members for offline use
  if (members.length > 0) {
    try {
      await databaseService.saveMembers(sectionIds, members);
      logger.info(`Cached ${members.length} members for offline use`);
    } catch (error) {
      logger.warn('Failed to cache members:', error);
      // Don't throw error - this is not critical for the main flow
    }
  }
  
  return members;
}

export async function testBackendConnection() {
  try {
    console.log('Testing backend connection to:', BACKEND_URL);
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
        
    console.log('Backend connection test - Status:', response.status);
        
    if (response.ok) {
      const data = await response.text();
      console.log('Backend connection test - Response:', data);
      return true;
    } else {
      console.error('Backend connection test failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Backend connection test error:', error);
    return false;
  }
}
