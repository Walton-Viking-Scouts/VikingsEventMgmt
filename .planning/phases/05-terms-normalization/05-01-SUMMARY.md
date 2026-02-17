---
phase: 05-terms-normalization
plan: 01
subsystem: database
tags: [indexeddb, zod, terms, schema-migration]

requires:
  - phase: 01-infrastructure-schema
    provides: Zod validation framework, IndexedDB versioned upgrade pattern, STORES constants
provides:
  - IndexedDB v7 upgrade block for normalized terms store (keyPath termid, indexes sectionid + startdate)
  - bulkReplaceTermsForSection cursor-based section-scoped atomic replacement
  - getTermsBySection index query with read-path resilience
  - getTermById direct lookup returning null on error
  - getAllTerms full scan returning empty array on error
  - TermSchema.sectionid required with Number transform
affects: [05-terms-normalization, database-service-terms-consumer]

tech-stack:
  added: []
  patterns:
    - "Terms follow events cursor-based section-scoped replacement pattern"
    - "Read methods return fallback (empty array/null) on error; write methods rethrow"

key-files:
  created: []
  modified:
    - src/shared/services/storage/indexedDBService.js
    - src/shared/services/storage/schemas/validation.js
    - src/shared/services/storage/__tests__/indexedDBService.test.js
    - src/shared/services/storage/__tests__/objectStoreVerification.test.js

key-decisions:
  - "TermSchema.sectionid made required (not optional) with .transform(Number) -- injected at write boundary"
  - "Terms CRUD read methods return fallback values on error (read-path resilience), matching attendance pattern"

patterns-established:
  - "v7 upgrade block: delete-then-recreate terms store with termid keyPath and sectionid/startdate indexes"

duration: 5min
completed: 2026-02-16
---

# Phase 05 Plan 01: Terms Store and Schema Summary

**IndexedDB v7 normalized terms store with keyPath termid, sectionid/startdate indexes, and four CRUD methods following events cursor-based pattern**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-16T20:53:47Z
- **Completed:** 2026-02-16T20:58:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- IndexedDB upgraded to v7 with normalized terms store (keyPath termid, indexes on sectionid and startdate)
- TermSchema.sectionid changed from optional union to required with Number transform
- Four CRUD methods added: bulkReplaceTermsForSection, getTermsBySection, getTermById, getAllTerms
- All 399 tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: TermSchema fix and IndexedDB v7 upgrade** - `7624d24` (feat)
2. **Task 2: IndexedDB terms CRUD methods** - `a26b603` (feat)

## Files Created/Modified
- `src/shared/services/storage/indexedDBService.js` - v7 upgrade block + four terms CRUD methods
- `src/shared/services/storage/schemas/validation.js` - TermSchema.sectionid required with Number transform
- `src/shared/services/storage/__tests__/indexedDBService.test.js` - Updated DATABASE_VERSION assertion to 7
- `src/shared/services/storage/__tests__/objectStoreVerification.test.js` - Updated DATABASE_VERSION assertion to 7

## Decisions Made
- TermSchema.sectionid made required (not optional) with `.transform(Number)` -- sectionid is always injected at write boundary before validation, so making it required catches bugs where injection was missed
- Terms CRUD read methods return fallback values on error (empty array/null) matching the read-path resilience pattern from Phase 4 attendance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test assertions for DATABASE_VERSION 7**
- **Found during:** Task 2 (verification step)
- **Issue:** Two test files had hardcoded DATABASE_VERSION = 6 assertions that failed after version bump
- **Fix:** Updated version assertions from 6 to 7 in both test files
- **Files modified:** src/shared/services/storage/__tests__/indexedDBService.test.js, src/shared/services/storage/__tests__/objectStoreVerification.test.js
- **Verification:** All 399 tests pass
- **Committed in:** a26b603 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test fix necessary for correctness after version bump. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Terms store layer complete, ready for Plan 02 (DatabaseService consumer methods)
- All patterns consistent with events (Phase 3) and attendance (Phase 4)

---
*Phase: 05-terms-normalization*
*Completed: 2026-02-16*
