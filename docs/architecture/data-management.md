---
title: "Data Management Architecture"
description: "Simplified session-based architecture with three data services for reliable offline access"
created: "2025-09-06"
last_updated: "2025-09-30"
version: "2.0.0"
tags: ["architecture", "data-management", "sync", "offline", "shared-events"]
related_docs: ["system-design.md", "authentication.md"]
---

# Data Management Architecture
**Simplified Session-Based Architecture with Three Data Services**

## Purpose
Clean, maintainable data management system that provides reliable offline access while respecting OSM API rate limits. Implements a session-based approach where static data is loaded once at login and cached for the entire session.

## New Three-Service Architecture

Data is classified by how frequently it changes during a user session:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIMPLIFIED DATA SERVICES                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Reference Data │    │  Events Service │    │ EventSyncService│
│    Service      │    │                 │    │                 │
│                 │    │                 │    │                 │
│ • Static Data   │    │ • Event Defs    │    │ • Attendance    │
│ • Load Once     │    │ • Weekly Change │    │ • Shared Events │
│ • Session Cache │    │ • Cache Only    │    │ • Real-time     │
│ • No Refresh    │    │ • No API calls  │    │ • Only Service  │
│                 │    │                 │    │   That Syncs    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
     ↓ Login              ↓ Separate Load       ↓ During Session
     OSM API              OSM API              OSM API
```

## Session-Based Data Strategy

### Data Classification by Change Frequency During Session
```javascript
// STATIC DATA (Reference Data Service)
// Loaded once at login, cached for entire session
const REFERENCE_DATA = {
  terms: 'Never changes during session',
  userRoles: 'Never changes during session',
  startupData: 'Never changes during session',
  members: 'Never changes during session',
  flexiRecords: {
    lists: 'Never changes during session',
    structures: 'Never changes during session'
  }
};

// MODERATELY DYNAMIC DATA (Events Service)
// Changes weekly, separate loading service
const EVENTS_DATA = {
  eventDefinitions: 'Weekly changes, cached for session'
};

// HIGHLY DYNAMIC DATA (EventSyncService)
// Can change during session, only service that refreshes
const ATTENDANCE_DATA = {
  attendance: 'Real-time updates during session',
  sharedAttendance: 'Real-time updates for multi-section events during session'
};
```

### Cache-Only Access Pattern
```javascript
// NEW: All UI components are cache-only
// No API calls from UI - only from dedicated loading services

const getCachedData = (key) => {
  // Simple cache access - no TTL checks, no API calls
  const cached = safeGetItem(key);
  return cached || null;
};

// Data loading happens in dedicated services
const loadDataViaService = async (dataType) => {
  switch (dataType) {
    case 'reference':
      return await referenceDataService.loadInitialReferenceData(token);
    case 'events':
      return await eventsService.loadEventsForSections(sections, token);
    case 'attendance':
      return await eventSyncService.syncAllEventAttendance(forceRefresh);
  }
};
```

### New Data Loading Flow
```javascript
// SIMPLIFIED: One load per service, clear separation
const loadAllData = async (token) => {
  try {
    // 1. Reference Data (once at login)
    const referenceResults = await referenceDataService.loadInitialReferenceData(token);

    // 2. Events Data (separate loading)
    const eventsResults = await eventsService.loadEventsForSections(
      referenceResults.results.userRoles,
      token
    );

    // 3. Attendance Data (only when user requests refresh)
    // eventSyncService.syncAllEventAttendance() - called manually

    return {
      reference: referenceResults,
      events: eventsResults,
      // attendance loaded on-demand
    };
  } catch (error) {
    logger.error('Data loading failed', { error: error.message });
    return { success: false, error: error.message };
  }
};
```

## Service Responsibilities

### 1. Reference Data Service
```javascript
// LOADS ONCE AT LOGIN - Static for entire session
class ReferenceDataService {
  async loadInitialReferenceData(token) {
    // Load all static data that never changes during session
    const results = {
      terms: await getTerms(token, false),
      userRoles: await getUserRoles(token),
      startupData: await getStartupData(token),
      members: await getListOfMembers(userRoles, token),
      flexiRecords: {
        lists: await getFlexiRecords(sectionId, token),
        structures: await getFlexiStructure(extraid, sectionId, null, token)
      }
    };
    return results;
  }
}
```

### 2. Events Service
```javascript
// EVENT DEFINITIONS - Moderately dynamic (weekly changes)
class EventsService {
  async loadEventsForSections(sections, token) {
    // Load event definitions (not attendance)
    // Separate from attendance data
    const results = [];
    for (const section of sections) {
      const termId = await fetchMostRecentTermId(section.sectionid, token);
      const events = await getEvents(section.sectionid, termId, token);
      results.push({ sectionId: section.sectionid, events });
    }
    return results;
  }

  // Cache-only method for UI components
  async loadEventsFromCache(sections) {
    // No API calls - cache only
    return await databaseService.getEvents(sections);
  }
}
```

### 3. EventSyncService
```javascript
// ATTENDANCE DATA - Highly dynamic (real-time during session)
class EventSyncService {
  async syncAllEventAttendance(forceRefresh = false) {
    // ONLY service that refreshes data during session
    // All others are cache-only after initial load
    const events = await databaseService.getEvents(); // from cache

    // Sync regular attendance
    for (const event of events) {
      const attendance = await getEventAttendance(
        event.sectionid, event.eventid, event.termid, token
      );
      await databaseService.saveAttendance(event.eventid, attendance);
    }

    // Sync shared event attendance for multi-section events
    await this.syncSharedAttendance(events, token);
  }

  async syncSharedAttendance(events, token) {
    // Check each event for shared metadata
    for (const event of events) {
      const metadataKey = `viking_shared_metadata_${event.eventid}`;
      const sharedMetadata = await UnifiedStorageService.get(metadataKey);

      if (sharedMetadata?._isSharedEvent === true) {
        // Fetch shared attendance for multi-section event
        const sharedAttendanceData = await getSharedEventAttendance(
          event.eventid,
          event.sectionid,
          token
        );

        // Cache the shared attendance data
        const cacheKey = `viking_shared_attendance_${event.eventid}_${event.sectionid}_offline`;
        localStorage.setItem(cacheKey, JSON.stringify(sharedAttendanceData));
      }
    }
  }
}
```

## UI Layer Changes

### All UI Components Now Cache-Only
```javascript
// OLD: UI components made API calls directly
const EventDashboard = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // BAD: API call from UI component
    getEvents(sectionId, termId, token).then(setEvents);
  }, []);
};

// NEW: UI components are cache-only
const EventDashboard = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // GOOD: Cache-only access
    eventsService.loadEventsFromCache(sections).then(setEvents);
  }, []);

  const handleRefresh = async () => {
    // Only refresh services can make API calls
    await eventsService.loadEventsForSections(sections, token);
    // Then reload from cache
    const updated = await eventsService.loadEventsFromCache(sections);
    setEvents(updated);
  };
};
```

## Benefits of New Architecture

### Eliminated SyncService Complexity
```javascript
// REMOVED: Complex sync service that was causing issues
// - sync.js (eliminated entirely)
// - pageDataManager.js (no longer needed)
// - usePageData.js (no longer needed)

// REASON FOR REMOVAL:
// SyncService was duplicating API calls with Reference Data Service
// causing 10x get-startup-data and 5x get-user-roles calls

// NEW APPROACH:
// Each service has clear responsibility
// No duplication of API calls
// Simple, predictable data flow
```

### Cache Strategy Simplification
```javascript
// OLD: Complex TTL-based cache management
const getCachedData = (key, ttl, forceRefresh) => { /* complex logic */ };

// NEW: Session-based cache strategy
const getCachedData = (key) => {
  // Reference data: Cached for entire session
  if (key.includes('reference_')) {
    return safeGetItem(key); // No TTL check
  }

  // Events: Cached until manual refresh
  if (key.includes('events_')) {
    return safeGetItem(key); // No TTL check
  }

  // Attendance: Can be refreshed during session
  if (key.includes('attendance_')) {
    return safeGetItem(key); // Refreshed by EventSyncService
  }
};
```

## FlexiRecord Integration

### Reference Data Service Handles FlexiRecord Metadata
```javascript
// FlexiRecord lists and structures loaded once at login
class ReferenceDataService {
  async loadInitialReferenceData(token) {
    const flexiRecordData = {
      lists: [],     // Available FlexiRecords per section
      structures: [] // Field definitions for Viking FlexiRecords
    };

    // Load FlexiRecord lists for all sections (static reference data)
    for (const section of userRoles) {
      const flexiRecords = await getFlexiRecords(section.sectionid, token, 'n', false);
      flexiRecordData.lists.push({
        sectionId: section.sectionid,
        records: flexiRecords.items
      });
    }

    // Load structures only for Viking FlexiRecords (static reference data)
    const vikingRecords = findVikingRecords(flexiRecordData.lists);
    for (const record of vikingRecords) {
      const structure = await getFlexiStructure(record.extraid, sectionId, null, token);
      flexiRecordData.structures.push({
        extraid: record.extraid,
        name: record.name,
        structure: structure
      });
    }

    return { flexiRecords: flexiRecordData };
  }
}
```

### EventSyncService Handles FlexiRecord Data
```javascript
// FlexiRecord member data (camp groups, sign-in/out) handled by EventSyncService
// This is dynamic data that can change during session
class EventSyncService {
  async syncFlexiRecordData(events, token) {
    for (const event of events) {
      const flexiData = await getFlexiRecordData(
        vikingRecord.extraid,
        event.sectionid,
        event.termid,
        token
      );

      // Transform f_1, f_2, etc. to meaningful field names
      const transformedData = this.transformFlexiRecordData(flexiData);
      await databaseService.saveFlexiData(event.eventid, transformedData);
    }
  }

  transformFlexiRecordData(flexiData) {
    return flexiData.items.map(item => ({
      scoutid: item.scoutid,
      firstname: item.firstname,
      lastname: item.lastname,
      CampGroup: item.f_1 || 'Unassigned',
      SignedInBy: item.f_2 || '',
      SignedInWhen: item.f_3 || '',
      SignedOutBy: item.f_4 || '',
      SignedOutWhen: item.f_5 || ''
    }));
  }
}
```

## Database Integration with Services

### Service-Specific Storage Patterns
```javascript
// Reference Data Service uses localStorage for session data
class ReferenceDataService {
  async storeReferenceData(data) {
    // Static data stored for entire session
    safeSetItem('viking_terms_offline', data.terms);
    safeSetItem('viking_user_roles_offline', data.userRoles);
    safeSetItem('viking_startup_data_offline', data.startupData);
    safeSetItem('viking_members_offline', data.members);
    safeSetItem('viking_flexi_records_offline', data.flexiRecords);
  }
}

// Events Service uses database for event definitions
class EventsService {
  async storeEvents(sectionId, events) {
    if (isCapacitorNative()) {
      await databaseService.saveEvents(sectionId, events);
    } else {
      safeSetItem(`viking_events_${sectionId}_offline`, events);
    }
  }
}

// EventSyncService manages attendance in database
class EventSyncService {
  async storeAttendance(eventId, attendance) {
    if (isCapacitorNative()) {
      await databaseService.saveAttendance(eventId, attendance);
    } else {
      safeSetItem(`viking_attendance_${eventId}_offline`, attendance);
    }
  }
}
```

### Core Database Tables (SQLite Native)
```sql
-- Events (managed by EventsService)
CREATE TABLE events (
  eventid INTEGER PRIMARY KEY,
  sectionid INTEGER NOT NULL,
  termid INTEGER,
  name TEXT NOT NULL,
  startdate TEXT,
  enddate TEXT,
  location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Attendance (managed by EventSyncService)
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventid INTEGER NOT NULL,
  scoutid INTEGER NOT NULL,
  firstname TEXT,
  lastname TEXT,
  attending TEXT,
  patrol TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventid) REFERENCES events(eventid)
);

-- FlexiRecord Data (managed by EventSyncService)
CREATE TABLE flexi_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventid INTEGER NOT NULL,
  scoutid INTEGER NOT NULL,
  camp_group TEXT,
  signed_in_by TEXT,
  signed_in_when TEXT,
  signed_out_by TEXT,
  signed_out_when TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventid) REFERENCES events(eventid)
);
```

### Database Service Updated for New Architecture
```javascript
// Database Service - Updated for service separation
const databaseService = {
  // Events Management (Events Service)
  saveEvents: async (sectionId, events) => {
    try {
      if (isCapacitorNative()) {
        // Delete existing events for section
        await executeSQLiteQuery('DELETE FROM events WHERE sectionid = ?', [sectionId]);

        // Insert new events
        for (const event of events) {
          await executeSQLiteQuery(
            'INSERT INTO events (eventid, sectionid, termid, name, startdate, enddate, location) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [event.eventid, event.sectionid, event.termid, event.name, event.startdate, event.enddate, event.location]
          );
        }
      } else {
        // Web fallback
        safeSetItem(`viking_events_${sectionId}_offline`, events);
      }
    } catch (error) {
      logger.error('Failed to save events', { error: error.message });
      throw error;
    }
  },

  getEvents: async (sectionId = null) => {
    try {
      if (isCapacitorNative()) {
        const query = sectionId
          ? 'SELECT * FROM events WHERE sectionid = ? ORDER BY startdate DESC'
          : 'SELECT * FROM events ORDER BY startdate DESC';
        const params = sectionId ? [sectionId] : [];
        const result = await executeSQLiteQuery(query, params);
        return result.values || [];
      } else {
        if (sectionId) {
          return safeGetItem(`viking_events_${sectionId}_offline`, []);
        } else {
          // Get all cached events from localStorage
          const allEvents = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('viking_events_') && key.endsWith('_offline')) {
              const events = safeGetItem(key, []);
              allEvents.push(...events);
            }
          }
          return allEvents;
        }
      }
    } catch (error) {
      logger.error('Failed to get events', { error: error.message });
      return [];
    }
  },

  // Attendance Management (EventSyncService)
  saveAttendance: async (eventId, attendanceRecords) => {
    try {
      if (isCapacitorNative()) {
        // Delete existing attendance for event
        await executeSQLiteQuery('DELETE FROM attendance WHERE eventid = ?', [eventId]);

        // Insert new attendance records
        for (const record of attendanceRecords) {
          await executeSQLiteQuery(
            'INSERT INTO attendance (eventid, scoutid, firstname, lastname, attending, patrol, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [eventId, record.scoutid, record.firstname, record.lastname, record.attending, record.patrol, record.notes]
          );
        }
      } else {
        // Web fallback
        safeSetItem(`viking_attendance_${eventId}_offline`, attendanceRecords);
      }
    } catch (error) {
      logger.error('Failed to save attendance', { error: error.message });
      throw error;
    }
  },

  getAttendance: async (eventId = null) => {
    try {
      if (isCapacitorNative()) {
        const query = eventId
          ? 'SELECT * FROM attendance WHERE eventid = ? ORDER BY lastname, firstname'
          : 'SELECT * FROM attendance ORDER BY eventid, lastname, firstname';
        const params = eventId ? [eventId] : [];
        const result = await executeSQLiteQuery(query, params);
        return result.values || [];
      } else {
        if (eventId) {
          return safeGetItem(`viking_attendance_${eventId}_offline`, []);
        } else {
          // Get all cached attendance from localStorage
          const allAttendance = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('viking_attendance_') && key.endsWith('_offline')) {
              const attendance = safeGetItem(key, []);
              allAttendance.push(...attendance);
            }
          }
          return allAttendance;
        }
      }
    } catch (error) {
      logger.error('Failed to get attendance', { error: error.message });
      return [];
    }
  }
};
```

## Error Handling & Recovery

### Enhanced Cache Error Handling
```javascript
// Production-Ready Cache Operations
const safeCacheWithLogging = async (cacheKey, data, category = LOG_CATEGORIES.API) => {
  try {
    const cachedData = {
      ...data,
      _cacheTimestamp: Date.now()
    };
    
    const success = safeSetItem(cacheKey, cachedData);
    
    if (success) {
      logger.info('Data successfully cached', {
        cacheKey,
        dataSize: JSON.stringify(cachedData).length,
        itemCount: Array.isArray(data) ? data.length : Object.keys(data || {}).length
      }, category);
    } else {
      logger.error('Data caching failed - safeSetItem returned false', {
        cacheKey,
        dataSize: JSON.stringify(cachedData).length
      }, LOG_CATEGORIES.ERROR);
    }
    
    return success;
  } catch (cacheError) {
    logger.error('Data caching error', {
      cacheKey,
      error: cacheError.message,
      dataSize: data ? JSON.stringify(data).length : 0
    }, LOG_CATEGORIES.ERROR);
    
    sentryUtils.captureException(cacheError, {
      tags: { operation: 'cache_write' },
      contexts: { cache: { key: cacheKey } }
    });
    
    return false;
  }
};
```

### Cache Fallback Strategy
```javascript
// API Call with Cache Fallback
const apiWithCacheFallback = async (apiCall, cacheKey, isOnline) => {
  try {
    // Try API call first when online
    if (isOnline) {
      const data = await apiCall();
      await safeCacheWithLogging(cacheKey, data);
      return data;
    }
  } catch (apiError) {
    logger.warn('API call failed, trying cache fallback', {
      cacheKey,
      error: apiError.message
    });
  }
  
  // Fallback to cache
  const cached = safeGetItem(cacheKey);
  if (cached) {
    logger.info('Using cached data after API failure', { cacheKey });
    return cached;
  }
  
  throw new Error('No data available - API failed and no cache');
};
```

## Performance Optimization

### Request Queuing
```javascript
// API Queue to Prevent Simultaneous Requests
class APIQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.requestCount = 0;
  }

  async add(apiCall) {
    return new Promise((resolve, reject) => {
      this.queue.push({ apiCall, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { apiCall, resolve, reject } = this.queue.shift();
      
      try {
        this.requestCount++;
        const result = await apiCall();
        resolve(result);
        
        // Rate limiting delay between requests
        if (this.queue.length > 0) {
          await sleep(200);
        }
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }
}
```

### Batch Operations
```javascript
// Optimized Multi-Section Data Loading
const loadDataForSections = async (sections, token) => {
  // Load terms once for all sections (major optimization)
  const allTerms = await getTerms(token);
  
  // Process sections in parallel with shared terms
  const results = await Promise.allSettled(
    sections.map(async (section) => {
      const termId = getMostRecentTermId(section.sectionid, allTerms);
      return await getMembersGrid(section.sectionid, termId, token);
    })
  );
  
  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)
    .flat();
};
```

## Integration Points

### NEW Service Dependencies
- **Reference Data Service**: Static data loaded once at login
- **Events Service**: Event definitions with cache-only UI access
- **EventSyncService**: Attendance data with refresh capabilities
- **Database Service**: SQLite operations and localStorage fallbacks
- **Auth Service**: Authentication state and tokens
- **API Service**: HTTP requests and rate limiting

### NEW Component Integration Pattern
```javascript
// All UI components follow cache-only pattern
const EventComponent = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    // CACHE-ONLY access
    const loadFromCache = async () => {
      const cachedData = await databaseService.getEvents();
      setData(cachedData);
    };
    loadFromCache();
  }, []);

  const handleRefresh = async () => {
    // Only dedicated services make API calls
    await eventsService.loadEventsForSections(sections, token);
    // Then reload from cache
    const updated = await databaseService.getEvents();
    setData(updated);
  };

  return (
    <div>
      <button onClick={handleRefresh}>Refresh Events</button>
      {/* Render cached data */}
    </div>
  );
};
```

### Service Communication
- **No Cross-Service Dependencies**: Each service is independent
- **Clear Data Ownership**: Each service owns specific data types
- **UI Layer Isolation**: Components never make direct API calls
- **Manual Refresh Control**: Users control when data updates happen

## Key Benefits of New Architecture

### Eliminated Issues
- **10x API Call Reduction**: Removed duplicate calls between SyncService and Reference Data Service
- **Clear Error Messages**: No more complex sync failures
- **Predictable Behavior**: UI components always work from cache
- **Simplified Debugging**: Each service has single responsibility

### Scout-Appropriate Design
- **Manual Control**: Leaders control when data refreshes
- **Session-Based Caching**: Static data stays cached for entire session
- **Cache-Only UI**: Components never fail due to network issues
- **Single Responsibility**: Each service does one thing well

### Performance Improvements
- **Faster Initial Load**: Reference data loaded once at login
- **Reduced Network Usage**: No redundant API calls
- **Better Offline Experience**: All UI works from cache
- **Predictable Memory Usage**: Simple caching patterns

---

*This simplified data management system provides reliable, maintainable access to OSM data with Scout-appropriate complexity levels.*