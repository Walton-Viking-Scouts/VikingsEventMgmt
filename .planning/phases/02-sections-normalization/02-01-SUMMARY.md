---
phase: 02-sections-normalization
plan: 01
subsystem: database
tags: [indexeddb, zod, sections, normalization, sqlite, fake-indexeddb]

requires:
  - phase: 01-infrastructure-schema
    provides: Zod schemas (SectionSchema, safeParseArray), IndexedDB v5 upgrade block, STORES constants

provides:
  - IndexedDBService.bulkReplaceSections for atomic section replacement
  - IndexedDBService.getAllSections for direct section reads
  - Normalized sections store keyed by sectionid with sectiontype index
  - DatabaseService.saveSections with Zod validation at write boundary
  - DatabaseService.getSections reading directly from IndexedDB (no UnifiedStorageService)
  - Proven normalization pattern (store migration, direct access, Zod validation, atomic bulk replace)

affects: [03-events-normalization, 04-attendance-normalization, 05-members-normalization, 06-flexi-normalization, 07-validation]

tech-stack:
  added: []
  patterns: [bulk-replace-clear-then-put, zod-validation-at-write-boundary, direct-indexeddb-access-bypass-unified]

key-files:
  created:
    - src/shared/services/storage/__tests__/sectionNormalization.test.js
  modified:
    - src/shared/services/storage/indexedDBService.js
    - src/shared/services/storage/database.js
    - src/shared/services/storage/__tests__/objectStoreVerification.test.js

key-decisions:
  - "Sections store uses clear+put in single transaction for atomic replacement (not merge/upsert)"
  - "Zod validation occurs at DatabaseService write boundary, not in IndexedDBService layer"
  - "Demo mode filtering stays in getSections (DatabaseService), not in IndexedDBService.getAllSections"

patterns-established:
  - "Bulk replace pattern: open readwrite tx, store.clear(), loop store.put(), tx.done"
  - "Write boundary validation: safeParseArray(Schema, data) then pass validData to IndexedDB"
  - "Direct IndexedDB access: DatabaseService calls IndexedDBService static methods, not UnifiedStorageService"

duration: 5min
completed: 2026-02-15
---

# Phase 02 Plan 01: Sections Normalization Summary

**Normalized sections from blob-in-a-key to individual records keyed by sectionid with Zod validation at write boundary and atomic bulk replacement**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-15T22:59:43Z
- **Completed:** 2026-02-15T23:04:47Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Sections stored as individual IndexedDB records keyed by sectionid with sectiontype index
- saveSections validates with Zod, writes via IndexedDBService.bulkReplaceSections (web) or transactional DELETE+INSERT (SQLite)
- getSections reads directly from IndexedDB with demo mode filtering, bypassing UnifiedStorageService
- 5 integration tests verify normalized CRUD behavior using fake-indexeddb

## Task Commits

Each task was committed atomically:

1. **Task 1: IndexedDB store migration and new section methods** - `17084e2` (feat)
2. **Task 2: DatabaseService saveSections/getSections bypass UnifiedStorageService** - `d98c78a` (feat)
3. **Task 3: Integration tests for sections normalization** - `b6603ac` (test)

## Files Created/Modified
- `src/shared/services/storage/indexedDBService.js` - v5 upgrade deletes+recreates sections store with keyPath:'sectionid'; added bulkReplaceSections and getAllSections static methods
- `src/shared/services/storage/database.js` - saveSections uses Zod+IndexedDBService (web) and transactional SQL (native); getSections reads from IndexedDB directly
- `src/shared/services/storage/__tests__/sectionNormalization.test.js` - 5 integration tests covering storage, replacement, clearing, empty state, and index queries
- `src/shared/services/storage/__tests__/objectStoreVerification.test.js` - Added deleteObjectStore to mock DB for v5 upgrade compatibility

## Decisions Made
- Sections store uses clear+put in single transaction for atomic replacement (not merge/upsert) -- simplest correct approach for full-dataset sync
- Zod validation occurs at DatabaseService write boundary, not in IndexedDBService layer -- keeps IndexedDBService generic
- Demo mode filtering stays in getSections (DatabaseService), not in IndexedDBService.getAllSections -- keeps filtering logic at the service layer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed objectStoreVerification test mock missing deleteObjectStore**
- **Found during:** Task 1 (IndexedDB store migration)
- **Issue:** The v5 upgrade block now calls db.deleteObjectStore() to replace the sections store, but the mock DB in objectStoreVerification.test.js lacked this method, causing the upgrade callback to throw silently
- **Fix:** Added deleteObjectStore method to the mock DB that removes the store from the _stores Map
- **Files modified:** src/shared/services/storage/__tests__/objectStoreVerification.test.js
- **Verification:** All tests pass (380 tests before new tests, 385 after)
- **Committed in:** 17084e2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix to maintain test compatibility with v5 upgrade changes. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Normalization pattern proven end-to-end: store migration, direct IndexedDB access, Zod validation, atomic bulk replace
- Phases 3-6 can follow this exact pattern for events, attendance, members, and flexi records
- UnifiedStorageService still used by other data types (events, attendance, hasOfflineData) -- those will be migrated in their respective phases

---
*Phase: 02-sections-normalization*
*Completed: 2026-02-15*
