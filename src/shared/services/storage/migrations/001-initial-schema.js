/**
 * Migration 001 — initial schema snapshot.
 *
 * IMMUTABLE: Once shipped, this migration must never be edited. To change
 * the schema, write a new migration with a higher version number.
 *
 * Captures the full schema as of the introduction of the migration system.
 * Devices upgrading from a pre-migration build will already have these
 * tables (CREATE TABLE IF NOT EXISTS is a no-op); new installs get them
 * created here.
 */

const SECTIONS = `
  CREATE TABLE IF NOT EXISTS sections (
    sectionid INTEGER PRIMARY KEY,
    sectionname TEXT NOT NULL,
    sectiontype TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const EVENTS = `
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

const ATTENDANCE = `
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

const MEMBERS = `
  CREATE TABLE IF NOT EXISTS members (
    scoutid INTEGER PRIMARY KEY,
    firstname TEXT,
    lastname TEXT,
    date_of_birth TEXT,
    age TEXT,
    age_years INTEGER,
    age_months INTEGER,
    sectionid INTEGER,
    sectionname TEXT,
    section TEXT,
    sections TEXT,
    patrol TEXT,
    patrol_id INTEGER,
    person_type TEXT,
    started TEXT,
    joined TEXT,
    end_date TEXT,
    active BOOLEAN,
    photo_guid TEXT,
    has_photo BOOLEAN,
    pic BOOLEAN,
    patrol_role_level INTEGER,
    patrol_role_level_label TEXT,
    email TEXT,
    contact_groups TEXT,
    custom_data TEXT,
    flattened_fields TEXT,
    read_only TEXT,
    filter_string TEXT,
    version INTEGER DEFAULT 1,
    local_version INTEGER DEFAULT 1,
    last_sync_version INTEGER DEFAULT 0,
    is_locally_modified BOOLEAN DEFAULT 0,
    last_synced_at DATETIME,
    conflict_resolution_needed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const SYNC_STATUS = `
  CREATE TABLE IF NOT EXISTS sync_status (
    table_name TEXT PRIMARY KEY,
    last_sync DATETIME,
    needs_sync INTEGER DEFAULT 0
  );
`;

const EVENT_DASHBOARD = `
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

const SYNC_METADATA = `
  CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const TERMS = `
  CREATE TABLE IF NOT EXISTS terms (
    termid TEXT PRIMARY KEY,
    sectionid INTEGER,
    name TEXT NOT NULL,
    startdate TEXT,
    enddate TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const FLEXI_LISTS = `
  CREATE TABLE IF NOT EXISTS flexi_lists (
    extraid TEXT NOT NULL,
    sectionid INTEGER NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (extraid, sectionid)
  );
`;

const FLEXI_STRUCTURE = `
  CREATE TABLE IF NOT EXISTS flexi_structure (
    extraid TEXT PRIMARY KEY,
    name TEXT,
    config TEXT,
    structure TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const FLEXI_DATA = `
  CREATE TABLE IF NOT EXISTS flexi_data (
    extraid TEXT NOT NULL,
    sectionid INTEGER NOT NULL,
    termid TEXT NOT NULL,
    scoutid TEXT NOT NULL,
    firstname TEXT,
    lastname TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (extraid, sectionid, termid, scoutid)
  );
`;

const SHARED_EVENT_METADATA = `
  CREATE TABLE IF NOT EXISTS shared_event_metadata (
    eventid TEXT PRIMARY KEY,
    is_shared_event INTEGER DEFAULT 1,
    owner_section_id INTEGER,
    sections TEXT,
    updated_at INTEGER
  );
`;

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_events_sectionid ON events(sectionid)',
  'CREATE INDEX IF NOT EXISTS idx_events_termid ON events(termid)',
  'CREATE INDEX IF NOT EXISTS idx_events_startdate ON events(startdate)',
  'CREATE INDEX IF NOT EXISTS idx_attendance_eventid ON attendance(eventid)',
  'CREATE INDEX IF NOT EXISTS idx_attendance_scoutid ON attendance(scoutid)',
  'CREATE INDEX IF NOT EXISTS idx_sections_sectiontype ON sections(sectiontype)',
  'CREATE INDEX IF NOT EXISTS idx_terms_sectionid ON terms(sectionid)',
  'CREATE INDEX IF NOT EXISTS idx_terms_startdate ON terms(startdate)',
];

export default {
  version: 1,
  name: 'initial_schema',
  up: async (db) => {
    await db.execute(SECTIONS);
    await db.execute(EVENTS);
    await db.execute(ATTENDANCE);
    await db.execute(MEMBERS);
    await db.execute(SYNC_STATUS);
    await db.execute(EVENT_DASHBOARD);
    await db.execute(SYNC_METADATA);
    await db.execute(TERMS);
    await db.execute(FLEXI_LISTS);
    await db.execute(FLEXI_STRUCTURE);
    await db.execute(FLEXI_DATA);
    await db.execute(SHARED_EVENT_METADATA);
    for (const indexSql of INDEXES) {
      await db.execute(indexSql);
    }
  },
};
