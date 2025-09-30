---
title: "Database Schema Documentation"
description: "Complete database schema for the new 3-service architecture"
created: "2025-09-06"
last_updated: "2025-01-22"
version: "2.0.0"
tags: ["database", "schema", "sqlite", "reference", "three-service-architecture"]
related_docs: ["../architecture/data-management.md", "../architecture/simplified-sync-architecture.md"]
---

# Database Schema Documentation

**Updated for New Three-Service Architecture**

This document describes the database schema and storage patterns used by the Vikings Event Management mobile app's new simplified architecture.

## 📋 Overview

- **Database Name**: `vikings_db`
- **Current Version**: 2
- **Platform**: Capacitor SQLite (native) with localStorage fallback (web)
- **Encryption**: None (`"no-encryption"`)
- **Architecture**: Three-service model with session-based caching
- **New Pattern**: Service-specific storage responsibilities

## 🗄️ Service-Specific Storage Pattern

### Storage Responsibility by Service

```javascript
// Reference Data Service - localStorage (session-based)
const REFERENCE_DATA_STORAGE = {
  terms: 'viking_terms_offline',
  userRoles: 'viking_user_roles_offline',
  startupData: 'viking_startup_data_offline',
  members: 'viking_members_offline',
  flexiRecords: 'viking_flexi_records_offline'
};

// Events Service - SQLite + localStorage fallback
const EVENTS_STORAGE = {
  native: 'events table in SQLite',
  web: 'viking_events_{sectionId}_offline'
};

// EventSyncService - SQLite + localStorage fallback
const ATTENDANCE_STORAGE = {
  native: 'attendance table in SQLite',
  web: 'viking_attendance_{eventId}_offline'
};
```

## 🗄️ Database Schema (SQLite Native)

### Reference Data (localStorage Only)

**Managed by Reference Data Service** - No SQLite tables needed, stored in localStorage with session-based caching:

```javascript
// Terms data (static for session)
localStorage.setItem('viking_terms_offline', JSON.stringify(termsData));

// User roles/sections (static for session)
localStorage.setItem('viking_user_roles_offline', JSON.stringify(userRoles));

// Startup data (static for session)
localStorage.setItem('viking_startup_data_offline', JSON.stringify(startupData));

// Members data (static for session)
localStorage.setItem('viking_members_offline', JSON.stringify(membersData));

// FlexiRecord metadata (static for session)
localStorage.setItem('viking_flexi_records_offline', JSON.stringify(flexiRecords));
```

**Data Structure Example:**
```javascript
const userRoles = [
  {
    sectionid: 12345,
    sectionname: "1st Example Scout Group",
    sectiontype: "scouts",
    isDefault: true
  }
];
```

---

### Table: `events`
**Managed by Events Service** - Event definitions (not attendance data).

```sql
CREATE TABLE IF NOT EXISTS events (
  eventid INTEGER PRIMARY KEY,
  sectionid INTEGER NOT NULL,
  termid INTEGER,
  name TEXT NOT NULL,
  startdate TEXT,
  enddate TEXT,
  location TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `eventid` - Unique identifier from OSM API (Primary Key)
- `sectionid` - Section identifier (NOTE: No FK constraint - sections in localStorage)
- `termid` - Term identifier for the event
- `name` - Event name (NOT NULL)
- `startdate` - Event start date (TEXT format: YYYY-MM-DD)
- `enddate` - Event end date (TEXT format: YYYY-MM-DD)
- `location` - Event location/venue
- `notes` - Additional event notes/description
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

**Service Integration:**
- Managed by Events Service
- Referenced by `attendance.eventid`
- Section data comes from Reference Data Service (localStorage)

---

### Table: `attendance`
**Managed by EventSyncService** - Real-time attendance data.

```sql
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventid INTEGER NOT NULL,
  scoutid INTEGER,
  firstname TEXT,
  lastname TEXT,
  attending TEXT,
  patrol TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventid) REFERENCES events (eventid)
);
```

**Columns:**
- `id` - Internal unique identifier (Auto-increment Primary Key)
- `eventid` - References `events.eventid` (Foreign Key)
- `scoutid` - Scout's unique identifier from OSM
- `firstname` - Scout's first name
- `lastname` - Scout's last name
- `attending` - Attendance status ("Yes", "No", "Maybe", etc.)
- `patrol` - Scout's patrol/group name
- `notes` - Attendance-specific notes
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

**Service Integration:**
- Managed by EventSyncService (only service that refreshes during session)
- References events from Events Service
- Member data comes from Reference Data Service (localStorage)

---

### Table: `flexi_data` (NEW)
**Managed by EventSyncService** - FlexiRecord member data (camp groups, sign-in/out).

```sql
CREATE TABLE IF NOT EXISTS flexi_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventid INTEGER NOT NULL,
  scoutid INTEGER,
  camp_group TEXT,
  signed_in_by TEXT,
  signed_in_when TEXT,
  signed_out_by TEXT,
  signed_out_when TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventid) REFERENCES events (eventid)
);
```

**Columns:**
- `id` - Internal unique identifier (Auto-increment Primary Key)
- `eventid` - References `events.eventid` (Foreign Key)
- `scoutid` - Scout's unique identifier from OSM
- `camp_group` - Transformed from FlexiRecord f_1 field
- `signed_in_by` - Transformed from FlexiRecord f_2 field
- `signed_in_when` - Transformed from FlexiRecord f_3 field
- `signed_out_by` - Transformed from FlexiRecord f_4 field
- `signed_out_when` - Transformed from FlexiRecord f_5 field
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

**Service Integration:**
- Managed by EventSyncService (dynamic data)
- FlexiRecord metadata comes from Reference Data Service
- Transforms OSM generic fields (f_1, f_2, etc.) to meaningful names

## 🔄 Data Flow & Service Relationships

```
Reference Data Service (localStorage)
    |
    ├── userRoles/sections ──┐
    ├── terms               │
    ├── startupData         │
    ├── members             │
    └── flexiRecords        │
                            │
                            ▼
Events Service (SQLite)     │
    └── events ─────────────┘
            |
            ▼
EventSyncService (SQLite)
    ├── attendance
    └── flexi_data
```

**Service Relationship Details:**
- **Reference Data Service**: Provides static data for entire session
- **Events Service**: Uses section data from Reference Data Service
- **EventSyncService**: Uses event data from Events Service
- **No direct database relationships** between services - data flows through service interfaces

## 📱 Platform Implementation

### Native Platforms (iOS/Android)
- **SQLite**: Events and attendance data via `@capacitor-community/sqlite` plugin
- **localStorage**: Reference data (session-based)
- Full SQL feature support for events and attendance
- Transaction capabilities for data integrity

### Web Browser Fallback
- **localStorage**: All data stored as JSON
- **Storage Keys by Service:**

```javascript
// Reference Data Service (session-based)
const REFERENCE_KEYS = {
  terms: 'viking_terms_offline',
  userRoles: 'viking_user_roles_offline',
  startupData: 'viking_startup_data_offline',
  members: 'viking_members_offline',
  flexiRecords: 'viking_flexi_records_offline'
};

// Events Service (until manual refresh)
const EVENT_KEYS = {
  events: 'viking_events_{sectionId}_offline'
};

// EventSyncService (can refresh during session)
const ATTENDANCE_KEYS = {
  attendance: 'viking_attendance_{eventId}_offline',
  flexiData: 'viking_flexi_data_{eventId}_offline'
};
```

- Limited to localStorage size constraints (~5-10MB typically)

## 🚀 Service Migration Considerations

### New Architecture Migration Completed
The three-service architecture has been implemented with the following migration considerations:

### Service-Specific Migration Strategy

```javascript
// Reference Data Service - No migration needed
// Uses localStorage with session-based lifecycle
const referenceDataMigration = {
  // Data is loaded fresh at each login
  // No persistent storage migration required
};

// Events Service - Standard SQLite migration
const eventsMigration = {
  1: async (db) => {
    // Initial events table creation
    await createEventsTable(db);
  },
  2: async (db) => {
    // Add termid column for better event management
    await addTermIdColumn(db);
  }
};

// EventSyncService - Enhanced with FlexiRecord data
const attendanceMigration = {
  1: async (db) => {
    // Initial attendance table
    await createAttendanceTable(db);
  },
  2: async (db) => {
    // Add flexi_data table for camp groups
    await createFlexiDataTable(db);
  }
};
```

### Service-Based Data Loading

```javascript
// NEW: Service-based data loading pattern
class DataLoadingOrchestrator {
  async initializeAllServices(token) {
    try {
      // 1. Reference Data - Load once at login
      const referenceResults = await referenceDataService.loadInitialReferenceData(token);

      // 2. Events - Load definitions separately
      const eventsResults = await eventsService.loadEventsForSections(
        referenceResults.results.userRoles,
        token
      );

      // 3. Attendance - Manual refresh only during session
      // eventSyncService.syncAllEventAttendance() called by user action

      return {
        reference: referenceResults,
        events: eventsResults,
        // attendance loaded on demand
      };
    } catch (error) {
      logger.error('Service initialization failed', { error: error.message });
      throw error;
    }
  }
}
```

## 🔧 Performance Optimizations

### Service-Optimized Indexes

```sql
-- Events Service indexes
CREATE INDEX IF NOT EXISTS idx_events_sectionid ON events(sectionid);
CREATE INDEX IF NOT EXISTS idx_events_termid ON events(termid);
CREATE INDEX IF NOT EXISTS idx_events_startdate ON events(startdate);

-- EventSyncService indexes
CREATE INDEX IF NOT EXISTS idx_attendance_eventid ON attendance(eventid);
CREATE INDEX IF NOT EXISTS idx_attendance_scoutid ON attendance(scoutid);
CREATE INDEX IF NOT EXISTS idx_attendance_lastname ON attendance(lastname);

-- FlexiRecord data indexes
CREATE INDEX IF NOT EXISTS idx_flexi_data_eventid ON flexi_data(eventid);
CREATE INDEX IF NOT EXISTS idx_flexi_data_scoutid ON flexi_data(scoutid);
CREATE INDEX IF NOT EXISTS idx_flexi_data_camp_group ON flexi_data(camp_group);
```

### Service-Specific Query Patterns

```sql
-- Events Service queries
SELECT * FROM events WHERE sectionid = ? ORDER BY startdate DESC;
SELECT * FROM events WHERE termid = ? ORDER BY startdate DESC;

-- EventSyncService queries
SELECT * FROM attendance WHERE eventid = ? ORDER BY lastname, firstname;
SELECT * FROM flexi_data WHERE eventid = ? ORDER BY camp_group, scoutid;

-- Combined attendance and camp group data
SELECT
  a.*,
  f.camp_group,
  f.signed_in_by,
  f.signed_in_when
FROM attendance a
LEFT JOIN flexi_data f ON a.eventid = f.eventid AND a.scoutid = f.scoutid
WHERE a.eventid = ?
ORDER BY a.lastname, a.firstname;
```

```javascript
// Reference Data Service queries (localStorage)
const getUserRoles = () => {
  return JSON.parse(localStorage.getItem('viking_user_roles_offline') || '[]');
};

const getMembers = () => {
  return JSON.parse(localStorage.getItem('viking_members_offline') || '[]');
};
```

## 🎯 New Architecture Benefits

### Service Separation Benefits
- ✅ **Clear Responsibilities**: Each service owns specific data types
- ✅ **No Service Conflicts**: Eliminated duplicate API calls between services
- ✅ **Simple Storage Patterns**: localStorage for static, SQLite for dynamic
- ✅ **Independent Testing**: Each service can be tested in isolation

### Performance Improvements
- ✅ **Session-Based Caching**: Reference data loaded once at login
- ✅ **Reduced API Calls**: Eliminated 10x get-startup-data duplication
- ✅ **Cache-Only UI**: Components never wait for API calls
- ✅ **Manual Refresh Control**: Scout leaders control when data updates

### Data Consistency
- ✅ **Single Source of Truth**: Each data type owned by one service
- ✅ **Clear Data Flow**: Reference → Events → Attendance
- ✅ **No Sync Conflicts**: Services don't duplicate each other's work
- ✅ **Isolated Failures**: One service failing doesn't break others

## 🎯 Recommended Improvements

### 1. Add Performance Indexes (v2 Migration)
```sql
-- Add essential indexes
CREATE INDEX idx_events_sectionid ON events(sectionid);
CREATE INDEX idx_events_startdate ON events(startdate);
CREATE INDEX idx_attendance_eventid ON attendance(eventid);
CREATE INDEX idx_attendance_scoutid ON attendance(scoutid);
```

### 2. Improve Date Handling (v3 Migration)
```sql
-- Convert text dates to proper DATE columns
ALTER TABLE events ADD COLUMN startdate_new DATE;
ALTER TABLE events ADD COLUMN enddate_new DATE;

-- Migrate data
UPDATE events SET 
  startdate_new = DATE(startdate),
  enddate_new = DATE(enddate);

-- Drop old columns and rename
ALTER TABLE events DROP COLUMN startdate;
ALTER TABLE events DROP COLUMN enddate;
ALTER TABLE events RENAME COLUMN startdate_new TO startdate;
ALTER TABLE events RENAME COLUMN enddate_new TO enddate;
```

### 3. Add Data Constraints (v4 Migration)
```sql
-- Add unique constraints where appropriate
CREATE UNIQUE INDEX idx_attendance_unique ON attendance(eventid, scoutid);

-- Add check constraints for data validation
ALTER TABLE attendance ADD CONSTRAINT chk_attending 
  CHECK (attending IN ('Yes', 'No', 'Maybe', 'Unknown'));
```

### 4. Implement Transaction Support
```javascript
// Wrap multi-record operations in transactions
async saveAttendanceRecords(eventId, records) {
  await this.db.execute('BEGIN TRANSACTION');
  try {
    await this.db.execute('DELETE FROM attendance WHERE eventid = ?', [eventId]);
    
    for (const record of records) {
      await this.db.execute(
        'INSERT INTO attendance (eventid, scoutid, firstname, lastname, attending, patrol, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [eventId, record.scoutid, record.firstname, record.lastname, record.attending, record.patrol, record.notes]
      );
    }
    
    await this.db.execute('COMMIT');
  } catch (error) {
    await this.db.execute('ROLLBACK');
    throw error;
  }
}
```

## 📊 Service-Based Data Management

### Session-Based Strategy
1. **Reference Data**: Load once at login, cache for entire session
2. **Events Data**: Load separately, cache until manual refresh
3. **Attendance Data**: Only service that refreshes during session
4. **Cache-Only UI**: All components read from cache, never API

### Service Loading Process
1. **Login Trigger**: Reference Data Service loads static data
2. **Navigation Trigger**: Events Service loads event definitions
3. **User Trigger**: EventSyncService refreshes attendance on demand
4. **Manual Control**: Scout leaders control all refresh operations

### Data Lifecycle by Service
```javascript
// Reference Data Service
const referenceLifecycle = {
  load: 'Once at login',
  refresh: 'Never during session',
  cache: 'Entire session',
  storage: 'localStorage only'
};

// Events Service
const eventsLifecycle = {
  load: 'Separate from login',
  refresh: 'Manual by user',
  cache: 'Until manual refresh',
  storage: 'SQLite + localStorage fallback'
};

// EventSyncService
const attendanceLifecycle = {
  load: 'On demand',
  refresh: 'Manual during session',
  cache: 'Until next refresh',
  storage: 'SQLite + localStorage fallback'
};
```

## 🔍 Debugging & Maintenance

### Database Inspection
```javascript
// Check database status
await CapacitorSQLite.checkConnectionsConsistency();

// View table structure
const result = await db.query('PRAGMA table_info(sections)');

// Check sync status
const syncStatus = await db.query('SELECT * FROM sync_status');
```

### Common Issues
1. **Connection Problems**: Check platform detection and plugin installation
2. **Sync Failures**: Verify network status and API connectivity  
3. **Data Inconsistency**: Check foreign key relationships
4. **Performance Issues**: Add missing indexes

## 📚 References

- [Capacitor SQLite Plugin](https://github.com/capacitor-community/sqlite)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Three-Service Architecture Documentation](../architecture/simplified-sync-architecture.md)
- [Data Management Architecture](../architecture/data-management.md)
- [Reference Data Service](../src/shared/services/referenceData/referenceDataService.js)
- [Events Service](../src/shared/services/data/eventsService.js)
- [EventSyncService](../src/shared/services/data/eventSyncService.js)
- [Database Service](../src/shared/services/storage/database.js)