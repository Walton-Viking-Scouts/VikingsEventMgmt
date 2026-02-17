---
phase: 07-cleanup-consolidation
plan: 04
subsystem: database
tags: [indexeddb, localstorage, cache-cleanup, attendance, tests]

requires:
  - phase: 04-attendance-normalization
    provides: "Normalized attendance in IndexedDB via DatabaseService"
  - phase: 07-01
    provides: "Initial UnifiedStorageService removal patterns"
  - phase: 07-02
    provides: "Events/Dashboard/Assignment UnifiedStorageService removal"
provides:
  - "attendanceDataService with no legacy localStorage scan"
  - "Simplified cacheCleanup handling only demo_ localStorage keys"
  - "Test files mocking DatabaseService instead of UnifiedStorageService"
affects: [07-05]

tech-stack:
  added: []
  patterns:
    - "cacheCleanup only manages demo_ prefix localStorage keys; non-demo data managed by IndexedDB"

key-files:
  created: []
  modified:
    - src/shared/services/data/attendanceDataService.js
    - src/shared/utils/cacheCleanup.js
    - src/shared/services/data/__tests__/attendanceDataService.test.js
    - src/shared/utils/__tests__/eventDashboardHelpers.test.js

key-decisions:
  - "Removed getCachedEvents localStorage fallback entirely rather than keeping as degraded path"
  - "Removed checkForDemoData helper since non-demo viking_* keys no longer exist in localStorage"
  - "Deleted addTestData.js since localStorage migration test data is no longer relevant"

patterns-established:
  - "cacheCleanup is demo-only: only removes demo_ prefix keys from localStorage"

duration: 3min
completed: 2026-02-17
---

# Phase 7 Plan 4: Attendance/Cache Legacy Cleanup Summary

**Removed getCachedEvents localStorage scanner, simplified cacheCleanup to demo-only, and updated test mocks from UnifiedStorageService to DatabaseService**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T10:23:40Z
- **Completed:** 2026-02-17T10:26:52Z
- **Tasks:** 2
- **Files modified:** 4 (+ 1 deleted)

## Accomplishments
- Removed legacy getCachedEvents() localStorage scan from attendanceDataService; getCachedEventsOptimized() now returns empty array on error instead of falling back to localStorage
- Simplified cacheCleanup.js from 224 lines to 48 lines: removed viking_events/attendance/shared localStorage scan and checkForDemoData helper (non-demo data lives in IndexedDB)
- Updated eventDashboardHelpers tests to mock databaseService.getSharedEventMetadata instead of UnifiedStorageService.get
- Deleted obsolete addTestData.js script (wrote localStorage migration test data no longer needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove getCachedEvents legacy scan and update cacheCleanup.js** - `872056a` (feat)
2. **Task 2: Update test files and addTestData.js** - `9e09d83` (feat)

## Files Created/Modified
- `src/shared/services/data/attendanceDataService.js` - Removed getCachedEvents() and localStorage fallback
- `src/shared/utils/cacheCleanup.js` - Simplified to demo-only localStorage cleanup
- `src/shared/services/data/__tests__/attendanceDataService.test.js` - Removed getCachedEvents test and localStorage.clear()
- `src/shared/utils/__tests__/eventDashboardHelpers.test.js` - Replaced UnifiedStorageService mock with DatabaseService mock
- `src/scripts/addTestData.js` - Deleted (obsolete migration test data script)

## Decisions Made
- Removed getCachedEvents entirely rather than keeping as degraded path -- IndexedDB is the sole data source now
- Removed checkForDemoData recursive helper since the only localStorage scan remaining is for demo_ prefix keys (simple string check)
- Deleted addTestData.js rather than converting to IndexedDB -- test data can be loaded via demo mode

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Two pre-existing test failures exist (DB version 7 vs 8 mismatch in indexedDBService.test.js and objectStoreVerification.test.js). These are unrelated to this plan's changes and documented in deferred-items.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All attendance and cache cleanup files now use IndexedDB exclusively (non-demo paths)
- Ready for 07-05 (final UnifiedStorageService removal verification)

## Self-Check: PASSED

- FOUND: src/shared/services/data/attendanceDataService.js
- FOUND: src/shared/utils/cacheCleanup.js
- CONFIRMED DELETED: src/scripts/addTestData.js
- FOUND: 872056a (Task 1 commit)
- FOUND: 9e09d83 (Task 2 commit)

---
*Phase: 07-cleanup-consolidation*
*Completed: 2026-02-17*
