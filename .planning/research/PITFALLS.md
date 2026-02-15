# Pitfalls Research

**Domain:** IndexedDB/SQLite storage normalization in hybrid Capacitor app (blob-to-record migration)
**Researched:** 2026-02-15
**Confidence:** HIGH (based on codebase analysis + documented community issues + prior members normalization experience)

## Critical Pitfalls

### Pitfall 1: IndexedDB Version Bump Fails Mid-Upgrade, Losing All Stores

**What goes wrong:**
The IndexedDB `onupgradeneeded` handler runs inside a single `versionchange` transaction. If any store creation or data migration throws an error, the entire transaction aborts and **all schema changes are reverted** -- including stores that were successfully created earlier in the same upgrade. The database reverts to the previous version, but old blob keys may have already been deleted by cleanup code that ran outside the transaction. Result: data loss with no schema to write to.

**Why it happens:**
The current `indexedDBService.js` creates 12+ stores in a single upgrade handler (lines 39-124). Adding new stores for normalized data types (events, attendance, flexi records) increases the surface area for failure. If any single `createObjectStore` or `createIndex` call fails (e.g., duplicate store name from a partial previous upgrade on Safari), the entire upgrade rolls back. Developers assume each `if (!db.objectStoreNames.contains(...))` guard is sufficient, but the guard does not protect against index creation failures on an existing store.

**How to avoid:**
- Never delete old blob keys in the same transaction or code path as schema creation. Blob cleanup must be a separate, later phase that only runs after confirming the new stores exist and contain migrated data.
- Keep the upgrade handler minimal: only create stores and indexes. Never run data migration inside `onupgradeneeded`.
- Test the upgrade path from every previous version (currently version 4) to the new version, not just from a fresh database.
- Add explicit error logging inside the upgrade handler -- the current handler logs start/complete but does not catch per-store failures.

**Warning signs:**
- Users report "blank screen" or "no data" after app update (upgrade transaction silently aborted).
- IndexedDB database version is stuck at old number despite new code deploying.
- Safari-specific reports (Safari has stricter IndexedDB transaction behavior).

**Phase to address:**
Phase 1 (Schema setup) -- before any data migration runs. Schema changes must be bulletproof before migration logic is added.

---

### Pitfall 2: Dual-Write Inconsistency During Migration Window

**What goes wrong:**
During the transition period where both old blob storage and new normalized stores coexist, writes go to the new store but reads still fall back to the old blob (or vice versa). The `UnifiedStorageService` routing in `unifiedStorageService.js` (lines 107-141) uses key-pattern matching to decide which store to use. If a service writes to the new normalized store via `FlexiRecordDataService` but another service reads via `UnifiedStorageService.get('viking_flexi_lists_${sectionId}_offline')`, they hit different data. This is **already happening** -- Task 90 documents dual-write inconsistencies in the flexi system.

**Why it happens:**
Multiple code paths access the same logical data through different entry points:
- `FlexiRecordDataService` uses `databaseService.storageBackend.saveFlexiRecordLists()` (direct IndexedDB)
- `UnifiedStorageService` uses key-based routing to the same IndexedDB store but with different key formats
- Some components still call `UnifiedStorageService.get()` with old blob key patterns
- The `getStoreForKey()` routing (lines 143-195) maps old-format keys to new stores, creating an illusion of compatibility while the data format inside may have changed

**How to avoid:**
- Define a single "source of truth" service per data type before starting migration. For flexi records, that service is `FlexiRecordDataService`. All reads and writes for flexi data must go through it -- no backdoor access via `UnifiedStorageService`.
- Create a migration state flag per data type (e.g., `flexi_migration_complete: true` in IndexedDB metadata). Until the flag is set, the service reads from the old blob as fallback. After the flag is set, it reads only from normalized stores.
- Remove `UnifiedStorageService` convenience methods (`getEvents`, `setEvents`, `getMembers`, etc.) as each data type gets its own dedicated service. These methods are the primary source of backdoor access.

**Warning signs:**
- Data appears in the app after initial load but disappears after navigation (read from blob cache, but subsequent read hits empty normalized store).
- Sign-in data recorded but not visible in attendance view (written to new store, read from old blob key).
- `FlexiRecordDataService` logs show data stored successfully but UI shows stale data.

**Phase to address:**
Every normalization phase -- this is the single most common failure mode. Each data type phase must start by auditing all read/write paths for that data type.

---

### Pitfall 3: Demo Mode Database Divergence

**What goes wrong:**
The demo database (`vikings-eventmgmt-demo`) and production database (`vikings-eventmgmt`) must have identical schemas but the migration may only run against one of them. IndexedDB creates the demo database lazily (only when `isDemoMode()` returns true), so the upgrade handler may never fire for the demo database if the user hasn't toggled demo mode since the version bump. When they later switch to demo mode, the demo database is at the old version with old schema, causing store-not-found errors.

**Why it happens:**
`indexedDBService.js` line 6: `const getDatabaseName = () => isDemoMode() ? 'vikings-eventmgmt-demo' : 'vikings-eventmgmt'`. The `getDB()` function (line 28) opens whichever database matches the current mode. The upgrade handler fires per-database, not globally. Additionally, `database.js` (SQLite layer) has separate demo mode handling with dynamic imports of `isDemoMode` (lines 1264, 1305), creating a third possible code path.

**How to avoid:**
- After any schema version bump, proactively open both databases on app startup (even if not in demo mode) to trigger the upgrade handler on both.
- Alternatively, create a startup check: if the demo database exists but is at an older version, trigger a re-open to force the upgrade.
- Add an integration test that switches between demo and production mode and verifies both databases have identical store structures.

**Warning signs:**
- "Demo mode is broken" bug reports that only appear after a release that changed the schema.
- `objectStoreNames.contains()` returning false for stores that should exist -- but only in demo mode.
- Database version mismatch errors in Sentry tagged with demo mode context.

**Phase to address:**
Phase 1 (Schema setup) and verified in every subsequent phase. Add a demo-mode schema verification step to the deployment checklist.

---

### Pitfall 4: Silent localStorage Fallback Masks Broken Normalization

**What goes wrong:**
Both `UnifiedStorageService` and `DatabaseService` silently fall back to localStorage when IndexedDB or SQLite fails. `UnifiedStorageService.get()` (lines 7-34) catches IndexedDB errors and returns `safeGetItem(key)` from localStorage. `DatabaseService.initialize()` (lines 139-144) sets `this.isNative = false` on failure, silently routing all operations to localStorage. This means a broken normalization that crashes IndexedDB operations will appear to "work" -- the app loads, data appears -- but it is reading stale localStorage blobs from before the migration. Users see old data and assume the app is fine. New data written to localStorage is not synced back to IndexedDB when the issue is fixed.

**Why it happens:**
The fallback was designed for graceful degradation (private browsing, quota exceeded), but during a migration it actively hides failures. The app's offline-first philosophy prioritizes "show something" over "show correct data." The CONCERNS.md already documents that localStorage write errors are silently ignored (Security Considerations section).

**How to avoid:**
- During migration phases, add a temporary "migration health check" that verifies data exists in the expected normalized store (not just that it was readable from *somewhere*).
- Log a Sentry warning (not just debug) when localStorage fallback activates for keys that should be in IndexedDB. Current code logs at `warn` level but these may be filtered.
- After each normalization phase, run a verification pass that reads from the normalized store directly (bypassing `UnifiedStorageService` routing) and confirms data integrity.
- Consider making the localStorage fallback **read-only** for migrated data types. If IndexedDB write fails, do not silently write to localStorage -- surface the error.

**Warning signs:**
- Sentry shows `UnifiedStorage: IndexedDB get failed, falling back to localStorage` warnings increasing after deployment.
- Data freshness regresses -- users see data from before the migration.
- localStorage quota warnings appearing in production (data that should have moved to IndexedDB is still being written to localStorage).

**Phase to address:**
Must be addressed in Phase 1 (infrastructure) and enforced through every subsequent phase. The fallback behavior should be made configurable: "development" mode surfaces errors, "production" mode falls back but reports.

---

### Pitfall 5: Circular Dependencies in Data Service Layer Cause Import Deadlocks

**What goes wrong:**
Adding new normalized data services creates circular import chains. The existing architecture already has:
- `FlexiRecordDataService` imports `dataServiceOrchestrator`
- `dataServiceOrchestrator` imports `flexiRecordStructureService`
- `flexiRecordStructureService` uses `databaseService.storageBackend`
- `databaseService` imports `UnifiedStorageService` and `IndexedDBService`

When normalizing events and attendance, new services will need to reference each other (events need attendance counts, attendance needs event metadata). If service A imports service B at module level and service B imports service A, the second import resolves to an incomplete module object (partially initialized). Methods appear as `undefined`, causing runtime crashes that only manifest in specific import orders.

**Why it happens:**
The CONCERNS.md already documents circular dependencies as a known issue (RequireAuth disabled due to circular dependency). The data services layer is heading toward the same pattern: each new normalized service needs to coordinate with others through the orchestrator, but the orchestrator imports all services.

**How to avoid:**
- Use the existing `DataServiceOrchestrator` pattern with constructor injection (already implemented). New services must accept dependencies via constructor, never import sibling services directly.
- Enforce a strict dependency direction: API services -> Data services -> Storage services. Never import upward.
- Use lazy imports (`await import()`) for cross-service references that cannot be avoided.
- Add a dependency graph check to the lint step that flags circular imports in `src/shared/services/`.

**Warning signs:**
- `TypeError: X is not a function` or `Cannot read properties of undefined` errors on service methods that clearly exist in the source code.
- Errors that appear only in production builds (bundler resolves import order differently than dev server).
- Tests pass individually but fail when run together (import order dependency).

**Phase to address:**
Phase 1 (Architecture/infrastructure). Establish the service dependency graph before creating new services. Each normalization phase must follow the established pattern.

---

### Pitfall 6: Blob Key Cleanup Deletes Data Still Referenced by Running Code

**What goes wrong:**
After migrating data from blob keys (e.g., `viking_flexi_lists_${sectionId}_offline`) to normalized IndexedDB stores, the cleanup phase deletes the old blob keys. But if any component, hook, or service still reads from the old key (even as a fallback), deleting the key causes data loss for that component. The app partially works (components using new stores) and partially breaks (components still reading old keys).

**Why it happens:**
The codebase has 26+ files using `localStorage` directly and 29+ files referencing `UnifiedStorageService`. A grep for the old key pattern may miss dynamic key construction (e.g., template literals with variable section IDs). The `shouldUseIndexedDB()` routing in `UnifiedStorageService` uses regex matching (lines 130-136) which can match keys the developer did not consider.

**How to avoid:**
- Before deleting any blob key, add a "deprecated key access" warning that logs when any code reads the old key. Deploy this warning for at least one release cycle before deleting the key.
- Create an explicit migration manifest that lists every old key, every file that references it, and the new normalized equivalent. Verify every reference is updated before cleanup.
- Cleanup must be the absolute last step, in a separate PR from the normalization itself. Never combine "add new store + migrate data + delete old keys" in a single change.

**Warning signs:**
- Features that worked before the cleanup PR now show empty states.
- `safeGetItem` returning `null` for keys that previously had data.
- Users who did not get the migration (e.g., offline when migration ran, or opened the app briefly before migration completed) lose data permanently when blob keys are deleted.

**Phase to address:**
Dedicated cleanup phase (final phase). Must not be combined with any normalization phase. Should include a rollback plan.

---

### Pitfall 7: SQLite Stub Methods Throw Instead of Falling Back

**What goes wrong:**
`FlexiRecordDataService` has 5 SQLite methods (lines 396-419) that throw `Error` instead of implementing SQLite persistence. On native platforms (iOS/Android), any code path that reaches these methods crashes the operation entirely instead of falling back to IndexedDB. If the normalization adds new code paths that call these methods (e.g., a new `getFlexiRecordData` that checks `this.isNative` first), the native app crashes while the web app works fine.

**Why it happens:**
The methods were stubbed with `throw new Error('not yet implemented')` as TODO placeholders. The web-only IndexedDB methods below them (lines 421+) work correctly. During web-only development and testing, the bug is invisible because `this.isNative` is always false. The existing code already uses `databaseService.storageBackend` which routes to IndexedDB on web but would route to SQLite on native -- hitting the throwing stubs.

**How to avoid:**
- Before normalizing any data type, implement or remove all throwing stub methods for that data type. Do not leave `throw new Error` stubs in production code.
- If SQLite support is not planned for a data type, make the stubs return empty results with a warning log instead of throwing. This preserves the fallback chain.
- Add platform-specific test runs (or at minimum, mock `Capacitor.isNativePlatform()` to return `true` in some tests) to catch native-only failures.

**Warning signs:**
- Crash reports from iOS/Android TestFlight users that do not reproduce on web.
- Sentry errors with `Error: SQLite retrieval for FlexiRecord lists not yet implemented`.
- App works perfectly in browser but blank screens on mobile.

**Phase to address:**
Phase 1 (before any normalization). Either implement the SQLite methods or change them to graceful fallbacks.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `UnifiedStorageService` routing during migration | Backwards compatibility, lower risk per change | Permanent indirection layer, double the read paths, harder to debug | Acceptable only during active migration -- must be removed after all data types are normalized |
| localStorage fallback for IndexedDB failures | App never shows blank screen | Masks bugs, creates data consistency issues, wastes quota | Never acceptable for migrated data types -- only for genuinely optional cache data |
| Regex key matching in `getStoreForKey()` | Handles dynamic key patterns without listing every key | Fragile, hard to audit, silent misrouting if key format changes | Never -- replace with explicit key registry as each data type is normalized |
| Lazy demo database upgrade (only on demo mode toggle) | No unnecessary database operations | Schema divergence between demo and production databases | Never -- always upgrade both databases |
| Skipping SQLite implementation (web-only development) | Faster iteration on web | Native app is broken for any feature using the stubbed methods | Only acceptable if native builds are not being distributed; unacceptable once TestFlight/Play Store builds exist |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `idb` library upgrade handler | Running data migration inside `onupgradeneeded` (blocks other tabs from opening the DB) | Keep upgrade handler schema-only; run data migration in a separate async operation after the database is open |
| `@capacitor-community/sqlite` + IndexedDB coexistence | Assuming `DatabaseService.storageBackend` always points to IndexedDB on web | Verify `storageBackend` exists and is initialized before calling methods on it; the `storageBackend` property is dynamically set and may be undefined if initialization failed silently |
| Sentry error tracking during migration | Errors during migration flood Sentry with noise | Add a `migration` tag to all Sentry events during migration phases; create a Sentry alert rule that filters migration errors separately |
| OSM API data shape changes during normalization | Normalizing based on current API response shape, then API changes | Validate API response shape at the service boundary (already partially done in `fetchAndStoreFlexiRecordLists` line 82-84); add schema validation for all normalized store writes |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reading all records from normalized store to reconstruct what was previously a single blob read | Slower initial page load after normalization | Use IndexedDB indexes and `getAll()` with key ranges instead of iterating. Pre-aggregate views if needed. | At 500+ individual records per store (e.g., 500 flexi data items across sections) |
| N+1 reads replacing single blob parse | Each component that previously parsed one blob now makes separate IndexedDB reads for each record it needs | Batch reads using `getAll()` or cursor ranges. Cache the result set in memory for the duration of a render cycle. | At 50+ components reading from the same normalized store on a single page |
| IndexedDB transaction overhead per write during bulk migration | Migration of 1000 records taking 30+ seconds, blocking UI | Use a single readwrite transaction for bulk writes. The `idb` library's `tx.store.put()` inside a single transaction is significantly faster than individual `set()` calls. | At 200+ records in a single migration batch |
| Full store scan for demo mode filtering | After normalization, demo mode data mixed with production data if key prefix is the only differentiator | Use separate databases (already implemented: `vikings-eventmgmt-demo`). Do not mix demo and production records in the same store with key prefixes. | Immediate -- any mixing causes data leaks between modes |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Migrating auth tokens or session data into IndexedDB alongside application data | Tokens become queryable/enumerable via IndexedDB API; any XSS vulnerability exposes all tokens | Keep auth tokens in sessionStorage only (current behavior). Never normalize auth data into IndexedDB. Audit migration code to ensure it does not accidentally sweep auth keys. |
| Not clearing old localStorage blob keys that contain member PII | Personal data (member names, contact info) persists in localStorage indefinitely after migration to IndexedDB | Blob cleanup phase must explicitly clear all keys containing PII. Verify with `Object.keys(localStorage).filter(k => k.startsWith('viking_'))` that no PII-containing keys remain. |
| Demo mode data accessible in production database | If migration accidentally writes demo data to production database (mode check fails), fake member data appears in production | Always check `isDemoMode()` at the service level, not just at the database level. Add assertions in production builds that demo data IDs are not present in production stores. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Running migration synchronously on app startup | App shows blank screen or loading spinner for 5-30 seconds while migration runs | Run migration in background after initial render. Show stale data from old blob immediately, then update UI when migration completes. |
| No progress indicator during migration | User force-quits app thinking it is frozen, corrupting partially-migrated data | If migration takes >2 seconds, show a subtle "Updating data..." indicator. Make migration resumable (idempotent). |
| Data appears different after migration (sorting, ordering changes) | User reports "my data is wrong" even though data is correct -- just displayed differently | Preserve the original sort order when migrating from blob. If the blob had an implicit order (insertion order), maintain that order as an explicit sort key in the normalized store. |

## "Looks Done But Isn't" Checklist

- [ ] **Flexi normalization:** Often missing `flexi_lists` store population -- verify all sections have their flexi lists in the new store, not just the currently active section
- [ ] **Events normalization:** Often missing events for sections the user hasn't viewed since migration -- verify all cached sections have events migrated, not just the last-viewed section
- [ ] **Attendance normalization:** Often missing shared attendance records -- verify `shared_attendance` store has data for multi-section events, not just per-section attendance
- [ ] **Demo mode:** Often missing schema upgrade on demo database -- verify demo database version matches production database version
- [ ] **Blob cleanup:** Often missing dynamic keys -- verify keys like `viking_flexi_data_${sectionId}_${termId}_offline` with all possible sectionId/termId combinations are cleaned up, not just the pattern
- [ ] **SQLite parity:** Often missing native platform testing -- verify at minimum that `Capacitor.isNativePlatform() === true` code paths do not hit throwing stubs
- [ ] **Migration idempotency:** Often missing re-run safety -- verify running migration twice does not duplicate records or corrupt data

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| IndexedDB upgrade transaction aborted | LOW | User clears browser data and re-syncs from API. No permanent data loss since API is source of truth. Add a "Reset local data" button as escape hatch. |
| Dual-write inconsistency (stale data displayed) | LOW | Force a full re-sync from API. Clear all normalized stores and re-run migration from API data. |
| Demo database schema mismatch | LOW | Delete the demo database (`indexedDB.deleteDatabase('vikings-eventmgmt-demo')`) and re-create on next demo mode toggle. |
| Blob keys deleted before migration completed | MEDIUM | If API is available, re-fetch all data and populate normalized stores. If offline, data is lost until next sync. |
| Circular dependency causing service initialization failure | MEDIUM | Requires code fix and redeployment. No data loss, but app is broken until fix ships. |
| SQLite stubs crashing native app | MEDIUM | Requires code fix and App Store/TestFlight redeployment. Native users are blocked until update. |
| localStorage fallback masking broken migration (users on stale data for days) | HIGH | Must identify affected users, clear their localStorage, force re-migration. Data written during fallback period may conflict with normalized store data. Requires a reconciliation strategy. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| IndexedDB upgrade transaction failure | Phase 1: Schema setup | Automated test that opens DB at old version, upgrades to new version, verifies all stores exist |
| Dual-write inconsistency | Every normalization phase | For each data type: grep all read/write paths, verify single source of truth service |
| Demo mode database divergence | Phase 1: Schema setup | Integration test toggling demo mode after schema upgrade, verifying both DBs at same version |
| Silent localStorage fallback | Phase 1: Infrastructure | Sentry alert for localStorage fallback events on migrated data types; monitoring dashboard |
| Circular dependencies | Phase 1: Architecture | ESLint rule or custom lint script detecting circular imports in `src/shared/services/` |
| Premature blob key cleanup | Final cleanup phase | Deploy deprecated-key-access warnings one release before cleanup; verify zero access logs before deleting |
| SQLite stub methods throwing | Phase 1: Before any normalization | Test suite with `isNativePlatform` mocked to `true`; all stubs either implemented or converted to graceful fallbacks |

## Sources

- Codebase analysis: `ios app/src/shared/services/storage/indexedDBService.js` (upgrade handler, store definitions)
- Codebase analysis: `ios app/src/shared/services/storage/unifiedStorageService.js` (routing logic, fallback behavior)
- Codebase analysis: `ios app/src/shared/services/flexiRecordDataService.js` (SQLite stubs, dual-write patterns)
- Codebase analysis: `ios app/src/shared/services/storage/database.js` (SQLite initialization, demo mode handling)
- Codebase analysis: `ios app/.planning/codebase/CONCERNS.md` (documented tech debt and known issues)
- [MDN: Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) -- transaction abort behavior, upgrade handler constraints
- [Ionic Forum: Migrate from LocalStorage/IndexedDB to SQLite](https://forum.ionicframework.com/t/migrate-from-localstorage-indexeddb-to-sqlite/204170) -- data loss during Capacitor storage migration
- [Capacitor GitHub Issue #7594](https://github.com/ionic-team/capacitor/issues/7594) -- IndexedDB persistence not guaranteed by browsers
- [Capacitor GitHub Issue #7832](https://github.com/ionic-team/capacitor/issues/7832) -- IndexedDB table splitting during Capacitor v5-to-v6 migration causing data loss
- [RxDB: Capacitor Database Guide](https://rxdb.info/capacitor-database.html) -- SQLite vs IndexedDB persistence guarantees
- [IndexedDB complete guide](https://blog.xnim.me/indexeddb-guide) -- transaction abort behavior and upgrade pitfalls
- [javascript.info: IndexedDB](https://javascript.info/indexeddb) -- version upgrade transaction constraints

---
*Pitfalls research for: IndexedDB/SQLite storage normalization in hybrid Capacitor app*
*Researched: 2026-02-15*
