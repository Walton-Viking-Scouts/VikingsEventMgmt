# Stack Research: IndexedDB/SQLite Data Normalization

**Domain:** Cross-platform offline storage normalization in Capacitor hybrid app
**Researched:** 2026-02-15
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| `idb` | ^8.0.3 | IndexedDB wrapper (web) | Already in use. Tiny (~1.19kB brotli). Promise-based API mirrors native IndexedDB. Built-in version-based upgrade mechanism via `openDB` is exactly the migration system needed. No reason to change. | HIGH |
| `@capacitor-community/sqlite` | ^7.0.0 (stay on 7.x) | SQLite (native iOS/Android) | Already in use. v8.0.0 released Feb 2026 but targets Capacitor 8. Project is on Capacitor 7.4 so stay on 7.x branch. Has built-in `addUpgradeStatement` for versioned migrations. | HIGH |
| `zod` | ^3.24 (import from `"zod"`) | Runtime schema validation | Zod 4 is stable (released July 2025) but is accessed via `"zod"` import which still exports v3 by default with v4 at `"zod/v4"`. Use v3 API for now -- it is stable, well-tested, and v4 migration can happen later. The project is JavaScript (not TypeScript) so Zod's type inference is less critical, but runtime `.parse()` / `.safeParse()` is valuable for validating API responses before storage. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `fake-indexeddb` | ^6.2.2 | IndexedDB testing in Vitest | Already a dev dependency. Use `import 'fake-indexeddb/auto'` in test setup to provide global IndexedDB in Node.js. Required for all IndexedDB normalization tests. | HIGH |
| `uuid` | ^11.1.0 | ID generation | Already in use. Use for generating compound cache keys if needed, but prefer natural keys (eventid, scoutid) from OSM API over synthetic UUIDs for normalized records. | MEDIUM |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit testing normalized stores | Already configured. Use `fake-indexeddb/auto` in setupFiles. Each test should create a fresh DB instance to avoid state leaks. |
| Browser DevTools > Application > IndexedDB | Manual inspection during dev | Chrome/Safari DevTools let you inspect object stores, records, and indexes directly. Essential for validating schema changes. |

## Schema Migration Strategy

### IndexedDB Migrations (Web)

**Use the built-in `idb` version-based upgrade mechanism.** This is already implemented in the project's `indexedDBService.js` via `openDB(dbName, DATABASE_VERSION, { upgrade })`.

**Pattern: Increment `DATABASE_VERSION` and add version guards.**

```javascript
// Current: DATABASE_VERSION = 4
// New:     DATABASE_VERSION = 5

const DATABASE_VERSION = 5;

dbPromise = openDB(dbName, DATABASE_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) {
    // Existing stores (versions 1-4) created with if-not-exists guards
    if (!db.objectStoreNames.contains(STORES.EVENTS)) {
      db.createObjectStore(STORES.EVENTS, { keyPath: 'key' });
      // ...
    }

    // NEW: Version 5 - Normalize events into individual records
    if (oldVersion < 5) {
      // Delete old blob-style events store
      if (db.objectStoreNames.contains('events')) {
        db.deleteObjectStore('events');
      }
      // Create normalized events store with natural key
      const eventsStore = db.createObjectStore('events', { keyPath: 'eventid' });
      eventsStore.createIndex('sectionId', 'sectionid', { unique: false });
      eventsStore.createIndex('termId', 'termid', { unique: false });
      eventsStore.createIndex('startdate', 'startdate', { unique: false });
    }
  },
});
```

**Why this works:** The `idb` upgrade callback receives `oldVersion` and runs within a versionchange transaction. Users upgrading from v4 to v5 get the migration. Users installing fresh get all stores created. This is the standard IndexedDB pattern -- no external migration library needed.

**Confidence:** HIGH -- verified via Context7 idb docs and existing project code.

### SQLite Migrations (Native)

**Use `@capacitor-community/sqlite`'s built-in `addUpgradeStatement` API.**

```javascript
// Define upgrade statements per version
const upgradeStatements = [
  {
    toVersion: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS events_normalized (
        eventid TEXT PRIMARY KEY,
        sectionid INTEGER NOT NULL,
        termid TEXT,
        name TEXT NOT NULL,
        startdate TEXT,
        enddate TEXT,
        location TEXT,
        FOREIGN KEY (sectionid) REFERENCES sections(sectionid)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_events_section ON events_normalized(sectionid);`,
      `CREATE INDEX IF NOT EXISTS idx_events_term ON events_normalized(termid);`,
    ],
  },
];

// Register before opening
await sqlite.addUpgradeStatement('vikings_db', upgradeStatements);
// Open with new version number
db = await sqlite.createConnection('vikings_db', false, 'no-encryption', 2, false);
```

**Why this works:** The plugin handles version tracking and runs statements only when upgrading. Incremental -- each `toVersion` block runs only for users below that version.

**Confidence:** HIGH -- verified via Context7 @capacitor-community/sqlite docs.

## Data Validation Strategy

### Zod for API Response Validation

Use Zod schemas to validate data coming from the OSM API **before** writing to either IndexedDB or SQLite. This catches malformed data at the boundary rather than letting corrupt records into local storage.

```javascript
import { z } from 'zod';

const EventSchema = z.object({
  eventid: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  sectionid: z.number(),
  termid: z.string().nullable().optional(),
  startdate: z.string().nullable().optional(),
  enddate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const EventArraySchema = z.array(EventSchema);

// Usage in data service before storage
function validateEvents(rawEvents) {
  const result = EventArraySchema.safeParse(rawEvents);
  if (!result.success) {
    logger.warn('Event validation failed', { errors: result.error.issues });
    // Filter to only valid records rather than rejecting entire batch
    return rawEvents.filter(e => EventSchema.safeParse(e).success);
  }
  return result.data;
}
```

**Why Zod over alternatives:**
- Runtime validation (not just types) -- essential for JavaScript project
- `.safeParse()` returns errors without throwing -- better for graceful degradation
- `.transform()` can coerce types (e.g., eventid number-to-string) during validation
- ~12kB gzipped (v3) -- acceptable for a mobile app with existing large dependencies
- If bundle size becomes a concern later, Zod Mini (~1.9kB) is available in v4

**Confidence:** HIGH -- Zod is the dominant runtime validation library for JS/TS in 2025/2026.

### Where Validation Happens

| Layer | What Gets Validated | Schema Used |
|-------|-------------------|-------------|
| API response handler | Raw JSON from OSM API | Full Zod schemas with transforms |
| Storage write (IndexedDB) | Validated data going into `db.put()` | Same schemas, already validated |
| Storage write (SQLite) | Validated data going into SQL inserts | Same schemas, already validated |
| Storage read | Trust local data (already validated on write) | No re-validation needed |

Validate once at the API boundary. Local storage is trusted after that.

## Cross-Platform Storage Parity

### Architecture Pattern: Adapter with Shared Validation

```
API Response
    |
    v
Zod Validation (shared)
    |
    v
DatabaseService (existing orchestrator)
    |
    +---> isNative? ---> SQLite adapter (normalized tables)
    |
    +---> !isNative? --> IndexedDB adapter (normalized object stores)
```

**The project already implements this pattern** in `database.js`. Each method checks `this.isNative` and delegates to either SQLite or `UnifiedStorageService` (which routes to IndexedDB). The normalization work extends this existing pattern -- it does not require architectural changes.

### Parity Rules

1. **Same natural keys on both platforms:** `eventid` as primary key in both SQLite table and IndexedDB object store
2. **Same indexes:** `sectionid`, `termid`, `startdate` indexed on both
3. **Same data shape:** Zod schema defines the canonical shape; both platforms store the same validated object
4. **Same query patterns:** `getEventsBySection(sectionId)` returns identical results from either platform

## Normalized Store Design

### IndexedDB Object Stores (Target Schema)

| Store Name | keyPath | Indexes | Replaces |
|------------|---------|---------|----------|
| `events` | `eventid` | `sectionid`, `termid`, `startdate` | Blob arrays under `viking_events_{sectionId}_offline` |
| `attendance` | `[eventid, scoutid]` | `eventid`, `scoutid` | Blob arrays under `viking_attendance_{eventId}_offline` |
| `sections` | `sectionid` | `sectiontype` | Blob under `viking_sections_offline` |
| `terms` | `termid` | `sectionid` | Blob under `viking_terms_offline` |
| `flexi_lists` | `[sectionid, recordid]` | `sectionid` | Blob arrays keyed by section |
| `flexi_structure` | `recordid` | (none needed) | Blob arrays keyed by record |
| `flexi_data` | `[recordid, sectionid, termid]` | `recordid`, `sectionid` | Blob arrays keyed by composite key |
| `core_members` | `scoutid` | `lastname`, `firstname` | **Already normalized** |
| `member_section` | `[scoutid, sectionid]` | `scoutid`, `sectionid` | **Already normalized** |

### SQLite Tables (Target Schema)

Mirror the IndexedDB stores. The existing SQLite `createTables()` in `database.js` already has normalized tables for events, attendance, members, and sections. The SQLite side needs less work -- it was designed normalized from the start. The normalization effort is primarily an IndexedDB concern.

## Installation

```bash
# Zod (new dependency for validation)
npm install zod

# Everything else is already installed:
# idb@^8.0.3 -- already in dependencies
# @capacitor-community/sqlite@^7.0.0 -- already in dependencies
# fake-indexeddb@^6.2.2 -- already in devDependencies
```

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `idb` (stay) | Dexie.js | Dexie adds 16kB+ for features not needed (live queries, sync protocol). `idb` is already in use, tiny, and its upgrade mechanism is sufficient. Switching would require rewriting all IndexedDB code for zero benefit. |
| `idb` built-in migrations | `idb-migrate` / custom migration runner | IndexedDB's native version-based upgrade is the correct pattern. External migration libraries add complexity for a problem already solved. The `openDB` upgrade callback with `oldVersion` guards is the industry standard. |
| `@capacitor-community/sqlite` `addUpgradeStatement` | TypeORM / Knex.js migrations | Heavy ORMs are overkill for a read-only offline cache. The plugin's built-in upgrade mechanism handles versioned schema changes. No need for a migration runner when you have ~6 tables. |
| Zod v3 (via `"zod"` import) | Joi / Yup / AJV | **Joi:** 148kB minified, designed for Node.js, heavy for mobile. **Yup:** API is fine but Zod has won the ecosystem (~25M weekly npm downloads vs Yup's ~7M). **AJV:** JSON Schema-based, different paradigm, better for API validation at the server. Zod's `.safeParse()` + `.transform()` is ideal for this use case. |
| Zod v3 | Zod v4 (`"zod/v4"`) | v4 is faster and smaller but the project is JavaScript (not TypeScript) so the type inference improvements matter less. v3 is battle-tested and the default export. Can upgrade to v4 import path later with minimal changes. |
| `fake-indexeddb` (stay) | `jsdom` built-in IndexedDB | jsdom does not include IndexedDB. `fake-indexeddb` is the standard solution for Node.js IndexedDB testing. Already working in the project. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Dexie.js | Unnecessary migration from working `idb` setup. Adds ~16kB. Live queries and sync protocol are unused features. Would require rewriting all existing IndexedDB code. | `idb` ^8.0.3 (already in use) |
| `@capacitor-community/sqlite` v8 | Targets Capacitor 8. Project is on Capacitor 7.4. Upgrading Capacitor is a separate major effort. | `@capacitor-community/sqlite` ^7.0.0 (already in use) |
| TypeORM / Prisma / Drizzle | Server-side ORMs. Massive bundle size. Don't understand Capacitor's SQLite plugin API. The project has ~6 tables with straightforward schemas. | Raw SQL via `@capacitor-community/sqlite` |
| localStorage for normalized data | Already being phased out. 5MB limit. Synchronous API blocks main thread. Cannot index or query individual records. | IndexedDB via `idb` |
| `localForage` | Outdated abstraction over IndexedDB/WebSQL/localStorage. Last meaningful update was 2020. No schema migration support. Adds complexity without benefit when `idb` is already working. | `idb` ^8.0.3 |
| `rxdb` | Reactive database layer. 50kB+ gzipped. Designed for real-time sync scenarios. Massive overkill for a read-only offline cache with manual sync. | `idb` + `@capacitor-community/sqlite` (already in use) |
| Joi for validation | 148kB minified. Designed for Node.js server validation. No `.transform()` equivalent for type coercion during parse. | Zod ^3.24 |
| Manual JSON.parse validation | No schema definition. No error reporting. No type coercion. Brittle `if` chains that diverge from actual data shape over time. | Zod ^3.24 |

## Stack Patterns by Variant

**For normalizing stores that currently hold blob arrays (events, attendance, terms, flexi):**
- Bump `DATABASE_VERSION` in `indexedDBService.js`
- Add version guard in `upgrade()` callback
- Delete old object store, create new one with natural keyPath
- Add appropriate indexes
- The service methods (in `database.js`, `vikingEventStorageService.js`, etc.) switch from `get(store, compositeKey)` returning an array to `getAllFromIndex(store, indexName, value)` returning individual records

**For stores already normalized (core_members, member_section):**
- No schema changes needed
- These serve as the reference pattern for how the new normalized stores should work

**For SQLite (native) side:**
- SQLite tables are already normalized in `createTables()`
- May need new indexes or minor column additions
- Use `addUpgradeStatement` for any schema changes

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `idb` ^8.0.3 | All modern browsers, Vite 7, Vitest 3 | ES module. Works with `fake-indexeddb` ^6.x for testing. |
| `@capacitor-community/sqlite` ^7.0.0 | Capacitor ^7.4.0 | Must stay on 7.x while project uses Capacitor 7. v8 requires Capacitor 8. |
| `zod` ^3.24 | Node.js >=18, all modern browsers | ES module and CJS. Tree-shakeable. No dependencies. |
| `fake-indexeddb` ^6.2.2 | Vitest ^3.x, `idb` ^8.x | Import `fake-indexeddb/auto` in test setup. Provides global `indexedDB`, `IDBKeyRange`, etc. |

## Sources

- [idb GitHub (jakearchibald/idb)](https://github.com/jakearchibald/idb) -- Context7 verified, version 8.0.3, migration patterns
- [@capacitor-community/sqlite docs](https://github.com/capacitor-community/sqlite) -- Context7 verified, `addUpgradeStatement` API, upgrade patterns
- [Zod v4 release notes](https://zod.dev/v4) -- Context7 verified, v3 remains default export, v4 available at `"zod/v4"`
- [Zod npm (colinhacks/zod)](https://github.com/colinhacks/zod/releases) -- v4.0.0 released July 2025, v3.24.x is current stable default
- [@capacitor-community/sqlite npm](https://www.npmjs.com/package/@capacitor-community/sqlite) -- v8.0.0 released Feb 2026 for Capacitor 8, v7.x for Capacitor 7
- [idb npm](https://www.npmjs.com/package/idb) -- v8.0.3 is latest, ~1.19kB brotli
- [fake-indexeddb npm](https://www.npmjs.com/package/fake-indexeddb) -- v6.x with 2025 Web Platform Tests
- [IndexedDB migration best practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) -- version-based upgrade is the standard pattern
- Existing project code: `indexedDBService.js`, `database.js`, `unifiedStorageService.js` -- verified current patterns and architecture

---
*Stack research for: IndexedDB/SQLite data normalization in Capacitor hybrid app*
*Researched: 2026-02-15*
