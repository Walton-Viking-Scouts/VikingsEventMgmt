# Phase 7: Cleanup & Consolidation - Research

**Researched:** 2026-02-17
**Domain:** Legacy storage code removal, dead code elimination, storage service consolidation
**Confidence:** HIGH

## Summary

Phase 7 is a pure deletion/simplification phase. No new libraries or architectural patterns are needed. The work involves systematically removing old blob-storage code paths, the UnifiedStorageService routing layer, localStorage fallbacks, and ensuring all consumers read/write through DatabaseService and the normalized IndexedDB stores built in Phases 2-6.

The codebase has 13 files importing UnifiedStorageService, 8 files importing storageUtils (safeGetItem/safeSetItem), and extensive `viking_*_offline` key references across ~15 files. The cleanup is straightforward but requires careful sequencing: consumer files must be updated before the routing layer is removed.

**Primary recommendation:** Work in 5 plans: (1) Remove UnifiedStorageService from consumer files, routing reads/writes through DatabaseService; (2) Remove blob key references from auth.js and useSignInOut.js; (3) Clean up demoMode.js and demo-related localStorage patterns; (4) Delete UnifiedStorageService, strip storageUtils of data functions, remove legacy database.js web-storage methods; (5) Clean up test files, addTestData.js, cacheCleanup.js, and documentation.

## Standard Stack

### Core
No new libraries needed. This phase only removes code.

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| N/A | N/A | No new dependencies | Removal-only phase |

### What Gets Removed
| Item | Location | Why |
|------|----------|-----|
| `UnifiedStorageService` class | `src/shared/services/storage/unifiedStorageService.js` | Entire file - blob routing layer replaced by normalized stores |
| `safeGetItem` / `safeSetItem` for data | `src/shared/utils/storageUtils.js` | Data functions no longer needed; session/UI functions may remain |
| `safeCacheWithLogging` | `src/shared/utils/storageUtils.js` | localStorage caching utility no longer needed |
| `_getWebStorageEvents` / `_saveWebStorageEvents` | `src/shared/services/storage/database.js` | Legacy web-storage methods using UnifiedStorageService |
| `_getWebStorageSections` | `src/shared/services/storage/database.js` | Legacy web-storage method |
| `getCachedEvents` (localStorage scan) | `src/shared/services/data/attendanceDataService.js` | Legacy localStorage scan for events |
| `checkForCachedData` (localStorage scan) | `src/features/auth/services/auth.js` | Legacy localStorage check |

## Architecture Patterns

### Pattern 1: Replace UnifiedStorageService.get/set with DatabaseService calls
**What:** Every file that currently imports UnifiedStorageService should switch to DatabaseService
**When to use:** All consumer files

**Current (remove):**
```javascript
import UnifiedStorageService from '../storage/unifiedStorageService.js';
const sections = await UnifiedStorageService.getSections();
await UnifiedStorageService.setLastSync(timestamp);
```

**New (already exists in codebase):**
```javascript
import databaseService from '../storage/database.js';
const sections = await databaseService.getSections();
// For last sync: use IndexedDBService directly or DatabaseService method
```

### Pattern 2: Demo mode reads remain in localStorage
**What:** Per prior decision [04-03], demo mode shared metadata reads still use localStorage/safeGetItem. Demo mode data is NOT migrated to normalized stores.
**When to use:** Demo mode code paths in demoMode.js, and demo-prefixed key reads in API files
**Key insight:** Demo mode (`demo_viking_*` keys) uses localStorage exclusively. These are NOT part of the `viking_*_offline` cleanup. Demo data initialization in demoMode.js writes to localStorage via safeSetItem -- this is intentional and stays.

### Pattern 3: Legitimate localStorage usage (DO NOT REMOVE)
**What:** Several keys legitimately use localStorage and must be preserved:
- `viking_current_view` - AppStateContext UI state
- `viking_navigation_data` - AppStateContext navigation
- `viking_last_sync_time` - AppStateContext sync display
- `user_preferences` - SectionMovementTracker preferences
- `eventAttendance_sectionFilters` - EventAttendance UI filters
- Session/auth tokens in sessionStorage
- All `demo_viking_*` keys (demo mode data in localStorage)

### Anti-Patterns to Avoid
- **Removing demo mode localStorage:** Demo mode intentionally uses localStorage. Do NOT migrate demo data to IndexedDB.
- **Breaking auth token storage:** Auth/token storage in sessionStorage is out of scope. The requirement explicitly excludes "auth/token storage."
- **Removing storageUtils entirely:** `safeGetSessionItem`, `safeSetSessionItem`, and potentially `safeGetItem`/`safeSetItem` are still used for legitimate non-data purposes (demo mode, UI state). Only remove data-oriented usage.
- **Removing cache_data and startup_data IndexedDB stores:** These stores are in the UNCHANGED_STORES list and remain valid.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| N/A | N/A | N/A | This is a deletion phase, not a construction phase |

**Key insight:** Phase 7 is purely subtractive. The normalized stores and DatabaseService methods already exist from Phases 2-6. The only work is removing the old paths.

## Common Pitfalls

### Pitfall 1: Missing a consumer file
**What goes wrong:** An import of UnifiedStorageService is left behind, causing runtime errors after the file is deleted.
**Why it happens:** The file has 13 direct importers plus dynamic imports.
**How to avoid:** Use grep for ALL occurrences: `import.*UnifiedStorageService`, `from.*unifiedStorageService`, and dynamic `import('.*unifiedStorageService')`.
**Warning signs:** Build errors or runtime crashes referencing unifiedStorageService.js

### Pitfall 2: Breaking the offline data check in auth.js
**What goes wrong:** `checkForCachedData()` in auth.js directly scans localStorage keys. After cleanup, it finds nothing and forces full logout instead of enabling offline mode.
**Why it happens:** The function uses `localStorage.getItem()` and `Object.keys(localStorage)` to look for `viking_*` keys.
**How to avoid:** Replace with IndexedDB-based check via DatabaseService (e.g., `databaseService.getSections().length > 0`).
**Warning signs:** Users get logged out when going offline instead of seeing cached data.

### Pitfall 3: Breaking the logout() function in auth.js
**What goes wrong:** `logout()` clears localStorage keys using `viking_*` patterns. After migration, data lives in IndexedDB but old cleanup code only clears localStorage.
**Why it happens:** The logout function was written for localStorage-era storage.
**How to avoid:** Replace with IndexedDB clear via `IndexedDBService.clear()` for relevant stores, similar to DataClearPage.jsx which already does this correctly.
**Warning signs:** Data persists after logout.

### Pitfall 4: Demo mode regression
**What goes wrong:** Demo mode stops working because demoMode.js initialization writes to localStorage with `safeSetItem`, and demo reads in API files use `safeGetItem`.
**Why it happens:** Over-aggressive cleanup removes demo-mode localStorage paths.
**How to avoid:** Demo mode paths are intentionally localStorage-based. Only clean up non-demo `viking_*_offline` key references. Keep all `demo_viking_*` paths intact.
**Warning signs:** Demo mode shows empty data or errors.

### Pitfall 5: Shared event metadata key pattern mismatch
**What goes wrong:** `eventsService.js` writes `viking_shared_metadata_*` via UnifiedStorageService (routed to IndexedDB). After removing UnifiedStorageService, the write path must go directly to IndexedDB.
**Why it happens:** The shared_metadata pattern is already routed to the SHARED_ATTENDANCE store in UnifiedStorageService, but the key format differs from the normalized store (which uses `eventid` as keyPath).
**How to avoid:** Ensure eventsService.js writes shared metadata via `databaseService.saveSharedEventMetadata()` (which already exists and was built in Phase 4).
**Warning signs:** Shared event detection stops working.

## Code Examples

### Example 1: Replacing UnifiedStorageService.getLastSync in useAuth.jsx
```javascript
// BEFORE (remove):
import { UnifiedStorageService } from '../../../shared/services/storage/unifiedStorageService.js';
const lastSync = await UnifiedStorageService.getLastSync();
await UnifiedStorageService.setLastSync(syncTime);

// AFTER (use IndexedDB directly):
import IndexedDBService from '../../../shared/services/storage/indexedDBService.js';
const lastSync = await IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, 'viking_last_sync');
// Or add a getLastSync/setLastSync to DatabaseService
```

### Example 2: Replacing shared metadata write in eventsService.js
```javascript
// BEFORE (remove):
const metadataKey = `viking_shared_metadata_${eventInstance.eventid}`;
await UnifiedStorageService.set(metadataKey, sharedMetadata);

// AFTER (use existing DatabaseService method):
await databaseService.saveSharedEventMetadata(sharedMetadata);
```

### Example 3: Replacing checkForCachedData in auth.js
```javascript
// BEFORE (remove - scans localStorage):
function checkForCachedData() {
  const sectionsKey = demoMode ? 'demo_viking_sections_offline' : 'viking_sections_offline';
  const cachedSections = localStorage.getItem(sectionsKey);
  ...
}

// AFTER:
async function checkForCachedData() {
  const demoMode = isDemoMode();
  if (demoMode) {
    // Demo still uses localStorage
    return !!localStorage.getItem('demo_viking_sections_offline');
  }
  const sections = await databaseService.getSections();
  return sections && sections.length > 0;
}
```

### Example 4: Replacing logout() localStorage cleanup
```javascript
// BEFORE (remove - clears localStorage keys):
localStorage.removeItem(sectionsKey);
localStorage.removeItem(startupKey);
Object.keys(localStorage).forEach(key => { ... });

// AFTER:
import IndexedDBService from '../../../shared/services/storage/indexedDBService.js';
const storeNames = Object.values(IndexedDBService.STORES);
await Promise.allSettled(storeNames.map(s => IndexedDBService.clear(s)));
// Demo mode keys: still clear from localStorage if needed
```

## Comprehensive File Inventory

### Files that import UnifiedStorageService (13 files - all must be updated or have import removed)

| File | Usage | Action |
|------|-------|--------|
| `src/shared/services/storage/database.js` | `_getWebStorageSections`, `_getWebStorageEvents`, `_saveWebStorageEvents` | Remove these legacy methods; getSections/getEvents already have IndexedDB paths |
| `src/shared/services/api/api/auth.js` | `get`/`set` for `viking_startup_data_offline` | Replace with `databaseService` calls |
| `src/shared/hooks/useSignInOut.js` | `get` for `viking_startup_data_offline`, `viking_sections_offline` | Replace with `databaseService` calls |
| `src/features/auth/hooks/useAuth.jsx` | `getLastSync`, `setLastSync` | Replace with IndexedDB/DatabaseService calls |
| `src/features/events/components/EventDashboard.jsx` | `getLastSync` | Replace with IndexedDB/DatabaseService calls |
| `src/shared/services/data/eventsService.js` | `set` for `viking_shared_metadata_*` | Replace with `databaseService.saveSharedEventMetadata()` |
| `src/features/movements/components/AssignmentInterface.jsx` | `get`/`set`/`remove` for draft keys | Replace with IndexedDB or keep as localStorage (draft keys are not `viking_*_offline`) |
| `src/shared/utils/eventDashboardHelpers.js` | Dynamic import for `viking_shared_attendance_*` | Replace with `databaseService.getSharedEventMetadata()` or remove |
| `src/shared/utils/__tests__/eventDashboardHelpers.test.js` | Test mock | Update mock to match new import |
| `src/features/auth/services/auth.js` (dynamic import) | `getUserInfo` uses dynamic import | Replace with databaseService |
| `src/shared/services/storage/currentActiveTermsSchema.md` | Documentation only | Update or remove references |
| `src/shared/services/storage/IMPLEMENTATION_SUMMARY.md` | Documentation only | Update or remove references |

### Files with `viking_*_offline` key string literals (beyond UnifiedStorageService)

| File | Keys Referenced | Action |
|------|----------------|--------|
| `src/config/demoMode.js` | `demo_viking_*_offline` | KEEP - demo mode is intentionally localStorage |
| `src/features/auth/services/auth.js` | `viking_sections_offline`, `viking_startup_data_offline`, `viking_events_*`, etc. | Replace with DatabaseService/IndexedDB calls |
| `src/shared/hooks/useSignInOut.js` | `viking_startup_data_offline`, `viking_sections_offline` | Replace with DatabaseService calls |
| `src/shared/services/api/api/events.js` | `demo_viking_events_*`, `demo_viking_attendance_*`, `demo_viking_shared_attendance_*` | KEEP demo paths; remove non-demo references if any |
| `src/shared/services/api/api/auth.js` | `viking_startup_data_offline`, `demo_viking_startup_data_offline`, `demo_viking_user_roles_offline` | Replace non-demo with DatabaseService; keep demo paths |
| `src/features/events/hooks/useSharedAttendance.js` | `demo_viking_shared_attendance_*` | KEEP - demo mode path |
| `src/shared/services/data/attendanceDataService.js` | `getCachedEvents()` scans localStorage for `viking_events_*_offline` | Remove legacy method; use DatabaseService |
| `src/shared/utils/cacheCleanup.js` | Scans localStorage for `viking_events_*`, `viking_attendance_*`, `viking_shared_*` | Update to also clear IndexedDB stores |
| `src/scripts/addTestData.js` | Various `viking_*` localStorage.setItem calls | Remove or update - this is a dev testing script |
| `src/shared/services/storage/indexedDBService.js` | Migration cleanup regex patterns | KEEP - these are upgrade migration handlers |

### Files with direct localStorage usage for data (excluding UI/auth)

| File | Usage | Action |
|------|-------|--------|
| `src/features/auth/services/auth.js` | `checkForCachedData()`, `logout()` | Replace with IndexedDB-based checks |
| `src/shared/services/data/attendanceDataService.js` | `getCachedEvents()` | Remove legacy localStorage scan |
| `src/shared/utils/cacheCleanup.js` | `cleanupDemoCache()` | Update to handle IndexedDB cleanup too |
| `src/shared/services/data/__tests__/attendanceDataService.test.js` | Sets `viking_events_*` in localStorage | Update test to use IndexedDB mocks |

### Files with legitimate localStorage usage (DO NOT CHANGE)

| File | Usage | Reason |
|------|-------|--------|
| `src/shared/contexts/app/AppStateContext.tsx` | `viking_current_view`, `viking_navigation_data`, `viking_last_sync_time` | UI state persistence - not data storage |
| `src/features/movements/components/SectionMovementTracker.jsx` | `user_preferences` | UI preferences |
| `src/features/events/components/attendance/EventAttendance.jsx` | `eventAttendance_sectionFilters` | UI filter persistence |
| `src/config/demoMode.js` | All `demo_viking_*` writes via `safeSetItem` | Demo mode intentionally uses localStorage |
| `src/shared/services/api/api/events.js` | Demo mode reads via `safeGetItem` | Demo mode reads |
| `src/features/events/hooks/useSharedAttendance.js` | Demo mode reads via `safeGetItem` | Demo mode reads |
| `src/test/setup.js` | Test setup localStorage mock | Test infrastructure |

### clearFlexiRecordCaches no-ops (deferred from Phase 6)

| File | Function | Action |
|------|----------|--------|
| `src/shared/services/api/api/base.js` | `clearFlexiRecordCaches()` - returns `{ clearedLocalStorageKeys: 0 }` | Either implement proper IndexedDB clearing or remove entirely |
| `src/features/events/services/flexiRecordService.js` | `clearFlexiRecordCaches()` - logs and returns `{ cleared: true }` | Either implement proper clearing or remove entirely |

## AssignmentInterface.jsx Special Case

AssignmentInterface uses UnifiedStorageService for draft assignment data with keys like `assignment_draft_*`. These are NOT `viking_*_offline` keys. Since UnifiedStorageService is being deleted, these need a new storage path. Options:
1. Use IndexedDB directly via IndexedDBService (store in cache_data store)
2. Use localStorage directly (drafts are small, temporary data)

**Recommendation:** Use localStorage directly for drafts - they are small, temporary, and don't need IndexedDB's capabilities.

## Suggested Plan Sequencing

### Plan 07-01: Update consumer files - auth & sign-in paths
- `src/features/auth/services/auth.js` - Replace UnifiedStorageService imports, fix `checkForCachedData()`, fix `logout()`, fix `getUserInfo()`
- `src/shared/hooks/useSignInOut.js` - Replace UnifiedStorageService usage
- `src/shared/services/api/api/auth.js` - Replace non-demo UnifiedStorageService usage

### Plan 07-02: Update consumer files - events & dashboard paths
- `src/features/auth/hooks/useAuth.jsx` - Replace `getLastSync`/`setLastSync`
- `src/features/events/components/EventDashboard.jsx` - Replace `getLastSync`
- `src/shared/services/data/eventsService.js` - Replace shared metadata write
- `src/shared/utils/eventDashboardHelpers.js` - Replace shared attendance read
- `src/features/movements/components/AssignmentInterface.jsx` - Replace with localStorage for drafts

### Plan 07-03: Remove UnifiedStorageService and legacy database methods
- Delete `src/shared/services/storage/unifiedStorageService.js`
- Remove `_getWebStorageSections`, `_getWebStorageEvents`, `_saveWebStorageEvents` from `database.js`
- Remove UnifiedStorageService import from `database.js`
- Clean up `storageUtils.js` - remove `safeCacheWithLogging` if no longer used
- Implement or remove `clearFlexiRecordCaches` no-ops

### Plan 07-04: Clean up attendanceDataService, cacheCleanup, auth.js logout, tests
- Remove `getCachedEvents()` legacy localStorage scan from `attendanceDataService.js`
- Update `cacheCleanup.js` to work with IndexedDB
- Update `attendanceDataService.test.js` to not use localStorage for `viking_*_offline` keys
- Remove or update `scripts/addTestData.js`
- Update documentation files (IMPLEMENTATION_SUMMARY.md, currentActiveTermsSchema.md)

### Plan 07-05: Final verification sweep
- Grep for any remaining `viking_*_offline` references (excluding demo and docs)
- Grep for any remaining `UnifiedStorageService` references
- Grep for any remaining `safeGetItem`/`safeSetItem` used for data (not demo/UI)
- Run full test suite
- Run build verification

## Open Questions

1. **AssignmentInterface draft storage**
   - What we know: It uses UnifiedStorageService for `assignment_draft_*` keys (not `viking_*_offline`)
   - What's unclear: Whether drafts should use localStorage or IndexedDB
   - Recommendation: Use localStorage directly - drafts are small and temporary

2. **storageUtils.js fate**
   - What we know: `safeGetItem`/`safeSetItem` are used for demo mode reads in 3+ files, and `safeGetSessionItem`/`safeSetSessionItem` are used for auth
   - What's unclear: Whether to keep the file with only session and demo-related functions
   - Recommendation: Keep the file but remove `safeCacheWithLogging`; the safe* functions are still useful for demo mode and error-safe localStorage access

3. **cacheCleanup.js scope**
   - What we know: It scans localStorage for demo contamination
   - What's unclear: Whether it needs to also scan IndexedDB for demo data
   - Recommendation: Keep it focused on localStorage cleanup since demo data only lives in localStorage

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all 23 files using localStorage
- Direct codebase analysis of all 13 files importing UnifiedStorageService
- Prior phase decisions [01-01] through [06-05]
- IndexedDB schema definitions in `src/shared/services/storage/schemas/indexedDBSchema.js`

### Secondary (MEDIUM confidence)
- Phase 6 research and summaries for understanding normalized store structure

## Metadata

**Confidence breakdown:**
- File inventory: HIGH - exhaustive grep/glob of entire src directory
- Removal plan: HIGH - all consumer paths traced and documented
- Demo mode boundary: HIGH - prior decision [04-03] explicitly addresses this
- Edge cases (AssignmentInterface, storageUtils): MEDIUM - needs validation during implementation

**Research date:** 2026-02-17
**Valid until:** No expiration - this is codebase-specific analysis, not library research
