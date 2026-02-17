---
phase: 07-cleanup-consolidation
plan: 02
subsystem: database
tags: [indexeddb, localstorage, storage-migration, unified-storage-removal]

requires:
  - phase: 04-attendance-normalization
    provides: DatabaseService.saveSharedEventMetadata() and getSharedEventMetadata() methods
  - phase: 01-infrastructure-schema
    provides: IndexedDB cache_data store with key-based access

provides:
  - Five event/dashboard/assignment files with zero UnifiedStorageService imports
  - lastSync read/write via IndexedDB cache_data store (viking_last_sync key)
  - Shared metadata writes through databaseService.saveSharedEventMetadata()
  - Draft assignment storage via localStorage directly

affects: [07-cleanup-consolidation]

tech-stack:
  added: []
  patterns: [IndexedDB cache_data for sync timestamps, localStorage for draft UI state]

key-files:
  created: []
  modified:
    - src/features/auth/hooks/useAuth.jsx
    - src/features/events/components/EventDashboard.jsx
    - src/shared/services/data/eventsService.js
    - src/shared/utils/eventDashboardHelpers.js
    - src/features/movements/components/AssignmentInterface.jsx

key-decisions:
  - "lastSync uses IndexedDB cache_data store with key viking_last_sync (not localStorage)"
  - "AssignmentInterface drafts use localStorage directly with try-catch (matching storageUtils pattern)"
  - "Shared event metadata writes use databaseService.saveSharedEventMetadata() with eventid injected"

patterns-established:
  - "IndexedDB cache_data for sync timestamps: put({key, timestamp}) / get().timestamp"
  - "localStorage for ephemeral UI draft data (assignment_draft_* keys)"

duration: 3min
completed: 2026-02-17
---

# Phase 7 Plan 02: Events/Dashboard/Assignment UnifiedStorageService Removal Summary

**Replaced all UnifiedStorageService usage in five event/dashboard/assignment files with IndexedDB cache_data, DatabaseService, and localStorage calls**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T10:18:27Z
- **Completed:** 2026-02-17T10:21:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- useAuth.jsx and EventDashboard.jsx now read/write lastSync via IndexedDB cache_data store
- eventsService.js shared metadata writes go through databaseService.saveSharedEventMetadata()
- eventDashboardHelpers.js reads shared attendance via databaseService.getSharedEventMetadata()
- AssignmentInterface.jsx uses localStorage directly for draft data with try-catch resilience
- Zero UnifiedStorageService imports remain across all five files

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace UnifiedStorageService in useAuth.jsx, EventDashboard.jsx, and eventsService.js** - `a1466eb` (feat)
2. **Task 2: Replace UnifiedStorageService in eventDashboardHelpers.js and AssignmentInterface.jsx** - `f8528c9` (feat)

## Files Created/Modified
- `src/features/auth/hooks/useAuth.jsx` - lastSync read/write via IndexedDBService.get/put on cache_data store
- `src/features/events/components/EventDashboard.jsx` - lastSync read via IndexedDBService.get on cache_data store
- `src/shared/services/data/eventsService.js` - shared metadata write via databaseService.saveSharedEventMetadata()
- `src/shared/utils/eventDashboardHelpers.js` - shared attendance read via databaseService.getSharedEventMetadata()
- `src/features/movements/components/AssignmentInterface.jsx` - draft storage via localStorage get/set/removeItem

## Decisions Made
- lastSync uses IndexedDB cache_data store with key `viking_last_sync` storing `{key, timestamp}` objects -- consistent with Phase 1 cache_data store design
- AssignmentInterface drafts use localStorage directly since draft keys (`viking_assignment_draft_*`) are ephemeral UI state per research recommendation
- Shared event metadata now includes `eventid` field injected at the databaseService boundary (required by SharedEventMetadataSchema keyPath)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Five event/dashboard/assignment consumer files fully migrated off UnifiedStorageService
- Ready for remaining Phase 7 plans to continue UnifiedStorageService removal from other consumers
- Pre-existing test failures (objectStoreVerification checking DB version 7 vs actual 8) are unrelated

---
*Phase: 07-cleanup-consolidation*
*Completed: 2026-02-17*
