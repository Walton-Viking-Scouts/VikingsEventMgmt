---
title: "SQLite Database Schema Documentation"
description: "Complete database schema for offline data storage in the mobile application"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["database", "schema", "sqlite", "reference"]
related_docs: ["../architecture/data-management.md", "../features/offline-capabilities/"]
---

# SQLite Database Schema Documentation

This document describes the SQLite database schema used by the Vikings Event Management mobile app for offline data storage.

## 📋 Overview

- **Database Name**: `vikings_db`
- **Current Version**: 1
- **Platform**: Capacitor SQLite (native) with localStorage fallback (web)
- **Encryption**: None (`"no-encryption"`)
- **Architecture**: Offline-first with background sync

## 🗄️ Database Schema

### Table: `sections`
Stores Scout sections that the user has access to.

```sql
CREATE TABLE IF NOT EXISTS sections (
  sectionid INTEGER PRIMARY KEY,
  sectionname TEXT NOT NULL,
  sectiontype TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `sectionid` - Unique identifier from OSM API (Primary Key)
- `sectionname` - Display name of the section (NOT NULL)
- `sectiontype` - Type/category of section (e.g., "Beavers", "Cubs", "Scouts")
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

**Relationships:** Referenced by `events.sectionid`

---

### Table: `events`
Stores events for each section.

```sql
CREATE TABLE IF NOT EXISTS events (
  eventid INTEGER PRIMARY KEY,
  sectionid INTEGER,
  name TEXT NOT NULL,
  startdate TEXT,
  enddate TEXT,
  location TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sectionid) REFERENCES sections (sectionid)
);
```

**Columns:**
- `eventid` - Unique identifier from OSM API (Primary Key)
- `sectionid` - References `sections.sectionid` (Foreign Key)
- `name` - Event name (NOT NULL)
- `startdate` - Event start date (TEXT format: YYYY-MM-DD)
- `enddate` - Event end date (TEXT format: YYYY-MM-DD)
- `location` - Event location/venue
- `notes` - Additional event notes/description
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

**Relationships:** 
- References `sections.sectionid`
- Referenced by `attendance.eventid`

---

### Table: `attendance`
Stores attendance records for events.

```sql
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventid INTEGER,
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

**Relationships:** References `events.eventid`

---

### Table: `sync_status`
Tracks synchronization status for offline/online data management.

```sql
CREATE TABLE IF NOT EXISTS sync_status (
  table_name TEXT PRIMARY KEY,
  last_sync DATETIME,
  needs_sync INTEGER DEFAULT 0
);
```

**Columns:**
- `table_name` - Name of the table being tracked (Primary Key)
- `last_sync` - Timestamp of last successful sync
- `needs_sync` - Boolean flag (0/1) indicating if sync is needed

**Usage:** Used by sync service to track when each table was last synchronized with the server.

## 🔄 Data Flow & Relationships

```
sections (1) -----> (N) events
                        |
                        v
                    (N) attendance

sync_status --------> tracks all tables
```

**Relationship Details:**
- One section can have many events
- One event can have many attendance records
- Sync status tracks synchronization state for each table

## 📱 Platform Implementation

### Native Platforms (iOS/Android)
- Uses `@capacitor-community/sqlite` plugin
- Persistent SQLite database file
- Full SQL feature support
- Transaction capabilities

### Web Browser Fallback
- Uses localStorage with JSON serialization
- Storage keys:
  - `viking_sections_offline` - Sections data
  - `viking_events_{sectionId}_offline` - Events per section  
  - `viking_attendance_{eventId}_offline` - Attendance per event
- Limited to localStorage size constraints

## 🚀 Migration System (Recommended)

### Current State: No Migration System
The current implementation has no versioning or migration system. Here's a recommended migration framework:

### Proposed Migration Structure

```javascript
// Database migrations
const migrations = {
  1: async (db) => {
    // Initial schema creation (current implementation)
    await createInitialSchema(db);
  },
  2: async (db) => {
    // Add indexes for performance
    await addPerformanceIndexes(db);
  },
  3: async (db) => {
    // Convert date columns to proper DATE type
    await migrateDateColumns(db);
  }
};
```

### Migration Implementation

```javascript
class DatabaseMigrator {
  async migrate(db, targetVersion) {
    const currentVersion = await this.getCurrentVersion(db);
    
    for (let version = currentVersion + 1; version <= targetVersion; version++) {
      if (migrations[version]) {
        await db.execute('BEGIN TRANSACTION');
        try {
          await migrations[version](db);
          await this.setVersion(db, version);
          await db.execute('COMMIT');
        } catch (error) {
          await db.execute('ROLLBACK');
          throw error;
        }
      }
    }
  }
}
```

## 🔧 Performance Optimizations

### Recommended Indexes

```sql
-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_sectionid ON events(sectionid);
CREATE INDEX IF NOT EXISTS idx_events_startdate ON events(startdate);
CREATE INDEX IF NOT EXISTS idx_attendance_eventid ON attendance(eventid);
CREATE INDEX IF NOT EXISTS idx_attendance_scoutid ON attendance(scoutid);
CREATE INDEX IF NOT EXISTS idx_attendance_lastname ON attendance(lastname);
```

### Query Optimization

**Current Queries (Examples):**
```sql
-- Get events for a section (sorted by start date)
SELECT * FROM events WHERE sectionid = ? ORDER BY startdate DESC;

-- Get attendance for an event (sorted by name)
SELECT * FROM attendance WHERE eventid = ? ORDER BY lastname, firstname;

-- Get sections (sorted by name)
SELECT * FROM sections ORDER BY sectionname;
```

## 🐛 Current Limitations & Issues

### Schema Design Issues
- ❌ **No Indexes**: Missing performance indexes on foreign keys
- ❌ **Text Dates**: Dates stored as TEXT instead of DATE/DATETIME
- ❌ **Missing Constraints**: No unique constraints or data validation
- ❌ **No Cascading**: Foreign keys don't specify CASCADE behavior

### Version Management
- ❌ **No Migration System**: No schema versioning framework
- ❌ **Hardcoded Version**: Database version hardcoded to 1
- ❌ **No Upgrade Path**: No mechanism for schema changes

### Transaction Management  
- ❌ **No Transactions**: Bulk operations not wrapped in transactions
- ❌ **Replace Pattern**: Uses DELETE + INSERT instead of UPSERT
- ❌ **No Rollback**: No rollback mechanism for failed operations

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

## 📊 Data Management Patterns

### Offline-First Strategy
1. **Local Storage**: All data stored locally first
2. **Background Sync**: Syncs with server when online
3. **Conflict Resolution**: Server data takes precedence
4. **Graceful Degradation**: App functions offline

### Sync Process
1. **Network Detection**: Monitor connection status
2. **Hierarchical Sync**: Sections → Events → Attendance
3. **Error Handling**: Continue with other data if one fails
4. **Status Tracking**: Real-time sync notifications

### Data Lifecycle
1. **Initial Load**: Fetch from server and cache locally
2. **Updates**: Server changes sync to local database
3. **Offline Changes**: Store locally, sync when online
4. **Cleanup**: No automatic cleanup implemented (opportunity for improvement)

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
- [Database Service Implementation](../src/services/database.js)
- [Sync Service Implementation](../src/services/sync.js)