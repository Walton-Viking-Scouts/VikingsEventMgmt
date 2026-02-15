# Feature Research: Normalized Storage Layer

**Domain:** IndexedDB/SQLite normalized storage for offline-first Capacitor hybrid app
**Researched:** 2026-02-15
**Confidence:** HIGH (based on codebase analysis, idb library docs, IndexedDB/SQLite best practices)

## Context

Migrating remaining data types from blob storage (`{ key: 'viking_events_{sectionId}_offline', data: [...allEvents] }`) to individually-keyed records with proper indexes. Members already normalized into `core_members` (keyed by `scoutid`) + `member_section` (keyed by `[scoutid, sectionid]`). The established pattern in `indexedDBService.js` and `database.js` is the reference architecture.

Data types to normalize: events, attendance, shared attendance, sections, terms, flexi records (lists/structures/data).

## Feature Landscape

### Table Stakes (Must Have for Proper Normalization)

Features that define the minimum viable normalized storage layer. Without these, the migration is incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Individual record storage with natural keys** | Core of normalization -- records keyed by their domain ID (eventid, scoutid+eventid, sectionid) instead of composite blob keys | MEDIUM | Follow members pattern: `core_members` uses `scoutid` keyPath, `member_section` uses `[scoutid, sectionid]` compound key. Events use `eventid`, attendance uses `[eventid, scoutid]`, sections use `sectionid`. |
| **Secondary indexes on query dimensions** | Every data type has at least one query path beyond primary key (events by sectionid, attendance by eventid, flexi data by sectionId+recordId) | LOW | Already done for members (`sectionid`, `lastname`, `person_type` indexes). Same pattern for all stores. IndexedDB indexes are cheap to create. |
| **Bulk upsert within single transaction** | Sync writes entire dataset at once; individual puts without transactions = N separate commits = unacceptable performance | MEDIUM | Members already have `bulkUpsertCoreMembers` and `bulkUpsertMemberSections`. Same pattern needed for all data types. Single `readwrite` transaction with `tx.done` at end. |
| **Platform-agnostic facade (DatabaseService)** | App code calls `databaseService.saveEvents()` -- must work on both web (IndexedDB) and native (SQLite) without caller knowing which | LOW | Already established in `database.js` with `if (!this.isNative)` branching. Extend same pattern to all normalized stores. |
| **Schema version migration** | Adding new stores or changing indexes requires bumping `DATABASE_VERSION` in IndexedDB and running `ALTER TABLE` / `CREATE TABLE` in SQLite | MEDIUM | Currently at `DATABASE_VERSION = 4`. Next version adds normalized stores. IndexedDB `upgrade()` handler already has phased store creation. SQLite uses `CREATE TABLE IF NOT EXISTS`. |
| **Delete-before-insert replacement strategy** | When syncing, old data for a scope (e.g., all events for a section) must be atomically replaced | LOW | SQLite already does `DELETE FROM events WHERE sectionid = ?` then inserts. IndexedDB equivalent: clear by index within transaction, then put new records. |
| **Consistent error handling with Sentry** | Storage failures must be caught, logged with context, and reported | LOW | Pattern fully established in `IndexedDBService` -- every method has try/catch with `sentryUtils.captureException` and structured `logger.error`. Copy pattern. |
| **Demo mode data isolation** | Demo and production data must never mix -- separate databases in IndexedDB, filtered queries in SQLite | LOW | Already solved: `getDatabaseName()` returns different DB name for demo mode. No additional work needed for new stores. |
| **SQLite FlexiRecord implementations** | 5 methods currently throw `Error('SQLite ... not yet implemented')` -- these are broken on native platforms | HIGH | `storeFlexiRecordListsInSQLite`, `storeFlexiRecordStructureInSQLite`, `getFlexiRecordListsFromSQLite`, `getFlexiRecordStructuresFromSQLite`, `getFlexiRecordDataFromSQLite` all need real implementations. Requires SQLite table design for flexi's 3-part structure. |
| **Old blob key cleanup** | After migration, remove routing for old composite keys from `UnifiedStorageService.shouldUseIndexedDB()` and `getStoreForKey()` | LOW | Per project policy: no backwards compatibility needed. Remove old patterns, don't maintain dual read paths. |

### Differentiators (Patterns That Make Storage Layer Excellent)

Not strictly required, but make the storage layer significantly more robust, debuggable, and maintainable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Compound index for attendance lookups** | Attendance is always queried as "all scouts for event X" or "all events for scout Y" -- compound indexes make both O(1) instead of scanning | LOW | IndexedDB supports compound indexes via array keyPaths. `[eventid, scoutid]` as primary key + `eventid` index + `scoutid` index covers all access patterns. |
| **Timestamp tracking on every record** | `updated_at` field on each record enables "what changed since last sync" queries and debugging stale data | LOW | Members already have `updated_at: Date.now()` on upsert. Extend to all stores. Enables future differential sync if needed. |
| **Store-level metadata record** | A single metadata record per store tracking last-sync timestamp and record count -- enables quick staleness checks without scanning | LOW | Pattern exists in `sync_status` SQLite table. Equivalent for IndexedDB: a `sync_metadata` store with `{ storeName, lastSync, recordCount }`. |
| **Batch read by index (getAllFromIndex)** | Read all records matching an index value in a single call rather than N individual gets | LOW | `idb` library provides `getAllFromIndex()`. Already used for `getMemberSectionsBySection`. Avoids the N+1 query pattern visible in current `getMembers()` which does `Promise.all(scoutIds.map(...))`. |
| **Cross-store transactional writes** | When saving events + attendance together, use a single transaction spanning both stores to prevent partial state | MEDIUM | IndexedDB supports multi-store transactions: `db.transaction(['events', 'attendance'], 'readwrite')`. SQLite already has `BEGIN TRANSACTION / COMMIT`. |
| **Migration utility with progress reporting** | One-time migration function that reads old blob keys, splits into individual records, writes to new stores, and reports progress | MEDIUM | `CurrentActiveTermsService.migrateFromTermsBlob()` is the established pattern. Needs equivalent for events, attendance, flexi records. Important for non-destructive transition. |
| **Store info diagnostic method** | `getStoreInfo()` already exists -- extend to cover all new stores for debugging and support diagnostics | LOW | Existing method returns key counts per store. Cheap to maintain, invaluable for debugging "where did my data go" issues. |
| **Defensive record validation on write** | Validate required fields before writing (e.g., reject attendance record without eventid) | LOW | Members pattern: `if (!memberData?.scoutid) throw new Error(...)`. Same guard for all write methods. Catches bugs early in development. |

### Anti-Features (Deliberately NOT Building)

Features that seem useful but add complexity inappropriate for a read-heavy, manual-sync, small-dataset Scout management app.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Automatic background sync** | "Data should always be fresh" | Adds Service Worker complexity, battery drain, race conditions with manual sync, complexity around conflict resolution. App uses manual sync intentionally -- users control when data refreshes. | Keep manual sync. User taps "sync" button. Simple, predictable, no surprises. |
| **Optimistic conflict resolution (CRDT/OT)** | "Handle concurrent edits gracefully" | Massive complexity for a read-heavy app where data originates from a single source (OSM API). Attendance is the only writable data and is edited by one leader at a time. | Last-write-wins with `updated_at` timestamps. Existing version tracking in attendance table is already more than sufficient. |
| **Reactive/observable storage (RxDB-style)** | "UI should auto-update when storage changes" | Adds heavyweight dependency, IndexedDB observer complexity, memory overhead for change streams. Data changes only on explicit sync, not continuously. | React query invalidation on sync completion. Component re-renders on sync via existing state management. |
| **Full-text search indexes** | "Search across all event names and descriptions" | IndexedDB full-text search is poor; SQLite FTS requires additional tables and configuration. Dataset is small enough (hundreds, not millions of records) that in-memory filtering is instant. | Load records, filter with `Array.filter()` in JavaScript. Already done for member search. |
| **Encryption at rest** | "Protect stored Scout data" | IndexedDB has no native encryption. SQLite encryption requires paid plugin or complex setup. Device-level encryption (iOS/Android) already protects app data. Adding app-level encryption adds latency to every read/write. | Rely on OS-level encryption (iOS Data Protection, Android file-based encryption). Both platforms encrypt app data by default. |
| **Offline write queue with retry** | "Queue writes for when we're back online" | Only attendance is writable offline, and it's already stored locally then pushed on next manual sync. A generic queue system adds complexity for one use case. | Keep current pattern: write to local storage immediately, push to API on manual sync. |
| **IndexedDB cursor-based pagination** | "Paginate through large result sets" | Dataset sizes are small (a Scout group has ~200 members, ~100 events per term, ~30 attendance records per event). Pagination adds API complexity for no benefit. | `getAll()` / `getAllFromIndex()` returns everything. Filter in memory. |
| **Schema ORM layer** | "Abstract away IndexedDB/SQLite differences" | Adds abstraction over the `DatabaseService` facade that already exists. Two layers of abstraction = harder to debug, more code to maintain. | Keep `DatabaseService` as the single facade. It already branches on `isNative`. Adding Dexie.js or similar would be over-engineering. |
| **Versioned record history** | "Track all changes to a record over time" | Storage overhead grows linearly. No use case for "show me what attendance looked like 3 weeks ago." Current version field is for sync conflict detection, not audit trail. | Single `version` + `updated_at` per record. If audit trail needed later, add it server-side. |

## Feature Dependencies

```
[Individual record storage with natural keys]
    |
    +--requires--> [Schema version migration]
    |                  |
    |                  +--requires--> [Old blob key cleanup]
    |
    +--enables--> [Secondary indexes on query dimensions]
    |                 |
    |                 +--enables--> [Batch read by index]
    |                 +--enables--> [Compound index for attendance]
    |
    +--enables--> [Bulk upsert within single transaction]
    |                 |
    |                 +--enables--> [Cross-store transactional writes]
    |
    +--enables--> [Timestamp tracking on every record]
                      |
                      +--enables--> [Store-level metadata record]

[Platform-agnostic facade] --required-by--> [All other features]

[SQLite FlexiRecord implementations] --independent-- [IndexedDB normalization]
    (can be done in parallel, different platform target)

[Migration utility] --requires--> [Individual record storage]
                    --requires--> [Old blob key cleanup] (runs after migration)

[Consistent error handling] --required-by--> [All write/read operations]

[Demo mode isolation] --already-solved-- (no new work)
```

### Dependency Notes

- **Individual record storage requires schema version migration:** New object stores and SQLite tables must be created before records can be written.
- **Schema version migration should include old blob key cleanup:** After migration, remove old routing code to avoid maintaining two paths.
- **Batch read by index requires secondary indexes:** `getAllFromIndex()` only works if the index exists.
- **Cross-store transactional writes require bulk upsert pattern:** The transaction pattern is the same, just spanning multiple stores.
- **SQLite FlexiRecord implementations are independent:** These fix broken native functionality and can be parallelized with IndexedDB work.
- **Migration utility depends on new stores existing:** Must be able to write to normalized stores before migrating data from blobs.

## MVP Definition

### Launch With (v1) -- Minimum to Ship Normalization

- [x] Individual record storage for events (keyed by `eventid`, indexed by `sectionid`)
- [x] Individual record storage for attendance (keyed by `[eventid, scoutid]`, indexed by `eventid`, `scoutid`)
- [x] Individual record storage for shared attendance (keyed by `[eventid, sectionid]`, indexed by `eventid`)
- [x] Normalize sections store (keyed by `sectionid` -- currently blob)
- [x] Normalize terms store (keyed by `termid`, indexed by `sectionid`)
- [x] Normalize flexi_lists (keyed by `[sectionid, extraid]`, indexed by `sectionid`)
- [x] Normalize flexi_structure (keyed by `extraid`)
- [x] Normalize flexi_data (keyed by `[extraid, sectionid, termid]`, indexed by `extraid`, `sectionid`)
- [x] Implement 5 broken SQLite FlexiRecord methods
- [x] Bulk upsert for all new stores
- [x] Schema version bump (DATABASE_VERSION 4 to 5)
- [x] Old blob key routing removal from UnifiedStorageService
- [x] DatabaseService facade methods updated for all data types
- [x] Consistent error handling on all new methods

### Add After Validation (v1.x)

- [ ] Migration utility from old blob keys to normalized stores -- triggered once after upgrade
- [ ] Store-level metadata records for sync freshness tracking
- [ ] Cross-store transactional writes for events + attendance together
- [ ] Diagnostic extension to `getStoreInfo()` covering all new stores

### Future Consideration (v2+)

- [ ] Differential sync based on `updated_at` timestamps -- only fetch changed records from API
- [ ] Store compaction / cleanup for terms and events from past years
- [ ] Performance telemetry for storage operations via Sentry custom metrics

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Individual record storage (all types) | HIGH | HIGH | P1 |
| Secondary indexes | HIGH | LOW | P1 |
| Bulk upsert (all types) | HIGH | MEDIUM | P1 |
| SQLite FlexiRecord implementations | HIGH | HIGH | P1 |
| Schema version migration | HIGH | LOW | P1 |
| Platform-agnostic facade updates | HIGH | LOW | P1 |
| Old blob key cleanup | MEDIUM | LOW | P1 |
| Error handling + Sentry | MEDIUM | LOW | P1 |
| Timestamp tracking | MEDIUM | LOW | P2 |
| Batch read by index | MEDIUM | LOW | P2 |
| Migration utility | MEDIUM | MEDIUM | P2 |
| Store-level metadata | LOW | LOW | P2 |
| Cross-store transactions | LOW | MEDIUM | P3 |
| Diagnostic extension | LOW | LOW | P3 |

**Priority key:**
- P1: Must have -- normalization is incomplete without these
- P2: Should have -- adds robustness and debuggability
- P3: Nice to have -- defer unless time permits

## Reference Architecture (From Members Normalization)

The completed members normalization establishes the pattern all other data types should follow:

**IndexedDB side (`indexedDBService.js`):**
- Store definition in `STORES` constant
- Store creation in `upgrade()` handler with `keyPath` and indexes
- CRUD methods: `upsertCoreMember`, `getCoreMember`, `getAllCoreMembers`, `deleteCoreMember`
- Bulk methods: `bulkUpsertCoreMembers`, `bulkGetCoreMembers`
- Index queries: `getMemberSectionsBySection`, `getMemberSectionsByScout`
- Consistent error handling with logger + Sentry

**SQLite side (`database.js`):**
- Table creation in `createTables()`
- `saveMembers()` with platform branching
- `getMembers()` with JOIN-like reassembly from dual stores on IndexedDB side
- JSON serialization for complex fields (`contact_groups`, `custom_data`)

**Facade (`database.js`):**
- Single entry point for app code
- `if (!this.isNative || !this.db)` branching to IndexedDB vs SQLite
- Consistent return types regardless of platform

## Sources

- [idb library documentation](https://github.com/jakearchibald/idb) -- Context7 verified, HIGH confidence
- [MDN IndexedDB documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) -- Official docs, HIGH confidence
- [LogRocket: Offline-first frontend apps in 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) -- MEDIUM confidence
- [RxDB: Solving IndexedDB Slowness](https://rxdb.info/slow-indexeddb.html) -- MEDIUM confidence (performance patterns)
- [Capacitor Community SQLite plugin](https://github.com/capacitor-community/sqlite) -- Official plugin, HIGH confidence
- Codebase analysis of existing normalized members implementation -- HIGH confidence (direct code review)

---
*Feature research for: Viking Event Management normalized storage layer*
*Researched: 2026-02-15*
