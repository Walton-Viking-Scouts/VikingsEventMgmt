/**
 * Migration 004 — wipe events + attendance to clear duplicates that
 * accumulated on real iOS devices before the FK-off fix in 8cef6be landed.
 *
 * IMMUTABLE: Once shipped, never edit. Future schema changes go in a
 * higher-numbered migration.
 *
 * Background: prior to 8cef6be the Capacitor SQLite plugin enforced
 * foreign keys on production iOS builds, so saveEvents' DELETE FROM
 * events WHERE sectionid=? threw silently whenever attendance referenced
 * those events. Renamed/removed events stayed in the table forever next
 * to their replacements, surfacing as duplicate dashboard entries.
 *
 * Destructive: drops all event + attendance rows. The next refresh
 * (login or pull-to-refresh) repopulates everything from OSM. Safe on
 * fresh installs because both tables are already empty.
 *
 * Order matters only when FKs are enforced — initialize() turns them off
 * before runMigrations runs, but we still delete attendance first so the
 * intent is clear if anyone reorders init steps later.
 */

const RESET_ATTENDANCE = 'DELETE FROM attendance;';
const RESET_EVENTS = 'DELETE FROM events;';

export default {
  version: 4,
  name: 'reset_events_after_fk_fix',
  up: async (db) => {
    await db.execute(RESET_ATTENDANCE);
    await db.execute(RESET_EVENTS);
  },
};
