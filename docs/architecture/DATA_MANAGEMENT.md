# Data Management Architecture
**Three-Tier Caching with FlexiRecord Integration**

## Purpose
Efficient data management system that provides reliable offline access while respecting OSM API rate limits and maintaining data consistency.

## Three-Tier Data Strategy

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OSM API       │    │   Local Cache   │    │   Offline DB    │
│ (Authoritative) │◄──►│ (Performance)   │◄──►│  (Persistence)  │
│                 │    │                 │    │                 │
│ • Live Data     │    │ • localStorage  │    │ • SQLite        │
│ • Rate Limited  │    │ • TTL Management│    │ • Structured    │
│ • Requires Auth │    │ • Fast Access   │    │ • Offline First │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Caching Strategy

### Current TTL Configuration
```javascript
const CACHE_DURATIONS = {
  terms: 30 * 60 * 1000,        // 30 minutes (moderate change frequency)
  sections: 24 * 60 * 60 * 1000, // 24 hours (rarely change)
  events: 5 * 60 * 1000,         // 5 minutes (can change frequently)
  attendance: 2 * 60 * 1000,     // 2 minutes (real-time updates)
  flexiStructure: 60 * 60 * 1000, // 60 minutes (structure definitions)
  flexiData: 5 * 60 * 1000       // 5 minutes (member data changes)
};
```

### Context-Aware Cache Access
```javascript
// Smart Cache Strategy
const getCachedData = (key, isOnline, authState) => {
  const cached = safeGetItem(key);
  if (!cached) return null;
  
  // Always use cache when offline
  if (!isOnline) return cached;
  
  // Always use cache when not authenticated
  if (authState !== 'authenticated') return cached;
  
  // Check TTL only when online + authenticated
  const cacheAge = Date.now() - cached._cacheTimestamp;
  const ttl = CACHE_DURATIONS[getCacheType(key)];
  
  return cacheAge < ttl ? cached : null;
};
```

### Data Synchronization Flow
```javascript
// Sync Priority Order
const performSync = async (token) => {
  try {
    // 1. Essential Data (blocking)
    const userRoles = await syncUserRoles(token);
    const terms = await syncTerms(token);
    
    // 2. Core Data (parallel)
    await Promise.all([
      syncSections(userRoles, token),
      syncStartupData(token)
    ]);
    
    // 3. Event Data (on-demand when user navigates)
    // 4. FlexiRecord Data (lazy load when viewing attendance)
    
    return { success: true, syncTime: Date.now() };
  } catch (error) {
    logger.error('Sync failed', { error: error.message });
    return { success: false, error: error.message };
  }
};
```

## FlexiRecord System

### Architecture Overview
FlexiRecords are OSM's flexible database system for custom member data. The Viking system uses them for camp group assignments and sign-in/out tracking.

```javascript
// Three-Component FlexiRecord System
const FLEXIRECORD_COMPONENTS = {
  lists: 'Available FlexiRecords per section',
  structure: 'Field definitions and types',
  data: 'Actual member values'
};
```

### Field Mapping System
```javascript
// OSM Generic Fields → Meaningful Names
const FIELD_MAPPINGS = {
  'f_1': 'CampGroup',      // e.g., "Blue Group", "Red Group"
  'f_2': 'SignedInBy',     // Leader who signed member in
  'f_3': 'SignedInWhen',   // Timestamp of sign-in
  'f_4': 'SignedOutBy',    // Leader who signed member out
  'f_5': 'SignedOutWhen'   // Timestamp of sign-out
};

// Transformation Process
const transformFlexiRecordData = (flexiData, fieldMapping) => {
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
};
```

### Cache Management Strategy
```javascript
// FlexiRecord Cache Keys
const CACHE_KEYS = {
  list: (sectionId, archived) => 
    `viking_flexi_records_${sectionId}_archived_${archived}_offline`,
  structure: (flexirecordId) => 
    `viking_flexi_structure_${flexirecordId}_offline`,
  data: (flexirecordId, sectionId, termId) => 
    `viking_flexi_data_${flexirecordId}_${sectionId}_${termId}_offline`
};

// Cache Strategy by Data Type
const FLEXIRECORD_CACHE_STRATEGY = {
  // Static data - long TTL, rarely changes
  lists: { ttl: 30 * 60 * 1000, forceRefresh: false },
  structure: { ttl: 60 * 60 * 1000, forceRefresh: false },
  
  // Dynamic data - short TTL, force refresh on operations
  data: { ttl: 5 * 60 * 1000, forceRefresh: true }
};
```

### Service Layer Architecture
```javascript
// FlexiRecord Service Structure
const flexiRecordService = {
  // High-level business operations
  getVikingEventDataForEvents: async (events, token, forceRefresh = true) => {
    // Optimized multi-event data loading
    const eventData = {};
    
    for (const event of events) {
      try {
        const data = await getVikingEventData(
          event.sectionid, 
          event.termid, 
          token, 
          forceRefresh
        );
        eventData[event.eventid] = data;
      } catch (error) {
        logger.warn('Failed to load FlexiRecord data for event', {
          eventid: event.eventid,
          error: error.message
        });
      }
    }
    
    return eventData;
  },
  
  // Individual section data
  getVikingEventData: async (sectionId, termId, token, forceRefresh = false) => {
    // 1. Get FlexiRecord list
    const flexiRecords = await getFlexiRecordsList(sectionId, token, forceRefresh);
    
    // 2. Find Viking Event FlexiRecord
    const vikingRecord = findVikingEventRecord(flexiRecords);
    if (!vikingRecord) return null;
    
    // 3. Get structure and data
    const [structure, data] = await Promise.all([
      getFlexiRecordStructure(vikingRecord.extraid, sectionId, termId, token, forceRefresh),
      getFlexiRecordData(vikingRecord.extraid, sectionId, termId, token, forceRefresh)
    ]);
    
    // 4. Transform and return
    return transformConsolidatedData(structure, data);
  }
};
```

## Database Schema (SQLite)

### Core Tables
```sql
-- Sections (User Access)
CREATE TABLE sections (
  sectionid INTEGER PRIMARY KEY,
  sectionname TEXT NOT NULL,
  section TEXT,
  sectiontype TEXT,
  isDefault INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Events 
CREATE TABLE events (
  eventid INTEGER PRIMARY KEY,
  sectionid INTEGER NOT NULL,
  name TEXT NOT NULL,
  startdate TEXT,
  enddate TEXT,
  location TEXT,
  FOREIGN KEY (sectionid) REFERENCES sections(sectionid)
);

-- Members
CREATE TABLE members (
  scoutid INTEGER PRIMARY KEY,
  sectionid INTEGER NOT NULL,
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  person_type TEXT,
  patrol TEXT,
  patrol_id INTEGER,
  active INTEGER DEFAULT 1,
  started TEXT,
  date_of_birth TEXT,
  FOREIGN KEY (sectionid) REFERENCES sections(sectionid)
);

-- Attendance
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventid INTEGER NOT NULL,
  scoutid INTEGER NOT NULL,
  attendance TEXT,
  FOREIGN KEY (eventid) REFERENCES events(eventid),
  FOREIGN KEY (scoutid) REFERENCES members(scoutid)
);
```

### Database Service Pattern
```javascript
// Database Service Implementation
const databaseService = {
  // Section Management
  saveSections: async (sections) => {
    try {
      if (isCapacitorNative()) {
        await executeSQLiteQuery('DELETE FROM sections');
        for (const section of sections) {
          await executeSQLiteQuery(
            'INSERT INTO sections (sectionid, sectionname, section, sectiontype, isDefault) VALUES (?, ?, ?, ?, ?)',
            [section.sectionid, section.sectionname, section.section, section.sectiontype, section.isDefault ? 1 : 0]
          );
        }
      } else {
        // Fallback to localStorage for web
        safeSetItem('viking_sections_offline', sections);
      }
    } catch (error) {
      logger.error('Failed to save sections', { error: error.message });
      throw error;
    }
  },
  
  getSections: async () => {
    try {
      if (isCapacitorNative()) {
        const result = await executeSQLiteQuery('SELECT * FROM sections ORDER BY sectionname');
        return result.values || [];
      } else {
        return safeGetItem('viking_sections_offline', []);
      }
    } catch (error) {
      logger.error('Failed to get sections', { error: error.message });
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

### Service Dependencies
- **API Service**: Handles HTTP requests and rate limiting
- **Auth Service**: Provides authentication state and tokens
- **Database Service**: Manages SQLite operations and localStorage fallbacks
- **Sync Service**: Coordinates online/offline data synchronization
- **Utility Services**: Network status, storage operations, error handling

### Component Integration
- **Data Loading**: Components request data through service layer
- **State Management**: React hooks manage data state with cache integration
- **Error Boundaries**: Components handle data loading failures gracefully
- **Offline Indicators**: UI shows data staleness and sync status

---

*This data management system provides reliable, performant access to OSM data while maintaining offline capabilities and respecting API constraints.*