/**
 * SQLite CREATE TABLE statements for normalized tables that do not yet exist.
 * These are the three flexi record tables needed for Phase 6 implementation.
 * Uses CREATE TABLE IF NOT EXISTS for idempotent execution.
 *
 * @type {Record<string, string>}
 */
export const SQLITE_SCHEMAS = {
  flexi_lists: `
    CREATE TABLE IF NOT EXISTS flexi_lists (
      extraid TEXT NOT NULL,
      sectionid INTEGER NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (extraid, sectionid)
    )
  `,
  flexi_structure: `
    CREATE TABLE IF NOT EXISTS flexi_structure (
      extraid TEXT PRIMARY KEY,
      name TEXT,
      config TEXT,
      structure TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  flexi_data: `
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
    )
  `,
  shared_event_metadata: `
    CREATE TABLE IF NOT EXISTS shared_event_metadata (
      eventid TEXT PRIMARY KEY,
      is_shared_event INTEGER DEFAULT 1,
      owner_section_id INTEGER,
      sections TEXT,
      updated_at INTEGER
    )
  `,
};

/**
 * SQL CREATE INDEX statements for missing indexes on existing and new tables.
 * These indexes improve query performance for the most common access patterns
 * in the normalized storage layer.
 *
 * @type {string[]}
 */
export const SQLITE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_events_sectionid ON events(sectionid)',
  'CREATE INDEX IF NOT EXISTS idx_events_termid ON events(termid)',
  'CREATE INDEX IF NOT EXISTS idx_events_startdate ON events(startdate)',
  'CREATE INDEX IF NOT EXISTS idx_attendance_eventid ON attendance(eventid)',
  'CREATE INDEX IF NOT EXISTS idx_attendance_scoutid ON attendance(scoutid)',
  'CREATE INDEX IF NOT EXISTS idx_sections_sectiontype ON sections(sectiontype)',
];
