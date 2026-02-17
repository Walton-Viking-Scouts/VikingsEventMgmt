# Phase 1: Infrastructure & Schema - Research

**Researched:** 2026-02-15
**Domain:** IndexedDB/SQLite schema migration, Zod validation, DatabaseService facade, Sentry error handling
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundation for data normalization by defining all new schema definitions (IndexedDB object stores and SQLite tables), installing and creating Zod validation schemas, updating the DatabaseService facade with method stubs, and ensuring consistent Sentry error handling across all storage operations. No data migration or consumer code changes happen in this phase -- it is purely additive infrastructure.

The codebase already has well-established patterns for everything this phase needs. The Members normalization (`core_members` + `member_section` stores in IndexedDB, `members` table in SQLite) serves as the exact reference pattern. The IndexedDB schema upgrade mechanism (`idb`'s `openDB` with version-based `upgrade()` callback) is already in use at `DATABASE_VERSION = 4`. The Sentry error handling pattern (`try/catch` with `sentryUtils.captureException` and structured `logger.error`) is already consistent across every method in `indexedDBService.js`. Demo mode isolation is already solved via `getDatabaseName()` returning `'vikings-eventmgmt-demo'` vs `'vikings-eventmgmt'`.

**Primary recommendation:** Bump `DATABASE_VERSION` from 4 to 5, add version-guarded store creation/replacement in the `upgrade()` callback, install Zod and define validation schemas in a new `schemas/` directory, add method stubs to `DatabaseService`, and confirm demo mode gets the same schema version automatically (it already does by design).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | ^8.0.3 | IndexedDB wrapper (web) | Already installed and in use. Version-based `openDB` upgrade mechanism is the migration system. No change needed. |
| `@capacitor-community/sqlite` | ^7.0.0 | SQLite (native iOS/Android) | Already installed and in use. `CREATE TABLE IF NOT EXISTS` pattern for schema setup. Stay on 7.x (project uses Capacitor 7.4). |
| `zod` | ^3.24 | Runtime schema validation | **NEW DEPENDENCY** -- must be installed. v3 API via `import { z } from 'zod'`. Runtime `.safeParse()` / `.parse()` for validating API responses before storage. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | ^6.2.2 | IndexedDB testing in Vitest | Already a devDependency. Use for testing new schema version upgrade. |
| `@sentry/react` | (installed) | Error reporting | Already configured. Use `sentryUtils.captureException()` in all new methods. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod v3 | Zod v4 (`import from 'zod/v4'`) | v4 is smaller/faster but v3 is battle-tested, default export, and sufficient for a JS project. Upgrade path is easy later. |
| Zod | Joi | Joi is 148kB minified vs Zod ~12kB. Server-oriented. No `.transform()` for type coercion. |
| Zod | AJV / JSON Schema | Different paradigm. Requires separate schema definition format. Less ergonomic for JS development. |

**Installation:**
```bash
npm install zod
```

## Architecture Patterns

### Recommended File Structure for Phase 1

```
src/shared/services/storage/
  indexedDBService.js           # MODIFY: bump DATABASE_VERSION 4->5, add new stores
  database.js                   # MODIFY: add method stubs for all normalized types
  schemas/                      # NEW directory
    validation.js               # Zod schemas for all data types
    indexedDBSchema.js           # Store definitions, keyPaths, indexes (documentation/constants)
    sqliteSchema.js              # CREATE TABLE statements (documentation/constants)
```

### Pattern 1: IndexedDB Schema Version Bump

**What:** Increment `DATABASE_VERSION` from 4 to 5, add version-guarded object store recreation in the `upgrade()` callback.

**How it works in this codebase:** The existing `indexedDBService.js` uses `openDB(dbName, DATABASE_VERSION, { upgrade(db, oldVersion, newVersion, transaction) })`. All current stores use `if (!db.objectStoreNames.contains(storeName))` guards. For Phase 1, **keep the existing guards for all stores** (they still work for fresh installs) and add `if (oldVersion < 5)` blocks for stores that need their keyPath changed.

**Critical detail:** Several existing stores (`events`, `attendance`, `sections`, `terms`, `flexi_lists`, `flexi_structure`, `flexi_data`) currently use `{ keyPath: 'key' }` and store blob data. In Phase 1, we do NOT delete/recreate these stores yet -- we only add the version bump and any **new** stores. The actual store replacement (delete old + create normalized) happens in the data-type-specific phases (2-6) when the consumer code is also updated. Phase 1 should:
1. Bump `DATABASE_VERSION` to 5
2. Ensure existing stores still get created on fresh install (no changes to existing guards)
3. Add any truly new stores that don't exist yet (e.g., `shared_attendance` already exists, so no new stores are actually needed)
4. Add the version 5 upgrade guard structure so subsequent phases can insert their store replacements

**Why this approach:** If we delete and recreate stores in Phase 1 but don't update the consumer code (which reads/writes using old blob patterns), the app breaks. Schema changes to existing stores must be coordinated with consumer code changes in the same phase.

**Revision of initial understanding:** The REQUIREMENTS say "all new object stores exist (empty)" -- but the existing stores already exist with the wrong keyPaths. The correct interpretation is: Phase 1 adds the version 5 upgrade infrastructure and defines what the target schemas WILL be (in `schemas/` files). The actual IndexedDB store replacement happens in each data-type phase. The only IndexedDB change in Phase 1 is bumping `DATABASE_VERSION` from 4 to 5 with a no-op `if (oldVersion < 5)` block that subsequent phases fill in.

**Alternative interpretation:** If the success criteria strictly requires "all new object stores exist (empty)" in Phase 1, then we must delete and recreate stores AND update all consumer code simultaneously. This would make Phase 1 much larger and violate the phase-per-data-type approach. Recommend discussing with user.

### Pattern 2: SQLite Schema Updates

**What:** Add new `CREATE TABLE IF NOT EXISTS` statements to `database.js`'s `createTables()` method.

**How it works:** SQLite uses `CREATE TABLE IF NOT EXISTS` which is idempotent -- tables are created on first run and skipped thereafter. The existing `createTables()` already creates `sections`, `events`, `attendance`, `members`, `sync_status`, `event_dashboard`, `sync_metadata`. For normalized storage, additional tables or schema modifications may be needed, but the existing tables are already normalized (SQLite was designed normalized from the start). The main gap is:
- No flexi tables exist in SQLite (5 methods throw "not yet implemented")
- Missing indexes on existing tables

**Phase 1 action:** Add `CREATE TABLE IF NOT EXISTS` for flexi-related tables (`flexi_lists`, `flexi_structure`, `flexi_data`) and add missing indexes.

### Pattern 3: Zod Validation Schemas

**What:** Define Zod schemas for all data types at the API boundary.

**Where they live:** New file `src/shared/services/storage/schemas/validation.js`.

**Existing data shapes** (derived from codebase analysis):

```javascript
import { z } from 'zod';

// Sections
const SectionSchema = z.object({
  sectionid: z.number(),
  sectionname: z.string().min(1),
  sectiontype: z.string().optional(),
  section: z.string().optional(),
  isDefault: z.boolean().optional(),
  permissions: z.record(z.number()).optional(),
});

// Events
const EventSchema = z.object({
  eventid: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  sectionid: z.union([z.string(), z.number()]).transform(Number),
  termid: z.string().nullable().optional(),
  startdate: z.string().nullable().optional(),
  startdate_g: z.string().nullable().optional(),
  enddate: z.string().nullable().optional(),
  enddate_g: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
});

// Attendance
const AttendanceSchema = z.object({
  scoutid: z.union([z.string(), z.number()]).transform(Number),
  eventid: z.union([z.string(), z.number()]).transform(String),
  firstname: z.string().nullable().optional(),
  lastname: z.string().nullable().optional(),
  attending: z.string().nullable().optional(),
  patrol: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Terms
const TermSchema = z.object({
  termid: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  sectionid: z.union([z.string(), z.number()]).optional(),
  startdate: z.string().nullable().optional(),
  enddate: z.string().nullable().optional(),
});

// Flexi Records
const FlexiListSchema = z.object({
  extraid: z.string(),
  name: z.string(),
  sectionid: z.union([z.string(), z.number()]).optional(),
});

const FlexiStructureSchema = z.object({
  extraid: z.string(),
  name: z.string().optional(),
  config: z.string().optional(),  // JSON string
  structure: z.array(z.any()).optional(),
});

const FlexiDataSchema = z.object({
  scoutid: z.union([z.string(), z.number()]).transform(String),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
}).passthrough();  // Allow dynamic f_1, f_2, etc. fields
```

**Key design decisions for Zod schemas:**
1. Use `.transform()` for type coercion -- OSM API sometimes returns numbers as strings or vice versa
2. Use `.nullable().optional()` for non-required fields -- API responses are inconsistent
3. Use `.passthrough()` for flexi data -- dynamic fields (f_1, f_2, etc.) vary by flexi record type
4. Export both individual schemas and array schemas
5. Export a `safeParseArray` utility that validates arrays gracefully (filters invalid records rather than rejecting entire batch)

### Pattern 4: DatabaseService Facade Stubs

**What:** Add method signatures to `DatabaseService` (`database.js`) for all normalized data types.

**Current state:** DatabaseService already has methods for `sections`, `events`, `attendance`, `members`. Missing: `terms`, `flexi lists/structure/data`, `shared attendance`. These stubs follow the existing pattern:

```javascript
// Method stub pattern (from existing code)
async getTerms(sectionId) {
  await this.initialize();
  if (!this.isNative || !this.db) {
    // IndexedDB path - stub for now
    throw new Error('Terms normalization not yet implemented');
  }
  // SQLite path - stub for now
  throw new Error('Terms normalization not yet implemented');
}
```

**Which methods to add:** Based on XCUT-04 requirement and the target normalized API:
- `getTerms(sectionId)`, `saveTerms(sectionId, terms)`
- `getCurrentActiveTerm(sectionId)`, `setCurrentActiveTerm(sectionId, term)`
- `getFlexiLists(sectionId)`, `saveFlexiLists(sectionId, lists)`
- `getFlexiStructure(recordId)`, `saveFlexiStructure(recordId, structure)`
- `getFlexiData(recordId, sectionId, termId)`, `saveFlexiData(recordId, sectionId, termId, data)`
- `getSharedAttendance(eventId)`, `saveSharedAttendance(eventId, data)`

### Pattern 5: Sentry Error Handling Consistency

**What:** Ensure all storage operations (existing and new) log errors to Sentry with consistent formatting.

**Existing pattern (from `indexedDBService.js`):**
```javascript
static async someMethod(params) {
  try {
    // ... operation
  } catch (error) {
    logger.error('IndexedDB operationName failed', {
      param1,
      param2,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'indexeddb_operation_name',
        store: storeName,
      },
      contexts: {
        indexedDB: {
          storeName,
          param1,
          operation: 'operationName',
        },
      },
    });

    throw error;
  }
}
```

**Consistency check needed:** The `database.js` (SQLite service) does NOT follow this pattern -- it has bare `console.error` calls and `throw error` without Sentry reporting. Phase 1 should add Sentry error handling to existing `database.js` methods to satisfy XCUT-01.

### Pattern 6: Demo Mode Database Parity

**What:** Verify demo mode database gets identical schema version and store definitions.

**Current implementation:** `indexedDBService.js` line 6: `const getDatabaseName = () => isDemoMode() ? 'vikings-eventmgmt-demo' : 'vikings-eventmgmt'`. Both databases use the same `DATABASE_VERSION` constant and the same `upgrade()` callback. **Demo mode parity is already solved by design.** When `DATABASE_VERSION` bumps to 5, both production and demo databases get the same upgrade.

**Phase 1 action:** Verify this works correctly. No code changes needed for demo mode IndexedDB parity. However, the demo mode initializer (`demoMode.js`) currently writes to localStorage with `safeSetItem()`. It does NOT populate IndexedDB object stores. When stores become normalized, the demo initializer will need to write to IndexedDB. This is a Phase 2+ concern -- Phase 1 just needs to confirm the schema definitions are identical.

For SQLite: demo mode detection happens via `this.isNative` check -- on native platforms, SQLite is used regardless of demo mode. The SQLite `createTables()` runs the same schema for both. **Already solved.**

### Anti-Patterns to Avoid

- **Don't delete and recreate stores in Phase 1 without updating consumers.** This would break all existing data reads that use the old blob pattern. Schema changes to existing stores must be paired with consumer code changes.
- **Don't add Zod validation to read paths.** Validate on write only. Local storage is trusted after data has been validated on write.
- **Don't create new files for each data type's Zod schema.** One `validation.js` file is sufficient for ~6 schemas. Keeps imports simple.
- **Don't implement full CRUD in stubs.** Method stubs should throw descriptive errors so any premature usage is caught immediately during development.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema versioning | Custom version tracking in a metadata table | `idb` built-in `openDB(name, version, { upgrade })` | IndexedDB has native version-based upgrade. The project already uses it. |
| SQLite migrations | Custom migration runner | `CREATE TABLE IF NOT EXISTS` (idempotent) | SQLite tables in this project are simple enough that idempotent creation works. |
| API data validation | Manual `if/typeof` checks | Zod `.safeParse()` + `.transform()` | Zod handles type coercion, nested objects, arrays, optional fields. Manual validation diverges from schema over time. |
| Error formatting for Sentry | Custom error serialization | Existing `sentryUtils.captureException()` with structured `tags` and `contexts` | Pattern already established and consistent across IndexedDB methods. |

**Key insight:** Every pattern needed for Phase 1 already exists in the codebase. The Members normalization (stores `core_members` + `member_section`) and the existing `sentryUtils` integration in `indexedDBService.js` are the reference implementations. Phase 1 is about extending these patterns, not inventing new ones.

## Common Pitfalls

### Pitfall 1: Breaking Existing Functionality by Replacing Store KeyPaths
**What goes wrong:** Deleting and recreating an IndexedDB store with a new `keyPath` in Phase 1 causes all existing consumer code to fail because it still writes/reads using the old blob pattern (`{ key: compositeKey, data: [...] }`).
**Why it happens:** The success criteria says "new object stores exist" which seems to require immediate store replacement. But consumers haven't been updated yet.
**How to avoid:** Phase 1 bumps the version and adds the upgrade infrastructure. Each subsequent phase (2-6) handles the actual store replacement + consumer migration for one data type at a time.
**Warning signs:** App crashes on launch after schema change. IndexedDB `DataError` exceptions on put/get operations.

### Pitfall 2: IndexedDB Version Conflict Between Tabs
**What goes wrong:** If two tabs are open and one triggers a version upgrade, the other tab's connection becomes blocked. The `blocked` callback fires and the upgrade cannot proceed.
**Why it happens:** IndexedDB's versionchange transaction requires all other connections to the database to close first.
**How to avoid:** The existing code already has `blocked()` and `blocking()` callbacks in the `openDB` config that log warnings. No additional handling needed for a dev-time-only scenario (users don't typically have multiple tabs of a Scout management app open). The `terminated()` callback already resets `dbPromise` and `currentDatabaseName`.
**Warning signs:** Console warning "IndexedDB opening blocked by another connection" during development.

### Pitfall 3: Zod Transform Side Effects with OSM API Data
**What goes wrong:** The OSM API returns `eventid` sometimes as a number, sometimes as a string. A Zod `.transform(String)` on `eventid` changes the type, which can break downstream code that uses strict equality (`===`) against the original number.
**Why it happens:** API inconsistency. The app has lived with mixed types for a long time.
**How to avoid:** Use `.transform()` to canonicalize types (always string for IDs, always number for sectionid). Document the canonical types clearly. Update all downstream comparisons to use the canonical type.
**Warning signs:** Record lookups return `null` even though the record exists. Equality comparisons fail silently.

### Pitfall 4: SQLite CREATE TABLE IF NOT EXISTS Hides Schema Changes
**What goes wrong:** If a column is added to a `CREATE TABLE IF NOT EXISTS` statement, existing databases that already have the table never see the new column because `IF NOT EXISTS` skips the entire statement.
**Why it happens:** `CREATE TABLE IF NOT EXISTS` is idempotent for table creation but not for schema modification.
**How to avoid:** For new columns on existing tables, use `ALTER TABLE ... ADD COLUMN`. For entirely new tables, `CREATE TABLE IF NOT EXISTS` works fine. The current `database.js` `createTables()` is safe because it doesn't attempt to modify existing tables.
**Warning signs:** `SQLITE_ERROR: no such column` errors on native platforms only.

### Pitfall 5: Demo Mode Initializer Not Updated for IndexedDB
**What goes wrong:** The demo mode initializer (`demoMode.js`) writes all demo data to localStorage via `safeSetItem()`. When stores become normalized (Phase 2+), the demo data won't be in IndexedDB object stores, causing empty state in demo mode.
**Why it happens:** Demo initialization was written when all data was in localStorage blobs. The normalization changes where data lives.
**How to avoid:** Phase 1 does NOT need to update demo initialization -- just verify the schema is identical. The demo initializer update should happen in the same phase as each data type's normalization (e.g., Phase 2 updates demo sections to write to IndexedDB).
**Warning signs:** Demo mode shows empty sections/events after normalization.

## Code Examples

Verified patterns from the actual codebase:

### IndexedDB Version Bump (from `indexedDBService.js`)
```javascript
// Source: /src/shared/services/storage/indexedDBService.js lines 7, 38-129
// Current: DATABASE_VERSION = 4
// Phase 1: Change to DATABASE_VERSION = 5

const DATABASE_VERSION = 5;  // bumped from 4

dbPromise = openDB(dbName, DATABASE_VERSION, {
  upgrade(db, oldVersion, newVersion, _transaction) {
    logger.info('IndexedDB upgrade started', {
      dbName, oldVersion, newVersion,
    }, LOG_CATEGORIES.DATABASE);

    // === Existing stores (versions 1-4) - unchanged ===
    if (!db.objectStoreNames.contains(STORES.CACHE_DATA)) {
      // ... existing creation code (unchanged)
    }
    // ... all other existing store creation guards (unchanged)

    // === Version 5 upgrade block ===
    // Phase 1: Just the version bump and guard structure.
    // Phases 2-6 will add store replacement logic here.
    if (oldVersion < 5) {
      logger.info('IndexedDB v5 upgrade: schema infrastructure ready', {
        dbName,
      }, LOG_CATEGORIES.DATABASE);
      // Store replacements added by subsequent phases:
      // Phase 2: sections store replacement
      // Phase 3: events store replacement
      // Phase 4: attendance store replacement
      // Phase 5: terms store replacement
      // Phase 6: flexi stores replacement
    }

    logger.info('IndexedDB upgrade completed', {
      dbName, version: newVersion,
      stores: Array.from(db.objectStoreNames),
    }, LOG_CATEGORIES.DATABASE);
  },
  // ... blocked, blocking, terminated callbacks unchanged
});
```

### Sentry Error Handling Pattern (from `indexedDBService.js`)
```javascript
// Source: /src/shared/services/storage/indexedDBService.js lines 163-198
// Reference pattern for all new storage methods

static async get(storeName, key) {
  try {
    const db = await getDB();
    const result = await db.get(storeName, key);
    if (result) {
      return result.data;
    }
    return null;
  } catch (error) {
    logger.error('IndexedDB get failed', {
      storeName,
      key,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'indexeddb_get',
        store: storeName,
      },
      contexts: {
        indexedDB: {
          storeName,
          key,
          operation: 'get',
        },
      },
    });

    throw error;
  }
}
```

### SQLite CREATE TABLE Pattern (from `database.js`)
```javascript
// Source: /src/shared/services/storage/database.js lines 173-323
// Pattern for adding new tables

async createTables() {
  // Existing tables (unchanged)
  const createSectionsTable = `CREATE TABLE IF NOT EXISTS sections (...)`;
  const createEventsTable = `CREATE TABLE IF NOT EXISTS events (...)`;
  // ... etc

  // NEW: Flexi tables (Phase 1 adds these)
  const createFlexiListsTable = `
    CREATE TABLE IF NOT EXISTS flexi_lists (
      extraid TEXT NOT NULL,
      sectionid INTEGER NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (extraid, sectionid)
    );
  `;

  const createFlexiStructureTable = `
    CREATE TABLE IF NOT EXISTS flexi_structure (
      extraid TEXT PRIMARY KEY,
      name TEXT,
      config TEXT,
      structure TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createFlexiDataTable = `
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

  // Execute all
  await this.db.execute(createSectionsTable);
  // ... existing tables
  await this.db.execute(createFlexiListsTable);
  await this.db.execute(createFlexiStructureTable);
  await this.db.execute(createFlexiDataTable);
}
```

### DatabaseService Method Stub Pattern
```javascript
// Source: database.js existing methods
// Stubs follow same structure: initialize -> platform check -> throw

async getTerms(sectionId) {
  await this.initialize();
  if (!this.isNative || !this.db) {
    // IndexedDB path - implemented in Phase 5
    throw new Error('Terms retrieval via normalized storage not yet implemented (Phase 5)');
  }
  // SQLite path - implemented in Phase 5
  throw new Error('Terms retrieval via normalized storage not yet implemented (Phase 5)');
}

async saveTerms(sectionId, terms) {
  await this.initialize();
  if (!this.isNative || !this.db) {
    throw new Error('Terms storage via normalized storage not yet implemented (Phase 5)');
  }
  throw new Error('Terms storage via normalized storage not yet implemented (Phase 5)');
}
```

### Zod Schema with Transform (for API data coercion)
```javascript
// Pattern for handling OSM API type inconsistencies
import { z } from 'zod';

const EventSchema = z.object({
  eventid: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  sectionid: z.union([z.string(), z.number()]).transform(Number),
  // ...
});

// Usage: validate + coerce at API boundary
function validateAndCoerceEvents(rawApiResponse) {
  const result = z.array(EventSchema).safeParse(rawApiResponse);
  if (!result.success) {
    logger.warn('Event validation failed', {
      errors: result.error.issues,
      recordCount: rawApiResponse?.length,
    }, LOG_CATEGORIES.DATABASE);
    // Graceful degradation: filter to valid records
    return rawApiResponse.filter(e => EventSchema.safeParse(e).success)
      .map(e => EventSchema.parse(e));
  }
  return result.data;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Blob arrays under composite string keys | Individual records with natural keyPaths | Phase 1 starts this transition | All query patterns become index-based instead of full-scan |
| No API response validation | Zod validation at API boundary | Phase 1 introduces | Catches malformed data before it enters local storage |
| Console.error for SQLite failures | Sentry-reported errors with structured context | Phase 1 standardizes | Production error visibility, debugging context |
| Members in blob storage | Members normalized into core_members + member_section | Already completed (reference pattern) | Proves the normalization approach works |

**Already completed normalization (reference implementation):**
- `core_members` store: `keyPath: 'scoutid'`, indexes on `lastname`, `firstname`, `updated_at`
- `member_section` store: `keyPath: ['scoutid', 'sectionid']`, indexes on `scoutid`, `sectionid`, `person_type`
- Bulk upsert methods: `bulkUpsertCoreMembers`, `bulkUpsertMemberSections`
- Full CRUD: `upsertCoreMember`, `getCoreMember`, `getAllCoreMembers`, `deleteCoreMember`
- Consistent Sentry error handling on every method

## Open Questions

1. **Store Replacement Timing**
   - What we know: Success criteria says "all new object stores exist (empty)." Current stores exist with blob-style `{ keyPath: 'key' }` layout.
   - What's unclear: Should Phase 1 delete and recreate stores with new keyPaths (breaking consumer code until Phases 2-6 complete), or should it only establish the version bump and define target schemas (stores replaced incrementally per phase)?
   - Recommendation: **Incremental approach** -- Phase 1 bumps version, defines schemas in code, adds SQLite tables. Each subsequent phase replaces one IndexedDB store and updates its consumer code together. This keeps the app functional after every phase. If the user wants all stores replaced at once, Phase 1 becomes much larger and Phases 2-6 become consumer-only changes.

2. **Shared Attendance Store**
   - What we know: `shared_attendance` store already exists in IndexedDB with `{ keyPath: 'key' }`. The normalized key should be `[eventid, sectionid]`.
   - What's unclear: Should shared attendance be treated as a sub-type of attendance (Phase 4) or have its own migration?
   - Recommendation: Handle in Phase 4 alongside regular attendance. They share the same consumer patterns.

3. **Demo Mode Initializer Updates**
   - What we know: `demoMode.js` writes to localStorage via `safeSetItem()`. After normalization, data should be in IndexedDB.
   - What's unclear: Should Phase 1 update demo mode to write to IndexedDB, or defer to each data type phase?
   - Recommendation: Defer to each phase. Phase 1 only needs to verify schema parity (which is automatic). Demo data population updates happen alongside the consumer code changes in Phases 2-6.

## Sources

### Primary (HIGH confidence)
- `/src/shared/services/storage/indexedDBService.js` -- Current schema (DATABASE_VERSION=4), 13 stores, upgrade mechanism, Sentry error handling pattern
- `/src/shared/services/storage/database.js` -- SQLite schema (createTables), DatabaseService facade, platform branching pattern
- `/src/config/demoMode.js` -- Demo mode detection, data initialization, localStorage usage
- `/.planning/research/STACK.md` -- Stack decisions (idb, Zod v3, @capacitor-community/sqlite v7)
- `/.planning/REQUIREMENTS.md` -- INFR-01 through INFR-04, XCUT-01, XCUT-04 requirements
- `/.planning/ROADMAP.md` -- Phase dependencies and success criteria
- `/.planning/research/ARCHITECTURE.md` -- Target architecture pattern
- `/.planning/research/FEATURES.md` -- Feature landscape, MVP definition, anti-features

### Secondary (MEDIUM confidence)
- `/.planning/research/STACK.md` Zod version analysis -- verified against Context7 and npm data
- MDN IndexedDB documentation -- version-based upgrade pattern is the standard

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use except Zod (verified compatible)
- Architecture: HIGH -- all patterns already established in codebase, extending existing code
- Pitfalls: HIGH -- derived from actual codebase analysis and known IndexedDB behaviors
- Schema design: HIGH -- target schemas defined in planning research, verified against API data shapes

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable domain, no fast-moving dependencies)

## Appendix: Current vs Target Schema Summary

### IndexedDB Stores

| Store | Current keyPath | Current Indexes | Target keyPath | Target Indexes | Changed In |
|-------|----------------|-----------------|----------------|----------------|------------|
| `cache_data` | `key` | `type`, `timestamp` | `key` | (unchanged) | No change |
| `sections` | `key` | `data.sectionid`, `timestamp` | `sectionid` | `sectiontype` | Phase 2 |
| `startup_data` | `key` | `timestamp` | `key` | (unchanged) | No change |
| `terms` | `key` | `timestamp` | `termid` | `sectionid`, `startdate` | Phase 5 |
| `current_active_terms` | `sectionId` | `lastUpdated` | `sectionId` | (unchanged) | No change |
| `flexi_lists` | `key` | `sectionId` | `[sectionid, extraid]` | `sectionid` | Phase 6 |
| `flexi_structure` | `key` | `recordId` | `extraid` | (none) | Phase 6 |
| `flexi_data` | `key` | `recordId`, `sectionId` | `[extraid, sectionid, termid]` | `extraid`, `sectionid` | Phase 6 |
| `events` | `key` | `sectionId` | `eventid` | `sectionid`, `termid`, `startdate` | Phase 3 |
| `attendance` | `key` | `eventId` | `[eventid, scoutid]` | `eventid`, `scoutid` | Phase 4 |
| `shared_attendance` | `key` | `eventId` | `[eventid, sectionid]` | `eventid` | Phase 4 |
| `core_members` | `scoutid` | `lastname`, `firstname`, `updated_at` | (unchanged) | (unchanged) | Already done |
| `member_section` | `[scoutid, sectionid]` | `scoutid`, `sectionid`, `person_type` | (unchanged) | (unchanged) | Already done |

### SQLite Tables

| Table | Status | Phase 1 Action |
|-------|--------|----------------|
| `sections` | Exists, already normalized | Add missing indexes |
| `events` | Exists, already normalized | Add missing indexes |
| `attendance` | Exists, already normalized | No change |
| `members` | Exists, already normalized | No change |
| `sync_status` | Exists | No change |
| `event_dashboard` | Exists | No change |
| `sync_metadata` | Exists | No change |
| `flexi_lists` | **MISSING** | **CREATE TABLE** |
| `flexi_structure` | **MISSING** | **CREATE TABLE** |
| `flexi_data` | **MISSING** | **CREATE TABLE** |

### Zod Schemas Needed

| Schema | Validates | Fields Count | Complexity |
|--------|-----------|--------------|------------|
| `SectionSchema` | Section records from API | ~6 | Low |
| `EventSchema` | Event records from API | ~12 | Medium (type coercion) |
| `AttendanceSchema` | Attendance records from API | ~7 | Low |
| `TermSchema` | Term records from API | ~5 | Low |
| `FlexiListSchema` | Flexi record list items | ~3 | Low |
| `FlexiStructureSchema` | Flexi record structures | ~5 | Medium (JSON fields) |
| `FlexiDataSchema` | Flexi record data rows | ~3 + dynamic | Medium (passthrough for f_N fields) |
| `SharedAttendanceSchema` | Shared attendance records | ~10 | Medium |

### DatabaseService Method Stubs Needed

| Method | Data Type | Phase Implemented |
|--------|-----------|-------------------|
| `getTerms(sectionId)` | Terms | Phase 5 |
| `saveTerms(sectionId, terms)` | Terms | Phase 5 |
| `getCurrentActiveTerm(sectionId)` | Terms | Phase 5 |
| `setCurrentActiveTerm(sectionId, term)` | Terms | Phase 5 |
| `getFlexiLists(sectionId)` | Flexi | Phase 6 |
| `saveFlexiLists(sectionId, lists)` | Flexi | Phase 6 |
| `getFlexiStructure(recordId)` | Flexi | Phase 6 |
| `saveFlexiStructure(recordId, structure)` | Flexi | Phase 6 |
| `getFlexiData(recordId, sectionId, termId)` | Flexi | Phase 6 |
| `saveFlexiData(recordId, sectionId, termId, data)` | Flexi | Phase 6 |
| `getSharedAttendance(eventId)` | Shared Attendance | Phase 4 |
| `saveSharedAttendance(eventId, data)` | Shared Attendance | Phase 4 |
