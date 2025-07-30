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

  // Members - Single comprehensive cache approach
  async saveMembers(sectionIds, members) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback - use single comprehensive key
      const key = 'viking_members_comprehensive_offline';
      
      // Get existing members
      let existingMembers = [];
      try {
        const existing = localStorage.getItem(key);
        existingMembers = existing ? JSON.parse(existing) : [];
      } catch (error) {
        console.warn('Failed to parse existing members cache:', error);
        existingMembers = [];
      }
      
      // Create member map for deduplication
      const memberMap = new Map();
      
      // Add existing members first
      existingMembers.forEach(member => {
        if (member.scoutid) {
          memberMap.set(member.scoutid, member);
        }
      });
      
      // Add/update new members (overwrites existing with same scoutid)
      members.forEach(member => {
        if (member.scoutid) {
          // Ensure sections array is properly maintained for multi-section members
          if (memberMap.has(member.scoutid)) {
            const existing = memberMap.get(member.scoutid);
            const combinedSections = [...new Set([
              ...(existing.sections || [existing.sectionname].filter(Boolean)),
              ...(member.sections || [member.sectionname].filter(Boolean)),
            ])];
            member.sections = combinedSections;
          }
          memberMap.set(member.scoutid, member);
        }
      });
      
      // Save comprehensive member list
      const allMembers = Array.from(memberMap.values());
      localStorage.setItem(key, JSON.stringify(allMembers));
      return;
    }
    
    // Use REPLACE INTO to handle updates for existing members across sections
    for (const member of members) {
      // Separate flattened fields from known structured fields
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

  async getMembers(sectionIds) {
    await this.initialize();
    
    if (!this.isNative || !this.db) {
      // localStorage fallback - use single comprehensive cache
      const key = 'viking_members_comprehensive_offline';
      
      try {
        const allMembers = localStorage.getItem(key);
        if (!allMembers) {
          return [];
        }
        
        const members = JSON.parse(allMembers);
        
        // Filter members by requested sections
        // Now that section IDs are standardized as numbers, filtering is simple
        const filteredMembers = members.filter(member => {
          return member.sectionid && sectionIds.includes(member.sectionid);
        });
        
        return filteredMembers;
        
      } catch (error) {
        console.warn('Failed to parse comprehensive members cache:', error);
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
          console.warn('Failed to parse flattened_fields for member:', dbMember.scoutid, error);
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
