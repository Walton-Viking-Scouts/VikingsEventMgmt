/**
 * Migration 002 — backfill attendance.sectionid and attendance.isSharedSection.
 *
 * IMMUTABLE: Once shipped, never edit. To make further changes, add a new
 * migration with a higher version number.
 *
 * Background: Earlier builds shipped a `attendance` CREATE TABLE statement
 * that lacked `sectionid` and `isSharedSection` columns. Those columns were
 * later added to the CREATE TABLE in code, but `CREATE TABLE IF NOT EXISTS`
 * does not modify pre-existing tables — so devices upgrading from an older
 * build retained the old schema and every INSERT/DELETE referencing the new
 * columns failed with `no such column`.
 *
 * Idempotent: checks PRAGMA table_info first so it's safe to re-run AND safe
 * for fresh installs where migration 001 already creates the columns.
 */

async function getColumnSet(db, tableName) {
  const info = await db.query(`PRAGMA table_info(${tableName})`);
  return new Set((info.values || []).map(row => row.name));
}

export default {
  version: 2,
  name: 'add_attendance_sectionid_and_isSharedSection',
  up: async (db) => {
    const columns = await getColumnSet(db, 'attendance');
    if (!columns.has('sectionid')) {
      await db.execute('ALTER TABLE attendance ADD COLUMN sectionid INTEGER');
    }
    if (!columns.has('isSharedSection')) {
      await db.execute('ALTER TABLE attendance ADD COLUMN isSharedSection INTEGER DEFAULT 0');
    }
  },
};
