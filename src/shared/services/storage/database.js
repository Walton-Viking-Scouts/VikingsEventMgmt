/**
 * @file SQLite Database Service for Vikings Event Management
 * 
 * Provides comprehensive offline-first data persistence for Scout sections, events,
 * attendance records, and member information. Uses Capacitor SQLite on native
 * platforms with localStorage fallback for web browsers. Supports demo mode
 * data segregation and comprehensive member caching across multiple sections.
 * 
 * Key features:
 * - Offline-first architecture with automatic fallback
 * - Cross-platform compatibility (iOS, Android, Web)
 * - Demo mode data isolation
 * - Comprehensive member caching to handle multi-section members
 * - Sync status tracking for data consistency
 * - Structured data schema with foreign key relationships
 * 
 * @module DatabaseService
 * @requires @capacitor-community/sqlite
 * @requires @capacitor/core
 */

import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import IndexedDBService from './indexedDBService.js';
import { SQLITE_SCHEMAS, SQLITE_INDEXES } from './schemas/sqliteSchema.js';
import { SectionSchema, EventSchema, AttendanceSchema, SharedEventMetadataSchema, TermSchema, FlexiListSchema, FlexiStructureSchema, FlexiDataSchema, safeParseArray } from './schemas/validation.js';
import { CurrentActiveTermsService } from './currentActiveTermsService.js';
import { sentryUtils } from '../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

/**
 * SQLite Database Service for offline data persistence
 * 
 * Manages all local data storage for the Vikings Event Management application.
 * Automatically detects platform capabilities and falls back to localStorage
 * when SQLite is not available. Provides consistent API across all platforms
 * with support for Scout sections, events, attendance, and member data.
 * 
 * @class
 * @example
 * // Initialize and save sections
 * import databaseService from './storage/database.js';
 * 
 * await databaseService.initialize();
 * await databaseService.saveSections([
 *   { sectionid: 1, sectionname: 'Beavers', sectiontype: 'beavers' },
 *   { sectionid: 2, sectionname: 'Cubs', sectiontype: 'cubs' }
 * ]);
 * 
 * // Retrieve sections
 * const sections = await databaseService.getSections();
 * console.log('Available sections:', sections);
 * 
 * @example
 * // Save and retrieve events for a section
 * const events = [
 *   {
 *     eventid: 'event_1',
 *     name: 'Weekend Camp',
 *     startdate: '2024-06-15',
 *     enddate: '2024-06-16',
 *     location: 'Scout Camp'
 *   }
 * ];
 * 
 * await databaseService.saveEvents(1, events);
 * const sectionEvents = await databaseService.getEvents(1);
 */
class DatabaseService {
  /**
   * Creates a new DatabaseService instance
   * 
   * Initializes the service with platform detection and default state.
   * Does not establish database connection - call initialize() for that.
   * 
   * @class
   */
  constructor() {
    /** @type {SQLiteConnection|null} SQLite connection instance */
    this.sqlite = null;
    /** @type {SQLiteDBConnection|null} Database connection instance */
    this.db = null;
    /** @type {boolean} Whether service has been initialized */
    this.isInitialized = false;
    /** @type {boolean} Whether running on native platform (iOS/Android) */
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Initializes the database service and creates necessary tables
   * 
   * Detects platform capabilities and establishes appropriate storage mechanism.
   * On native platforms, initializes SQLite with proper connections and creates
   * database schema. On web platforms, validates localStorage availability and
   * sets up fallback mode. Safe to call multiple times - subsequent calls are ignored.
   * 
   * @async
   * @returns {Promise<void>} Resolves when initialization is complete
   * @throws {Error} Only logs errors, never throws - gracefully falls back to localStorage
   * 
   * @example
   * // Initialize before any database operations
   * import databaseService from './storage/database.js';
   * 
   * try {
   *   await databaseService.initialize();
   *   console.log('Database ready for use');
   * } catch (error) {
   *   // Service automatically falls back to localStorage
   *   console.log('Using localStorage fallback');
   * }
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Only initialize SQLite on native platforms
      if (!this.isNative) {
        logger.info('Running in browser - SQLite not available, using IndexedDB', {}, LOG_CATEGORIES.DATABASE);
        this.isInitialized = true;
        return;
      }

      // Wait for platform to be ready
      await Capacitor.getPlatform();
      
      this.sqlite = new SQLiteConnection(CapacitorSQLite);
      
      // Create database
      const ret = await this.sqlite.checkConnectionsConsistency();
      const isConn = (await this.sqlite.isConnection('vikings_db', false)).result;
      
      if (ret.result && isConn) {
        this.db = await this.sqlite.retrieveConnection('vikings_db', false);
      } else {
        this.db = await this.sqlite.createConnection('vikings_db', false, 'no-encryption', 1, false);
      }
      
      await this.db.open();
      await this.createTables();
      this.isInitialized = true;
      logger.info('Database initialized successfully', {}, LOG_CATEGORIES.DATABASE);
    } catch (error) {
      logger.error('DatabaseService initialize failed', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'database_initialize',
          platform: this.isNative ? 'sqlite' : 'web',
        },
        contexts: {
          database: {
            operation: 'initialize',
          },
        },
      });
      this.isInitialized = true;
      this.isNative = false;
    }
  }

  /**
   * Creates database schema with all required tables
   * 
   * Establishes the complete database structure including sections, events,
   * attendance, members, and sync tracking tables. Uses proper foreign key
   * relationships and indexes for optimal performance. Only executed on
   * native platforms with SQLite support.
   * 
   * Tables created:
   * - sections: Scout sections (Beavers, Cubs, Scouts, etc.)
   * - events: Section events with date ranges and locations
   * - attendance: Event attendance records for individual scouts
   * - members: Comprehensive scout member information
   * - sync_status: Data synchronization tracking
   * - event_dashboard: Aggregated event summary data
   * - sync_metadata: Additional synchronization metadata
   * 
   * @async
   * @private
   * @returns {Promise<void>} Resolves when all tables are created
   * @throws {Error} If table creation fails
   * 
   * @example
   * // Called automatically during initialize()
   * await this.createTables();
   */
  async createTables() {
    const createSectionsTable = `
      CREATE TABLE IF NOT EXISTS sections (
        sectionid INTEGER PRIMARY KEY,
        sectionname TEXT NOT NULL,
        sectiontype TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createEventsTable = `
      CREATE TABLE IF NOT EXISTS events (
        eventid TEXT PRIMARY KEY,
        sectionid INTEGER,
        termid TEXT,
        name TEXT NOT NULL,
        date TEXT,
        startdate TEXT,
        startdate_g TEXT,
        enddate TEXT,
        enddate_g TEXT,
        location TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sectionid) REFERENCES sections (sectionid)
      );
    `;

    const createAttendanceTable = `
      CREATE TABLE IF NOT EXISTS attendance (
        eventid TEXT NOT NULL,
        scoutid INTEGER NOT NULL,
        sectionid INTEGER,
        attending TEXT,
        patrol TEXT,
        notes TEXT,
        isSharedSection INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (eventid, scoutid),
        FOREIGN KEY (eventid) REFERENCES events (eventid)
      );
    `;

    const createMembersTable = `
      CREATE TABLE IF NOT EXISTS members (
        scoutid INTEGER PRIMARY KEY,
        -- Basic info
        firstname TEXT,
        lastname TEXT,
        date_of_birth TEXT,
        age TEXT,
        age_years INTEGER,
        age_months INTEGER,
        
        -- Section info
        sectionid INTEGER,
        sectionname TEXT,
        section TEXT,
        sections TEXT, -- JSON array of all sections this member belongs to
        patrol TEXT,
        patrol_id INTEGER,
        person_type TEXT, -- Young People, Young Leaders, Leaders
        
        -- Membership dates
        started TEXT,
        joined TEXT,
        end_date TEXT,
        active BOOLEAN,
        
        -- Photo info
        photo_guid TEXT,
        has_photo BOOLEAN,
        pic BOOLEAN,
        
        -- Role info
        patrol_role_level INTEGER,
        patrol_role_level_label TEXT,
        
        -- Contact info (basic)
        email TEXT,
        
        -- Complex data stored as JSON
        contact_groups TEXT, -- JSON blob of all contact groups
        custom_data TEXT,    -- JSON blob of raw custom_data from OSM
        flattened_fields TEXT, -- JSON blob of all flattened custom fields
        
        -- Metadata
        read_only TEXT, -- JSON array
        filter_string TEXT,
        
        -- Versioning and sync tracking
        version INTEGER DEFAULT 1,
        local_version INTEGER DEFAULT 1,
        last_sync_version INTEGER DEFAULT 0,
        is_locally_modified BOOLEAN DEFAULT 0,
        last_synced_at DATETIME,
        conflict_resolution_needed BOOLEAN DEFAULT 0,

        -- Timestamps
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createSyncStatusTable = `
      CREATE TABLE IF NOT EXISTS sync_status (
        table_name TEXT PRIMARY KEY,
        last_sync DATETIME,
        needs_sync INTEGER DEFAULT 0
      );
    `;

    const createEventDashboardTable = `
      CREATE TABLE IF NOT EXISTS event_dashboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        section_id INTEGER NOT NULL,
        section_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        attendance_summary TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, section_id)
      );
    `;

    const createSyncMetadataTable = `
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await this.db.execute(createSectionsTable);
    await this.db.execute(createEventsTable);
    await this.db.execute(createAttendanceTable);
    await this.db.execute(createMembersTable);
    await this.db.execute(createSyncStatusTable);
    await this.db.execute(createEventDashboardTable);
    await this.db.execute(createSyncMetadataTable);

    await this.db.execute(SQLITE_SCHEMAS.flexi_lists);
    await this.db.execute(SQLITE_SCHEMAS.flexi_structure);
    await this.db.execute(SQLITE_SCHEMAS.flexi_data);
    await this.db.execute(SQLITE_SCHEMAS.shared_event_metadata);

    for (const indexSql of SQLITE_INDEXES) {
      await this.db.execute(indexSql);
    }
  }

  /**
   * Saves Scout sections to local storage
   * 
   * Stores section information with complete replacement of existing data.
   * On native platforms, uses SQLite with proper transaction handling.
   * On web platforms, uses localStorage with demo mode data segregation.
   * Automatically updates sync status after successful save.
   * 
   * @async
   * @param {Array<Object>} sections - Array of section objects to save
   * @param {number} sections[].sectionid - Unique section identifier
   * @param {string} sections[].sectionname - Display name (e.g., "1st Walton Beavers")
   * @param {string} [sections[].sectiontype] - Section type (e.g., "beavers", "cubs")
   * @returns {Promise<void>} Resolves when sections are saved
   * 
   * @example
   * // Save sections for a Scout group
   * const sections = [
   *   { sectionid: 1, sectionname: '1st Walton Beavers', sectiontype: 'beavers' },
   *   { sectionid: 2, sectionname: '1st Walton Cubs', sectiontype: 'cubs' },
   *   { sectionid: 3, sectionname: '1st Walton Scouts', sectiontype: 'scouts' }
   * ];
   * 
   * await databaseService.saveSections(sections);
   * console.log('Sections saved successfully');
   */
  async saveSections(sections) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      const { data: validSections, errors } = safeParseArray(SectionSchema, sections);
      if (errors.length > 0) {
        logger.warn('Section validation errors during save', {
          errorCount: errors.length,
          totalCount: sections?.length,
          errors: errors.slice(0, 5),
        }, LOG_CATEGORIES.DATABASE);
      }
      await IndexedDBService.bulkReplaceSections(validSections);
      return;
    }

    await this.db.execute('BEGIN TRANSACTION');
    try {
      await this.db.execute('DELETE FROM sections');

      for (const section of sections) {
        const insert = `
          INSERT INTO sections (sectionid, sectionname, sectiontype)
          VALUES (?, ?, ?)
        `;
        await this.db.run(insert, [section.sectionid, section.sectionname, section.sectiontype]);
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }

    await this.updateSyncStatus('sections');
  }

  /**
   * Retrieves all Scout sections from local storage
   * 
   * Loads section information with automatic demo mode filtering.
   * On native platforms, queries SQLite database with proper ordering.
   * On web platforms, retrieves from localStorage with data validation.
   * Automatically filters out demo sections when not in demo mode.
   * 
   * @async
   * @returns {Promise<Array<Object>>} Array of section objects
   * @returns {number} returns[].sectionid - Unique section identifier
   * @returns {string} returns[].sectionname - Display name
   * @returns {string} [returns[].sectiontype] - Section type
   * 
   * @example
   * // Get all available sections
   * const sections = await databaseService.getSections();
   * 
   * sections.forEach(section => {
   *   console.log(`Section: ${section.sectionname} (ID: ${section.sectionid})`);
   * });
   * 
   * @example
   * // Use sections to populate dropdown
   * const sections = await databaseService.getSections();
   * const sectionOptions = sections.map(section => ({
   *   value: section.sectionid,
   *   label: section.sectionname
   * }));
   */
  async getSections() {
    await this.initialize();

    if (!this.isNative || !this.db) {
      const sections = await IndexedDBService.getAllSections();
      const { isDemoMode } = await import('../../../config/demoMode.js');
      if (!isDemoMode()) {
        return sections.filter(s => !(typeof s?.sectionname === 'string' && s.sectionname.startsWith('Demo ')));
      }
      return sections;
    }

    const query = 'SELECT * FROM sections ORDER BY sectionname';
    const result = await this.db.query(query);
    return result.values || [];
  }

  /**
   * Saves Scout events for a specific section
   * 
   * Stores event information with section-specific data isolation.
   * Replaces all existing events for the specified section. On native
   * platforms, uses SQLite with foreign key relationships. On web platforms,
   * uses localStorage with section-specific keys and demo mode support.
   * 
   * @async
   * @param {number} sectionId - Section identifier to save events for
   * @param {Array<Object>} events - Array of event objects to save
   * @param {string|number} events[].eventid - Unique event identifier
   * @param {string} events[].name - Event name/title
   * @param {string} [events[].date] - Legacy date field
   * @param {string} events[].startdate - Event start date (YYYY-MM-DD)
   * @param {string} [events[].startdate_g] - Start date in different format
   * @param {string} [events[].enddate] - Event end date (YYYY-MM-DD)
   * @param {string} [events[].enddate_g] - End date in different format
   * @param {string} [events[].location] - Event location/venue
   * @param {string} [events[].notes] - Additional event notes
   * @param {string} [events[].termid] - Associated term identifier
   * @returns {Promise<void>} Resolves when events are saved
   * 
   * @example
   * // Save events for Beavers section
   * const beaverEvents = [
   *   {
   *     eventid: 'event_123',
   *     name: 'Beaver Colony Meeting',
   *     startdate: '2024-06-15',
   *     enddate: '2024-06-15',
   *     location: 'Scout Hut',
   *     notes: 'Weekly meeting with badge work'
   *   },
   *   {
   *     eventid: 'camp_456',
   *     name: 'Weekend Camp',
   *     startdate: '2024-07-20',
   *     enddate: '2024-07-21',
   *     location: 'Phasels Wood Scout Camp'
   *   }
   * ];
   * 
   * await databaseService.saveEvents(1, beaverEvents);
   */
  async saveEvents(sectionId, events) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      const { data: validEvents, errors } = safeParseArray(EventSchema, events);
      if (errors.length > 0) {
        logger.warn('Event validation errors during save', {
          errorCount: errors.length,
          totalCount: events?.length,
          errors: errors.slice(0, 5),
        }, LOG_CATEGORIES.DATABASE);
      }
      await IndexedDBService.bulkReplaceEventsForSection(sectionId, validEvents);
      return;
    }

    await this.db.execute('BEGIN TRANSACTION');
    try {
      const deleteOld = 'DELETE FROM events WHERE sectionid = ?';
      await this.db.run(deleteOld, [sectionId]);

      for (const event of events) {
        const insert = `
          INSERT INTO events (eventid, sectionid, termid, name, date, startdate, startdate_g, enddate, enddate_g, location, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await this.db.run(insert, [
          event.eventid,
          sectionId,
          event.termid || null,
          event.name,
          event.date,
          event.startdate,
          event.startdate_g,
          event.enddate,
          event.enddate_g,
          event.location,
          event.notes,
        ]);
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }

    await this.updateSyncStatus('events');
  }

  /**
   * Retrieves Scout events for a specific section
   * 
   * Loads event information with automatic demo mode filtering and proper
   * date ordering. On native platforms, queries SQLite with section filtering.
   * On web platforms, retrieves from localStorage with data validation.
   * Returns events sorted by start date (most recent first).
   * 
   * @async
   * @param {number} sectionId - Section identifier to get events for
   * @returns {Promise<Array<Object>>} Array of event objects for the section
   * @returns {string|number} returns[].eventid - Unique event identifier
   * @returns {string} returns[].name - Event name/title
   * @returns {string} returns[].startdate - Event start date
   * @returns {string} [returns[].enddate] - Event end date
   * @returns {string} [returns[].location] - Event location
   * @returns {string} [returns[].notes] - Event notes
   * 
   * @example
   * // Get events for Beavers section
   * const beaverEvents = await databaseService.getEvents(1);
   * 
   * console.log(`Found ${beaverEvents.length} events for Beavers:`);
   * beaverEvents.forEach(event => {
   *   console.log(`- ${event.name} on ${event.startdate}`);
   * });
   * 
   * @example
   * // Display upcoming events
   * const events = await databaseService.getEvents(sectionId);
   * const today = new Date().toISOString().split('T')[0];
   * 
   * const upcomingEvents = events.filter(event => 
   *   event.startdate >= today
   * );
   */
  async getEvents(sectionId) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      const events = await IndexedDBService.getEventsBySection(sectionId);
      const { isDemoMode } = await import('../../../config/demoMode.js');
      if (!isDemoMode()) {
        return events.filter(e => !(typeof e?.eventid === 'string' && e.eventid.startsWith('demo_event_')));
      }
      return events;
    }

    const query = 'SELECT * FROM events WHERE sectionid = ? ORDER BY startdate DESC';
    const result = await this.db.query(query, [sectionId]);
    return result.values || [];
  }

  /**
   * Retrieves events for a specific term across all sections
   *
   * @async
   * @param {string} termId - Term identifier to get events for
   * @returns {Promise<Array<Object>>} Array of event objects for the term
   */
  async getEventsByTerm(termId) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return IndexedDBService.getEventsByTerm(termId);
    }

    const query = 'SELECT * FROM events WHERE termid = ? ORDER BY startdate DESC';
    const result = await this.db.query(query, [termId]);
    return result.values || [];
  }

  /**
   * Retrieves a single event by its event ID
   *
   * @async
   * @param {string} eventId - Event identifier to look up
   * @returns {Promise<Object|null>} The event object or null if not found
   */
  async getEventById(eventId) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return IndexedDBService.getEventById(eventId);
    }

    const query = 'SELECT * FROM events WHERE eventid = ?';
    const result = await this.db.query(query, [eventId]);
    return result.values?.[0] || null;
  }

  /**
   * Saves attendance records for a specific event
   *
   * Validates with Zod at the write boundary and stores to normalized
   * IndexedDB (web) or SQLite with transaction wrapping (native).
   * Replaces all existing attendance records for the specified event.
   * Unknown fields are logged to Sentry as warnings.
   *
   * @async
   * @param {string|number} eventId - Event identifier to save attendance for
   * @param {Array<Object>} attendanceData - Array of attendance records
   * @returns {Promise<void>} Resolves when attendance is saved
   */
  async saveAttendance(eventId, attendanceData) {
    await this.initialize();

    const KNOWN_ATTENDANCE_KEYS = ['scoutid', 'eventid', 'sectionid', 'attending', 'patrol', 'notes', 'isSharedSection', 'updated_at'];

    const { data: validRecords, errors } = safeParseArray(AttendanceSchema, attendanceData);
    if (errors.length > 0) {
      logger.warn('Attendance validation errors during save', {
        errorCount: errors.length,
        totalCount: attendanceData?.length,
        errors: errors.slice(0, 5),
      }, LOG_CATEGORIES.DATABASE);
    }

    for (const record of validRecords) {
      const unknownKeys = Object.keys(record).filter(k => !KNOWN_ATTENDANCE_KEYS.includes(k));
      if (unknownKeys.length > 0) {
        sentryUtils.captureMessage('Attendance record has unknown fields', {
          level: 'warning',
          extra: { unknownKeys, eventid: eventId },
        });
        break;
      }
    }

    if (!this.isNative || !this.db) {
      await IndexedDBService.bulkReplaceAttendanceForEvent(eventId, validRecords);
      return;
    }

    await this.db.execute('BEGIN TRANSACTION');
    try {
      await this.db.run('DELETE FROM attendance WHERE eventid = ?', [eventId]);

      for (const record of validRecords) {
        const insert = `
          INSERT INTO attendance (eventid, scoutid, sectionid, attending, patrol, notes, isSharedSection)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await this.db.run(insert, [
          record.eventid,
          record.scoutid,
          record.sectionid,
          record.attending,
          record.patrol,
          record.notes,
          record.isSharedSection ? 1 : 0,
        ]);
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }

    await this.updateSyncStatus('attendance');
  }

  /**
   * Retrieves attendance records for a specific event from normalized storage
   *
   * @async
   * @param {string|number} eventId - Event identifier to get attendance for
   * @returns {Promise<Array<Object>>} Array of attendance records
   */
  async getAttendance(eventId) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return IndexedDBService.getAttendanceByEvent(String(eventId));
    }

    const query = 'SELECT * FROM attendance WHERE eventid = ? ORDER BY scoutid';
    const result = await this.db.query(query, [eventId]);
    return result.values || [];
  }

  /**
   * Saves shared attendance records for a specific event
   *
   * Stores attendance records with isSharedSection marker. Only replaces
   * shared records for the event, preserving regular attendance records.
   *
   * @async
   * @param {string|number} eventId - Event identifier
   * @param {Array<Object>} attendanceData - Array of shared attendance records
   * @returns {Promise<void>}
   */
  async saveSharedAttendance(eventId, attendanceData) {
    await this.initialize();

    const markedData = (Array.isArray(attendanceData) ? attendanceData : []).map(record => ({
      ...record,
      isSharedSection: true,
    }));

    const KNOWN_ATTENDANCE_KEYS = ['scoutid', 'eventid', 'sectionid', 'attending', 'patrol', 'notes', 'isSharedSection', 'updated_at'];

    const { data: validRecords, errors } = safeParseArray(AttendanceSchema, markedData);
    if (errors.length > 0) {
      logger.warn('Shared attendance validation errors during save', {
        errorCount: errors.length,
        totalCount: attendanceData?.length,
        errors: errors.slice(0, 5),
      }, LOG_CATEGORIES.DATABASE);
    }

    for (const record of validRecords) {
      const unknownKeys = Object.keys(record).filter(k => !KNOWN_ATTENDANCE_KEYS.includes(k));
      if (unknownKeys.length > 0) {
        sentryUtils.captureMessage('Shared attendance record has unknown fields', {
          level: 'warning',
          extra: { unknownKeys, eventid: eventId },
        });
        break;
      }
    }

    if (!this.isNative || !this.db) {
      const db = await IndexedDBService.getDB();
      const tx = db.transaction('attendance', 'readwrite');
      const store = tx.objectStore('attendance');
      const index = store.index('eventid');

      let cursor = await index.openCursor(String(eventId));
      while (cursor) {
        if (cursor.value.isSharedSection === true) {
          await cursor.delete();
        }
        cursor = await cursor.continue();
      }

      for (const record of validRecords) {
        await store.put({ ...record, updated_at: Date.now() });
      }

      await tx.done;
      return;
    }

    await this.db.execute('BEGIN TRANSACTION');
    try {
      await this.db.run('DELETE FROM attendance WHERE eventid = ? AND isSharedSection = 1', [eventId]);

      for (const record of validRecords) {
        const insert = `
          INSERT INTO attendance (eventid, scoutid, sectionid, attending, patrol, notes, isSharedSection)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await this.db.run(insert, [
          record.eventid,
          record.scoutid,
          record.sectionid,
          record.attending,
          record.patrol,
          record.notes,
          1,
        ]);
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }

    await this.updateSyncStatus('attendance');
  }

  /**
   * Saves shared event metadata
   *
   * @async
   * @param {Object} metadata - Shared event metadata object with eventid
   * @returns {Promise<void>}
   */
  async saveSharedEventMetadata(metadata) {
    await this.initialize();

    const result = SharedEventMetadataSchema.safeParse(metadata);
    if (!result.success) {
      logger.warn('SharedEventMetadata validation failed', {
        issues: result.error.issues,
      }, LOG_CATEGORIES.DATABASE);
      throw new Error('SharedEventMetadata validation failed');
    }
    const validMetadata = result.data;

    if (!this.isNative || !this.db) {
      await IndexedDBService.saveSharedEventMetadata(validMetadata);
      return;
    }

    const insert = `
      INSERT OR REPLACE INTO shared_event_metadata (eventid, is_shared_event, owner_section_id, sections, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    await this.db.run(insert, [
      validMetadata.eventid,
      validMetadata.isSharedEvent ? 1 : 0,
      validMetadata.ownerSectionId ?? null,
      JSON.stringify(validMetadata.sections),
      Date.now(),
    ]);
  }

  /**
   * Retrieves shared event metadata for a specific event
   *
   * @async
   * @param {string|number} eventId - Event identifier
   * @returns {Promise<Object|null>} Shared event metadata or null
   */
  async getSharedEventMetadata(eventId) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return IndexedDBService.getSharedEventMetadata(String(eventId));
    }

    const query = 'SELECT * FROM shared_event_metadata WHERE eventid = ?';
    const result = await this.db.query(query, [eventId]);
    const row = result.values?.[0];
    if (!row) return null;

    return {
      ...row,
      sections: row.sections ? JSON.parse(row.sections) : [],
    };
  }

  /**
   * Retrieves attendance records for a specific scout across all events
   *
   * @async
   * @param {number|string} scoutId - Scout identifier
   * @returns {Promise<Array<Object>>} Array of attendance records
   */
  async getAttendanceByScout(scoutId) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return IndexedDBService.getAttendanceByScout(Number(scoutId));
    }

    const query = 'SELECT * FROM attendance WHERE scoutid = ? ORDER BY eventid';
    const result = await this.db.query(query, [scoutId]);
    return result.values || [];
  }

  /**
   * Updates synchronization status for a data table
   * 
   * Records when data was last synchronized and marks table as current.
   * Used for offline-first architecture to track which data needs
   * synchronization when connection is restored. Only operates on
   * native platforms with SQLite support.
   * 
   * @async
   * @private
   * @param {string} tableName - Name of table to update sync status for
   * @returns {Promise<void>} Resolves when sync status is updated
   * 
   * @example
   * // Called automatically after successful data saves
   * await this.updateSyncStatus('sections');
   * await this.updateSyncStatus('events');
   */
  async updateSyncStatus(tableName) {
    if (!this.isNative || !this.db) return; // Skip for localStorage fallback
    
    const update = `
      INSERT OR REPLACE INTO sync_status (table_name, last_sync, needs_sync)
      VALUES (?, CURRENT_TIMESTAMP, 0)
    `;
    await this.db.run(update, [tableName]);
  }

  /**
   * Checks if a data table needs synchronization
   * 
   * Determines whether data has been modified locally and requires
   * synchronization with the server. Used to optimize sync operations
   * and avoid unnecessary network requests.
   * 
   * @async
   * @param {string} tableName - Name of table to check sync status for
   * @returns {Promise<boolean>} True if table needs synchronization
   * 
   * @example
   * // Check if sections need syncing before API call
   * if (await databaseService.needsSync('sections')) {
   *   console.log('Sections data needs synchronization');
   *   // Perform sync operation
   * }
   */
  async needsSync(tableName) {
    if (!this.isNative || !this.db) return false; // Skip for localStorage fallback
    
    const query = 'SELECT needs_sync FROM sync_status WHERE table_name = ?';
    const result = await this.db.query(query, [tableName]);
    return result.values?.[0]?.needs_sync === 1;
  }

  /**
   * Saves Scout member information with comprehensive caching
   * 
   * Stores member data using a single comprehensive cache that handles
   * multi-section members efficiently. Deduplicates members by scout ID
   * while preserving section associations. Critical for offline member
   * lookup during events and meetings.
   * 
   * @async
   * @param {Array<number>} sectionIds - Section identifiers members belong to
   * @param {Array<Object>} members - Array of member objects to save
   * @param {number} members[].scoutid - Unique scout identifier
   * @param {string} members[].firstname - Scout's first name
   * @param {string} members[].lastname - Scout's last name
   * @param {string} [members[].date_of_birth] - Date of birth (YYYY-MM-DD)
   * @param {number} [members[].age_years] - Age in years
   * @param {number} members[].sectionid - Primary section ID
   * @param {string} members[].sectionname - Primary section name
   * @param {Array<string>} [members[].sections] - All sections member belongs to
   * @param {string} [members[].patrol] - Patrol/lodge name
   * @param {string} [members[].person_type] - Member type (Young People/Leaders)
   * @param {boolean} [members[].active] - Whether member is currently active
   * @param {Object} [members[].custom_data] - Additional OSM custom field data
   * @returns {Promise<void>} Resolves when members are saved
   * 
   * @example
   * // Save members for multiple sections
   * const members = [
   *   {
   *     scoutid: 12345,
   *     firstname: 'Alice',
   *     lastname: 'Smith',
   *     age_years: 8,
   *     sectionid: 1,
   *     sectionname: 'Beavers',
   *     patrol: 'Red Lodge',
   *     active: true
   *   }
   * ];
   * 
   * await databaseService.saveMembers([1, 2], members);
   */
  async saveMembers(sectionIds, members) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      const coreMembers = [];
      const sectionMembers = [];
      const coreMemberMap = new Map();

      const knownFields = new Set([
        'scoutid', 'member_id', 'firstname', 'lastname', 'date_of_birth', 'age', 'age_years', 'age_months', 'yrs',
        'sectionid', 'sectionname', 'section', 'sections', 'patrol', 'patrol_id', 'person_type',
        'started', 'joined', 'end_date', 'active', 'photo_guid', 'has_photo', 'pic',
        'patrol_role_level', 'patrol_role_level_label', 'email', 'contact_groups', 'custom_data',
        'read_only', 'filter_string', '_filterString', 'sectionMemberships',
      ]);

      for (const member of members) {
        if (!member.scoutid && !member.member_id) {
          continue;
        }

        const scoutid = member.scoutid || member.member_id;

        const flattenedFields = {};
        Object.keys(member).forEach(key => {
          if (!knownFields.has(key)) {
            flattenedFields[key] = member[key];
          }
        });

        const coreData = {
          scoutid,
          firstname: member.firstname,
          lastname: member.lastname,
          date_of_birth: member.date_of_birth,
          photo_guid: member.photo_guid,
          has_photo: member.has_photo,
          contact_groups: member.contact_groups || {},
          custom_data: member.custom_data || {},
          flattened_fields: flattenedFields,
          age: member.age,
          yrs: member.yrs,
          email: member.email,
          age_years: member.age_years,
          age_months: member.age_months,
          pic: member.pic,
          read_only: member.read_only,
          filter_string: member.filter_string,
        };

        if (!coreMemberMap.has(scoutid)) {
          coreMemberMap.set(scoutid, coreData);
        } else {
          const existing = coreMemberMap.get(scoutid);
          // Merge all fields from new data into existing
          Object.keys(coreData).forEach(key => {
            if (key === 'contact_groups' || key === 'custom_data' || key === 'flattened_fields') {
              // Deep merge for these special fields
              existing[key] = { ...existing[key], ...coreData[key] };
            } else if (coreData[key] !== undefined) {
              // Update all other fields if they're present in new data
              existing[key] = coreData[key];
            }
            // If coreData[key] is undefined, keep existing value (accumulate from other sections)
          });
        }

        if (member.sectionMemberships && Array.isArray(member.sectionMemberships)) {
          member.sectionMemberships.forEach(sectionMembership => {
            const sectionData = {
              scoutid,
              sectionid: sectionMembership.sectionid,
              person_type: sectionMembership.person_type,
              patrol: sectionMembership.patrol,
              patrol_id: sectionMembership.patrol_id,
              started: sectionMembership.started,
              joined: sectionMembership.joined,
              end_date: sectionMembership.end_date,
              active: sectionMembership.active,
              patrol_role_level: sectionMembership.patrol_role_level,
              patrol_role_level_label: sectionMembership.patrol_role_level_label,
              sectionname: sectionMembership.sectionname,
              section: sectionMembership.section,
            };
            sectionMembers.push(sectionData);
          });
        } else if (member.sectionid) {
          const sectionData = {
            scoutid,
            sectionid: member.sectionid,
            person_type: member.person_type,
            patrol: member.patrol,
            patrol_id: member.patrol_id,
            started: member.started,
            joined: member.joined,
            end_date: member.end_date,
            active: member.active,
            patrol_role_level: member.patrol_role_level,
            patrol_role_level_label: member.patrol_role_level_label,
            sectionname: member.sectionname,
            section: member.section,
          };
          sectionMembers.push(sectionData);
        }
      }

      coreMembers.push(...coreMemberMap.values());

      try {
        if (coreMembers.length > 0) {
          await IndexedDBService.bulkUpsertCoreMembers(coreMembers);
        }

        if (sectionMembers.length > 0) {
          await IndexedDBService.bulkUpsertMemberSections(sectionMembers);
        }
      } catch (error) {
        logger.error('DatabaseService saveMembers failed', {
          coreMembersCount: coreMembers.length,
          sectionMembersCount: sectionMembers.length,
          error: error.message,
          stack: error.stack,
        }, LOG_CATEGORIES.ERROR);

        sentryUtils.captureException(error, {
          tags: {
            operation: 'database_save_members',
            platform: this.isNative ? 'sqlite' : 'web',
          },
          contexts: {
            database: {
              operation: 'saveMembers',
              coreMembersCount: coreMembers.length,
              sectionMembersCount: sectionMembers.length,
            },
          },
        });
        throw error;
      }

      return;
    }

    for (const member of members) {
      const knownFields = new Set([
        'scoutid', 'member_id', 'firstname', 'lastname', 'date_of_birth', 'age', 'age_years', 'age_months',
        'sectionid', 'sectionname', 'section', 'sections', 'patrol', 'patrol_id', 'person_type',
        'started', 'joined', 'end_date', 'active', 'photo_guid', 'has_photo', 'pic',
        'patrol_role_level', 'patrol_role_level_label', 'email', 'contact_groups', 'custom_data',
        'read_only', 'filter_string', '_filterString',
      ]);

      const flattenedFields = {};
      Object.keys(member).forEach(key => {
        if (!knownFields.has(key)) {
          flattenedFields[key] = member[key];
        }
      });

      const insert = `
        REPLACE INTO members (
          scoutid, firstname, lastname, date_of_birth, age, age_years, age_months,
          sectionid, sectionname, section, sections, patrol, patrol_id, person_type,
          started, joined, end_date, active, photo_guid, has_photo, pic,
          patrol_role_level, patrol_role_level_label, email,
          contact_groups, custom_data, flattened_fields, read_only, filter_string
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.run(insert, [
        member.scoutid || member.member_id,
        member.firstname,
        member.lastname,
        member.date_of_birth,
        member.age,
        member.age_years,
        member.age_months,
        member.sectionid,
        member.sectionname,
        member.section,
        JSON.stringify(member.sections || []),
        member.patrol,
        member.patrol_id,
        member.person_type,
        member.started,
        member.joined,
        member.end_date,
        member.active,
        member.photo_guid,
        member.has_photo,
        member.pic,
        member.patrol_role_level,
        member.patrol_role_level_label,
        member.email,
        JSON.stringify(member.contact_groups || {}),
        JSON.stringify(member.custom_data || {}),
        JSON.stringify(flattenedFields),
        JSON.stringify(member.read_only || []),
        member._filterString || member.filter_string,
      ]);
    }

    await this.updateSyncStatus('members');
  }

  /**
   * Retrieves Scout members for specified sections
   * 
   * Loads member information with section filtering and proper data
   * reconstruction. Handles comprehensive member cache and ensures
   * backward compatibility. Returns members with all custom fields
   * and section associations intact.
   * 
   * @async
   * @param {Array<number>} sectionIds - Section identifiers to get members for
   * @returns {Promise<Array<Object>>} Array of member objects
   * @returns {number} returns[].scoutid - Scout identifier
   * @returns {string} returns[].firstname - Scout's first name
   * @returns {string} returns[].lastname - Scout's last name
   * @returns {number} [returns[].age_years] - Age in years
   * @returns {string} returns[].sectionname - Section name
   * @returns {string} [returns[].patrol] - Patrol/lodge name
   * @returns {Array<string>} [returns[].sections] - All sections member belongs to
   * @returns {Object} [returns[].custom_data] - Custom field data from OSM
   * 
   * @example
   * // Get all Beaver members
   * const beaverMembers = await databaseService.getMembers([1]);
   * 
   * console.log(`Found ${beaverMembers.length} Beaver scouts:`);
   * beaverMembers.forEach(member => {
   *   console.log(`- ${member.firstname} ${member.lastname} (${member.age_years} years)`);
   * });
   * 
   * @example
   * // Get members for multiple sections
   * const allMembers = await databaseService.getMembers([1, 2, 3]);
   * const leaders = allMembers.filter(member => 
   *   member.person_type === 'Leaders'
   * );
   */
  async getMembers(sectionIds) {
    await this.initialize();

    if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
      logger.warn('getMembers called with invalid sectionIds', { sectionIds }, LOG_CATEGORIES.DATABASE);
      return [];
    }

    if (!this.isNative || !this.db) {
      try {
        const sectionMemberships = await Promise.all(
          sectionIds.map(sectionId =>
            IndexedDBService.getMemberSectionsBySection(sectionId),
          ),
        ).then(results => results.flat());

        if (!sectionMemberships.length) {
          return [];
        }

        const uniqueScoutIds = [...new Set(sectionMemberships.map(m => m.scoutid))];

        const coreMembers = await Promise.all(
          uniqueScoutIds.map(scoutid => IndexedDBService.getCoreMember(scoutid)),
        );

        const coreMemberMap = new Map(
          coreMembers.filter(m => m).map(m => [m.scoutid, m]),
        );

        const sectionsByScoutId = new Map();
        for (const section of sectionMemberships) {
          if (!sectionsByScoutId.has(section.scoutid)) {
            sectionsByScoutId.set(section.scoutid, []);
          }
          sectionsByScoutId.get(section.scoutid).push(section);
        }

        const members = [];
        const processedScoutIds = new Set();

        for (const sectionMember of sectionMemberships) {
          if (processedScoutIds.has(sectionMember.scoutid)) {
            continue;
          }
          processedScoutIds.add(sectionMember.scoutid);

          const core = coreMemberMap.get(sectionMember.scoutid);
          if (!core) {
            logger.warn('Orphaned member_section record - missing core_members data', {
              scoutid: sectionMember.scoutid,
              sectionid: sectionMember.sectionid,
            }, LOG_CATEGORIES.DATABASE);
            continue;
          }

          const allSections = sectionsByScoutId.get(sectionMember.scoutid) || [];

          const member = {
            scoutid: core.scoutid,
            member_id: core.scoutid,
            firstname: core.firstname,
            lastname: core.lastname,
            date_of_birth: core.date_of_birth,
            dateofbirth: core.date_of_birth,
            age: core.age,
            age_years: core.age_years || null,
            age_months: core.age_months || null,
            yrs: core.yrs,
            photo_guid: core.photo_guid,
            has_photo: core.has_photo,
            pic: core.pic || null,
            email: core.email,
            contact_groups: core.contact_groups || {},
            custom_data: core.custom_data || {},
            read_only: core.read_only || [],

            sectionid: sectionMember.sectionid,
            sectionname: sectionMember.sectionname,
            section: sectionMember.section,
            person_type: sectionMember.person_type,
            patrol: sectionMember.patrol,
            patrol_id: sectionMember.patrol_id,
            started: sectionMember.started,
            joined: sectionMember.joined,
            end_date: sectionMember.end_date,
            active: sectionMember.active,
            patrol_role_level: sectionMember.patrol_role_level,
            patrol_role_level_label: sectionMember.patrol_role_level_label,

            sections: allSections.map(s => ({
              section_id: s.sectionid,
              sectionid: s.sectionid,
              sectionname: s.sectionname,
              section: s.section,
              person_type: s.person_type,
              patrol: s.patrol,
              active: s.active,
            })),

            ...(typeof core.flattened_fields === 'object' && !Array.isArray(core.flattened_fields)
              ? core.flattened_fields
              : {}),
          };

          members.push(member);
        }

        members.sort((a, b) => {
          const lastNameCmp = (a.lastname || '').localeCompare(b.lastname || '');
          return lastNameCmp !== 0 ? lastNameCmp : (a.firstname || '').localeCompare(b.firstname || '');
        });

        return members;

      } catch (error) {
        logger.warn('Failed to fetch members from dual-store', {
          error: error.message,
          sectionIds,
        }, LOG_CATEGORIES.DATABASE);
        return [];
      }
    }
    
    const placeholders = sectionIds.map(() => '?').join(',');
    const query = `SELECT * FROM members WHERE sectionid IN (${placeholders}) ORDER BY lastname, firstname`;
    const result = await this.db.query(query, sectionIds);
    
    // Reconstruct full member objects from database
    return (result.values || []).map(dbMember => {
      // Parse JSON fields back to objects/arrays
      const member = {
        ...dbMember,
        sections: dbMember.sections ? JSON.parse(dbMember.sections) : [],
        contact_groups: dbMember.contact_groups ? JSON.parse(dbMember.contact_groups) : {},
        custom_data: dbMember.custom_data ? JSON.parse(dbMember.custom_data) : {},
        read_only: dbMember.read_only ? JSON.parse(dbMember.read_only) : [],
      };
      
      // Restore flattened fields to the member object
      if (dbMember.flattened_fields) {
        try {
          const flattenedFields = JSON.parse(dbMember.flattened_fields);
          Object.assign(member, flattenedFields);
        } catch (error) {
          logger.warn('Failed to parse flattened_fields for member', {
            scoutid: dbMember.scoutid,
            error: error.message,
          }, LOG_CATEGORIES.DATABASE);
        }
      }
      
      // Ensure backward compatibility field mappings
      if (!member.member_id && member.scoutid) {
        member.member_id = member.scoutid;
      }
      if (!member.dateofbirth && member.date_of_birth) {
        member.dateofbirth = member.date_of_birth;
      }
      
      return member;
    });
  }

  /**
   * Checks if offline data is available
   * 
   * Determines whether the application has any cached data available
   * for offline operation. Used to decide whether to show cached
   * content or force an online data fetch.
   * 
   * @async
   * @returns {Promise<boolean>} True if offline data is available
   * 
   * @example
   * // Check data availability before rendering
   * const hasData = await databaseService.hasOfflineData();
   * 
   * if (hasData) {
   *   console.log('Offline data available - can work offline');
   *   // Load cached sections and events
   * } else {
   *   console.log('No offline data - need internet connection');
   *   // Force online data fetch
   * }
   */
  async hasOfflineData() {
    await this.initialize();

    if (!this.isNative || !this.db) {
      const sections = await IndexedDBService.getAllSections();
      return Array.isArray(sections) && sections.length > 0;
    }

    const sectionsQuery = 'SELECT COUNT(*) as count FROM sections';
    const result = await this.db.query(sectionsQuery);
    return result.values?.[0]?.count > 0;
  }

  /**
   * Get records with conflicts that need resolution
   */
  async getConflictRecords(tableName = 'attendance') {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return [];
    }

    // Whitelist allowed table names to prevent SQL injection
    const allowedTables = ['attendance', 'members', 'events', 'sections'];
    const safeTableName = allowedTables.includes(tableName) ? tableName : 'attendance';

    const query = `SELECT * FROM ${safeTableName} WHERE conflict_resolution_needed = 1`;
    const result = await this.db.query(query);
    return result.values || [];
  }

  /**
   * Get locally modified records that haven't been synced
   */
  async getLocallyModifiedRecords(tableName = 'attendance') {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return [];
    }

    // Whitelist allowed table names to prevent SQL injection
    const allowedTables = ['attendance', 'members', 'events', 'sections'];
    const safeTableName = allowedTables.includes(tableName) ? tableName : 'attendance';

    const query = `SELECT * FROM ${safeTableName} WHERE is_locally_modified = 1 AND local_version > last_sync_version`;
    const result = await this.db.query(query);
    return result.values || [];
  }

  /**
   * Mark record as having a conflict
   */
  async markConflict(tableName, recordId, hasConflict = true) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return;
    }

    // Whitelist allowed table names to prevent SQL injection
    const allowedTables = ['attendance', 'members', 'events', 'sections'];
    const safeTableName = allowedTables.includes(tableName) ? tableName : 'attendance';

    const query = `UPDATE ${safeTableName} SET conflict_resolution_needed = ? WHERE id = ?`;
    await this.db.run(query, [hasConflict ? 1 : 0, recordId]);
  }

  /**
   * Get version information for a record
   */
  async getRecordVersions(tableName, recordId) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return null;
    }

    // Whitelist allowed table names to prevent SQL injection
    const allowedTables = ['attendance', 'members', 'events', 'sections'];
    const safeTableName = allowedTables.includes(tableName) ? tableName : 'attendance';

    const query = `
      SELECT version, local_version, last_sync_version, is_locally_modified,
             updated_at, last_synced_at, conflict_resolution_needed
      FROM ${safeTableName} WHERE id = ?
    `;
    const result = await this.db.query(query, [recordId]);
    return result.values?.[0] || null;
  }

  /**
   * Update record versions after sync
   */
  async updateRecordVersions(tableName, recordId, versions) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return;
    }

    // Whitelist allowed table names to prevent SQL injection
    const allowedTables = ['attendance', 'members', 'events', 'sections'];
    const safeTableName = allowedTables.includes(tableName) ? tableName : 'attendance';

    const {
      version,
      localVersion,
      lastSyncVersion,
      isLocallyModified = false,
      conflictResolutionNeeded = false,
    } = versions;

    const query = `
      UPDATE ${safeTableName} SET
        version = ?,
        local_version = ?,
        last_sync_version = ?,
        is_locally_modified = ?,
        conflict_resolution_needed = ?,
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await this.db.run(query, [
      version,
      localVersion,
      lastSyncVersion,
      isLocallyModified ? 1 : 0,
      conflictResolutionNeeded ? 1 : 0,
      recordId,
    ]);
  }

  /**
   * Delete attendance record (used by offline operations)
   */
  async deleteAttendance(eventId) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      await IndexedDBService.bulkReplaceAttendanceForEvent(eventId, []);
      return;
    }

    const query = 'DELETE FROM attendance WHERE eventid = ?';
    await this.db.run(query, [eventId]);
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    await this.initialize();

    if (!this.isNative || !this.db) {
      return {
        totalRecords: 0,
        locallyModified: 0,
        conflicted: 0,
        synced: 0,
      };
    }

    const stats = {};

    // Count total attendance records
    const totalQuery = 'SELECT COUNT(*) as count FROM attendance';
    const totalResult = await this.db.query(totalQuery);
    stats.totalRecords = totalResult.values?.[0]?.count || 0;

    // Count locally modified
    const modifiedQuery = 'SELECT COUNT(*) as count FROM attendance WHERE is_locally_modified = 1';
    const modifiedResult = await this.db.query(modifiedQuery);
    stats.locallyModified = modifiedResult.values?.[0]?.count || 0;

    // Count conflicts
    const conflictQuery = 'SELECT COUNT(*) as count FROM attendance WHERE conflict_resolution_needed = 1';
    const conflictResult = await this.db.query(conflictQuery);
    stats.conflicted = conflictResult.values?.[0]?.count || 0;

    // Count synced
    const syncedQuery = 'SELECT COUNT(*) as count FROM attendance WHERE last_synced_at IS NOT NULL';
    const syncedResult = await this.db.query(syncedQuery);
    stats.synced = syncedResult.values?.[0]?.count || 0;

    return stats;
  }

  /**
   * Saves terms for a section to normalized storage.
   * Validates with Zod at the write boundary and stores to normalized
   * IndexedDB (web) or SQLite with transaction wrapping (native).
   * Replaces all existing terms for the specified section.
   *
   * @async
   * @param {number|string} sectionId - Section identifier
   * @param {Array<Object>} terms - Array of term objects to save
   * @returns {Promise<void>}
   */
  async saveTerms(sectionId, terms) {
    await this.initialize();

    try {
      const enrichedTerms = (Array.isArray(terms) ? terms : []).map(t => ({ ...t, sectionid: sectionId }));

      const { data: validTerms, errors } = safeParseArray(TermSchema, enrichedTerms);
      if (errors.length > 0) {
        logger.warn('Term validation errors during save', {
          errorCount: errors.length,
          totalCount: enrichedTerms.length,
          errors: errors.slice(0, 5),
        }, LOG_CATEGORIES.DATABASE);
      }

      if (!this.isNative || !this.db) {
        await IndexedDBService.bulkReplaceTermsForSection(sectionId, validTerms);
        return;
      }

      await this.db.execute('BEGIN TRANSACTION');
      try {
        await this.db.run('DELETE FROM terms WHERE sectionid = ?', [sectionId]);

        for (const term of validTerms) {
          const insert = `
            INSERT INTO terms (termid, sectionid, name, startdate, enddate)
            VALUES (?, ?, ?, ?, ?)
          `;
          await this.db.run(insert, [
            term.termid,
            term.sectionid,
            term.name,
            term.startdate,
            term.enddate,
          ]);
        }

        await this.db.execute('COMMIT');
      } catch (error) {
        await this.db.execute('ROLLBACK');
        throw error;
      }

      await this.updateSyncStatus('terms');
    } catch (error) {
      logger.error('Failed to save terms', {
        sectionId,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      sentryUtils.captureException(error, { context: 'DatabaseService.saveTerms', sectionId });
      throw error;
    }
  }

  /**
   * Retrieves terms for a section from normalized storage
   *
   * @async
   * @param {number|string} sectionId - Section identifier
   * @returns {Promise<Array<Object>>} Array of term objects
   */
  async getTerms(sectionId) {
    await this.initialize();

    try {
      if (!this.isNative || !this.db) {
        return IndexedDBService.getTermsBySection(sectionId);
      }

      const query = 'SELECT * FROM terms WHERE sectionid = ? ORDER BY startdate DESC';
      const result = await this.db.query(query, [sectionId]);
      return result.values || [];
    } catch (error) {
      logger.error('Failed to get terms', {
        sectionId,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      sentryUtils.captureException(error, { context: 'DatabaseService.getTerms', sectionId });
      return [];
    }
  }

  /**
   * Retrieves all terms from normalized storage across all sections
   *
   * @async
   * @returns {Promise<Array<Object>>} Array of all term objects
   */
  async getAllTerms() {
    await this.initialize();

    try {
      if (!this.isNative || !this.db) {
        return IndexedDBService.getAllTerms();
      }

      const query = 'SELECT * FROM terms ORDER BY sectionid, startdate DESC';
      const result = await this.db.query(query);
      return result.values || [];
    } catch (error) {
      logger.error('Failed to get all terms', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      sentryUtils.captureException(error, { context: 'DatabaseService.getAllTerms' });
      return [];
    }
  }

  /**
   * Retrieves a specific term by its ID from normalized storage
   *
   * @async
   * @param {string} termId - Term identifier
   * @returns {Promise<Object|null>} Term object or null if not found
   */
  async getTermById(termId) {
    await this.initialize();

    try {
      if (!this.isNative || !this.db) {
        return IndexedDBService.getTermById(termId);
      }

      const query = 'SELECT * FROM terms WHERE termid = ?';
      const result = await this.db.query(query, [termId]);
      return result.values?.[0] || null;
    } catch (error) {
      logger.error('Failed to get term by ID', {
        termId,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      sentryUtils.captureException(error, { context: 'DatabaseService.getTermById', termId });
      return null;
    }
  }

  /**
   * Retrieves the current active term for a section.
   * Delegates to CurrentActiveTermsService.
   *
   * @async
   * @param {number|string} sectionId - Section identifier
   * @returns {Promise<Object|null>} Current active term or null
   */
  async getCurrentActiveTerm(sectionId) {
    return CurrentActiveTermsService.getCurrentActiveTerm(sectionId);
  }

  /**
   * Sets the current active term for a section.
   * Delegates to CurrentActiveTermsService.
   *
   * @async
   * @param {number|string} sectionId - Section identifier
   * @param {Object} term - Term object to set as active
   * @returns {Promise<void>}
   */
  async setCurrentActiveTerm(sectionId, term) {
    return CurrentActiveTermsService.setCurrentActiveTerm(sectionId, term);
  }

  /**
   * Retrieves flexi lists for a section from normalized storage
   *
   * @async
   * @param {number} sectionId - Section identifier
   * @returns {Promise<{items: Array<Object>, _cacheTimestamp: number}|null>} Flexi lists with cache timestamp, or null if none found
   */
  async getFlexiLists(sectionId) {
    await this.initialize();

    try {
      if (!this.isNative || !this.db) {
        const records = await IndexedDBService.getFlexiListsBySection(sectionId);
        if (!records || records.length === 0) return null;
        return {
          items: records,
          _cacheTimestamp: Math.max(...records.map(r => r.updated_at || 0)),
        };
      }

      const query = 'SELECT * FROM flexi_lists WHERE sectionid = ?';
      const result = await this.db.query(query, [Number(sectionId)]);
      const rows = result.values || [];
      if (rows.length === 0) return null;
      return {
        items: rows,
        _cacheTimestamp: Math.max(...rows.map(r => r.updated_at || 0)),
      };
    } catch (error) {
      logger.error('Failed to get flexi lists', {
        sectionId,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      sentryUtils.captureException(error, { context: 'DatabaseService.getFlexiLists', sectionId });
      return null;
    }
  }

  /**
   * Saves flexi lists for a section to normalized storage.
   * Validates with Zod at the write boundary.
   *
   * @async
   * @param {number} sectionId - Section identifier
   * @param {Array<Object>} lists - Array of flexi list objects to save
   * @returns {Promise<void>}
   */
  async saveFlexiLists(sectionId, lists) {
    await this.initialize();

    const rawItems = Array.isArray(lists) ? lists : (Array.isArray(lists?.items) ? lists.items : []);
    const enriched = rawItems.map(l => ({ ...l, sectionid: sectionId }));
    const { data: valid, errors } = safeParseArray(FlexiListSchema, enriched);
    if (errors.length > 0) {
      logger.warn('FlexiList validation errors during save', {
        errorCount: errors.length,
        totalCount: enriched.length,
        errors: errors.slice(0, 5),
      }, LOG_CATEGORIES.DATABASE);
    }

    if (!this.isNative || !this.db) {
      await IndexedDBService.bulkReplaceFlexiListsForSection(sectionId, valid);
      return;
    }

    await this.db.execute('BEGIN TRANSACTION');
    try {
      await this.db.run('DELETE FROM flexi_lists WHERE sectionid = ?', [Number(sectionId)]);

      for (const item of valid) {
        const insert = 'INSERT OR REPLACE INTO flexi_lists (sectionid, extraid, name) VALUES (?, ?, ?)';
        await this.db.run(insert, [Number(item.sectionid), String(item.extraid), item.name]);
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }
  }

  /**
   * Retrieves flexi structure for a record from normalized storage
   *
   * @async
   * @param {string} recordId - Flexi record identifier
   * @returns {Promise<Object|null>} Flexi structure object or null
   */
  async getFlexiStructure(recordId) {
    await this.initialize();

    try {
      if (!this.isNative || !this.db) {
        const record = await IndexedDBService.getFlexiRecordStructure(recordId);
        if (record?.updated_at && !record._cacheTimestamp) {
          record._cacheTimestamp = record.updated_at;
        }
        return record;
      }

      const query = 'SELECT * FROM flexi_structure WHERE extraid = ?';
      const result = await this.db.query(query, [String(recordId)]);
      return result.values?.[0] || null;
    } catch (error) {
      logger.error('Failed to get flexi structure', {
        recordId,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      sentryUtils.captureException(error, { context: 'DatabaseService.getFlexiStructure', recordId });
      return null;
    }
  }

  /**
   * Saves flexi structure for a record to normalized storage.
   * Validates with Zod at the write boundary.
   *
   * @async
   * @param {string} recordId - Flexi record identifier
   * @param {Object} structure - Flexi structure object to save
   * @returns {Promise<void>}
   */
  async saveFlexiStructure(recordId, structure) {
    await this.initialize();

    const enriched = { ...structure, extraid: recordId };
    const result = FlexiStructureSchema.safeParse(enriched);
    if (!result.success) {
      logger.warn('FlexiStructure validation failed', {
        issues: result.error.issues,
      }, LOG_CATEGORIES.DATABASE);
      throw new Error('FlexiStructure validation failed');
    }
    const valid = result.data;

    if (!this.isNative || !this.db) {
      await IndexedDBService.saveFlexiRecordStructure(valid);
      return;
    }

    const insert = 'INSERT OR REPLACE INTO flexi_structure (extraid, name, config, structure) VALUES (?, ?, ?, ?)';
    await this.db.run(insert, [
      String(valid.extraid),
      valid.name || null,
      valid.config || null,
      valid.structure ? JSON.stringify(valid.structure) : null,
    ]);
  }

  /**
   * Retrieves all flexi structures from normalized storage across all records.
   * Needed by CampGroupsView in Plan 05.
   *
   * @async
   * @returns {Promise<Array<Object>>} Array of all flexi structure objects
   */
  async getAllFlexiStructures() {
    await this.initialize();

    try {
      if (!this.isNative || !this.db) {
        return await IndexedDBService.getAllFlexiRecordStructures();
      }

      const query = 'SELECT * FROM flexi_structure';
      const result = await this.db.query(query);
      return result.values || [];
    } catch (error) {
      logger.error('Failed to get all flexi structures', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      sentryUtils.captureException(error, { context: 'DatabaseService.getAllFlexiStructures' });
      return [];
    }
  }

  /**
   * Retrieves flexi data for a record, section, and term from normalized storage
   *
   * @async
   * @param {string} recordId - Flexi record identifier
   * @param {number} sectionId - Section identifier
   * @param {string} termId - Term identifier
   * @returns {Promise<Object|Array|null>} Flexi data (object on web, array on native, null on error)
   */
  async getFlexiData(recordId, sectionId, termId) {
    await this.initialize();

    try {
      if (!this.isNative || !this.db) {
        return await IndexedDBService.getFlexiRecordData(recordId, sectionId, termId);
      }

      const query = 'SELECT * FROM flexi_data WHERE extraid = ? AND sectionid = ? AND termid = ?';
      const result = await this.db.query(query, [String(recordId), Number(sectionId), String(termId)]);
      return result.values || [];
    } catch (error) {
      logger.error('Failed to get flexi data', {
        recordId, sectionId, termId,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      sentryUtils.captureException(error, { context: 'DatabaseService.getFlexiData', recordId, sectionId, termId });
      if (!this.isNative || !this.db) {
        return null;
      }
      return [];
    }
  }

  /**
   * Saves flexi data for a record, section, and term to normalized storage.
   * Validates with Zod at the write boundary for SQLite rows.
   * Web stores the full API response as one record; native stores individual rows.
   *
   * @async
   * @param {string} recordId - Flexi record identifier
   * @param {number} sectionId - Section identifier
   * @param {string} termId - Term identifier
   * @param {Array<Object>|Object} data - Flexi data (array of rows or full API response object)
   * @returns {Promise<void>}
   */
  async saveFlexiData(recordId, sectionId, termId, data) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      await IndexedDBService.saveFlexiRecordData(recordId, sectionId, termId, data);
      return;
    }

    let rows = data;
    if (data && !Array.isArray(data) && data.items) {
      rows = data.items;
    }

    if (!Array.isArray(rows)) {
      rows = [];
    }

    const { data: valid, errors } = safeParseArray(FlexiDataSchema, rows);
    if (errors.length > 0) {
      logger.warn('FlexiData validation errors during save', {
        errorCount: errors.length,
        totalCount: rows.length,
        errors: errors.slice(0, 5),
      }, LOG_CATEGORIES.DATABASE);
    }

    await this.db.execute('BEGIN TRANSACTION');
    try {
      await this.db.run('DELETE FROM flexi_data WHERE extraid = ? AND sectionid = ? AND termid = ?', [String(recordId), Number(sectionId), String(termId)]);

      for (const row of valid) {
        const { scoutid, firstname, lastname, ...rest } = row;
        const insert = 'INSERT OR REPLACE INTO flexi_data (extraid, sectionid, termid, scoutid, firstname, lastname, data) VALUES (?, ?, ?, ?, ?, ?, ?)';
        await this.db.run(insert, [
          String(recordId),
          Number(sectionId),
          String(termId),
          String(scoutid),
          firstname || null,
          lastname || null,
          JSON.stringify(rest),
        ]);
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }
  }

  /**
   * Retrieves all flexi data rows for a given extraId across all sections and terms.
   * Needed by useSignInOut and useSectionMovements in Plan 05.
   *
   * @async
   * @param {string} extraId - Flexi record extra identifier
   * @returns {Promise<Array<Object>>} Array of flexi data objects
   */
  async getFlexiRecordDataByExtra(extraId) {
    await this.initialize();

    try {
      if (!this.isNative || !this.db) {
        return await IndexedDBService.getFlexiRecordDataByExtra(extraId);
      }

      const query = 'SELECT * FROM flexi_data WHERE extraid = ?';
      const result = await this.db.query(query, [String(extraId)]);
      return result.values || [];
    } catch (error) {
      logger.error('Failed to get flexi record data by extra', {
        extraId,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      sentryUtils.captureException(error, { context: 'DatabaseService.getFlexiRecordDataByExtra', extraId });
      return [];
    }
  }


  /**
   * Closes database connections and cleans up resources
   *
   * Properly closes SQLite connections and resets service state.
   * Should be called when the application is shutting down or
   * when database access is no longer needed. Safe to call
   * multiple times or when no connection exists.
   *
   * @async
   * @returns {Promise<void>} Resolves when cleanup is complete
   *
   * @example
   * // Clean shutdown
   * await databaseService.close();
   * console.log('Database connections closed');
   *
   * @example
   * // In component cleanup
   * useEffect(() => {
   *   return async () => {
   *     await databaseService.close();
   *   };
   * }, []);
   */
  async close() {
    if (this.db) {
      await this.db.close();
      await this.sqlite.closeConnection('vikings_db', false);
      this.db = null;
      this.isInitialized = false;
    }
  }
}

/**
 * Singleton instance of DatabaseService for global application use
 * 
 * Pre-instantiated service ready for immediate use across the application.
 * Provides consistent data access patterns and maintains single connection
 * state. Import and use directly without instantiation.
 * 
 * @type {DatabaseService}
 * @example
 * // Import and use immediately
 * import databaseService from './storage/database.js';
 * 
 * // Initialize and start using
 * await databaseService.initialize();
 * const sections = await databaseService.getSections();
 */
export default new DatabaseService();
