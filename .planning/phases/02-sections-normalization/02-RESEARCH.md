# Phase 2: Sections Normalization - Research

**Researched:** 2026-02-15
**Domain:** IndexedDB store migration, SQLite sections storage, UnifiedStorageService bypass, Zod validation at write boundary
**Confidence:** HIGH

## Summary

Phase 2 is the first data-type normalization phase. It converts the `sections` IndexedDB store from blob storage (`keyPath: 'key'`, data stored as `{ key: 'viking_sections_offline', data: [...], timestamp: ... }`) to normalized individual records (`keyPath: 'sectionid'`, each section stored as its own record). The SQLite path already stores sections as individual rows keyed by `sectionid`, so the SQLite side needs minimal changes. The web/IndexedDB path requires: (1) replacing the old sections store in the v5 upgrade block, (2) implementing `saveSections`/`getSections` to write directly to IndexedDB instead of routing through UnifiedStorageService, and (3) adding Zod validation at the write boundary.

This phase proves the end-to-end normalization pattern that phases 3-6 will repeat. The critical technical challenge is the IndexedDB store replacement: you cannot change a store's `keyPath` without deleting and recreating it within the `upgrade()` callback. The consumer code (DatabaseService methods) must be updated simultaneously so reads/writes use the new normalized store format. The reference implementation is `core_members`/`member_section` stores which already use direct IndexedDB access with `bulkUpsert` patterns.

**Primary recommendation:** Delete and recreate the `sections` store inside the `if (oldVersion < 5)` upgrade block with `keyPath: 'sectionid'`. Update `DatabaseService.saveSections()` and `getSections()` to bypass UnifiedStorageService and write/read individual section records directly via IndexedDB. Add Zod validation via `safeParseArray(SectionSchema, sections)` at the write boundary. Implement atomic bulk upsert using clear-then-put-all within a single IndexedDB transaction.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | ^8.0.3 | IndexedDB wrapper with transaction support | Already installed. `openDB` upgrade callback for store replacement. Transaction API for atomic bulk operations. |
| `zod` | ^4.3.6 | Runtime validation at write boundary | Already installed (Phase 1). `SectionSchema` and `safeParseArray` ready to use. |
| `@capacitor-community/sqlite` | ^7.0.0 | SQLite on native platforms | Already installed. Sections table already exists and is normalized. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | ^6.2.2 | IndexedDB testing in Vitest | Already a devDependency. Use for testing store replacement and normalized CRUD. |

**Installation:** No new dependencies needed.

## Architecture Patterns

### Pattern 1: IndexedDB Store Replacement in Upgrade Block

**What:** Delete the old blob-style `sections` store and create a new normalized one within the `if (oldVersion < 5)` block.

**Why this must happen in upgrade():** IndexedDB only allows `createObjectStore` and `deleteObjectStore` during a `versionchange` transaction (the upgrade callback). You cannot change a store's `keyPath` any other way.

**Implementation approach:**
```javascript
// Inside the upgrade() callback, within the existing if (oldVersion < 5) block:
if (oldVersion < 5) {
  // Phase 2: Replace sections store with normalized keyPath
  if (db.objectStoreNames.contains(STORES.SECTIONS)) {
    db.deleteObjectStore(STORES.SECTIONS);
  }
  const sectionsStore = db.createObjectStore(STORES.SECTIONS, { keyPath: 'sectionid' });
  sectionsStore.createIndex('sectiontype', 'sectiontype', { unique: false });

  logger.info('IndexedDB v5 upgrade: sections store normalized', {
    dbName,
  }, LOG_CATEGORIES.DATABASE);
}
```

**Critical interaction with fresh installs:** The existing `if (!db.objectStoreNames.contains(STORES.SECTIONS))` guard (lines 54-58) creates the store with `{ keyPath: 'key' }` for fresh installs. After Phase 2, this guard fires first (fresh install, store doesn't exist), creating the old-format store. Then the `if (oldVersion < 5)` block fires (oldVersion is 0 for fresh install, which IS less than 5), deleting it and recreating with `{ keyPath: 'sectionid' }`. This works correctly but is redundant work. Two options:
1. **Simple (recommended):** Leave the old guard in place. The v5 block always replaces it. Clear intent, minimal diff, works for both fresh and upgrade paths.
2. **Clean:** Update the old guard to use the new keyPath. Requires careful ordering since later phases also modify their stores in the v5 block.

**Recommendation:** Option 1 -- leave the old guard, let the v5 block do the replacement. This keeps Phase 2 changes isolated to the v5 block.

### Pattern 2: Direct IndexedDB Access (Bypass UnifiedStorageService)

**What:** `DatabaseService.saveSections()` and `getSections()` currently route through `UnifiedStorageService.setSections(sections)` which stores the entire sections array as a single blob under key `'viking_sections_offline'` in the `sections` store. After normalization, sections are individual records keyed by `sectionid`. The UnifiedStorageService blob pattern is incompatible with the new store format.

**Current flow (web path):**
```
saveSections(sections) -> UnifiedStorageService.setSections(sections)
  -> IndexedDBService.set('sections', 'viking_sections_offline', sections)
  -> db.put('sections', { key: 'viking_sections_offline', data: sections, timestamp: ... })
```

**New flow (web path):**
```
saveSections(sections) -> validate with Zod -> IndexedDBService.bulkUpsertSections(sections)
  -> transaction on 'sections' store -> clear() -> put() each record -> tx.done
```

**Reference pattern:** The `bulkUpsertCoreMembers` method in `indexedDBService.js` (lines 544-590) is the exact template. It opens a readwrite transaction, iterates records, and calls `store.put()` for each within a single transaction.

### Pattern 3: Atomic Bulk Upsert with Full Replacement

**What:** The sections dataset is small (typically 4-6 sections) and should be replaced atomically. "Bulk upsert replaces the entire sections dataset atomically without leaving partial state" is a success criterion.

**Implementation:** Use a single IndexedDB transaction that:
1. Clears the entire store (`store.clear()`)
2. Puts all new records
3. Commits via `tx.done`

If any put fails, the transaction aborts and the store rolls back to its pre-clear state. IndexedDB transactions are atomic -- either all operations succeed or none do.

```javascript
static async bulkReplaceSections(sections) {
  const db = await getDB();
  const tx = db.transaction(STORES.SECTIONS, 'readwrite');
  const store = tx.objectStore(STORES.SECTIONS);

  await store.clear();

  for (const section of sections) {
    await store.put(section);
  }

  await tx.done;
  return sections.length;
}
```

**Why clear+put instead of just put:** The success criterion says "replaces the entire sections dataset." If a section was removed from the API response, an additive-only upsert would leave stale records. Clear-then-put ensures exact parity with the API response.

### Pattern 4: Zod Validation at Write Boundary

**What:** Validate and coerce sections data using `SectionSchema` before writing to IndexedDB.

**When to validate:** In `DatabaseService.saveSections()`, before passing data to IndexedDB. NOT on read -- data in local storage is trusted after validated write.

**Implementation:**
```javascript
import { SectionSchema, safeParseArray } from './schemas/validation.js';

async saveSections(sections) {
  await this.initialize();

  if (!this.isNative || !this.db) {
    const { data: validSections, errors } = safeParseArray(SectionSchema, sections);
    if (errors.length > 0) {
      logger.warn('Section validation errors during save', {
        errorCount: errors.length,
        totalCount: sections?.length,
      }, LOG_CATEGORIES.DATABASE);
    }
    await IndexedDBService.bulkReplaceSections(validSections);
    return;
  }

  // SQLite path (existing code, already normalized)
  // ... existing DELETE + INSERT logic
}
```

### Pattern 5: Consistent Return Shape Across Platforms

**What:** `getSections()` must return the same data shape on both IndexedDB and SQLite platforms.

**Current shapes:**
- **SQLite:** Returns `result.values` which is `[{ sectionid: 1, sectionname: '...', sectiontype: '...', created_at: '...', updated_at: '...' }]`
- **IndexedDB (current blob):** Returns the raw array that was stored, which includes extra fields like `section`, `isDefault`, `permissions`
- **IndexedDB (after normalization):** Will return individual records from `getAll()`, which will include whatever fields were stored

**Normalization strategy:** Both platforms should return an array of objects with at minimum: `sectionid`, `sectionname`, `sectiontype`. Additional fields (`section`, `isDefault`, `permissions`) may be present on IndexedDB but absent on SQLite. This is acceptable -- consumers should not depend on platform-specific extra fields. The Zod schema defines the canonical shape.

**getSections() implementation:**
```javascript
async getSections() {
  await this.initialize();

  if (!this.isNative || !this.db) {
    return await IndexedDBService.getAllSections();
  }

  const query = 'SELECT * FROM sections ORDER BY sectionname';
  const result = await this.db.query(query);
  return result.values || [];
}
```

### Recommended File Changes

```
src/shared/services/storage/
  indexedDBService.js           # MODIFY: store replacement in v5 block, add bulkReplaceSections + getAllSections
  database.js                   # MODIFY: saveSections/getSections bypass UnifiedStorageService
  __tests__/
    indexedDBService.test.js    # MODIFY: update tests for sections store migration
    (new) sectionNormalization.test.js  # NEW: integration tests for sections CRUD
```

### Anti-Patterns to Avoid

- **Don't route through UnifiedStorageService for normalized data.** USS wraps data in `{ key, data, timestamp }` blobs -- this defeats the purpose of normalization. Write directly to IndexedDB.
- **Don't validate on read.** Zod validation is expensive relative to a simple IndexedDB get. Validate once on write; trust local storage thereafter.
- **Don't use `bulkUpsertCoreMembers` pattern (merge with existing).** Members uses read-modify-write (`get existing -> spread -> put`). Sections should use clear-then-put since the entire dataset is replaced atomically.
- **Don't forget to handle the demo mode filter.** The current `_getWebStorageSections()` filters out demo sections (`name.startsWith('Demo ')`) when not in demo mode. This logic must be preserved in the new path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic store replacement | Manual version tracking or conditional logic | IndexedDB transaction (clear + put in single tx) | Transactions auto-rollback on failure, guaranteeing atomicity |
| Type coercion for sectionid | Manual `parseInt()` or `Number()` calls | `SectionSchema` with `.transform(Number)` | Already defined in validation.js, handles string/number union |
| Graceful validation degradation | Try/catch per record | `safeParseArray(SectionSchema, data)` | Already implemented in validation.js, returns valid + error arrays |
| Store schema definition | Hardcoded keyPath strings | `NORMALIZED_STORES.sections` from indexedDBSchema.js | Single source of truth for target schema |

## Common Pitfalls

### Pitfall 1: Fresh Install Creates Old Store Format Then v5 Block Recreates It
**What goes wrong:** On fresh install, `oldVersion` is 0, so `if (!db.objectStoreNames.contains('sections'))` creates the store with `keyPath: 'key'`, then `if (oldVersion < 5)` deletes and recreates with `keyPath: 'sectionid'`. This is correct but wasteful.
**Why it happens:** The v1 store creation guards are still present for backwards compatibility with partial upgrades.
**How to avoid:** Accept the double-create on fresh install. It's harmless and keeps the code simple. The delete+recreate in the v5 block is the authoritative definition.
**Warning signs:** None -- this is expected behavior. Only a concern if performance of `upgrade()` becomes an issue (it won't for 13 stores).

### Pitfall 2: UnifiedStorageService Still Has Sections Mapping
**What goes wrong:** If any code path still calls `UnifiedStorageService.setSections()` or `UnifiedStorageService.getSections()`, it will try to use the old blob pattern (`IndexedDBService.set('sections', 'viking_sections_offline', data)`) which fails because the store now expects `keyPath: 'sectionid'` not `keyPath: 'key'`.
**Why it happens:** Multiple code paths and the USS convenience methods haven't been updated.
**How to avoid:** Ensure ALL sections write/read paths go through `DatabaseService.saveSections()`/`getSections()`. The USS `getSections`/`setSections` convenience methods should be updated or deprecated. Check all callers: `auth.js`, `dataLoadingService.js`, component files.
**Warning signs:** `DataError: Data provided to an operation does not meet requirements` -- IndexedDB throws this when a record doesn't have the required keyPath property.

### Pitfall 3: Demo Mode Sections Written to localStorage, Not IndexedDB
**What goes wrong:** `demoMode.js` line 188 writes sections to localStorage via `safeSetItem('demo_viking_sections_offline', ...)`. After normalization, `DatabaseService.getSections()` reads from IndexedDB. Demo mode sections won't appear.
**Why it happens:** Demo initialization predates the IndexedDB migration.
**How to avoid:** Update `DatabaseService.saveSections()` to be the canonical write path for both real and demo data. The demo initializer should call `databaseService.saveSections()` instead of `safeSetItem()`. Alternatively, update the demo init to also write to IndexedDB.
**Warning signs:** Demo mode shows empty sections list after Phase 2.

### Pitfall 4: Test Expectations About Store keyPath
**What goes wrong:** Existing tests in `indexedDBService.test.js` reference the sections store with various keyPath expectations. Some tests (lines 138, 175, 205, 220) already expect `keyPath: 'sectionid'` for sections. The actual store currently uses `keyPath: 'key'`. Tests may be testing the PLANNED state rather than current state.
**Why it happens:** Tests were likely written/updated during Phase 1 to reflect the target schema.
**How to avoid:** Review test expectations carefully. After Phase 2, the store keyPath IS `'sectionid'`, which matches what several tests already expect. Ensure no tests still assert `keyPath: 'key'` for sections.
**Warning signs:** Test failures referencing store schema expectations.

### Pitfall 5: SQLite saveSections Does DELETE + INSERT Without Transaction
**What goes wrong:** The current SQLite `saveSections()` does `DELETE FROM sections` then loops `INSERT INTO sections`. If the process crashes between DELETE and INSERT, sections table is empty.
**Why it happens:** The original code didn't wrap this in a transaction.
**How to avoid:** Wrap the SQLite DELETE+INSERT in `BEGIN TRANSACTION`/`COMMIT` (with ROLLBACK on error), matching the `saveAttendance()` pattern already in the codebase. This satisfies the "atomically without leaving partial state" success criterion for both platforms.
**Warning signs:** Empty sections table after app crash during sync.

## Code Examples

### IndexedDB Store Replacement (in upgrade block)
```javascript
// Source: indexedDBService.js, inside existing if (oldVersion < 5) block
// Reference: NORMALIZED_STORES.sections from schemas/indexedDBSchema.js
if (oldVersion < 5) {
  // Phase 2: Replace sections store - blob keyPath:'key' -> normalized keyPath:'sectionid'
  if (db.objectStoreNames.contains(STORES.SECTIONS)) {
    db.deleteObjectStore(STORES.SECTIONS);
  }
  const sectionsStore = db.createObjectStore(STORES.SECTIONS, { keyPath: 'sectionid' });
  sectionsStore.createIndex('sectiontype', 'sectiontype', { unique: false });

  logger.info('IndexedDB v5 upgrade: sections store normalized', {
    dbName,
  }, LOG_CATEGORIES.DATABASE);
}
```

### Bulk Replace Sections (new IndexedDBService method)
```javascript
// Source pattern: IndexedDBService.bulkUpsertCoreMembers (lines 544-590)
// Adapted for sections: clear-then-put for full dataset replacement
static async bulkReplaceSections(sections) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.SECTIONS, 'readwrite');
    const store = tx.objectStore(STORES.SECTIONS);

    await store.clear();

    const timestamp = Date.now();
    for (const section of sections) {
      await store.put({
        ...section,
        updated_at: timestamp,
      });
    }

    await tx.done;
    return sections.length;
  } catch (error) {
    logger.error('IndexedDB bulkReplaceSections failed', {
      count: sections?.length,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'indexeddb_bulk_replace_sections',
        store: STORES.SECTIONS,
      },
      contexts: {
        indexedDB: {
          count: sections?.length,
          operation: 'bulkReplaceSections',
        },
      },
    });

    throw error;
  }
}
```

### Get All Sections (new IndexedDBService method)
```javascript
// Source pattern: IndexedDBService.getAllCoreMembers (lines 486-512)
static async getAllSections() {
  try {
    const db = await getDB();
    const results = await db.getAll(STORES.SECTIONS);
    return results || [];
  } catch (error) {
    logger.error('IndexedDB getAllSections failed', {
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'indexeddb_get_all_sections',
        store: STORES.SECTIONS,
      },
      contexts: {
        indexedDB: {
          operation: 'getAllSections',
        },
      },
    });

    throw error;
  }
}
```

### Updated DatabaseService.saveSections (web path)
```javascript
// Source: database.js saveSections method (lines 377-397)
// Change: bypass UnifiedStorageService, validate with Zod, write directly to IndexedDB
async saveSections(sections) {
  await this.initialize();

  if (!this.isNative || !this.db) {
    const { data: validSections, errors } = safeParseArray(SectionSchema, sections);
    if (errors.length > 0) {
      logger.warn('Section validation errors during save', {
        errorCount: errors.length,
        totalCount: sections?.length,
        errors: errors.slice(0, 5),
      }, LOG_CATEGORIES.DATABASE);
    }
    await IndexedDBService.bulkReplaceSections(validSections);
    return;
  }

  // SQLite path -- wrap in transaction for atomicity
  await this.db.execute('BEGIN TRANSACTION');
  try {
    await this.db.execute('DELETE FROM sections');
    for (const section of sections) {
      const insert = `INSERT INTO sections (sectionid, sectionname, sectiontype) VALUES (?, ?, ?)`;
      await this.db.run(insert, [section.sectionid, section.sectionname, section.sectiontype]);
    }
    await this.db.execute('COMMIT');
  } catch (error) {
    await this.db.execute('ROLLBACK');
    throw error;
  }

  await this.updateSyncStatus('sections');
}
```

### Updated DatabaseService.getSections (web path)
```javascript
// Source: database.js getSections method (lines 429-439)
// Change: bypass UnifiedStorageService, read directly from IndexedDB
async getSections() {
  await this.initialize();

  if (!this.isNative || !this.db) {
    const sections = await IndexedDBService.getAllSections();

    const { isDemoMode } = await import('../../../config/demoMode.js');
    if (!isDemoMode()) {
      return sections.filter(section => {
        const name = section?.sectionname;
        return !(typeof name === 'string' && name.startsWith('Demo '));
      });
    }
    return sections;
  }

  const query = 'SELECT * FROM sections ORDER BY sectionname';
  const result = await this.db.query(query);
  return result.values || [];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sections stored as blob array under `viking_sections_offline` key | Individual records keyed by `sectionid` | Phase 2 (this phase) | Direct lookup by sectionid, no full-scan needed |
| UnifiedStorageService routing (key-based dispatch) | Direct IndexedDB methods on IndexedDBService | Phase 2 starts this | Removes indirection layer for normalized data |
| No validation on write | Zod `safeParseArray` at write boundary | Phase 2 starts this | Catches malformed API data before storage |
| Non-transactional SQLite DELETE+INSERT | Transaction-wrapped atomic replacement | Phase 2 fixes this | No partial state on crash |

## Open Questions

1. **Demo Mode Initializer Update Scope**
   - What we know: `demoMode.js` writes sections to localStorage via `safeSetItem('demo_viking_sections_offline', ...)`. After normalization, `DatabaseService.getSections()` reads from IndexedDB.
   - What's unclear: Should Phase 2 update the demo initializer to call `databaseService.saveSections()`, or should it add a parallel IndexedDB write alongside the localStorage write?
   - Recommendation: Update demo initializer to call `databaseService.saveSections()` for sections data. This proves the normalized write path works for demo data too. Keep the localStorage write as a fallback for now (can be removed later).

2. **UnifiedStorageService Sections Methods**
   - What we know: `UnifiedStorageService.getSections()` and `setSections()` exist as convenience wrappers. After normalization, calling them would fail (wrong store format).
   - What's unclear: Should we deprecate/remove these methods, or update them to use the new format?
   - Recommendation: Remove or stub with errors. All callers should use `databaseService.saveSections()`/`getSections()`. Verify no direct callers exist besides `database.js`.

3. **Consumer Code That Reads Sections Directly from localStorage**
   - What we know: `auth.js` (line 610, 692) and `useSignInOut.js` (lines 308-309) reference `viking_sections_offline` and `demo_viking_sections_offline` localStorage keys directly.
   - What's unclear: Do these paths bypass `databaseService.getSections()` entirely?
   - Recommendation: Audit all direct localStorage reads for sections. Update to use `databaseService.getSections()`. This may be a larger scope than expected.

## Sources

### Primary (HIGH confidence)
- `/src/shared/services/storage/indexedDBService.js` -- Current sections store definition (keyPath: 'key', line 55), upgrade mechanism, member normalization reference patterns
- `/src/shared/services/storage/database.js` -- Current saveSections/getSections implementation, UnifiedStorageService routing, SQLite sections table
- `/src/shared/services/storage/unifiedStorageService.js` -- Key-to-store mapping for sections (line 151-152), getSections/setSections convenience methods
- `/src/shared/services/storage/schemas/validation.js` -- SectionSchema with .transform(Number) for sectionid, safeParseArray utility
- `/src/shared/services/storage/schemas/indexedDBSchema.js` -- NORMALIZED_STORES.sections target definition (keyPath: 'sectionid', index: sectiontype)
- `/src/config/demoMode.js` -- Demo sections data structure, localStorage-based demo initialization
- `/src/shared/services/api/api/auth.js` -- Primary consumer that calls saveSections after API fetch

### Secondary (MEDIUM confidence)
- MDN IndexedDB documentation -- `deleteObjectStore`/`createObjectStore` only allowed during versionchange transaction
- `idb` library behavior -- transaction atomicity (rollback on uncaught error)

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns exist in codebase
- Architecture: HIGH -- derived from existing member normalization pattern and actual code analysis
- Pitfalls: HIGH -- identified from concrete code paths and IndexedDB behavior
- Store migration: HIGH -- IndexedDB upgrade mechanism is well-understood, v5 block already exists

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable domain, no fast-moving dependencies)
