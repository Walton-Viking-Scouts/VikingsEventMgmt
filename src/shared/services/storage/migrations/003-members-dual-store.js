/**
 * Migration 003 — split single `members` table into normalised
 * `core_members` + `member_section` tables matching IndexedDB's schema.
 *
 * IMMUTABLE: Once shipped, never edit. Future schema changes go in a
 * higher-numbered migration.
 *
 * Destructive: drops the old `members` table. No data preservation —
 * this ships before any iOS users have real data, and re-sync from OSM
 * repopulates everything.
 */

const DROP_MEMBERS = 'DROP TABLE IF EXISTS members;';

const CORE_MEMBERS = `
  CREATE TABLE IF NOT EXISTS core_members (
    scoutid          INTEGER PRIMARY KEY,
    firstname        TEXT,
    lastname         TEXT,
    date_of_birth    TEXT,
    age              TEXT,
    age_years        INTEGER,
    age_months       INTEGER,
    yrs              TEXT,
    photo_guid       TEXT,
    has_photo        INTEGER,
    pic              INTEGER,
    email            TEXT,
    contact_groups   TEXT,
    custom_data      TEXT,
    flattened_fields TEXT,
    read_only        TEXT,
    filter_string    TEXT,
    updated_at       INTEGER
  );
`;

const MEMBER_SECTION = `
  CREATE TABLE IF NOT EXISTS member_section (
    scoutid                  INTEGER NOT NULL,
    sectionid                INTEGER NOT NULL,
    sectionname              TEXT,
    section                  TEXT,
    person_type              TEXT,
    patrol                   TEXT,
    patrol_id                INTEGER,
    started                  TEXT,
    joined                   TEXT,
    end_date                 TEXT,
    active                   INTEGER,
    patrol_role_level        INTEGER,
    patrol_role_level_label  TEXT,
    updated_at               INTEGER,
    PRIMARY KEY (scoutid, sectionid)
  );
`;

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_core_members_lastname ON core_members(lastname)',
  'CREATE INDEX IF NOT EXISTS idx_core_members_firstname ON core_members(firstname)',
  'CREATE INDEX IF NOT EXISTS idx_core_members_updated_at ON core_members(updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_member_section_scoutid ON member_section(scoutid)',
  'CREATE INDEX IF NOT EXISTS idx_member_section_sectionid ON member_section(sectionid)',
  'CREATE INDEX IF NOT EXISTS idx_member_section_person_type ON member_section(person_type)',
];

export default {
  version: 3,
  name: 'members_dual_store',
  up: async (db) => {
    await db.execute(DROP_MEMBERS);
    await db.execute(CORE_MEMBERS);
    await db.execute(MEMBER_SECTION);
    for (const sql of INDEXES) {
      await db.execute(sql);
    }
  },
};
