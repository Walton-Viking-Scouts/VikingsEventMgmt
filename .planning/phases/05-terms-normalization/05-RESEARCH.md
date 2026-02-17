# Phase 5: Terms Normalization - Research

**Researched:** 2026-02-16
**Domain:** IndexedDB terms store migration, SQLite terms table, CurrentActiveTermsService integration, Zod validation
**Confidence:** HIGH

## Summary

Phase 5 normalizes term storage from a blob-in-a-key format to individual records keyed by `termid`. The current IndexedDB `terms` store uses `keyPath: 'key'` and stores all terms as a single blob under the key `viking_terms_offline` (via UnifiedStorageService). The target is `keyPath: 'termid'` with indexes on `sectionid` and `startdate`, enabling direct lookups and efficient per-section queries.

The critical integration point is `CurrentActiveTermsService`, which currently operates independently from the terms store -- it has its own `current_active_terms` store keyed by `sectionId` and is populated by the `getTerms()` API function. The `current_active_terms` store is listed in `UNCHANGED_STORES` in `indexedDBSchema.js` and does NOT need migration. Phase 5 only normalizes the main `terms` store while ensuring `CurrentActiveTermsService` continues to read/write its own store correctly.

The API returns terms as an object keyed by sectionId, where each value is an array of term objects: `{ "12345": [{ termid, name, startdate, enddate }, ...], "67890": [...] }`. This nested structure must be flattened into individual records with `sectionid` attached to each record before storage. The `TermSchema` Zod validator already exists with `.transform(String)` for `termid` and optional `sectionid`.

**Primary recommendation:** Add a `terms` store replacement in a new `if (oldVersion < 7)` upgrade block (bump DATABASE_VERSION to 7). Add `bulkReplaceTermsForSection(sectionId, terms)` using cursor-based section-scoped delete (same pattern as events). Add query methods `getTermsBySection`, `getTermById`, `getAllTerms`. Update `DatabaseService.saveTerms()` and `getTerms()` to validate with Zod and call IndexedDBService directly. The `calculateAndStoreCurrentTerms()` in `terms.js` API module continues to populate `current_active_terms` separately -- no changes needed there. Add a SQLite `terms` table since none exists yet. Remove legacy `viking_terms_offline` blob references.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | ^8.0.3 | IndexedDB wrapper with transaction and index support | Already installed. Transaction API for atomic section-scoped replacement. |
| `zod` | ^4.3.6 | Runtime validation at write boundary | Already installed (Phase 1). `TermSchema` and `safeParseArray` defined in `validation.js`. |
| `@capacitor-community/sqlite` | ^7.0.0 | SQLite on native platforms | Already installed. Terms table needs to be created. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | ^6.2.2 | IndexedDB testing in Vitest | Already a devDependency. Use for testing normalized terms CRUD. |

**Installation:** No new dependencies needed.

## Architecture Patterns

### Recommended File Structure
```
src/shared/services/storage/
  indexedDBService.js         # Add terms store v7 upgrade + bulkReplaceTermsForSection + query methods
  database.js                 # Implement saveTerms() and getTerms() stubs (currently throw Phase 5 errors)
  currentActiveTermsService.js  # NO CHANGES - continues operating on current_active_terms store
  schemas/
    validation.js             # TermSchema already exists - may need sectionid transform update
    indexedDBSchema.js         # NORMALIZED_STORES.terms already defined (reference only)
    sqliteSchema.js            # Add terms table CREATE TABLE + indexes
```

### Pattern 1: IndexedDB Store Replacement in New v7 Upgrade Block

**What:** Delete the old blob-style `terms` store and create a normalized one. This requires a new version bump since v5 (sections + events) and v6 (attendance) are already used.

**Current terms store definition (lines 66-69 in indexedDBService.js):**
```javascript
if (!db.objectStoreNames.contains(STORES.TERMS)) {
  const termsStore = db.createObjectStore(STORES.TERMS, { keyPath: 'key' });
  termsStore.createIndex('timestamp', 'timestamp', { unique: false });
}
```

**Target (new `if (oldVersion < 7)` block):**
```javascript
if (oldVersion < 7) {
  if (db.objectStoreNames.contains(STORES.TERMS)) {
    db.deleteObjectStore(STORES.TERMS);
  }
  const termsStoreV7 = db.createObjectStore(STORES.TERMS, { keyPath: 'termid' });
  termsStoreV7.createIndex('sectionid', 'sectionid', { unique: false });
  termsStoreV7.createIndex('startdate', 'startdate', { unique: false });

  logger.info('IndexedDB v7 upgrade: terms store normalized', { dbName }, LOG_CATEGORIES.DATABASE);
}
```

**DATABASE_VERSION must be bumped from 6 to 7.**

**Fresh install behavior:** Same as prior phases -- the guard at lines 66-69 creates the old-format store, then the v7 block deletes and recreates it. Redundant but correct and consistent with established approach. The old guard is kept in place.

**Reference:** `NORMALIZED_STORES.terms` in `schemas/indexedDBSchema.js` defines `keyPath: 'termid'` and indexes `sectionid`, `startdate`.

### Pattern 2: Section-Scoped Atomic Replacement

**What:** Terms come from the API grouped by section. When saving terms for a section, delete all existing terms for that sectionId via index cursor, then insert the new ones -- identical to the events pattern from Phase 3.

```javascript
static async bulkReplaceTermsForSection(sectionId, terms) {
  const db = await getDB();
  const tx = db.transaction(STORES.TERMS, 'readwrite');
  const store = tx.objectStore(STORES.TERMS);
  const index = store.index('sectionid');

  let cursor = await index.openCursor(sectionId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  for (const term of terms) {
    await store.put({ ...term, updated_at: Date.now() });
  }

  await tx.done;
  return terms.length;
}
```

**Why cursor-based delete (not store.clear()):** Terms span multiple sections, just like events. Each API call syncs one section's terms. Must not destroy other sections' terms.

### Pattern 3: API Response Flattening

**What:** The API returns `{ sectionId: [termObj, termObj, ...], ... }`. Each term object has `termid`, `name`, `startdate`, `enddate` but the `sectionid` may not be on the term itself -- it's the object key. The `sectionid` field in `TermSchema` is optional. During save, the sectionid from the object key must be injected into each term record.

```javascript
// In DatabaseService.saveTerms(sectionId, terms):
const enrichedTerms = terms.map(t => ({ ...t, sectionid: sectionId }));
const { data: validTerms } = safeParseArray(TermSchema, enrichedTerms);
await IndexedDBService.bulkReplaceTermsForSection(sectionId, validTerms);
```

**Important:** The `TermSchema` sectionid field uses `z.union([z.string(), z.number()]).optional()` but does NOT have a `.transform()`. This should be updated to `.transform(Number)` to match the sections normalization pattern (sectionid is canonically a Number throughout the codebase).

### Pattern 4: CurrentActiveTermsService Integration (NO CHANGES)

**What:** The `current_active_terms` store is separate from the `terms` store and is listed in `UNCHANGED_STORES`. It stores one record per section with the currently active term's summary (sectionId, currentTermId, termName, startDate, endDate, lastUpdated).

**How it gets populated:** The `getTerms()` API function in `terms.js` calls `calculateAndStoreCurrentTerms()` which iterates through the API response, finds the current/most recent term per section using `findMostRecentTerm()`, and writes to `CurrentActiveTermsService.setCurrentActiveTerm()`.

**Who reads it:** `fetchMostRecentTermId()` and direct calls from `members.js` read via `CurrentActiveTermsService.getCurrentActiveTerm()`.

**Phase 5 impact:** NONE on these flows. The `calculateAndStoreCurrentTerms()` function writes directly to the `current_active_terms` store, not the `terms` store. The `terms` store normalization does not affect the `current_active_terms` store.

**However:** Phase 5 should also update the `getTerms()` API function to store the full terms data into the normalized `terms` store (in addition to the current active term extraction). This provides offline access to ALL terms, not just the current active one.

### Pattern 5: DatabaseService Stub Implementation

**What:** `database.js` already has stub methods for Phase 5 that throw "not yet implemented" errors:
- `getTerms(sectionId)` -- line 1723
- `saveTerms(sectionId, terms)` -- line 1736
- `getCurrentActiveTerm(sectionId)` -- line 1748
- `setCurrentActiveTerm(sectionId, term)` -- line 1761

These must be implemented. `getTerms` and `saveTerms` route to the normalized `terms` store. `getCurrentActiveTerm` and `setCurrentActiveTerm` delegate to `CurrentActiveTermsService`.

### Pattern 6: SQLite Terms Table Creation

**What:** No SQLite `terms` table exists yet. One must be added to `database.js createTables()` and ideally defined in `sqliteSchema.js`.

```sql
CREATE TABLE IF NOT EXISTS terms (
  termid TEXT PRIMARY KEY,
  sectionid INTEGER,
  name TEXT NOT NULL,
  startdate TEXT,
  enddate TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_terms_sectionid ON terms(sectionid);
CREATE INDEX IF NOT EXISTS idx_terms_startdate ON terms(startdate);
```

### Anti-Patterns to Avoid
- **Modifying current_active_terms store or service:** It works correctly and is explicitly in UNCHANGED_STORES. Do not touch it.
- **Using UnifiedStorageService for terms:** The blob-based `viking_terms_offline` key routes through UnifiedStorageService to the old `terms` store. After normalization, DatabaseService should call IndexedDBService directly (same pattern as sections and events).
- **Forgetting sectionid injection:** API terms objects may not have `sectionid` -- it comes from the object key. Must be injected before storage.
- **Clearing the whole terms store:** Terms span sections. Use cursor-based section-scoped delete.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section-scoped delete | Manual key filtering | IndexedDB index cursor delete | Atomic, efficient, proven in Phase 3 |
| Data validation | Manual field checks | Zod `TermSchema` + `safeParseArray` | Consistent with other phases, handles edge cases |
| Type coercion | String/Number casting | Zod `.transform()` | Canonical types guaranteed at write boundary |

## Common Pitfalls

### Pitfall 1: TermSchema sectionid Not Canonicalized
**What goes wrong:** The `sectionid` field in `TermSchema` is `z.union([z.string(), z.number()]).optional()` without `.transform(Number)`. This means sectionid might be stored as string `"12345"` in one record and number `12345` in another, causing index lookups to fail.
**Why it happens:** Phase 1 defined the schema before the normalization pattern was established.
**How to avoid:** Update `TermSchema` to add `.transform(Number)` on the `sectionid` field, matching `SectionSchema`, `EventSchema`, and `AttendanceSchema`.
**Warning signs:** Index queries return empty arrays despite data being present.

### Pitfall 2: Forgetting to Update DATABASE_VERSION
**What goes wrong:** If DATABASE_VERSION stays at 6, the `if (oldVersion < 7)` block never executes. The old blob-format `terms` store remains.
**Why it happens:** Version bump is easy to overlook.
**How to avoid:** First change: bump DATABASE_VERSION from 6 to 7.

### Pitfall 3: Legacy Blob Consumers Still Reading Old Format
**What goes wrong:** `YoungLeadersPage.jsx` reads terms via `UnifiedStorageService.get('viking_terms_offline')` as a fallback. After migration, the old blob is gone and this returns null.
**Why it happens:** Multiple consumers read terms in different ways.
**How to avoid:** Update `YoungLeadersPage.jsx` to use `DatabaseService.getTerms()` or a new method that returns terms grouped by section. Also update `auth.js` which reads/clears the blob key from localStorage.
**Warning signs:** Young Leaders page shows no terms data after migration.

### Pitfall 4: API terms.js Still Needs to Store to Normalized Terms Store
**What goes wrong:** Currently `getTerms()` in `terms.js` only stores to `current_active_terms` via `calculateAndStoreCurrentTerms()`. The raw terms data is returned from the function but NOT stored offline. After removing the blob, there's no offline terms fallback.
**Why it happens:** The old approach relied on consumers storing the terms blob themselves.
**How to avoid:** Add a `storeTermsToNormalizedStore()` call inside `getTerms()` that iterates the API response and calls `DatabaseService.saveTerms()` for each section's terms.

### Pitfall 5: CurrentActiveTermsService.migrateFromTermsBlob() Will Break
**What goes wrong:** `migrateFromTermsBlob()` reads from `UnifiedStorageService.get('viking_terms_offline')` which maps to the old `terms` store. After normalization, this store has a different keyPath and the old blob key no longer exists.
**Why it happens:** The migration method was designed for the blob-to-current_active_terms migration.
**How to avoid:** This method becomes obsolete after Phase 5. It should either be removed or updated to read from the normalized terms store. Since the `calculateAndStoreCurrentTerms()` flow already populates `current_active_terms` on every API call, the migration method is likely unnecessary.

## Code Examples

### Existing TermSchema (validation.js lines 84-90)
```javascript
export const TermSchema = z.object({
  termid: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  sectionid: z.union([z.string(), z.number()]).optional(),
  startdate: z.string().nullable().optional(),
  enddate: z.string().nullable().optional(),
});
```

**Needs update:** `sectionid` should become `z.union([z.string(), z.number()]).transform(Number)` (not optional, since we inject it during save).

### API Response Shape (from terms.js)
```javascript
// getTerms() returns:
{
  "999901": [
    { termid: "12345", name: "Autumn Term 2025", startdate: "2025-09-01", enddate: "2025-12-15" },
    { termid: "67890", name: "Spring Term 2026", startdate: "2026-01-15", enddate: "2026-04-10" }
  ],
  "999902": [
    { termid: "11111", name: "Autumn Term 2025", startdate: "2025-09-01", enddate: "2025-12-15" }
  ]
}
```

### Current active_terms Store Record Shape
```javascript
{
  sectionId: "999901",         // keyPath (String)
  currentTermId: "12345",      // String
  termName: "Autumn Term 2025",
  startDate: "2025-09-01",
  endDate: "2025-12-15",
  lastUpdated: 1737765123456   // timestamp
}
```

### Target normalized terms Store Record Shape
```javascript
{
  termid: "12345",             // keyPath (String, via Zod transform)
  name: "Autumn Term 2025",
  sectionid: 999901,           // Number (via Zod transform), indexed
  startdate: "2025-09-01",     // indexed
  enddate: "2025-12-15",
  updated_at: 1737765123456    // timestamp added during put()
}
```

### DatabaseService.saveTerms() Implementation Pattern
```javascript
async saveTerms(sectionId, terms) {
  await this.initialize();

  const enrichedTerms = terms.map(t => ({ ...t, sectionid: sectionId }));
  const { data: validTerms, errors } = safeParseArray(TermSchema, enrichedTerms);
  if (errors.length > 0) {
    logger.warn('Term validation errors during save', {
      errorCount: errors.length,
      totalCount: terms?.length,
      errors: errors.slice(0, 5),
    }, LOG_CATEGORIES.DATABASE);
  }

  if (!this.isNative || !this.db) {
    await IndexedDBService.bulkReplaceTermsForSection(sectionId, validTerms);
    return;
  }

  // SQLite path
  await this.db.execute('BEGIN TRANSACTION');
  try {
    await this.db.run('DELETE FROM terms WHERE sectionid = ?', [sectionId]);
    for (const term of validTerms) {
      await this.db.run(
        'INSERT INTO terms (termid, sectionid, name, startdate, enddate) VALUES (?, ?, ?, ?, ?)',
        [term.termid, term.sectionid, term.name, term.startdate, term.enddate]
      );
    }
    await this.db.execute('COMMIT');
  } catch (error) {
    await this.db.execute('ROLLBACK');
    throw error;
  }
  await this.updateSyncStatus('terms');
}
```

### DatabaseService.getTerms() Implementation Pattern
```javascript
async getTerms(sectionId) {
  await this.initialize();

  if (!this.isNative || !this.db) {
    return IndexedDBService.getTermsBySection(sectionId);
  }

  const query = 'SELECT * FROM terms WHERE sectionid = ? ORDER BY startdate DESC';
  const result = await this.db.query(query, [sectionId]);
  return result.values || [];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All terms in single JSON blob under `viking_terms_offline` | Individual records keyed by `termid` with indexes | Phase 5 | Direct lookups, section-scoped queries, consistent with events pattern |
| `UnifiedStorageService.get('viking_terms_offline')` for all term reads | `IndexedDBService.getTermsBySection()` / `DatabaseService.getTerms()` | Phase 5 | Eliminates full-blob parsing, enables efficient queries |
| No offline term storage beyond current_active_terms summary | Full term records stored normalized | Phase 5 | Complete offline term data available |

**Deprecated/outdated:**
- `UnifiedStorageService.get('viking_terms_offline')` -- replaced by normalized store reads
- `CurrentActiveTermsService.migrateFromTermsBlob()` -- migration from blob no longer needed after normalization
- Direct localStorage `viking_terms_offline` reads in `auth.js` and `YoungLeadersPage.jsx`

## Open Questions

1. **Should TermSchema.sectionid become required instead of optional?**
   - What we know: API terms objects don't always include `sectionid` -- it comes from the API response object key. Phase 5 injects it before save.
   - What's unclear: Are there any code paths that validate terms WITHOUT injecting sectionid first?
   - Recommendation: Make `sectionid` required in the schema (with `.transform(Number)`) since we always inject it at the write boundary. If validation fails for records without sectionid, that's a bug we want to catch. **Confidence: HIGH**

2. **Should the `getTerms()` API function store to the normalized terms store automatically?**
   - What we know: Currently it only stores to `current_active_terms`. The terms data is returned but not persisted for offline use (beyond the old blob path).
   - What's unclear: Performance impact of storing all terms on every API call.
   - Recommendation: Yes, store to normalized terms store. Terms data is small (few records per section). This ensures offline availability. **Confidence: HIGH**

3. **Legacy blob cleanup scope**
   - What we know: `viking_terms_offline` blob is referenced in: `UnifiedStorageService` (store mapping), `auth.js` (cache check + cleanup), `YoungLeadersPage.jsx` (fallback read), `currentActiveTermsService.js` (migration), `demoMode.js` (mock data).
   - What's unclear: Whether removing the blob mapping from UnifiedStorageService could break anything not discovered during search.
   - Recommendation: Remove all blob references. Update consumers to use DatabaseService. Update demo mode to seed normalized store. **Confidence: HIGH**

## Sources

### Primary (HIGH confidence)
- `indexedDBService.js` -- lines 6-7: DATABASE_VERSION = 6, line 66-69: current terms store definition
- `schemas/indexedDBSchema.js` -- lines 36-42: NORMALIZED_STORES.terms definition (keyPath: 'termid', indexes: sectionid, startdate)
- `schemas/indexedDBSchema.js` -- lines 68-74: UNCHANGED_STORES includes 'current_active_terms'
- `schemas/validation.js` -- lines 84-90: TermSchema definition
- `database.js` -- lines 1722-1764: Phase 5 stub methods
- `currentActiveTermsService.js` -- full file: independent service operating on current_active_terms store
- `terms.js` API module -- full file: getTerms() flow, calculateAndStoreCurrentTerms()
- Phase 3 (events) research and implementation: established section-scoped cursor delete pattern

### Secondary (MEDIUM confidence)
- `YoungLeadersPage.jsx` lines 120-138: terms blob fallback consumer
- `auth.js` lines 609-697: terms blob cache check and cleanup

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all patterns established in prior phases
- Architecture: HIGH - direct application of Phase 2/3 patterns (store replacement, cursor delete, Zod validation at write boundary)
- Pitfalls: HIGH - all identified from direct code analysis, well-understood patterns
- CurrentActiveTermsService integration: HIGH - verified it operates independently on its own store

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable codebase, internal patterns)
