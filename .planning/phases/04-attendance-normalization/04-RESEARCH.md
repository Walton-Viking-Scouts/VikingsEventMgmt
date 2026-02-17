# Phase 4: Attendance Normalization - Research

**Researched:** 2026-02-16
**Domain:** IndexedDB attendance store migration (compound keys), shared attendance handling, Zod validation, per-event atomic replacement, old blob cleanup
**Confidence:** HIGH

## Summary

Phase 4 migrates attendance from blob-in-a-key storage (`viking_attendance_{eventId}_offline` routed through UnifiedStorageService) to individual records with compound key `[eventid, scoutid]` in a normalized IndexedDB store. Shared attendance records go into the SAME store with a marker field (`isSharedSection: true`). A separate small `shared_event_metadata` store holds metadata about which sections participate in shared events. Old blob keys (`viking_attendance_*_offline`, `viking_shared_attendance_*`) are cleaned up during the DB upgrade.

The codebase already has a proven compound keyPath pattern in the `member_section` store (`keyPath: ['scoutid', 'sectionid']`), which provides a direct reference for implementing the attendance compound key. The `idb` library's `db.get(storeName, [key1, key2])` and `db.getAllFromIndex(storeName, indexName, value)` patterns are already used throughout the codebase and apply directly. Phase 3's cursor-based section-scoped delete pattern adapts to per-event scoped delete for attendance.

The current attendance save path goes through `UnifiedStorageService.set(key, enhancedData)` which wraps the data in a `{ key, data, timestamp }` blob -- this is incompatible with the new compound keyPath store. The new path will validate with Zod's `AttendanceSchema` at the write boundary, then call IndexedDBService directly. The existing `AttendanceSchema` in `validation.js` (lines 44-52) already handles `scoutid -> Number` and `eventid -> String` coercion but stores enrichment fields (firstname, lastname) that the user has decided should NOT be stored. The schema needs adjustment per the user's decisions.

**Primary recommendation:** Bump DB version to 6 (or add to the v5 block if it can accommodate more store changes), replace the attendance and shared_attendance stores with a single normalized attendance store using compound keyPath `['eventid', 'scoutid']` with indexes on `eventid` and `scoutid`. Add a new `shared_event_metadata` store keyed by `eventid`. Implement `bulkReplaceAttendanceForEvent(eventId, records)` using the cursor-based delete pattern from Phase 3. Clean up old blob keys during upgrade. Remove the in-memory `attendanceCache` from `attendanceDataService`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Compound Key Design
- Regular attendance keyed by compound keyPath array `[eventid, scoutid]` in IndexedDB (not concatenated string)
- Shared attendance uses the same store as regular attendance, with a marker field (e.g., `source: 'shared'` or `isSharedSection: true`) to distinguish cross-section records
- Store core API fields only (scoutid, attending, patrol, notes, eventid, sectionid) -- do NOT store enrichment fields (eventname, eventdate, sectionname). Join with events/sections stores at read time
- Standardize `attending` field on write to a consistent format (resolve mixed string/number API values during Zod validation)
- Zod schema uses passthrough mode (allow unknown fields) but log unknown fields to Sentry as a warning so API shape changes are tracked

#### Sync & Upsert Scope
- Attendance loads on-demand per event (when user views an event), NOT in a batch refresh of all events
- Summary counts for events come from the events store (already normalized in Phase 3), detailed attendance loads only when needed
- Bulk upsert uses per-event atomic replace: delete all records for eventid, then insert fresh batch, wrapped in a single IndexedDB transaction
- Shared attendance follows the same per-event atomic replace pattern
- On sync failure: show stale cached data with a visible warning indicator, allow manual retry

#### Shared Attendance Handling
- Regular and shared attendance records go into ONE store (no separate shared_attendance store) since this is a single-user store with no cross-exposure risk
- Shared attendance records marked with a distinguishing field to identify cross-section scouts
- Shared event metadata (which sections participate) gets its OWN small normalized store, separate from events -- keyed by eventid
- Shared attendance brings in scouts from sections the user doesn't normally have access to -- these need enrichment from the shared data itself since section/scout mapping isn't available in normal data downloads

#### Migration & Dual-Write
- No migration of existing blob data -- start fresh, let on-demand sync populate the new store when each event is viewed
- Clean up old blob keys (viking_attendance_*_offline, viking_shared_attendance_*) immediately during DB upgrade, not deferred to Phase 7
- No dual-write period -- all writes go directly to the new normalized store only. Old blob path becomes dead code
- Remove the in-memory cache layer (attendanceDataService.attendanceCache) -- rely solely on IndexedDB/SQLite store for reads

### Claude's Discretion
- Exact Zod schema field definitions and standardized attending value format (string enum vs number enum)
- IndexedDB secondary index configuration (which fields get indexes beyond the compound primary key)
- SQLite table column definitions and index strategy
- How to surface the "stale data" warning in the UI layer (toast, banner, inline indicator)
- Transaction error handling and retry logic details
- Shared event metadata store schema

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | ^8.0.3 | IndexedDB wrapper with compound keyPath and transaction support | Already installed. Compound keyPath arrays proven in `member_section` store. Cursor API for per-event scoped deletion. |
| `zod` | ^4.3.6 | Runtime validation at write boundary | Already installed (Phase 1). `AttendanceSchema` and `SharedAttendanceSchema` exist in validation.js. Need modification for core-fields-only + passthrough. |
| `@capacitor-community/sqlite` | ^7.0.0 | SQLite on native platforms | Already installed. Attendance table already exists with proper schema. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | ^6.2.2 | IndexedDB testing in Vitest | Already a devDependency. Use for testing compound key store, per-event replacement, and query methods. |

**Installation:** No new dependencies needed.

## Architecture Patterns

### Recommended File Changes
```
src/shared/services/storage/
  indexedDBService.js           # MODIFY: attendance store replacement in upgrade block,
                                #   add bulkReplaceAttendanceForEvent, getAttendanceByEvent,
                                #   getAttendanceByScout, getAttendanceRecord,
                                #   new shared_event_metadata store + CRUD
  database.js                   # MODIFY: saveAttendance/getAttendance bypass USS,
                                #   add Zod validation, remove enrichment field storage,
                                #   update SQLite attendance table/queries
  schemas/validation.js         # MODIFY: AttendanceSchema core-fields-only + passthrough + attending normalization
  schemas/indexedDBSchema.js    # MODIFY: Update NORMALIZED_STORES.attendance definition
                                #   (compound key already correct, but shared_attendance entry
                                #   should be replaced with shared_event_metadata)
  schemas/sqliteSchema.js       # MODIFY: Add shared_event_metadata table, update indexes

src/shared/services/data/
  attendanceDataService.js      # MODIFY: Remove attendanceCache, update loadAttendanceFromCache
                                #   to read from normalized store
  eventDataLoader.js            # MODIFY: Update syncEventAttendance/syncSharedAttendance
                                #   to write normalized records

src/shared/utils/
  attendanceHelpers_new.js      # MODIFY: Update loadAllAttendanceFromDatabase to join with
                                #   events/sections for enrichment fields at read time

src/features/events/hooks/
  useAttendanceData.js          # MODIFY: Read shared attendance from normalized store
                                #   instead of USS blob keys
  useSharedAttendance.js        # MODIFY: Read shared metadata from new store instead
                                #   of USS blob keys

src/shared/services/api/api/
  events.js                     # MODIFY: getSharedEventAttendance writes to normalized
                                #   store instead of USS blob

src/shared/services/storage/__tests__/
  attendanceNormalization.test.js  # NEW: Integration tests for attendance compound key CRUD
```

### Pattern 1: IndexedDB Store Replacement for Attendance (Compound Key)

**What:** Replace the blob-style `attendance` store (`keyPath: 'key'`) with a normalized store using compound keyPath `['eventid', 'scoutid']`. Delete the separate `shared_attendance` store (shared records go into the unified attendance store). Create a new `shared_event_metadata` store.

**Existing attendance store definition (lines 99-102 in indexedDBService.js):**
```javascript
if (!db.objectStoreNames.contains(STORES.ATTENDANCE)) {
  const attendanceStore = db.createObjectStore(STORES.ATTENDANCE, { keyPath: 'key' });
  attendanceStore.createIndex('eventId', 'eventId', { unique: false });
}
```

**Target (inside the v5 upgrade block, or a new v6 block):**
```javascript
// Phase 4: Replace attendance store - blob keyPath:'key' -> normalized compound key
if (db.objectStoreNames.contains(STORES.ATTENDANCE)) {
  db.deleteObjectStore(STORES.ATTENDANCE);
}
const attendanceStoreNorm = db.createObjectStore(STORES.ATTENDANCE, {
  keyPath: ['eventid', 'scoutid'],
});
attendanceStoreNorm.createIndex('eventid', 'eventid', { unique: false });
attendanceStoreNorm.createIndex('scoutid', 'scoutid', { unique: false });
attendanceStoreNorm.createIndex('sectionid', 'sectionid', { unique: false });

// Remove separate shared_attendance store - records now in attendance store
if (db.objectStoreNames.contains(STORES.SHARED_ATTENDANCE)) {
  db.deleteObjectStore(STORES.SHARED_ATTENDANCE);
}

// Create shared event metadata store
if (!db.objectStoreNames.contains('shared_event_metadata')) {
  db.createObjectStore('shared_event_metadata', { keyPath: 'eventid' });
}
```

**DB version consideration:** The current DB version is 5. The v5 upgrade block handles sections (Phase 2) and events (Phase 3). Phase 4 needs to either extend the v5 block or bump to v6. Since existing deployed apps may already be at v5, a v6 bump is the correct approach -- this ensures the attendance migration runs for users who already completed the v5 upgrade.

**Reference pattern:** The `member_section` store (lines 117-122) already uses compound keyPath `['scoutid', 'sectionid']` with separate indexes on each component. This is the exact same pattern.

### Pattern 2: Per-Event Atomic Replacement (Cursor Delete + Insert)

**What:** When syncing attendance for an event, delete all existing records for that eventid, then insert the fresh batch. This follows the Phase 3 section-scoped delete pattern but scoped to eventid.

```javascript
static async bulkReplaceAttendanceForEvent(eventId, records) {
  const db = await getDB();
  const tx = db.transaction(STORES.ATTENDANCE, 'readwrite');
  const store = tx.objectStore(STORES.ATTENDANCE);
  const index = store.index('eventid');

  // Delete all existing attendance for this event (regular AND shared)
  let cursor = await index.openCursor(eventId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  // Insert new records
  const timestamp = Date.now();
  for (const record of records) {
    await store.put({ ...record, updated_at: timestamp });
  }

  await tx.done;
  return records.length;
}
```

**Why cursor delete instead of IDBKeyRange:** The eventid index contains all records for that event -- both regular and shared. Cursor iteration deletes them all, which is the desired behavior for a full refresh. When syncing shared attendance separately, the caller would pass only shared records after deleting just the shared subset (filter by `isSharedSection: true` before delete, or just delete-all and re-insert both regular and shared).

**Recommended approach for shared attendance sync:** Since shared attendance is synced per-event just like regular attendance, but they may arrive at different times:
1. Regular attendance sync: delete all records for eventid where `isSharedSection` is falsy, insert regular records
2. Shared attendance sync: delete all records for eventid where `isSharedSection` is true, insert shared records

This requires TWO separate bulk operations, each filtering by the marker field during cursor delete. Alternatively, if they always arrive together, a single delete-all + insert-all works.

### Pattern 3: Compound Key Access Patterns

**What:** Using compound keys with `idb` for get/put/delete operations.

```javascript
// Get a single attendance record by compound key
static async getAttendanceRecord(eventId, scoutId) {
  const db = await getDB();
  return (await db.get(STORES.ATTENDANCE, [eventId, scoutId])) || null;
}

// Get all attendance for an event (uses eventid index)
static async getAttendanceByEvent(eventId) {
  const db = await getDB();
  return (await db.getAllFromIndex(STORES.ATTENDANCE, 'eventid', eventId)) || [];
}

// Get all attendance for a scout across events (uses scoutid index)
static async getAttendanceByScout(scoutId) {
  const db = await getDB();
  return (await db.getAllFromIndex(STORES.ATTENDANCE, 'scoutid', scoutId)) || [];
}

// Delete a single record
static async deleteAttendanceRecord(eventId, scoutId) {
  const db = await getDB();
  await db.delete(STORES.ATTENDANCE, [eventId, scoutId]);
}
```

**Verified pattern:** The `member_section` store already uses `db.get(STORES.MEMBER_SECTION, [scoutid, sectionid])` at line 877 of indexedDBService.js. This confirms compound key arrays work correctly with the `idb` library.

### Pattern 4: Core-Fields-Only Storage with Read-Time Enrichment

**What:** Store only core API fields (scoutid, eventid, sectionid, attending, patrol, notes) plus the shared marker. Enrichment fields (eventname, eventdate, sectionname) are joined at read time from the events and sections stores.

**Current saveAttendance enrichment (attendanceDataService.js lines 112-120):**
```javascript
// CURRENT: Stores enrichment fields with each record
return attendanceRecords.map(record => ({
  ...record,
  eventid: event.eventid,
  eventname: event.name,        // DO NOT STORE
  eventdate: event.startdate,   // DO NOT STORE
  sectionid: event.sectionid,
  sectionname: event.sectionname, // DO NOT STORE
}));
```

**New read-time enrichment (in loadAllAttendanceFromDatabase or equivalent):**
```javascript
// Get raw attendance records
const records = await IndexedDBService.getAttendanceByEvent(eventId);

// Join with event data for enrichment
const event = await IndexedDBService.getEventById(eventId);
const section = event ? (await IndexedDBService.getAllSections()).find(s => s.sectionid === event.sectionid) : null;

// Enrich at read time
return records.map(record => ({
  ...record,
  eventname: event?.name,
  eventdate: event?.startdate,
  sectionname: section?.sectionname,
}));
```

**Why read-time enrichment:** Prevents stale denormalized data. If an event name changes, the attendance records automatically reflect the change. Also reduces storage size for potentially thousands of attendance records.

### Pattern 5: Zod Schema Modification for Core Fields + Passthrough

**What:** Modify `AttendanceSchema` to define only core fields, use `.passthrough()` to allow unknown fields through, and log unknown fields to Sentry.

**Current AttendanceSchema (validation.js lines 44-52):**
```javascript
export const AttendanceSchema = z.object({
  scoutid: z.union([z.string(), z.number()]).transform(Number),
  eventid: z.union([z.string(), z.number()]).transform(String),
  firstname: z.string().nullable().optional(),
  lastname: z.string().nullable().optional(),
  attending: z.string().nullable().optional(),
  patrol: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
```

**Recommended new schema:**
```javascript
export const AttendanceSchema = z.object({
  scoutid: z.union([z.string(), z.number()]).transform(Number),
  eventid: z.union([z.string(), z.number()]).transform(String),
  sectionid: z.union([z.string(), z.number()]).transform(Number),
  attending: z.union([z.string(), z.number()])
    .transform(val => {
      // Normalize mixed string/number attending values
      const str = String(val).toLowerCase().trim();
      if (str === 'yes' || str === '1' || str === 'true') return 'Yes';
      if (str === 'no' || str === '0' || str === 'false') return 'No';
      if (str === 'invited') return 'Invited';
      if (str === 'shown' || str === 'show in my.scout') return 'Shown';
      return str; // Preserve unknown values as-is
    })
    .nullable()
    .optional(),
  patrol: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).passthrough();
```

**Key changes:**
1. Added `sectionid` as a required core field (needed for the sectionid index)
2. Removed `firstname` and `lastname` (enrichment fields -- join at read time from core_members)
3. Added `attending` normalization transform to standardize mixed string/number API values
4. Added `.passthrough()` to allow unknown fields through (they get stored but we log them)

**Attending value normalization:** The OSM API returns attending as mixed types -- sometimes string "Yes"/"No", sometimes number 1/0, sometimes "Invited", "Shown", "Show in My.SCOUT". The transform normalizes to consistent string values.

**Unknown field logging:** After validation, compare output keys against known keys. Log unknowns to Sentry:
```javascript
const knownKeys = new Set(['scoutid', 'eventid', 'sectionid', 'attending', 'patrol', 'notes']);
const unknownKeys = Object.keys(validRecord).filter(k => !knownKeys.has(k));
if (unknownKeys.length > 0) {
  sentryUtils.captureMessage('Attendance record has unknown fields', {
    level: 'warning',
    extra: { unknownKeys, eventid: validRecord.eventid },
  });
}
```

### Pattern 6: Shared Event Metadata Store

**What:** A small normalized store for shared event metadata, keyed by eventid. Stores which sections participate in a shared event.

**Current storage:** Shared metadata stored via `UnifiedStorageService.set('viking_shared_metadata_{eventid}', data)` as a blob in the `shared_attendance` store.

**New schema:**
```javascript
// In indexedDBSchema.js NORMALIZED_STORES
shared_event_metadata: {
  keyPath: 'eventid',
  indexes: [],
}
```

**Record shape:**
```javascript
{
  eventid: '12345',           // String (primary key)
  isSharedEvent: true,        // Boolean
  ownerSectionId: 67890,      // Number
  sections: [                 // Array of participating sections
    { sectionid: 67890, sectionname: 'Beavers', receiving_eventid: '12345' },
    { sectionid: 11111, sectionname: 'Cubs', receiving_eventid: '54321' },
  ],
  updated_at: 1708099200000,  // Timestamp
}
```

### Pattern 7: Old Blob Key Cleanup During Upgrade

**What:** During the DB upgrade, clean up old blob keys from the attendance and shared_attendance stores. Since we're deleting and recreating these stores, the IndexedDB data is automatically removed. But we also need to clean up localStorage keys.

```javascript
// In the upgrade block, after store replacement:
// Clean up old localStorage keys (sync, cannot be async in upgrade)
try {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.match(/^viking_attendance_.+_offline$/) ||
      key.match(/^viking_shared_attendance_.+_offline$/) ||
      key.startsWith('viking_shared_metadata_') ||
      key.match(/^demo_viking_attendance_.+_offline$/) ||
      key.match(/^demo_viking_shared_attendance_.+_offline$/) ||
      key.startsWith('demo_viking_shared_metadata_')
    )) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
} catch (e) {
  // localStorage cleanup is best-effort
}
```

**Important:** The upgrade callback in IndexedDB is synchronous with respect to store creation but localStorage access is sync, so this cleanup can happen inline. However, the `idb` library's upgrade callback DOES support async operations within the transaction context -- but localStorage is sync anyway, so no issue.

### Anti-Patterns to Avoid

- **Don't create a separate shared_attendance store.** The user decided shared records go in the same store as regular attendance, with a marker field. The existing `STORES.SHARED_ATTENDANCE` should be deleted during upgrade.
- **Don't store enrichment fields (eventname, eventdate, sectionname) in attendance records.** Join at read time from events/sections stores. Storing them creates stale data.
- **Don't route through UnifiedStorageService for attendance data.** USS wraps data in `{ key, data, timestamp }` blobs incompatible with the compound keyPath store. Write directly to IndexedDBService.
- **Don't use store.clear() for per-event replacement.** Clear() would delete ALL attendance across ALL events. Use index cursor delete scoped to the eventid.
- **Don't batch-sync all attendance eagerly.** Attendance loads on-demand per event only. The eventDataLoader's `syncAllEventAttendance` flow will need updating to respect this pattern.
- **Don't forget the sectionid field on attendance records.** Without it, the sectionid index won't work and queries by section will fail. The API enrichment step adds sectionid before save.
- **Don't assume shared attendance records have the same fields as regular attendance.** Shared records may have different field names (e.g., `first_name` vs `firstname`, `section_name` vs `sectionname`). Normalize during validation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compound key management | Manual key concatenation (`eventid_scoutid`) | IndexedDB compound keyPath array `['eventid', 'scoutid']` | Native IndexedDB feature, automatic key extraction, proper ordering |
| Type coercion for IDs | Manual `String()` / `Number()` calls scattered through code | `AttendanceSchema` with `.transform()` | Centralized at write boundary, handles string/number union |
| Per-event scoped deletion | Manual key tracking or store.clear() | Index cursor delete on `eventid` index | Atomic, handles missing records, proven in Phase 3 |
| Attending value normalization | Switch statements in multiple locations | Zod `.transform()` in `AttendanceSchema` | Single source of truth, runs at validation time |
| Unknown field detection | Manual field comparison in save methods | Zod `.passthrough()` + post-validation key diff | Schema-driven, catches API shape changes automatically |

**Key insight:** The compound keyPath is the primary new pattern. Everything else follows directly from Phase 3's proven approach (cursor delete, Zod validation at write boundary, direct IndexedDB access bypassing USS).

## Common Pitfalls

### Pitfall 1: Compound Key Type Mismatch on Lookup
**What goes wrong:** `db.get(STORES.ATTENDANCE, [eventId, scoutId])` returns undefined even though the record exists, because eventId was passed as a number but stored as a string (or vice versa).
**Why it happens:** IndexedDB compound keys are compared strictly. `['123', 456]` and `[123, 456]` are different keys.
**How to avoid:** Zod validation normalizes types at write time (eventid -> String, scoutid -> Number). All read operations must use the same types: `db.get(STORES.ATTENDANCE, [String(eventId), Number(scoutId)])`.
**Warning signs:** `getAttendanceRecord` returns null for records that should exist. Query by eventid index works (returns results) but direct compound key lookup fails.

### Pitfall 2: Shared Attendance Records Missing sectionid
**What goes wrong:** Shared attendance records from inaccessible sections may not have a `sectionid` field in the API response, or it may be in a different format (`scoutsectionid` vs `sectionid`).
**Why it happens:** The shared attendance API returns data from sections the user doesn't normally access. The response format may differ from regular attendance.
**How to avoid:** The shared attendance response itself is the source of truth for sectionid. Map the field correctly during validation. The existing `createMemberSectionRecordsForSharedAttendees` already handles `Number(attendee.sectionid)` -- follow this pattern.
**Warning signs:** Shared attendance records stored with null/undefined sectionid. Queries by sectionid index return incomplete results.

### Pitfall 3: eventDataLoader Batch Sync Conflicts with On-Demand Pattern
**What goes wrong:** The `eventDataLoader._doSync()` method iterates ALL events and syncs attendance for each one. After Phase 4, attendance should load on-demand per event. If both patterns coexist, there will be redundant API calls and potential race conditions.
**Why it happens:** `eventDataLoader` was designed for eager batch sync. Phase 4 changes to on-demand sync.
**How to avoid:** The eventDataLoader sync should ONLY sync attendance for events the user has already viewed (or is currently viewing). Alternatively, the loader becomes the mechanism for on-demand sync, triggered when an event is opened rather than on a batch schedule.
**Warning signs:** Excessive API calls during sync. Rate limiting triggered. Attendance data being overwritten while user is viewing it.

### Pitfall 4: loadAllAttendanceFromDatabase Enrichment Breaks Without Stored Fields
**What goes wrong:** `attendanceHelpers_new.js` line 21 enriches records with `eventname: event.name, eventdate: event.startdate, sectionid: event.sectionid`. After Phase 4, the attendance store no longer has eventname/eventdate. If the enrichment code isn't updated, the UI receives records missing these fields.
**Why it happens:** Code assumes attendance records contain all fields. Phase 4 removes enrichment fields from storage.
**How to avoid:** Update `loadAllAttendanceFromDatabase` to perform read-time enrichment by joining with events/sections stores. The function already loads events per-section, so it has access to the event data needed for enrichment.
**Warning signs:** UI displays undefined/empty event names or dates next to attendance records.

### Pitfall 5: useAttendanceData Reads Shared Attendance from Old USS Blob Keys
**What goes wrong:** `useAttendanceData.js` lines 61-87 reads shared attendance from `UnifiedStorageService.get('viking_shared_attendance_{eventId}_{sectionId}_offline')`. After Phase 4, this data is in the normalized attendance store with `isSharedSection: true` marker.
**Why it happens:** Hook code not updated for new storage location.
**How to avoid:** Update `useAttendanceData` to read shared attendance from the normalized attendance store, filtering by `isSharedSection: true`. Similarly update `useSharedAttendance` hook to read shared metadata from the new `shared_event_metadata` store.
**Warning signs:** Shared attendance tab shows no data. Regular attendance works fine but shared events show empty.

### Pitfall 6: useSharedAttendance Reads Shared Metadata from Old USS Keys
**What goes wrong:** `useSharedAttendance.js` line 19 checks `UnifiedStorageService.get('viking_shared_metadata_{eventId}')` for shared event detection. After Phase 4, this metadata is in the `shared_event_metadata` store.
**Why it happens:** Hook not updated for new storage.
**How to avoid:** Update to read from the new store via `IndexedDBService.getSharedEventMetadata(eventId)` or through `databaseService.getSharedEventMetadata(eventId)`.
**Warning signs:** `hasSharedEvents` is always false. Shared attendance tab never appears.

### Pitfall 7: DB Version Bump vs Extending v5 Block
**What goes wrong:** If attendance store changes are added to the existing `if (oldVersion < 5)` block, users who already upgraded to v5 (from Phases 2-3) will NOT get the Phase 4 migration. Their attendance store remains in old blob format.
**Why it happens:** The `if (oldVersion < 5)` guard only runs when upgrading FROM a version less than 5.
**How to avoid:** Use `if (oldVersion < 6)` for Phase 4 changes and bump DATABASE_VERSION to 6. Users already at v5 will get the v6 upgrade. Fresh installs will run both v5 and v6 blocks.
**Warning signs:** Existing users' attendance breaks after Phase 4 code deploys. New users work fine. `DataError` from IndexedDB because store still has `keyPath: 'key'`.

### Pitfall 8: Removing In-Memory Cache Breaks Mid-Session State
**What goes wrong:** `attendanceDataService.attendanceCache` is used as an in-memory cache for the current session. Removing it means every attendance read goes to IndexedDB. If IndexedDB reads are significantly slower than memory access, the UI may feel sluggish.
**Why it happens:** IndexedDB reads are async and involve IPC overhead.
**How to avoid:** IndexedDB reads for small datasets (20-50 attendance records per event) are sub-millisecond. The concern is theoretical. However, if performance issues appear, a thin read-through cache can be added later. The user decision is to remove it now.
**Warning signs:** Noticeable UI delay when switching between attendance views. Profile shows excessive IndexedDB read calls.

### Pitfall 9: SQLite Attendance Table Has Different Schema Than New IndexedDB
**What goes wrong:** The existing SQLite attendance table (lines 221-241 in database.js) has columns like `firstname`, `lastname`, `version`, `local_version`, `last_sync_version`, etc. that won't exist in the new IndexedDB store. Query methods must return consistent shapes.
**Why it happens:** SQLite and IndexedDB evolved independently. ATTN-06 requires consistent shapes.
**How to avoid:** Define a canonical output shape that both platforms return. The SQLite query should SELECT only the fields that match the IndexedDB record shape, or map the results. Alternatively, update the SQLite table to match the simplified schema (drop enrichment columns, add isSharedSection).
**Warning signs:** Code that works on web (IndexedDB) breaks on native (SQLite) due to missing fields, or vice versa.

## Code Examples

### IndexedDB Upgrade Block (DB Version 6)
```javascript
// Source: indexedDBService.js, new block after existing if (oldVersion < 5) block
if (oldVersion < 6) {
  // Phase 4: Replace attendance store with compound key [eventid, scoutid]
  if (db.objectStoreNames.contains(STORES.ATTENDANCE)) {
    db.deleteObjectStore(STORES.ATTENDANCE);
  }
  const attendanceStoreV6 = db.createObjectStore(STORES.ATTENDANCE, {
    keyPath: ['eventid', 'scoutid'],
  });
  attendanceStoreV6.createIndex('eventid', 'eventid', { unique: false });
  attendanceStoreV6.createIndex('scoutid', 'scoutid', { unique: false });
  attendanceStoreV6.createIndex('sectionid', 'sectionid', { unique: false });

  // Remove separate shared_attendance store
  if (db.objectStoreNames.contains(STORES.SHARED_ATTENDANCE)) {
    db.deleteObjectStore(STORES.SHARED_ATTENDANCE);
  }

  // Create shared event metadata store
  const sharedMetaStore = db.createObjectStore('shared_event_metadata', {
    keyPath: 'eventid',
  });

  // Clean up old blob keys from localStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.match(/^(demo_)?viking_attendance_.+_offline$/) ||
        key.match(/^(demo_)?viking_shared_attendance_.+_offline$/) ||
        key.match(/^(demo_)?viking_shared_metadata_/)
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    // Best-effort cleanup
  }

  logger.info('IndexedDB v6 upgrade: attendance stores normalized', {
    dbName,
  }, LOG_CATEGORIES.DATABASE);
}
```

### Per-Event Bulk Replace (Regular Attendance)
```javascript
// Source pattern: bulkReplaceEventsForSection adapted for per-event attendance
static async bulkReplaceAttendanceForEvent(eventId, records) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.ATTENDANCE, 'readwrite');
    const store = tx.objectStore(STORES.ATTENDANCE);
    const index = store.index('eventid');

    // Delete all existing attendance for this event
    let cursor = await index.openCursor(eventId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    // Insert new records
    const timestamp = Date.now();
    for (const record of records) {
      await store.put({ ...record, updated_at: timestamp });
    }

    await tx.done;
    return records.length;
  } catch (error) {
    logger.error('IndexedDB bulkReplaceAttendanceForEvent failed', {
      eventId,
      count: records?.length,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'indexeddb_bulk_replace_attendance_for_event',
        store: STORES.ATTENDANCE,
      },
      contexts: {
        indexedDB: {
          eventId,
          count: records?.length,
          operation: 'bulkReplaceAttendanceForEvent',
        },
      },
    });

    throw error;
  }
}
```

### Updated DatabaseService.saveAttendance (Web Path)
```javascript
async saveAttendance(eventId, attendanceData, options = {}) {
  await this.initialize();

  if (!this.isNative || !this.db) {
    // Validate with Zod at write boundary
    const { data: validRecords, errors } = safeParseArray(AttendanceSchema, attendanceData);
    if (errors.length > 0) {
      logger.warn('Attendance validation errors during save', {
        errorCount: errors.length,
        totalCount: attendanceData?.length,
        errors: errors.slice(0, 5),
      }, LOG_CATEGORIES.DATABASE);
    }

    // Log unknown fields to Sentry
    const knownKeys = new Set(['scoutid', 'eventid', 'sectionid', 'attending', 'patrol', 'notes', 'isSharedSection']);
    for (const record of validRecords) {
      const unknownKeys = Object.keys(record).filter(k => !knownKeys.has(k) && k !== 'updated_at');
      if (unknownKeys.length > 0) {
        sentryUtils.captureMessage('Attendance record has unknown fields', {
          level: 'warning',
          extra: { unknownKeys, eventid: record.eventid },
        });
        break; // Log once per batch
      }
    }

    await IndexedDBService.bulkReplaceAttendanceForEvent(eventId, validRecords);
    return;
  }

  // SQLite path with transaction
  await this.db.execute('BEGIN TRANSACTION');
  try {
    await this.db.run('DELETE FROM attendance WHERE eventid = ?', [eventId]);
    for (const record of attendanceData) {
      const insert = `
        INSERT INTO attendance (eventid, scoutid, sectionid, attending, patrol, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await this.db.run(insert, [
        eventId, record.scoutid, record.sectionid,
        record.attending, record.patrol, record.notes,
      ]);
    }
    await this.db.execute('COMMIT');
  } catch (error) {
    await this.db.execute('ROLLBACK');
    throw error;
  }
  await this.updateSyncStatus('attendance');
}
```

### Updated DatabaseService.getAttendance (Web Path)
```javascript
async getAttendance(eventId) {
  await this.initialize();

  if (!this.isNative || !this.db) {
    return IndexedDBService.getAttendanceByEvent(eventId);
  }

  const query = 'SELECT * FROM attendance WHERE eventid = ? ORDER BY scoutid';
  const result = await this.db.query(query, [eventId]);
  return result.values || [];
}
```

### Shared Event Metadata CRUD
```javascript
// Save shared event metadata
static async saveSharedEventMetadata(metadata) {
  const db = await getDB();
  await db.put('shared_event_metadata', {
    ...metadata,
    updated_at: Date.now(),
  });
}

// Get shared event metadata
static async getSharedEventMetadata(eventId) {
  const db = await getDB();
  return (await db.get('shared_event_metadata', eventId)) || null;
}

// Get all shared event metadata
static async getAllSharedEventMetadata() {
  const db = await getDB();
  return (await db.getAll('shared_event_metadata')) || [];
}
```

### Read-Time Enrichment Pattern
```javascript
// In attendanceHelpers_new.js or equivalent
export async function loadAttendanceForEventEnriched(eventId) {
  const records = await databaseService.getAttendance(eventId);
  if (!records || records.length === 0) return [];

  // Join with event data
  const event = await databaseService.getEventById(eventId);

  return records.map(record => ({
    ...record,
    eventname: event?.name,
    eventdate: event?.startdate,
    sectionname: null, // Join with sections if needed
  }));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Attendance stored as blob array under `viking_attendance_{eventId}_offline` key via USS | Individual records with compound key `[eventid, scoutid]` directly in IndexedDB | Phase 4 (this phase) | Direct lookup by event+scout, queries by eventid or scoutid via indexes |
| Separate `shared_attendance` store for shared event data | Unified attendance store with `isSharedSection` marker field | Phase 4 (this phase) | Single query returns all attendance for an event, regular and shared |
| Shared metadata in USS blob keys (`viking_shared_metadata_{eventId}`) | Dedicated `shared_event_metadata` store keyed by eventid | Phase 4 (this phase) | Direct lookup, no string key parsing |
| Enrichment fields stored with each attendance record (eventname, eventdate, sectionname) | Core fields only, enrichment joined at read time | Phase 4 (this phase) | No stale denormalized data, reduced storage size |
| In-memory cache (`attendanceDataService.attendanceCache`) | Direct IndexedDB reads | Phase 4 (this phase) | Single source of truth, no cache invalidation bugs |
| Batch sync of all event attendance on refresh | On-demand per-event sync when user views event | Phase 4 (this phase) | Fewer API calls, faster perceived load times |
| UnifiedStorageService routing for attendance | Direct IndexedDBService methods | Phase 4 (this phase) | Removes indirection, enables compound key queries |

## Open Questions

1. **DB Version: 6 or extend v5?**
   - What we know: Current version is 5. Users on v5 need v6 to get attendance migration. Fresh installs need both.
   - What's unclear: Whether any Phase 3 tasks are still pending that might also need the v5 block.
   - Recommendation: Use v6. It's the safe choice. Fresh installs run v5 then v6 sequentially. The overhead of two upgrade steps is negligible.

2. **SQLite Attendance Table Simplification**
   - What we know: The existing SQLite attendance table has columns for firstname, lastname, version tracking (version, local_version, last_sync_version, etc.) that won't be in the new IndexedDB records.
   - What's unclear: Whether the SQLite table should be recreated with a simplified schema matching the IndexedDB record shape, or just have queries adapted.
   - Recommendation: Simplify the SQLite table to match. Drop enrichment columns and versioning columns that aren't used on the new path. Add `isSharedSection` column and `sectionid` index. This ensures ATTN-06 (consistent shapes) is straightforward.

3. **eventDataLoader Batch Sync Removal vs Adaptation**
   - What we know: The user decided attendance loads on-demand per event. The eventDataLoader currently batch-syncs all displayable events.
   - What's unclear: Should eventDataLoader be removed entirely, or adapted to be the mechanism that syncs attendance when an event is opened?
   - Recommendation: Keep eventDataLoader but change its trigger. Instead of batch-syncing on a schedule, it becomes the service called when a user opens an event. The `syncEventAttendance(event, token)` method already exists and does per-event sync -- just make it the primary sync trigger.

4. **Shared Attendance Separate Cursor Delete**
   - What we know: Regular and shared attendance share a store. They may sync at different times.
   - What's unclear: Should shared attendance sync delete ONLY shared records (cursor filter by `isSharedSection`) or delete ALL records for the event and re-insert both?
   - Recommendation: Separate cursor deletes. Regular attendance sync: delete where `isSharedSection` is falsy for the event, then insert regular records. Shared attendance sync: delete where `isSharedSection` is true for the event, then insert shared records. This prevents one sync from wiping the other's data.

5. **Demo Mode Attendance Initialization**
   - What we know: `demoMode.js` writes demo attendance to localStorage under keys like `demo_viking_attendance_{sectionId}_{termId}_{eventId}_offline`. Phase 4 cleans these up and stores in IndexedDB.
   - What's unclear: Should Phase 4 update demo mode initialization to write through the normalized path?
   - Recommendation: Yes, update demo initialization to call `databaseService.saveAttendance()` so demo mode works with the new store. This is a small adjacent fix similar to the events demo mode fix that should have happened in Phase 3.

## Sources

### Primary (HIGH confidence)
- `/src/shared/services/storage/indexedDBService.js` -- Current attendance store definition (keyPath: 'key', lines 99-102), shared_attendance store (lines 104-107), member_section compound key pattern (lines 117-122, 874-904), upgrade mechanism, Phase 3 events migration
- `/src/shared/services/storage/database.js` -- Current saveAttendance/getAttendance implementation (lines 694-839), USS routing, SQLite attendance table schema (lines 221-241)
- `/src/shared/services/storage/schemas/validation.js` -- AttendanceSchema (lines 44-52), SharedAttendanceSchema (lines 60-68), safeParseArray utility
- `/src/shared/services/storage/schemas/indexedDBSchema.js` -- NORMALIZED_STORES.attendance target definition (compound key ['eventid', 'scoutid']), shared_attendance definition
- `/src/shared/services/storage/schemas/sqliteSchema.js` -- SQLITE_INDEXES for attendance (idx_attendance_eventid, idx_attendance_scoutid)
- `/src/shared/services/data/attendanceDataService.js` -- In-memory attendanceCache (line 9), loadAttendanceFromCache, getCachedEventsOptimized
- `/src/shared/services/data/eventDataLoader.js` -- Batch sync logic, syncSharedAttendance method
- `/src/shared/utils/attendanceHelpers_new.js` -- loadAllAttendanceFromDatabase enrichment pattern
- `/src/features/events/hooks/useAttendanceData.js` -- Shared attendance read from USS (lines 61-87)
- `/src/features/events/hooks/useSharedAttendance.js` -- Shared metadata read from USS (line 19)
- `/src/shared/services/api/api/events.js` -- getEventAttendance, getSharedEventAttendance, createMemberSectionRecordsForSharedAttendees
- `/src/shared/services/storage/unifiedStorageService.js` -- Key routing for attendance/shared_attendance stores (lines 133-137, 179-187)
- Phase 3 RESEARCH.md -- Proven normalization pattern (cursor delete, Zod at write boundary, direct IndexedDB)
- `/jakearchibald/idb` Context7 docs -- Compound keyPath, cursor iteration, transaction management

### Secondary (MEDIUM confidence)
- MDN IndexedDB documentation -- Compound key behavior, index cursor iteration
- IndexedDB specification -- Compound keyPath arrays, key comparison semantics

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns exist in codebase
- Architecture: HIGH -- compound key pattern proven by member_section store, cursor delete proven by Phase 3 events
- Pitfalls: HIGH -- identified from concrete code paths (USS routing, enrichment fields, shared metadata keys, hooks reading from old locations)
- Store migration: HIGH -- v6 upgrade block follows established pattern, compound keyPath proven
- Query methods: HIGH -- `getAllFromIndex`, `get` with compound key array are standard idb operations already used in codebase
- Shared attendance handling: MEDIUM -- merging regular and shared into one store with marker field is straightforward, but the cursor-filter-by-marker approach for separate sync is untested in this codebase (the alternative of delete-all-then-insert-all is simpler)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, no fast-moving dependencies)
