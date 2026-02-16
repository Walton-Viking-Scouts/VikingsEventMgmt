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
import UnifiedStorageService from './unifiedStorageService.js';
import IndexedDBService from './indexedDBService.js';
import { SQLITE_SCHEMAS, SQLITE_INDEXES } from './schemas/sqliteSchema.js';
import { SectionSchema, EventSchema, safeParseArray } from './schemas/validation.js';
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
        logger.info('Running in browser - SQLite not available, using IndexedDB via UnifiedStorageService', {}, LOG_CATEGORIES.DATABASE);
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventid TEXT,
        scoutid INTEGER,
        firstname TEXT,
        lastname TEXT,
        attending TEXT,
        patrol TEXT,
        notes TEXT,
        version INTEGER DEFAULT 1,
        local_version INTEGER DEFAULT 1,
        last_sync_version INTEGER DEFAULT 0,
        is_locally_modified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_synced_at DATETIME,
        conflict_resolution_needed BOOLEAN DEFAULT 0,
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
   * Stores individual scout attendance information for event tracking.
   * Replaces all existing attendance records for the specified event.
   * Critical for offline functionality during events when internet may
   * be unreliable but attendance needs to be recorded.
   *
   * @async
   * @param {string|number} eventId - Event identifier to save attendance for
   * @param {Array<Object>} attendanceData - Array of attendance records
   * @param {number} attendanceData[].scoutid - Scout member identifier
   * @param {string} attendanceData[].firstname - Scout's first name
   * @param {string} attendanceData[].lastname - Scout's last name
   * @param {string} attendanceData[].attending - Attendance status ("Yes"/"No"/"Maybe")
   * @param {string} [attendanceData[].patrol] - Scout's patrol name
   * @param {string} [attendanceData[].notes] - Additional attendance notes
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.isLocalModification] - Whether this is a local modification
   * @param {number} [options.remoteVersion] - Remote version number if syncing from server
   * @param {boolean} [options.fromSync] - Whether this save is from a sync operation
   * @returns {Promise<void>} Resolves when attendance is saved
   *
   * @example
   * // Record attendance for weekend camp
   * const campAttendance = [
   *   {
   *     scoutid: 12345,
   *     firstname: 'Alice',
   *     lastname: 'Smith',
   *     attending: 'Yes',
   *     patrol: 'Red Patrol',
   *     notes: 'Dietary requirements: vegetarian'
   *   },
   *   {
   *     scoutid: 67890,
   *     firstname: 'Bob',
   *     lastname: 'Jones',
   *     attending: 'No',
   *     patrol: 'Blue Patrol',
   *     notes: 'Family holiday'
   *   }
   * ];
   *
   * await databaseService.saveAttendance('camp_456', campAttendance);
   */
  async saveAttendance(eventId, attendanceData, options = {}) {
    await this.initialize();

    if (!this.isNative || !this.db) {
      // Storage routing - add versioning metadata to localStorage
      const key = `viking_attendance_${eventId}_offline`;
      const enhancedData = Array.isArray(attendanceData) ?
        attendanceData.map(record => ({
          ...record,
          version: record.version || 1,
          local_version: options.isLocalModification ? (record.local_version || 1) + 1 : record.local_version || 1,
          is_locally_modified: options.isLocalModification || false,
          updated_at: Date.now(),
          last_synced_at: options.fromSync ? Date.now() : record.last_synced_at,
        })) : attendanceData;

      await UnifiedStorageService.set(key, enhancedData);
      return;
    }

    // For SQLite, handle versioning properly
    const currentTime = new Date().toISOString();
    const isLocalMod = options.isLocalModification || false;
    const fromSync = options.fromSync || false;

    // Begin transaction for atomic updates
    await this.db.execute('BEGIN TRANSACTION');

    try {
      // Get existing records to preserve version information
      const existingQuery = 'SELECT eventid, scoutid, version, local_version, last_sync_version FROM attendance WHERE eventid = ?';
      const existingResult = await this.db.query(existingQuery, [eventId]);
      const existingRecords = new Map();

      if (existingResult.values) {
        for (const record of existingResult.values) {
          existingRecords.set(record.scoutid, record);
        }
      }

      // Delete existing attendance for this event
      const deleteOld = 'DELETE FROM attendance WHERE eventid = ?';
      await this.db.run(deleteOld, [eventId]);

      for (const person of attendanceData) {
        const existing = existingRecords.get(person.scoutid);

        let version = person.version || 1;
        let localVersion = person.local_version || 1;
        let lastSyncVersion = person.last_sync_version || 0;

        if (existing) {
          if (isLocalMod) {
            // Local modification - increment local version
            localVersion = existing.local_version + 1;
            version = Math.max(existing.version, version);
          } else if (fromSync) {
            // Sync from server - update version tracking
            version = options.remoteVersion || version;
            lastSyncVersion = version;
          } else {
            // Preserve existing versions
            version = existing.version;
            localVersion = existing.local_version;
            lastSyncVersion = existing.last_sync_version;
          }
        }

        const insert = `
          INSERT INTO attendance (
            eventid, scoutid, firstname, lastname, attending, patrol, notes,
            version, local_version, last_sync_version, is_locally_modified,
            updated_at, last_synced_at, conflict_resolution_needed
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.db.run(insert, [
          eventId,
          person.scoutid,
          person.firstname,
          person.lastname,
          person.attending,
          person.patrol,
          person.notes,
          version,
          localVersion,
          lastSyncVersion,
          isLocalMod ? 1 : 0,
          currentTime,
          fromSync ? currentTime : null,
          person.conflict_resolution_needed ? 1 : 0,
        ]);
      }

      await this.db.execute('COMMIT');
      await this.updateSyncStatus('attendance');

    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }
  }

  /**
   * Retrieves attendance records for a specific event
   * 
   * Loads attendance information with proper name ordering for easy review.
   * Returns all scouts registered for the event with their attendance status.
   * Critical for event check-in/check-out and attendance reporting.
   * 
   * @async
   * @param {string|number} eventId - Event identifier to get attendance for
   * @returns {Promise<Array<Object>>} Array of attendance records
   * @returns {number} returns[].scoutid - Scout member identifier
   * @returns {string} returns[].firstname - Scout's first name
   * @returns {string} returns[].lastname - Scout's last name
   * @returns {string} returns[].attending - Attendance status
   * @returns {string} [returns[].patrol] - Scout's patrol name
   * @returns {string} [returns[].notes] - Attendance notes
   * 
   * @example
   * // Get attendance for event check-in
   * const attendance = await databaseService.getAttendance('camp_456');
   * 
   * const attending = attendance.filter(scout => scout.attending === 'Yes');
   * console.log(`${attending.length} scouts attending the camp`);
   * 
   * // Display attendance list
   * attendance.forEach(scout => {
   *   console.log(`${scout.firstname} ${scout.lastname}: ${scout.attending}`);
   * });
   */
  async getAttendance(eventId) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // Storage routing
      const key = `viking_attendance_${eventId}_offline`;
      return await UnifiedStorageService.get(key) || [];
    }
    
    const query = 'SELECT * FROM attendance WHERE eventid = ? ORDER BY lastname, firstname';
    const result = await this.db.query(query, [eventId]);
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
      const sections = await UnifiedStorageService.getSections();
      return Array.isArray(sections) && sections.length > 0;
    }

    const sectionsQuery = 'SELECT COUNT(*) as count FROM sections';
    const result = await this.db.query(sectionsQuery);
    return result.values?.[0]?.count > 0;
  }

  /**
   * Helper method to get sections from web storage (localStorage/IndexedDB)
   *
   * @async
   * @private
   * @returns {Promise<Array<Object>>} Array of section objects
   */
  async _getWebStorageSections() {
    const sectionsData = await UnifiedStorageService.getSections();
    const sections = this._normalizeSectionsData(sectionsData);

    const { isDemoMode } = await import('../../../config/demoMode.js');

    if (!isDemoMode()) {
      return sections.filter((section) => {
        const name = section?.sectionname;
        return !(typeof name === 'string' && name.startsWith('Demo '));
      });
    }

    return sections;
  }

  /**
   * Normalizes sections data from different storage formats
   *
   * @private
   * @param {*} sectionsData - Raw sections data from storage
   * @returns {Array<Object>} Normalized array of section objects
   */
  _normalizeSectionsData(sectionsData) {
    if (Array.isArray(sectionsData)) {
      return sectionsData;
    } else if (sectionsData && typeof sectionsData === 'object' && sectionsData.items) {
      return sectionsData.items;
    }
    return [];
  }

  /**
   * Helper method to get events from web storage (localStorage/IndexedDB)
   *
   * @async
   * @private
   * @param {number} sectionId - Section identifier to get events for
   * @returns {Promise<Array<Object>>} Array of event objects
   */
  async _getWebStorageEvents(sectionId) {
    const key = `viking_events_${sectionId}_offline`;
    const eventsData = await UnifiedStorageService.get(key) || [];
    const events = this._normalizeEventsData(eventsData);

    const { isDemoMode } = await import('../../../config/demoMode.js');

    if (!isDemoMode()) {
      return events.filter((event) => {
        const eid = event?.eventid;
        return !(typeof eid === 'string' && eid.startsWith('demo_event_'));
      });
    }

    return events;
  }

  /**
   * Normalizes events data from different storage formats
   *
   * @private
   * @param {*} eventsData - Raw events data from storage
   * @returns {Array<Object>} Normalized array of event objects
   */
  _normalizeEventsData(eventsData) {
    if (Array.isArray(eventsData)) {
      return eventsData;
    } else if (eventsData && typeof eventsData === 'object' && eventsData.items) {
      return eventsData.items;
    }
    return [];
  }

  /**
   * Helper method to save events to web storage (localStorage/IndexedDB)
   *
   * @async
   * @private
   * @param {number} sectionId - Section identifier to save events for
   * @param {Array<Object>} events - Array of event objects to save
   * @returns {Promise<void>} Resolves when events are saved
   */
  async _saveWebStorageEvents(sectionId, events) {
    const key = `viking_events_${sectionId}_offline`;
    await UnifiedStorageService.set(key, events);
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
      const key = `viking_attendance_${eventId}_offline`;
      await UnifiedStorageService.remove(key);
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
   * Retrieves terms for a section from normalized storage
   * @async
   * @param {number} _sectionId - Section identifier
   * @returns {Promise<Array<Object>>} Array of term objects
   * @throws {Error} Not yet implemented - Phase 5
   */
  async getTerms(_sectionId) {
    await this.initialize();
    throw new Error('Terms retrieval via normalized storage not yet implemented (Phase 5)');
  }

  /**
   * Saves terms for a section to normalized storage
   * @async
   * @param {number} _sectionId - Section identifier
   * @param {Array<Object>} _terms - Array of term objects to save
   * @returns {Promise<void>}
   * @throws {Error} Not yet implemented - Phase 5
   */
  async saveTerms(_sectionId, _terms) {
    await this.initialize();
    throw new Error('Terms storage via normalized storage not yet implemented (Phase 5)');
  }

  /**
   * Retrieves the current active term for a section
   * @async
   * @param {number} _sectionId - Section identifier
   * @returns {Promise<Object|null>} Current active term or null
   * @throws {Error} Not yet implemented - Phase 5
   */
  async getCurrentActiveTerm(_sectionId) {
    await this.initialize();
    throw new Error('Current active term retrieval via normalized storage not yet implemented (Phase 5)');
  }

  /**
   * Sets the current active term for a section
   * @async
   * @param {number} _sectionId - Section identifier
   * @param {Object} _term - Term object to set as active
   * @returns {Promise<void>}
   * @throws {Error} Not yet implemented - Phase 5
   */
  async setCurrentActiveTerm(_sectionId, _term) {
    await this.initialize();
    throw new Error('Current active term storage via normalized storage not yet implemented (Phase 5)');
  }

  /**
   * Retrieves flexi lists for a section from normalized storage
   * @async
   * @param {number} _sectionId - Section identifier
   * @returns {Promise<Array<Object>>} Array of flexi list objects
   * @throws {Error} Not yet implemented - Phase 6
   */
  async getFlexiLists(_sectionId) {
    await this.initialize();
    throw new Error('FlexiLists retrieval via normalized storage not yet implemented (Phase 6)');
  }

  /**
   * Saves flexi lists for a section to normalized storage
   * @async
   * @param {number} _sectionId - Section identifier
   * @param {Array<Object>} _lists - Array of flexi list objects to save
   * @returns {Promise<void>}
   * @throws {Error} Not yet implemented - Phase 6
   */
  async saveFlexiLists(_sectionId, _lists) {
    await this.initialize();
    throw new Error('FlexiLists storage via normalized storage not yet implemented (Phase 6)');
  }

  /**
   * Retrieves flexi structure for a record from normalized storage
   * @async
   * @param {string} _recordId - Flexi record identifier
   * @returns {Promise<Object|null>} Flexi structure object or null
   * @throws {Error} Not yet implemented - Phase 6
   */
  async getFlexiStructure(_recordId) {
    await this.initialize();
    throw new Error('FlexiStructure retrieval via normalized storage not yet implemented (Phase 6)');
  }

  /**
   * Saves flexi structure for a record to normalized storage
   * @async
   * @param {string} _recordId - Flexi record identifier
   * @param {Object} _structure - Flexi structure object to save
   * @returns {Promise<void>}
   * @throws {Error} Not yet implemented - Phase 6
   */
  async saveFlexiStructure(_recordId, _structure) {
    await this.initialize();
    throw new Error('FlexiStructure storage via normalized storage not yet implemented (Phase 6)');
  }

  /**
   * Retrieves flexi data for a record, section, and term from normalized storage
   * @async
   * @param {string} _recordId - Flexi record identifier
   * @param {number} _sectionId - Section identifier
   * @param {string} _termId - Term identifier
   * @returns {Promise<Array<Object>>} Array of flexi data objects
   * @throws {Error} Not yet implemented - Phase 6
   */
  async getFlexiData(_recordId, _sectionId, _termId) {
    await this.initialize();
    throw new Error('FlexiData retrieval via normalized storage not yet implemented (Phase 6)');
  }

  /**
   * Saves flexi data for a record, section, and term to normalized storage
   * @async
   * @param {string} _recordId - Flexi record identifier
   * @param {number} _sectionId - Section identifier
   * @param {string} _termId - Term identifier
   * @param {Array<Object>} _data - Array of flexi data objects to save
   * @returns {Promise<void>}
   * @throws {Error} Not yet implemented - Phase 6
   */
  async saveFlexiData(_recordId, _sectionId, _termId, _data) {
    await this.initialize();
    throw new Error('FlexiData storage via normalized storage not yet implemented (Phase 6)');
  }

  /**
   * Retrieves shared attendance data for an event from normalized storage
   * @async
   * @param {string} _eventId - Event identifier
   * @returns {Promise<Object|null>} Shared attendance data or null
   * @throws {Error} Not yet implemented - Phase 4
   */
  async getSharedAttendance(_eventId) {
    await this.initialize();
    throw new Error('SharedAttendance retrieval via normalized storage not yet implemented (Phase 4)');
  }

  /**
   * Saves shared attendance data for an event to normalized storage
   * @async
   * @param {string} _eventId - Event identifier
   * @param {Object} _data - Shared attendance data to save
   * @returns {Promise<void>}
   * @throws {Error} Not yet implemented - Phase 4
   */
  async saveSharedAttendance(_eventId, _data) {
    await this.initialize();
    throw new Error('SharedAttendance storage via normalized storage not yet implemented (Phase 4)');
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
