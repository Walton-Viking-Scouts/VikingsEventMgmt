# Phase 3: Events Normalization - Research

**Researched:** 2026-02-16
**Domain:** IndexedDB events store migration, SQLite events indexes, Zod validation, section-scoped atomic replacement
**Confidence:** HIGH

## Summary

Phase 3 normalizes event storage from blob-in-a-key to individual records keyed by `eventid`. The current IndexedDB events store uses `keyPath: 'key'` and stores all events for a section as a single blob under key `viking_events_{sectionId}_offline`. The target is `keyPath: 'eventid'` with indexes on `sectionid`, `termid`, and `startdate`, enabling direct lookup by event ID and efficient queries by section or term.

The established Phase 2 pattern (store replacement in v5 upgrade block, direct IndexedDB access bypassing UnifiedStorageService, Zod validation at write boundary, atomic bulk replacement) applies directly. The key difference from sections is scope: events are synced and replaced per-section, not globally. This means the delete-before-insert must be scoped to a single `sectionid` (delete all events for that section, then insert the new ones) rather than clearing the entire store. This requires using an index cursor delete rather than `store.clear()`.

The SQLite side already stores events as individual rows with `eventid TEXT PRIMARY KEY` and `sectionid INTEGER` foreign key. The existing `saveEvents()` already does section-scoped DELETE + INSERT but lacks a transaction wrapper. SQLite indexes on `sectionid`, `termid`, and `startdate` are already defined in `sqliteSchema.js` and created during `createTables()`. The EventSchema Zod validator already exists with `.transform(String)` for eventid and `.transform(Number)` for sectionid.

**Primary recommendation:** Replace the events store in the IndexedDB v5 upgrade block with `keyPath: 'eventid'` and indexes on `sectionid`, `termid`, `startdate`. Add `bulkReplaceEventsForSection(sectionId, events)` to IndexedDBService that deletes all events matching the sectionId index then inserts new ones in a single transaction. Update `DatabaseService.saveEvents()` to validate with Zod and call IndexedDBService directly. Add query methods `getEventsBySection`, `getEventsByTerm`, `getEventById`. Wrap SQLite saveEvents in a transaction.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | ^8.0.3 | IndexedDB wrapper with transaction and index support | Already installed. Transaction API for atomic section-scoped replacement. Index API for cursor-based deletion by sectionid. |
| `zod` | ^4.3.6 | Runtime validation at write boundary | Already installed (Phase 1). `EventSchema` and `safeParseArray` defined in validation.js. |
| `@capacitor-community/sqlite` | ^7.0.0 | SQLite on native platforms | Already installed. Events table already exists with proper schema. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | ^6.2.2 | IndexedDB testing in Vitest | Already a devDependency. Use for testing store replacement and normalized CRUD with indexes. |

**Installation:** No new dependencies needed.

## Architecture Patterns

### Pattern 1: IndexedDB Store Replacement in v5 Upgrade Block

**What:** Delete the old blob-style `events` store and create a new normalized one within the `if (oldVersion < 5)` block, following the exact pattern proven in Phase 2 for sections.

**Current events store definition (lines 94-97 in indexedDBService.js):**
```javascript
if (!db.objectStoreNames.contains(STORES.EVENTS)) {
  const eventsStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'key' });
  eventsStore.createIndex('sectionId', 'sectionId', { unique: false });
}
```

**Target (inside existing `if (oldVersion < 5)` block):**
```javascript
if (db.objectStoreNames.contains(STORES.EVENTS)) {
  db.deleteObjectStore(STORES.EVENTS);
}
const eventsStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'eventid' });
eventsStore.createIndex('sectionid', 'sectionid', { unique: false });
eventsStore.createIndex('termid', 'termid', { unique: false });
eventsStore.createIndex('startdate', 'startdate', { unique: false });
```

**Fresh install behavior:** Same as sections -- the guard at lines 94-97 creates the old-format store, then the v5 block deletes and recreates it. Redundant but correct and harmless. Leave the old guard in place for consistency with Phase 2's approach.

**Reference:** `NORMALIZED_STORES.events` in `schemas/indexedDBSchema.js` defines keyPath `'eventid'` and indexes `sectionid`, `termid`, `startdate`.

### Pattern 2: Section-Scoped Atomic Replacement (Delete-Before-Insert)

**What:** Unlike sections (small dataset, replace-all with `store.clear()`), events are synced per-section. The delete-before-insert must only affect events for the target sectionId, leaving events for other sections untouched.

**Implementation approach:** Use an index cursor to delete all records matching the sectionId, then put new records, all within a single transaction.

```javascript
static async bulkReplaceEventsForSection(sectionId, events) {
  const db = await getDB();
  const tx = db.transaction(STORES.EVENTS, 'readwrite');
  const store = tx.objectStore(STORES.EVENTS);
  const index = store.index('sectionid');

  // Delete all existing events for this section
  let cursor = await index.openCursor(sectionId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  // Insert new events
  const timestamp = Date.now();
  for (const event of events) {
    await store.put({ ...event, updated_at: timestamp });
  }

  await tx.done;
  return events.length;
}
```

**Why cursor delete instead of store.clear():** `store.clear()` removes ALL events across ALL sections. We only want to replace events for a single section. The index cursor approach deletes only matching records. If no events exist for the section, the cursor loop simply doesn't execute, and the inserts proceed normally.

**Atomicity guarantee:** IndexedDB transactions are atomic -- either all cursor deletes AND all puts succeed, or the entire transaction rolls back. This satisfies EVNT-04.

**Performance note:** Cursor iteration is O(n) where n is the number of events for the section. Typical section event counts are 20-50 per term, so this is fast. For very large sections, this is still sub-millisecond on modern browsers.

### Pattern 3: Direct IndexedDB Access (Bypass UnifiedStorageService)

**Current flow (web path):**
```
saveEvents(sectionId, events) -> _saveWebStorageEvents(sectionId, events)
  -> UnifiedStorageService.set(`viking_events_${sectionId}_offline`, events)
  -> IndexedDBService.set('events', key, events)
  -> db.put('events', { key: 'viking_events_1_offline', data: [...events], timestamp: ... })
```

**New flow (web path):**
```
saveEvents(sectionId, events) -> validate with Zod -> IndexedDBService.bulkReplaceEventsForSection(sectionId, validEvents)
  -> transaction: cursor-delete by sectionid index -> put each event -> tx.done
```

**Current getEvents flow:**
```
getEvents(sectionId) -> _getWebStorageEvents(sectionId)
  -> UnifiedStorageService.get(`viking_events_${sectionId}_offline`)
  -> IndexedDBService.get('events', key) -> returns blob.data
```

**New getEvents flow:**
```
getEvents(sectionId) -> IndexedDBService.getEventsBySection(sectionId)
  -> db.getAllFromIndex('events', 'sectionid', sectionId) -> returns individual records
```

### Pattern 4: Zod Validation at Write Boundary

**What:** Validate and coerce event data using `EventSchema` before writing to IndexedDB. The EventSchema (validation.js lines 23-36) already handles:
- `eventid`: union(string, number).transform(String) -- canonicalizes to String
- `sectionid`: union(string, number).transform(Number) -- canonicalizes to Number
- `name`: string.min(1) -- required
- `termid`, `startdate`, `enddate`, `location`, `notes`, `cost`, `date`: all nullable/optional strings

**Implementation in DatabaseService.saveEvents:**
```javascript
async saveEvents(sectionId, events) {
  await this.initialize();

  if (!this.isNative || !this.db) {
    const { data: validEvents, errors } = safeParseArray(EventSchema, events);
    if (errors.length > 0) {
      logger.warn('Event validation errors during save', {
        errorCount: errors.length,
        totalCount: events?.length,
        errors: errors.slice(0, 5),
      }, LOG_CATEGORIES.DATABASE);
    }
    await IndexedDBService.bulkReplaceEventsForSection(sectionId, validEvents);
    return;
  }

  // SQLite path -- wrap in transaction
  await this.db.execute('BEGIN TRANSACTION');
  try {
    await this.db.execute('DELETE FROM events WHERE sectionid = ?', [sectionId]);
    for (const event of validEvents) {
      // ... existing INSERT logic
    }
    await this.db.execute('COMMIT');
  } catch (error) {
    await this.db.execute('ROLLBACK');
    throw error;
  }
  await this.updateSyncStatus('events');
}
```

### Pattern 5: Query Methods for Both Platforms

**Required methods (from EVNT-05):**
1. `getEventsBySection(sectionId)` -- returns events for a section (existing `getEvents` signature)
2. `getEventsByTerm(termId)` -- returns events for a term
3. `getEventById(eventId)` -- returns a single event by ID

**IndexedDB implementation:**
```javascript
// Get by section (uses sectionid index)
static async getEventsBySection(sectionId) {
  const db = await getDB();
  return (await db.getAllFromIndex(STORES.EVENTS, 'sectionid', sectionId)) || [];
}

// Get by term (uses termid index)
static async getEventsByTerm(termId) {
  const db = await getDB();
  return (await db.getAllFromIndex(STORES.EVENTS, 'termid', termId)) || [];
}

// Get by ID (uses primary key)
static async getEventById(eventId) {
  const db = await getDB();
  return (await db.get(STORES.EVENTS, eventId)) || null;
}
```

**SQLite implementation:**
```javascript
// Get by section
const query = 'SELECT * FROM events WHERE sectionid = ? ORDER BY startdate DESC';

// Get by term
const query = 'SELECT * FROM events WHERE termid = ? ORDER BY startdate DESC';

// Get by ID
const query = 'SELECT * FROM events WHERE eventid = ?';
```

### Pattern 6: SQLite Transaction Wrapping

**Current SQLite saveEvents (lines 507-540 in database.js):**
The existing code does `DELETE FROM events WHERE sectionid = ?` followed by individual `INSERT INTO events` without a transaction wrapper. If the app crashes between DELETE and INSERT, events for that section are lost.

**Fix:** Wrap in `BEGIN TRANSACTION` / `COMMIT` with `ROLLBACK` on error, matching the pattern already used in `saveSections()` and `saveAttendance()`. The SQLite indexes on sectionid, termid, and startdate are already created by `SQLITE_INDEXES` in sqliteSchema.js.

### Recommended File Changes

```
src/shared/services/storage/
  indexedDBService.js           # MODIFY: events store replacement in v5 block, add bulkReplaceEventsForSection, getEventsBySection, getEventsByTerm, getEventById
  database.js                   # MODIFY: saveEvents/getEvents bypass UnifiedStorageService, add getEventsByTerm/getEventById, wrap SQLite in transaction
  __tests__/
    (new) eventNormalization.test.js  # NEW: integration tests for events CRUD with indexes
```

### Anti-Patterns to Avoid

- **Don't use store.clear() for section-scoped replacement.** Unlike sections (entire dataset), events are replaced per-section. `store.clear()` would delete events for ALL sections, causing data loss. Use index cursor delete.
- **Don't route through UnifiedStorageService for normalized data.** USS wraps data in `{ key, data, timestamp }` blobs incompatible with the new store format.
- **Don't validate on read.** Zod validation at write boundary only, consistent with Phase 2 decision.
- **Don't forget to preserve the termid and sectionid enrichment.** The API events service (events.js lines 85-89) enriches events with `termid` and `sectionid` before saving. This enrichment must happen BEFORE Zod validation so the schema can validate these fields.
- **Don't forget demo mode event filtering.** The current `_getWebStorageEvents()` filters out `demo_event_*` events when not in demo mode. This logic must be preserved in the new path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section-scoped deletion | Manual key tracking or store.clear() | IndexedDB index cursor delete within transaction | Atomic, handles missing records, no stale data |
| Type coercion for eventid/sectionid | Manual `String()` or `Number()` calls | `EventSchema` with `.transform()` | Already defined in validation.js, handles string/number union |
| Graceful validation degradation | Try/catch per record | `safeParseArray(EventSchema, data)` | Already implemented in validation.js |
| Store schema definition | Hardcoded keyPath strings | `NORMALIZED_STORES.events` from indexedDBSchema.js | Single source of truth for target schema |

**Key insight:** The cursor-based section-scoped delete is the only meaningful new pattern. Everything else follows directly from Phase 2's proven approach.

## Common Pitfalls

### Pitfall 1: store.clear() Deletes All Events, Not Just Target Section
**What goes wrong:** If the implementation uses `store.clear()` (copying the sections pattern), it wipes events for ALL sections. When syncing Beavers events, Cubs and Scouts events disappear.
**Why it happens:** Copy-pasting the sections `bulkReplaceSections` pattern without adjusting for section-scoped replacement.
**How to avoid:** Use index cursor delete on the `sectionid` index. Delete only records matching the target sectionId.
**Warning signs:** Events for other sections disappear after syncing one section.

### Pitfall 2: UnifiedStorageService Still Has Events Mapping
**What goes wrong:** If any code path still calls `UnifiedStorageService.setEvents()` or `UnifiedStorageService.getEvents()`, it tries to use the old blob pattern with key `viking_events_{sectionId}_offline`, which fails because the store now expects `keyPath: 'eventid'`.
**Why it happens:** `database.js` `_saveWebStorageEvents()` and `_getWebStorageEvents()` route through USS. The API events service calls `databaseService.saveEvents()` which in turn calls USS.
**How to avoid:** Ensure `saveEvents()` and `getEvents()` in `DatabaseService` call `IndexedDBService` directly, bypassing USS entirely. Remove or deprecate `_saveWebStorageEvents` and `_getWebStorageEvents` private methods.
**Warning signs:** `DataError: Data provided to an operation does not meet requirements` from IndexedDB (record lacks required `eventid` keyPath).

### Pitfall 3: attendanceDataService.getCachedEvents() Reads Directly from localStorage
**What goes wrong:** `attendanceDataService.js` lines 172-200 iterate `localStorage` looking for keys matching `viking_events_*_offline`. After normalization, events are in IndexedDB, not localStorage. This method returns empty results.
**Why it happens:** Legacy code written before IndexedDB migration.
**How to avoid:** Update `getCachedEvents()` to use `databaseService.getEvents()` per-section (via `databaseService.getSections()` first), or route through the already-existing `getCachedEventsOptimized()` method at line 202 which uses `databaseService.getEvents()`. The legacy `getCachedEvents()` can be removed or updated.
**Warning signs:** Attendance data service reports zero cached events despite successful event sync.

### Pitfall 4: Demo Mode Events Written to localStorage
**What goes wrong:** `demoMode.js` lines 208-215 write demo events to localStorage under keys like `demo_viking_events_{sectionId}_{termId}_offline` and `demo_viking_events_{sectionId}_offline`. After normalization, `getEvents()` reads from IndexedDB. Demo events won't appear.
**Why it happens:** Demo initialization predates IndexedDB migration, identical to the sections demo mode issue in Phase 2.
**How to avoid:** Update demo event initialization to call `databaseService.saveEvents()` for the normalized path. The demo API `getEvents()` function (events.js line 36) reads from localStorage with `safeGetItem` and returns directly without calling `databaseService.saveEvents()`, so the demo init must write through the normalized path.
**Warning signs:** Demo mode shows no events after Phase 3.

### Pitfall 5: SQLite saveEvents Missing Transaction Wrapper
**What goes wrong:** Current SQLite `saveEvents()` does DELETE then INSERT without a transaction. App crash between these operations leaves the events table empty for that section.
**Why it happens:** Original code didn't wrap in transaction (sections had the same issue, fixed in Phase 2).
**How to avoid:** Wrap in `BEGIN TRANSACTION` / `COMMIT` with `ROLLBACK` on error, same pattern as Phase 2's `saveSections()`.
**Warning signs:** Empty events for a section after app crash during sync.

### Pitfall 6: Event Data Missing sectionid When Stored
**What goes wrong:** If events are stored without their `sectionid` field, the index cursor delete for section-scoped replacement can't find them, and queries by section return empty.
**Why it happens:** The API response may not include `sectionid` on every event. The API events service (events.js line 88) adds `sectionid: event.sectionid ?? sectionId ?? null` to handle this.
**How to avoid:** Ensure the sectionid enrichment (events.js lines 85-89) happens BEFORE Zod validation and storage. The `EventSchema` already validates `sectionid` as `union(string, number).transform(Number)`, but if the raw event lacks `sectionid`, the enrichment step must provide it.
**Warning signs:** Events stored with null sectionid; queries by section return incomplete results.

## Code Examples

### IndexedDB Store Replacement (in v5 upgrade block)
```javascript
// Source: indexedDBService.js, inside existing if (oldVersion < 5) block
// Reference: NORMALIZED_STORES.events from schemas/indexedDBSchema.js
if (oldVersion < 5) {
  // Phase 2: sections store replacement (already implemented)
  // ...

  // Phase 3: Replace events store - blob keyPath:'key' -> normalized keyPath:'eventid'
  if (db.objectStoreNames.contains(STORES.EVENTS)) {
    db.deleteObjectStore(STORES.EVENTS);
  }
  const eventsStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'eventid' });
  eventsStore.createIndex('sectionid', 'sectionid', { unique: false });
  eventsStore.createIndex('termid', 'termid', { unique: false });
  eventsStore.createIndex('startdate', 'startdate', { unique: false });

  logger.info('IndexedDB v5 upgrade: events store normalized', {
    dbName,
  }, LOG_CATEGORIES.DATABASE);
}
```

### Section-Scoped Bulk Replace (new IndexedDBService method)
```javascript
// Source pattern: bulkReplaceSections adapted for section-scoped delete
static async bulkReplaceEventsForSection(sectionId, events) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.EVENTS);
    const index = store.index('sectionid');

    // Delete all existing events for this section via index cursor
    let cursor = await index.openCursor(sectionId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    // Insert new events
    const timestamp = Date.now();
    for (const event of events) {
      await store.put({ ...event, updated_at: timestamp });
    }

    await tx.done;
    return events.length;
  } catch (error) {
    logger.error('IndexedDB bulkReplaceEventsForSection failed', {
      sectionId,
      count: events?.length,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'indexeddb_bulk_replace_events_for_section',
        store: STORES.EVENTS,
      },
      contexts: {
        indexedDB: {
          sectionId,
          count: events?.length,
          operation: 'bulkReplaceEventsForSection',
        },
      },
    });

    throw error;
  }
}
```

### Query Methods (new IndexedDBService methods)
```javascript
// Get events by section (uses sectionid index)
static async getEventsBySection(sectionId) {
  try {
    const db = await getDB();
    return (await db.getAllFromIndex(STORES.EVENTS, 'sectionid', sectionId)) || [];
  } catch (error) {
    // ... standard error handling pattern
    throw error;
  }
}

// Get events by term (uses termid index)
static async getEventsByTerm(termId) {
  try {
    const db = await getDB();
    return (await db.getAllFromIndex(STORES.EVENTS, 'termid', termId)) || [];
  } catch (error) {
    // ... standard error handling pattern
    throw error;
  }
}

// Get single event by ID (uses primary key)
static async getEventById(eventId) {
  try {
    const db = await getDB();
    return (await db.get(STORES.EVENTS, eventId)) || null;
  } catch (error) {
    // ... standard error handling pattern
    throw error;
  }
}
```

### Updated DatabaseService.saveEvents (web path)
```javascript
// Source: database.js saveEvents method (lines 507-540)
// Change: bypass UnifiedStorageService, validate with Zod, write directly to IndexedDB
async saveEvents(sectionId, events) {
  await this.initialize();

  if (!this.isNative || !this.db) {
    const { data: validEvents, errors } = safeParseArray(EventSchema, events);
    if (errors.length > 0) {
      logger.warn('Event validation errors during save', {
        errorCount: errors.length,
        totalCount: events?.length,
        errors: errors.slice(0, 5),
      }, LOG_CATEGORIES.DATABASE);
    }
    await IndexedDBService.bulkReplaceEventsForSection(sectionId, validEvents);
    return;
  }

  // SQLite path -- wrap in transaction for atomicity
  await this.db.execute('BEGIN TRANSACTION');
  try {
    const deleteOld = 'DELETE FROM events WHERE sectionid = ?';
    await this.db.run(deleteOld, [sectionId]);

    for (const event of events) {
      const insert = `
        INSERT INTO events (eventid, sectionid, termid, name, date, startdate, startdate_g, enddate, enddate_g, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await this.db.run(insert, [
        event.eventid, sectionId, event.termid || null,
        event.name, event.date, event.startdate, event.startdate_g,
        event.enddate, event.enddate_g, event.location, event.notes,
      ]);
    }

    await this.db.execute('COMMIT');
  } catch (error) {
    await this.db.execute('ROLLBACK');
    throw error;
  }

  await this.updateSyncStatus('events');
}
```

### Updated DatabaseService.getEvents (web path)
```javascript
// Source: database.js getEvents method (lines 578-588)
// Change: bypass UnifiedStorageService, read directly from IndexedDB
async getEvents(sectionId) {
  await this.initialize();

  if (!this.isNative || !this.db) {
    const events = await IndexedDBService.getEventsBySection(sectionId);

    const { isDemoMode } = await import('../../../config/demoMode.js');
    if (!isDemoMode()) {
      return events.filter(event => {
        const eid = event?.eventid;
        return !(typeof eid === 'string' && eid.startsWith('demo_event_'));
      });
    }
    return events;
  }

  const query = 'SELECT * FROM events WHERE sectionid = ? ORDER BY startdate DESC';
  const result = await this.db.query(query, [sectionId]);
  return result.values || [];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Events stored as blob array under `viking_events_{sectionId}_offline` key | Individual records keyed by `eventid` with sectionid/termid/startdate indexes | Phase 3 (this phase) | Direct lookup by eventid, queries by section/term/date via indexes |
| UnifiedStorageService routing for events | Direct IndexedDB methods on IndexedDBService | Phase 3 starts this for events | Removes indirection, enables index-based queries |
| No validation on event write | Zod `safeParseArray(EventSchema)` at write boundary | Phase 3 starts this for events | Catches malformed API data, canonicalizes eventid to String and sectionid to Number |
| Non-transactional SQLite DELETE+INSERT for events | Transaction-wrapped atomic replacement | Phase 3 fixes this | No partial state on crash |
| Only getEvents(sectionId) query | Additional getEventsByTerm(termId) and getEventById(eventId) | Phase 3 adds these | Enables term-based and individual event queries |

## Open Questions

1. **attendanceDataService.getCachedEvents() Legacy localStorage Access**
   - What we know: `attendanceDataService.js` lines 172-200 iterates localStorage for `viking_events_*_offline` keys. After normalization, events are in IndexedDB.
   - What's unclear: Is this method actively used, or has it been superseded by `getCachedEventsOptimized()` (line 202)?
   - Recommendation: Replace the body of `getCachedEvents()` with a call to `getCachedEventsOptimized()`, or update it to use `databaseService.getEvents()` per-section. This may be better deferred to Phase 7 (cleanup) if the method is not on the critical path for this phase's success criteria. However, if tests reference it, it must be updated now.

2. **Demo Mode Event Initialization**
   - What we know: `demoMode.js` writes events to localStorage. After normalization, reads come from IndexedDB.
   - What's unclear: Should Phase 3 update the demo initializer to call `databaseService.saveEvents()`, or should demo mode updating be batched into a separate effort?
   - Recommendation: Update demo initializer to call `databaseService.saveEvents()` for events data, same as Phase 2 should have done for sections (but may not have). This ensures demo mode works with normalized storage.

3. **hasOfflineData() Still Uses UnifiedStorageService for Sections**
   - What we know: `hasOfflineData()` in database.js (line 1311) calls `UnifiedStorageService.getSections()`. After Phase 2, sections are in IndexedDB directly. This should have been updated in Phase 2.
   - What's unclear: Is this method working correctly after Phase 2? Does it need fixing in Phase 3?
   - Recommendation: If `hasOfflineData()` is broken after Phase 2, fix it in Phase 3 since it's a small adjacent fix. It should call `IndexedDBService.getAllSections()` or `this.getSections()`.

## Sources

### Primary (HIGH confidence)
- `/src/shared/services/storage/indexedDBService.js` -- Current events store definition (keyPath: 'key', lines 94-97), upgrade mechanism, Phase 2 sections migration reference
- `/src/shared/services/storage/database.js` -- Current saveEvents/getEvents implementation (lines 507-588), _saveWebStorageEvents/_getWebStorageEvents helper methods, UnifiedStorageService routing
- `/src/shared/services/storage/schemas/validation.js` -- EventSchema with .transform(String) for eventid and .transform(Number) for sectionid, safeParseArray utility
- `/src/shared/services/storage/schemas/indexedDBSchema.js` -- NORMALIZED_STORES.events target definition (keyPath: 'eventid', indexes: sectionid, termid, startdate)
- `/src/shared/services/storage/schemas/sqliteSchema.js` -- SQLITE_INDEXES already include idx_events_sectionid, idx_events_termid, idx_events_startdate
- `/src/shared/services/api/api/events.js` -- API consumer that enriches events with termid/sectionid before calling databaseService.saveEvents()
- `/src/shared/services/data/attendanceDataService.js` -- getCachedEvents() reads directly from localStorage (lines 172-200)
- `/src/config/demoMode.js` -- Demo event initialization writes to localStorage (lines 208-215)
- `/src/shared/services/storage/unifiedStorageService.js` -- Events key mapping (line 176), getEvents/setEvents convenience methods
- Phase 2 SUMMARY and RESEARCH documents -- Proven normalization pattern

### Secondary (MEDIUM confidence)
- MDN IndexedDB documentation -- Index cursor iteration and deletion within transactions
- `idb` library -- `getAllFromIndex()` for index-based queries, cursor API

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns exist in codebase
- Architecture: HIGH -- derived from Phase 2 proven pattern, adapted for section-scoped replacement
- Pitfalls: HIGH -- identified from concrete code paths, localStorage direct reads, and demo mode initialization
- Store migration: HIGH -- IndexedDB upgrade mechanism well-understood, v5 block already exists with Phase 2 changes
- Query methods: HIGH -- `getAllFromIndex` and `get` are standard idb operations, SQLite queries are straightforward

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, no fast-moving dependencies)
