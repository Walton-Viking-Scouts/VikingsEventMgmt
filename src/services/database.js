import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

class DatabaseService {
  constructor() {
    this.sqlite = null;
    this.db = null;
    this.isInitialized = false;
    this.isNative = Capacitor.isNativePlatform();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Only initialize SQLite on native platforms
      if (!this.isNative) {
        console.log('Running in browser - SQLite not available, using localStorage fallback');
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
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      // Don't throw error - fallback to localStorage
      this.isInitialized = true;
      this.isNative = false;
    }
  }

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
        eventid INTEGER PRIMARY KEY,
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
    `;

    const createMembersTable = `
      CREATE TABLE IF NOT EXISTS members (
        scoutid INTEGER PRIMARY KEY,
        firstname TEXT,
        lastname TEXT,
        email TEXT,
        sectionid INTEGER,
        sectionname TEXT,
        section TEXT,
        sections TEXT,
        patrol TEXT,
        dateofbirth TEXT,
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
  }

  // Sections
  async saveSections(sections) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback
      localStorage.setItem('viking_sections_offline', JSON.stringify(sections));
      return;
    }
    
    const deleteOld = 'DELETE FROM sections';
    await this.db.execute(deleteOld);

    for (const section of sections) {
      const insert = `
        INSERT INTO sections (sectionid, sectionname, sectiontype)
        VALUES (?, ?, ?)
      `;
      await this.db.run(insert, [section.sectionid, section.sectionname, section.sectiontype]);
    }

    await this.updateSyncStatus('sections');
  }

  async getSections() {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback
      const sections = localStorage.getItem('viking_sections_offline');
      return sections ? JSON.parse(sections) : [];
    }
    
    const query = 'SELECT * FROM sections ORDER BY sectionname';
    const result = await this.db.query(query);
    return result.values || [];
  }

  // Events
  async saveEvents(sectionId, events) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback
      const key = `viking_events_${sectionId}_offline`;
      localStorage.setItem(key, JSON.stringify(events));
      console.log(`Saved ${events.length} events to localStorage with key: ${key}`);
      return;
    }
    
    // Delete existing events for this section
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

    await this.updateSyncStatus('events');
  }

  async getEvents(sectionId) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback
      const key = `viking_events_${sectionId}_offline`;
      const events = localStorage.getItem(key);
      const parsedEvents = events ? JSON.parse(events) : [];
      console.log(`Retrieved ${parsedEvents.length} events from localStorage with key: ${key}`);
      return parsedEvents;
    }
    
    const query = 'SELECT * FROM events WHERE sectionid = ? ORDER BY startdate DESC';
    const result = await this.db.query(query, [sectionId]);
    return result.values || [];
  }

  // Attendance
  async saveAttendance(eventId, attendanceData) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback
      const key = `viking_attendance_${eventId}_offline`;
      localStorage.setItem(key, JSON.stringify(attendanceData));
      return;
    }
    
    // Delete existing attendance for this event
    const deleteOld = 'DELETE FROM attendance WHERE eventid = ?';
    await this.db.run(deleteOld, [eventId]);

    for (const person of attendanceData) {
      const insert = `
        INSERT INTO attendance (eventid, scoutid, firstname, lastname, attending, patrol, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await this.db.run(insert, [
        eventId,
        person.scoutid,
        person.firstname,
        person.lastname,
        person.attending,
        person.patrol,
        person.notes,
      ]);
    }

    await this.updateSyncStatus('attendance');
  }

  async getAttendance(eventId) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback
      const key = `viking_attendance_${eventId}_offline`;
      const attendance = localStorage.getItem(key);
      return attendance ? JSON.parse(attendance) : [];
    }
    
    const query = 'SELECT * FROM attendance WHERE eventid = ? ORDER BY lastname, firstname';
    const result = await this.db.query(query, [eventId]);
    return result.values || [];
  }

  // Sync status
  async updateSyncStatus(tableName) {
    if (!this.isNative || !this.db) return; // Skip for localStorage fallback
    
    const update = `
      INSERT OR REPLACE INTO sync_status (table_name, last_sync, needs_sync)
      VALUES (?, CURRENT_TIMESTAMP, 0)
    `;
    await this.db.run(update, [tableName]);
  }

  async needsSync(tableName) {
    if (!this.isNative || !this.db) return false; // Skip for localStorage fallback
    
    const query = 'SELECT needs_sync FROM sync_status WHERE table_name = ?';
    const result = await this.db.query(query, [tableName]);
    return result.values?.[0]?.needs_sync === 1;
  }

  // Members
  async saveMembers(sectionIds, members) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback
      const key = `viking_members_${sectionIds.join('_')}_offline`;
      localStorage.setItem(key, JSON.stringify(members));
      return;
    }
    
    // Delete existing members for these sections
    const placeholders = sectionIds.map(() => '?').join(',');
    const deleteOld = `DELETE FROM members WHERE sectionid IN (${placeholders})`;
    await this.db.run(deleteOld, sectionIds);

    for (const member of members) {
      const insert = `
        INSERT INTO members (scoutid, firstname, lastname, email, sectionid, sectionname, section, sections, patrol, dateofbirth)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await this.db.run(insert, [
        member.scoutid,
        member.firstname,
        member.lastname,
        member.email,
        member.sectionid,
        member.sectionname,
        member.section,
        JSON.stringify(member.sections || []),
        member.patrol,
        member.dateofbirth,
      ]);
    }

    await this.updateSyncStatus('members');
  }

  async getMembers(sectionIds) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback
      const key = `viking_members_${sectionIds.join('_')}_offline`;
      const members = localStorage.getItem(key);
      return members ? JSON.parse(members) : [];
    }
    
    const placeholders = sectionIds.map(() => '?').join(',');
    const query = `SELECT * FROM members WHERE sectionid IN (${placeholders}) ORDER BY lastname, firstname`;
    const result = await this.db.query(query, sectionIds);
    
    // Parse sections JSON back to array
    return (result.values || []).map(member => ({
      ...member,
      sections: member.sections ? JSON.parse(member.sections) : [],
    }));
  }

  // Check if we have offline data
  async hasOfflineData() {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback
      const sections = localStorage.getItem('viking_sections_offline');
      return !!(sections && JSON.parse(sections).length > 0);
    }
    
    const sectionsQuery = 'SELECT COUNT(*) as count FROM sections';
    const result = await this.db.query(sectionsQuery);
    return result.values?.[0]?.count > 0;
  }

  async close() {
    if (this.db) {
      await this.db.close();
      await this.sqlite.closeConnection('vikings_db', false);
      this.db = null;
      this.isInitialized = false;
    }
  }
}

export default new DatabaseService();
