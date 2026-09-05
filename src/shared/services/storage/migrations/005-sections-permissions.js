/**
 * Migration 005 — add sections.permissions (JSON TEXT).
 *
 * IMMUTABLE: Once shipped, never edit. To make further changes, add a new
 * migration with a higher version number.
 *
 * Background: saveSections only persisted sectionid/sectionname/sectiontype
 * on the SQLite (native) path, so getSections on iOS returned sections
 * without the OSM `permissions` map that the web/IndexedDB path keeps.
 * Features that gate on permissions (subs finance access, water-rota
 * permission checks) therefore behaved differently on device.
 *
 * Idempotent: checks PRAGMA table_info first so it's safe to re-run.
 */

/**
 * Reads the column names currently declared on a table, so the migration can
 * skip its ALTER when the column already exists (fresh installs, re-runs).
 *
 * @param {Object} db - Capacitor SQLite connection
 * @param {string} tableName - Table to inspect
 * @returns {Promise<Set<string>>} Set of column names
 */
async function getColumnSet(db, tableName) {
  const info = await db.query(`PRAGMA table_info(${tableName})`);
  return new Set((info.values || []).map(row => row.name));
}

export default {
  version: 5,
  name: 'add_sections_permissions',
  up: async (db) => {
    const columns = await getColumnSet(db, 'sections');
    if (!columns.has('permissions')) {
      await db.execute('ALTER TABLE sections ADD COLUMN permissions TEXT');
    }
  },
};
