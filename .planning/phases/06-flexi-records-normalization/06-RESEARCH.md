# Phase 6: Flexi Records Normalization - Research

**Researched:** 2026-02-17
**Domain:** IndexedDB / SQLite store normalization for three interrelated flexi record stores
**Confidence:** HIGH

## Summary

Phase 6 normalizes three flexi record stores (lists, structures, data) from the current blob-in-a-key pattern to individually keyed records in IndexedDB and implements the five currently-broken SQLite methods. This follows the exact same normalization pattern established in Phases 2-5 (sections, events, attendance, terms) but is more complex because: (a) there are three interrelated stores instead of one, (b) two stores use compound keys, (c) there is significant backdoor access through UnifiedStorageService and direct localStorage reads that must be migrated, and (d) the `databaseService.storageBackend` references in FlexiRecordDataService are phantom -- that property does not exist on DatabaseService.

The current state is well-documented in `indexedDBSchema.js` (NORMALIZED_STORES) and `sqliteSchema.js` (SQLITE_SCHEMAS). Zod validation schemas already exist in `validation.js` (FlexiListSchema, FlexiStructureSchema, FlexiDataSchema). The IndexedDB stores already exist at version 7 but still use the old blob-style `{ keyPath: 'key' }` format. Database.js already has five Phase 6 stub methods that throw Error.

**Primary recommendation:** Follow the established phase pattern -- (1) bump IndexedDB to v8 and normalize all three flexi stores with proper keyPaths/indexes, (2) add CRUD methods to IndexedDBService, (3) wire DatabaseService methods to IndexedDB/SQLite, (4) migrate FlexiRecordDataService to use DatabaseService instead of phantom `storageBackend`, (5) eliminate all backdoor access paths.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | existing | IndexedDB wrapper with upgrade support | Already used for all stores |
| @capacitor-community/sqlite | existing | SQLite on native platforms | Already used for native storage |
| zod | existing (v4 compat) | Schema validation at write boundary | Established pattern from Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | No new dependencies needed | - |

### Alternatives Considered
None -- this phase uses exclusively existing libraries and established patterns.

**Installation:**
No new packages needed.

## Architecture Patterns

### Recommended Approach

The normalization must follow the exact patterns established in Phases 2-5.

### Store Definitions (from indexedDBSchema.js -- already documented)

```
flexi_lists:     keyPath: ['sectionid', 'extraid']    indexes: [sectionid]
flexi_structure: keyPath: 'extraid'                    indexes: []
flexi_data:      keyPath: ['extraid', 'sectionid', 'termid']  indexes: [extraid, sectionid]
```

Note: The SQLite schema (sqliteSchema.js) uses a 4-column PK for flexi_data: `(extraid, sectionid, termid, scoutid)`. This is because SQLite stores individual member rows per flexi record, while IndexedDB stores the whole API response blob per (extraid, sectionid, termid) combination. The IndexedDB schema in NORMALIZED_STORES does NOT include scoutid in the keyPath -- each record is a complete API response for one flexi record + section + term combination. This is consistent with how the app currently uses the data.

### Pattern 1: IndexedDB Version Upgrade (v7 -> v8)
**What:** Bump DATABASE_VERSION to 8, add `if (oldVersion < 8)` block
**When to use:** Standard version upgrade pattern
**Example (from Phase 5):**
```javascript
if (oldVersion < 8) {
  if (db.objectStoreNames.contains(STORES.FLEXI_LISTS)) {
    db.deleteObjectStore(STORES.FLEXI_LISTS);
  }
  const flexiListsStore = db.createObjectStore(STORES.FLEXI_LISTS, { keyPath: ['sectionid', 'extraid'] });
  flexiListsStore.createIndex('sectionid', 'sectionid', { unique: false });
  // ... repeat for FLEXI_STRUCTURE and FLEXI_DATA
}
```

### Pattern 2: Section-Scoped Cursor Delete + Put (for flexi_lists)
**What:** Delete all records for a section, then put new ones
**When to use:** Replacing all flexi lists for a section
**Example (from events Phase 3):**
```javascript
static async bulkReplaceFlexiListsForSection(sectionId, lists) {
  const db = await getDB();
  const tx = db.transaction(STORES.FLEXI_LISTS, 'readwrite');
  const store = tx.objectStore(STORES.FLEXI_LISTS);
  const index = store.index('sectionid');
  let cursor = await index.openCursor(sectionId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  for (const list of lists) {
    await store.put({ ...list, updated_at: Date.now() });
  }
  await tx.done;
  return lists.length;
}
```

### Pattern 3: Direct Key Put (for flexi_structure)
**What:** Put a single structure record by extraid
**When to use:** Storing/updating a single flexi record structure
```javascript
static async saveFlexiRecordStructure(structure) {
  const db = await getDB();
  await db.put(STORES.FLEXI_STRUCTURE, { ...structure, updated_at: Date.now() });
  return structure;
}
```

### Pattern 4: Compound-Key Scoped Replacement (for flexi_data)
**What:** Replace all data for a specific (extraid, sectionid, termid) combination
**When to use:** Storing flexi data after API fetch
**Note:** Uses index cursor since the keyPath is compound

### Pattern 5: DatabaseService Write Boundary Validation
**What:** Validate with Zod at DatabaseService layer before passing to IndexedDBService
**When to use:** All write operations
**Example (from Phase 5):**
```javascript
async saveFlexiLists(sectionId, lists) {
  await this.initialize();
  const enriched = lists.map(l => ({ ...l, sectionid: sectionId }));
  const { data: valid, errors } = safeParseArray(FlexiListSchema, enriched);
  if (errors.length > 0) { /* log warning */ }
  if (!this.isNative || !this.db) {
    await IndexedDBService.bulkReplaceFlexiListsForSection(sectionId, valid);
    return;
  }
  // SQLite path...
}
```

### Anti-Patterns to Avoid
- **Phantom storageBackend:** FlexiRecordDataService references `databaseService.storageBackend.saveFlexiRecordLists()` etc. This property does not exist on DatabaseService. Must replace all 6 calls with proper DatabaseService methods.
- **Direct localStorage scanning:** CampGroupsView.jsx scans `Object.keys(localStorage)` for flexi keys. Must route through FlexiRecordDataService.
- **UnifiedStorageService for flexi writes:** The old flexiRecordService.js (features layer) writes flexi data through UnifiedStorageService.set() with constructed key strings. After normalization, all flexi writes must go through FlexiRecordDataService -> DatabaseService -> IndexedDBService.
- **Key-string parsing:** Several files (useSignInOut.js, CampGroupsView.jsx, useSectionMovements.js) parse `viking_flexi_data_EXTRAID_SECTIONID_TERMID_offline` key strings to extract IDs. This pattern must be replaced with proper service calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Store migration | Manual data copy between stores | Delete + recreate store in upgrade block | Clean migration, data re-fetched from API |
| Compound key queries | Manual iteration over all records | IndexedDB indexes with cursor | Performance, correctness |
| Zod validation | Custom type checking | Existing FlexiListSchema, FlexiStructureSchema, FlexiDataSchema | Already defined and tested |
| SQLite CRUD | New query builders | Direct SQL statements matching sqliteSchema.js | Consistent with existing patterns |

**Key insight:** All three Zod schemas already exist in validation.js. The normalized store definitions already exist in indexedDBSchema.js. The SQLite CREATE TABLE statements already exist in sqliteSchema.js. Phase 6 is primarily a wiring exercise -- connecting existing schemas to existing store definitions through established patterns.

## Common Pitfalls

### Pitfall 1: Phantom storageBackend Property
**What goes wrong:** FlexiRecordDataService calls `databaseService.storageBackend.saveFlexiRecordLists()` which doesn't exist. Currently this code path only runs on web where IndexedDB methods are used, but the property access would fail if the method were actually called.
**Why it happens:** The code was written assuming a different architecture than what was built.
**How to avoid:** Replace all 6 `storageBackend` references with proper DatabaseService method calls. Verify by grepping for `storageBackend` in the final code.
**Warning signs:** `TypeError: Cannot read properties of undefined` at runtime.

### Pitfall 2: Compound Key Type Coercion
**What goes wrong:** IndexedDB compound keys require exact type matching. If `sectionid` is stored as `"123"` (string) but queried as `123` (number), the lookup fails silently and returns no results.
**Why it happens:** API responses may return IDs as strings or numbers inconsistently.
**How to avoid:** Use Zod `.transform(Number)` for sectionid and `.transform(String)` for extraid at the write boundary, ensuring consistent types. The schemas already do this correctly.
**Warning signs:** Queries return empty arrays when data is known to exist.

### Pitfall 3: Flexi Data Key Granularity Mismatch
**What goes wrong:** The NORMALIZED_STORES schema uses `['extraid', 'sectionid', 'termid']` as the keyPath for flexi_data, but the SQLite schema uses `(extraid, sectionid, termid, scoutid)`. These store data at different granularities.
**Why it happens:** IndexedDB stores the full API response as one record per (extraid, section, term); SQLite normalizes to per-member rows.
**How to avoid:** For IndexedDB, continue storing the full API response object (with items array) per (extraid, sectionid, termid). For SQLite, normalize to individual rows. The FlexiRecordDataService already handles this difference -- its `normalizeFlexiRecordData()` method extracts individual member rows for SQLite storage.
**Warning signs:** IndexedDB overwriting data or losing members; SQLite queries returning unexpected result shapes.

### Pitfall 4: Multiple Backdoor Access Points
**What goes wrong:** Even after normalizing storage, old code paths continue reading/writing flexi data through UnifiedStorageService or direct localStorage, causing stale data or data loss.
**Why it happens:** Flexi data has the most scattered access patterns of all store types in this codebase.
**How to avoid:** Systematically enumerate ALL flexi data consumers before starting migration. The grep results show at least 8 files with direct flexi key access:
  - `flexiRecordService.js` (features layer -- uses UnifiedStorageService.set/get)
  - `flexiRecords.js` (API layer -- uses UnifiedStorageService.set/get)
  - `CampGroupsView.jsx` (component -- scans localStorage directly)
  - `useSignInOut.js` (hook -- parses flexi key strings)
  - `campGroupAllocationService.js` (service -- constructs flexi cache keys)
  - `useSectionMovements.js` (hook -- scans localStorage for flexi keys)
  - `SectionMovementTracker.jsx` (component -- constructs flexi cache keys)
  - `TermMovementCard.jsx` (component -- constructs flexi cache keys)
  - `demoMode.js` (config -- seeds demo flexi data to localStorage)
  - `base.js` (API -- clears flexi cache keys from localStorage)
**Warning signs:** Data works on first load but becomes stale after updates.

### Pitfall 5: Demo Mode Data Seeding
**What goes wrong:** demoMode.js uses `safeSetItem()` (localStorage) to seed demo flexi data. After normalization, these records won't be found in IndexedDB.
**Why it happens:** Demo mode was written before the normalization effort.
**How to avoid:** Update demoMode.js flexi seeding to write to IndexedDB through DatabaseService/IndexedDBService. Or, since the NO BACKWARDS COMPATIBILITY policy applies, simply accept that demo flexi data may need re-seeding. Given that demo mode is a secondary concern, this can be deferred.
**Warning signs:** Demo mode shows no flexi record data.

### Pitfall 6: Store Upgrade vs. Existing Data
**What goes wrong:** The v8 upgrade deletes and recreates flexi stores, losing any cached data. Users must re-fetch from API.
**Why it happens:** This is by design -- the same approach used in all previous phases. The old blob-format data cannot be migrated to the new keyed format.
**How to avoid:** This is expected behavior. The app already handles missing cached data by fetching from API. Ensure all read methods handle empty stores gracefully (return empty array / null).
**Warning signs:** None -- this is the correct behavior.

## Code Examples

### Verified patterns from completed phases:

### IndexedDB Compound Key Store with Index
```javascript
// From Phase 4 (attendance) -- compound keyPath with indexes
if (oldVersion < 6) {
  if (db.objectStoreNames.contains(STORES.ATTENDANCE)) {
    db.deleteObjectStore(STORES.ATTENDANCE);
  }
  const attendanceStoreV6 = db.createObjectStore(STORES.ATTENDANCE, { keyPath: ['eventid', 'scoutid'] });
  attendanceStoreV6.createIndex('eventid', 'eventid', { unique: false });
  attendanceStoreV6.createIndex('scoutid', 'scoutid', { unique: false });
  attendanceStoreV6.createIndex('sectionid', 'sectionid', { unique: false });
}
```

### Cursor-Based Section-Scoped Delete (for compound-key stores)
```javascript
// From Phase 3 (events) -- delete by section then put
static async bulkReplaceEventsForSection(sectionId, events) {
  const db = await getDB();
  const tx = db.transaction(STORES.EVENTS, 'readwrite');
  const store = tx.objectStore(STORES.EVENTS);
  const index = store.index('sectionid');
  let cursor = await index.openCursor(sectionId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  for (const event of events) {
    await store.put({ ...event, updated_at: Date.now() });
  }
  await tx.done;
  return events.length;
}
```

### DatabaseService Write Boundary with Zod Validation
```javascript
// From Phase 5 (terms)
async saveTerms(sectionId, terms) {
  await this.initialize();
  const enrichedTerms = (Array.isArray(terms) ? terms : []).map(t => ({ ...t, sectionid: sectionId }));
  const { data: validTerms, errors } = safeParseArray(TermSchema, enrichedTerms);
  if (errors.length > 0) {
    logger.warn('Term validation errors during save', { ... }, LOG_CATEGORIES.DATABASE);
  }
  if (!this.isNative || !this.db) {
    await IndexedDBService.bulkReplaceTermsForSection(sectionId, validTerms);
    return;
  }
  // SQLite path with transaction...
}
```

### Read-Path Resilience Pattern
```javascript
// From Phase 4 (attendance) -- return fallback on error for reads
static async getAttendanceByEvent(eventId) {
  try {
    const db = await getDB();
    return (await db.getAllFromIndex(STORES.ATTENDANCE, 'eventid', String(eventId))) || [];
  } catch (error) {
    logger.error('IndexedDB getAttendanceByEvent failed', { ... });
    sentryUtils.captureException(error, { ... });
    return [];
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Blob under single key `{ key: 'flexi_lists_123', data: [...] }` | Individual records with keyPath sectionid/extraid | Phase 6 (this phase) | Enables efficient queries, eliminates full-blob reads |
| `databaseService.storageBackend.saveFlexiRecordLists()` | `databaseService.saveFlexiLists()` | Phase 6 (this phase) | Eliminates phantom property access |
| UnifiedStorageService key-string routing for flexi data | Direct IndexedDBService CRUD methods | Phase 6 (this phase) | Single source of truth through FlexiRecordDataService |
| SQLite flexi methods `throw new Error('not yet implemented')` | Working SQLite CRUD matching IndexedDB API | Phase 6 (this phase) | Native platform support |

**Deprecated/outdated:**
- `databaseService.storageBackend` -- phantom property, never existed
- Direct localStorage scanning for flexi keys in components
- UnifiedStorageService key-string construction for flexi data access
- `_CACHE_KEYS` constants in flexiRecordDataService.js (currently unused)

## Open Questions

1. **FlexiData granularity in IndexedDB**
   - What we know: NORMALIZED_STORES defines `['extraid', 'sectionid', 'termid']` as keyPath. Current code stores full API response objects.
   - What's unclear: Should individual member rows be stored separately (like SQLite) or should the full API response blob be stored per (extraid, sectionid, termid)?
   - Recommendation: Keep storing full API response per (extraid, sectionid, termid) in IndexedDB to match current behavior and minimize changes. The data is always read as a complete set per flexi record + section + term.

2. **Extent of backdoor elimination in this phase**
   - What we know: FLEX-06 says "no backdoor access via UnifiedStorageService". There are ~10 files with direct flexi key access.
   - What's unclear: Should ALL 10 files be migrated in Phase 6, or should the feature-layer services (flexiRecordService.js etc.) be deferred to Phase 7?
   - Recommendation: Migrate the storage layer completely (FlexiRecordDataService, DatabaseService, IndexedDBService) in early plans. Then migrate feature-layer consumers (flexiRecordService.js, campGroupAllocationService.js, components, hooks) in later plans. Demo mode can be deferred.

3. **FlexiRecordDataService vs flexiRecordService.js (feature layer)**
   - What we know: There are two flexi services -- `FlexiRecordDataService` (shared/services) and `flexiRecordService.js` (features/events/services). They overlap significantly.
   - What's unclear: Should flexiRecordService.js be refactored to delegate storage to FlexiRecordDataService, or should it be left using its own caching?
   - Recommendation: The feature-layer flexiRecordService.js handles caching, network checks, and API orchestration. It should continue to own that logic but must write storage through FlexiRecordDataService -> DatabaseService instead of directly through UnifiedStorageService. This is a consumer migration, not a refactor.

## Key Findings for Planning

### Work Breakdown Estimate (5-6 plans)

**Plan 1: IndexedDB v8 upgrade + CRUD methods for all three stores**
- Bump DATABASE_VERSION to 8
- Add `if (oldVersion < 8)` block: delete/recreate flexi_lists, flexi_structure, flexi_data
- Add 8-10 static methods to IndexedDBService:
  - flexi_lists: bulkReplaceFlexiListsForSection, getFlexiListsBySection, getAllFlexiLists
  - flexi_structure: saveFlexiRecordStructure, getFlexiRecordStructure, getFlexiRecordStructures
  - flexi_data: saveFlexiRecordData (put by compound key), getFlexiRecordData (by extraid+sectionid+termid), getFlexiRecordDataBySection

**Plan 2: DatabaseService flexi methods (replace stubs)**
- Implement 5 stub methods that currently throw Error: getFlexiLists, saveFlexiLists, getFlexiStructure, saveFlexiStructure, getFlexiData/saveFlexiData
- Add Zod validation at write boundary using existing schemas
- Wire to IndexedDBService (web) and SQLite (native)
- Add SQLite indexes for flexi tables

**Plan 3: FlexiRecordDataService migration**
- Replace all 6 `databaseService.storageBackend.*` calls with proper `databaseService.*` calls
- Replace `IndexedDB`-specific read methods (getFlexiRecordListsFromIndexedDB etc.) with platform-agnostic DatabaseService calls
- Implement the 5 SQLite methods that currently throw Error
- Remove dead code: `_CACHE_KEYS`, separate IndexedDB/SQLite method pairs

**Plan 4: Feature-layer consumer migration**
- Migrate flexiRecordService.js: replace UnifiedStorageService.set/get with FlexiRecordDataService calls
- Migrate flexiRecords.js (API layer): replace UnifiedStorageService caching with FlexiRecordDataService
- Migrate campGroupAllocationService.js: replace cache key construction

**Plan 5: Component/hook consumer migration**
- Migrate CampGroupsView.jsx: replace localStorage scanning with FlexiRecordDataService calls
- Migrate useSignInOut.js: replace key string parsing
- Migrate useSectionMovements.js + SectionMovementTracker.jsx + TermMovementCard.jsx
- Clean up base.js flexi cache clearing

**Plan 6 (optional): Bulk upsert methods + cleanup**
- Add bulk upsert convenience methods per FLEX-07
- Remove UnifiedStorageService flexi convenience methods
- Clean up demoMode.js flexi seeding (if needed)
- Final verification

### Files That Will Be Modified

**Storage layer (Plans 1-2):**
- `src/shared/services/storage/indexedDBService.js` -- v8 upgrade, CRUD methods
- `src/shared/services/storage/database.js` -- implement flexi stubs
- `src/shared/services/storage/schemas/sqliteSchema.js` -- add flexi indexes

**Service layer (Plan 3):**
- `src/shared/services/flexiRecordDataService.js` -- major refactor
- `src/shared/services/data/flexiRecordStructureService.js` -- minor updates

**Feature layer (Plans 4-5):**
- `src/features/events/services/flexiRecordService.js` -- storage migration
- `src/shared/services/api/api/flexiRecords.js` -- storage migration
- `src/features/events/services/campGroupAllocationService.js` -- key construction
- `src/features/events/components/CampGroupsView.jsx` -- localStorage removal
- `src/shared/hooks/useSignInOut.js` -- key parsing
- `src/features/movements/hooks/useSectionMovements.js` -- key parsing
- `src/features/movements/components/SectionMovementTracker.jsx` -- key construction
- `src/features/movements/components/TermMovementCard.jsx` -- key construction
- `src/shared/services/api/api/base.js` -- cache clearing
- `src/shared/services/storage/unifiedStorageService.js` -- remove flexi methods (cleanup)

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/shared/services/storage/indexedDBService.js` -- current store definitions, all version upgrade blocks
- Codebase inspection: `src/shared/services/storage/schemas/indexedDBSchema.js` -- NORMALIZED_STORES target definitions
- Codebase inspection: `src/shared/services/storage/schemas/sqliteSchema.js` -- SQLITE_SCHEMAS for flexi tables
- Codebase inspection: `src/shared/services/storage/schemas/validation.js` -- FlexiListSchema, FlexiStructureSchema, FlexiDataSchema
- Codebase inspection: `src/shared/services/flexiRecordDataService.js` -- current phantom storageBackend references
- Codebase inspection: `src/shared/services/storage/database.js` -- 5 stub methods throwing Error
- All Phase 2-5 PLAN.md files -- established normalization patterns

### Secondary (MEDIUM confidence)
- Grep results across codebase for all flexi data access patterns (10+ files identified)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all patterns established in Phases 2-5
- Architecture: HIGH -- store definitions already documented in indexedDBSchema.js, Zod schemas already exist
- Pitfalls: HIGH -- based on direct codebase inspection, all findings verified against source code
- Consumer migration scope: HIGH -- comprehensive grep identified all access patterns

**Research date:** 2026-02-17
**Valid until:** indefinite (codebase-specific research, no external dependencies)
