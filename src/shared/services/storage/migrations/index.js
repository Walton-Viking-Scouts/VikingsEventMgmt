/**
 * Registry of database migrations, applied in version order on init.
 *
 * Add new migrations here as new files. Each migration must have a unique,
 * monotonically increasing `version` and a stable `name`. Migrations are
 * frozen once shipped — never edit a previously-released migration; create
 * a new one instead.
 */

import migration001 from './001-initial-schema.js';
import migration002 from './002-add-attendance-columns.js';

export const MIGRATIONS = [
  migration001,
  migration002,
];
