# Project Research Summary

**Project:** IndexedDB/SQLite Data Normalization
**Domain:** Cross-platform offline storage migration in Capacitor hybrid app
**Researched:** 2026-02-15
**Confidence:** HIGH

## Executive Summary

This project involves migrating a hybrid mobile app's storage layer from blob-based storage (JSON arrays keyed by composite string patterns) to properly normalized IndexedDB object stores and SQLite tables with individual record-level keys, indexes, and efficient query patterns. The Members data type has already been successfully normalized and serves as the reference implementation pattern. The remaining data types (events, attendance, sections, terms, and flexi records) should follow this established architecture.

The recommended approach leverages the existing `idb` library (already in use) and `@capacitor-community/sqlite` plugin with their built-in version-based migration mechanisms. No new frameworks or ORMs are needed. The critical insight from research is that both platforms already have migration systems -- IndexedDB's `openDB` upgrade callback with `oldVersion` guards, and SQLite's `addUpgradeStatement` API. The normalization work extends the existing `DatabaseService` pattern where `if (!this.isNative)` branches to platform-specific implementations. Add Zod for runtime validation at API boundaries to ensure corrupt data never reaches local storage.

The primary risk is dual-write inconsistency during the migration window where both old blob keys and new normalized stores coexist. The `UnifiedStorageService` key routing layer currently allows backdoor access to storage, enabling different code paths to read/write the same logical data through different entry points. This is already causing issues (documented in Task 90 for flexi records). Mitigation: establish a single source-of-truth service per data type, add migration state flags to control read fallback, and remove `UnifiedStorageService` routing after all data types are normalized.

## Key Findings

### Recommended Stack

The existing stack is well-suited for this normalization effort. No major technology changes are needed -- this is an architecture improvement within the current platform.

**Core technologies:**
- `idb` ^8.0.3: Already in use for IndexedDB access. Tiny (1.19kB brotli), promise-based API, built-in version-based upgrade mechanism via `openDB` is exactly what's needed for schema migration. No reason to change.
- `@capacitor-community/sqlite` ^7.0.0: Stay on 7.x branch (project uses Capacitor 7.4). Has built-in `addUpgradeStatement` for versioned migrations. SQLite tables are already normalized -- less work needed on native side.
- Zod ^3.24: New dependency for runtime schema validation at API boundaries. Validates and coerces data from OSM API before writing to either platform. Prevents corrupt data from entering local storage. Use v3 API (stable default) via `"zod"` import; v4 migration can happen later.

**Supporting libraries:**
- `fake-indexeddb` ^6.2.2: Already a dev dependency. Enables IndexedDB testing in Vitest with `import 'fake-indexeddb/auto'` in test setup.
- `uuid` ^11.1.0: Already in use. Prefer natural keys (eventid, scoutid) over synthetic UUIDs for normalized records, but use for compound cache keys if needed.

### Expected Features

**Must have (table stakes):**
- Individual record storage with natural keys (eventid, scoutid, sectionid) instead of composite blob keys
- Secondary indexes on query dimensions (events by sectionid, attendance by eventid)
- Bulk upsert within single transactions (sync writes entire datasets atomically)
- Platform-agnostic facade (DatabaseService already established -- extend to all data types)
- Schema version migration (bump DATABASE_VERSION, run upgrade handlers)
- Delete-before-insert replacement strategy for atomic scope updates
- Consistent error handling with Sentry across all operations
- Demo mode data isolation (already solved with separate DB names)
- SQLite FlexiRecord implementations (5 methods currently throw -- broken on native)
- Old blob key cleanup after migration completes

**Should have (differentiators):**
- Compound indexes for attendance lookups (eventid+scoutid primary key, plus separate eventid and scoutid indexes)
- Timestamp tracking on every record (updated_at: Date.now() enables staleness checks)
- Store-level metadata records (last-sync timestamp, record count per store)
- Batch read by index (getAllFromIndex() avoids N+1 query patterns)
- Cross-store transactional writes (events + attendance together in single transaction)
- Migration utility with progress reporting (one-time migration from blobs to normalized stores)
- Store info diagnostic method extension (getStoreInfo() already exists, extend to all new stores)
- Defensive record validation on write (reject records missing required fields)

**Defer (v2+):**
- Automatic background sync (app uses manual sync intentionally)
- Optimistic conflict resolution (CRDT/OT unnecessary for read-heavy single-source data)
- Reactive/observable storage (RxDB-style live queries add heavyweight dependency)
- Full-text search indexes (dataset small enough for in-memory filtering)
- Encryption at rest (rely on OS-level encryption)
- Offline write queue with retry (only attendance is writable, already handled)
- IndexedDB cursor-based pagination (datasets are small, getAll() is sufficient)
- Schema ORM layer (DatabaseService facade is sufficient)
- Versioned record history (no use case for audit trail)

### Architecture Approach

The architecture follows the existing Members normalization pattern: a single DatabaseService facade that branches on platform, with repositories handling normalization/denormalization logic, and platform adapters encapsulating IndexedDB vs SQLite specifics.

**Major components:**
1. **StorageService** (facade): Single public API with domain-scoped namespaces (`.sections`, `.members`, `.events`). All consumers import only this service. Replaces direct imports of DatabaseService, UnifiedStorageService, IndexedDBService from 20+ files.
2. **Platform Adapters** (IndexedDBAdapter, SQLiteAdapter): Identical interface implemented for both platforms. Selected once at initialization based on `Capacitor.isNativePlatform()`. Encapsulate all platform-specific code.
3. **Domain Repositories** (MembersRepository, EventsRepository, etc.): Type-specific CRUD logic. Normalize data from API responses into individual records. Denormalize on reads to reconstruct rich objects. Each repository consumed by its StorageService namespace.
4. **Deprecation Shims** (DEPRECATED_database.js, DEPRECATED_unifiedStorageService.js): Thin wrappers during migration period. Delegate to new StorageService. Enable incremental migration of 30+ consumer files without big-bang rewrite. Removed after all consumers migrated.

**Data flow pattern:**
API Response (JSON blob) → Data Loading Service → StorageService.{domain}.save() → {Domain}Repository.save() → normalize + validate → PlatformAdapter.{store}.bulkPut() → IndexedDB stores (web) or SQLite tables (native)

**Normalized schema (target state):**
- Events: keyPath `eventid`, indexes: `sectionid`, `termid`, `startdate`
- Attendance: keyPath `[eventid, scoutid]`, indexes: `eventid`, `scoutid`
- Sections: keyPath `sectionid`, index: `sectiontype`
- Terms: keyPath `termid`, indexes: `sectionid`, `startdate`
- Flexi: Three stores with proper keyPaths for lists/structure/data
- Members: Already normalized (core_members + member_section) -- reference pattern

### Critical Pitfalls

1. **IndexedDB Version Bump Fails Mid-Upgrade, Losing All Stores**: The `onupgradeneeded` handler runs in a single `versionchange` transaction. If any store creation or data migration throws, the entire transaction aborts and all schema changes revert. If old blob keys were already deleted, result is data loss. **Avoid by:** Never delete old blobs in same code path as schema creation. Keep upgrade handler minimal (schema only, no data migration). Test upgrade path from every previous version, not just fresh DB.

2. **Dual-Write Inconsistency During Migration Window**: Multiple code paths access the same logical data through different entry points (FlexiRecordDataService vs UnifiedStorageService key routing). Writes go to new store, reads hit old blob, or vice versa. This is already happening (Task 90 flexi issues). **Avoid by:** Define single source-of-truth service per data type before migration. Add migration state flag per data type to control fallback. Remove UnifiedStorageService backdoor access as each type normalizes.

3. **Demo Mode Database Divergence**: Demo database (`vikings-eventmgmt-demo`) and production database may have mismatched schemas because upgrade handler fires per-database. Demo DB only opens when `isDemoMode()` returns true, so it may never receive the upgrade. **Avoid by:** Proactively open both databases on app startup after schema version bump. Add integration test that toggles demo mode and verifies both DBs at same version.

4. **Silent localStorage Fallback Masks Broken Normalization**: UnifiedStorageService and DatabaseService silently fall back to localStorage when IndexedDB/SQLite fails. During migration, broken normalization appears to "work" because app reads stale localStorage blobs. Users see old data, assume app is fine. **Avoid by:** Add migration health check that verifies data exists in expected normalized store. Log Sentry warning (not just debug) when localStorage fallback activates. Make fallback read-only for migrated data types.

5. **Circular Dependencies in Data Service Layer Cause Import Deadlocks**: Adding new normalized data services creates circular import chains (service A imports service B, service B imports service A, second import resolves to incomplete module). Already documented issue (RequireAuth disabled due to circular dependency). **Avoid by:** Use DataServiceOrchestrator pattern with constructor injection (already implemented). Enforce strict dependency direction: API services → Data services → Storage services. Add lint check for circular imports in `src/shared/services/`.

## Implications for Roadmap

Based on combined research, the normalization should proceed in a phased approach that follows dependency order and complexity. Each phase normalizes one or more related data types, validates migration, then moves to cleanup before proceeding.

### Suggested Phase Structure

#### Phase 1: Infrastructure & Schema Setup
**Rationale:** Must establish migration patterns and platform parity before normalizing any data type. The Members normalization proved the pattern works -- extend it to remaining types. Address broken SQLite FlexiRecord stubs that crash native platforms.

**Delivers:**
- Zod schema definitions for all data types (runtime validation)
- IndexedDB schema definitions (DATABASE_VERSION 5, store keyPaths, indexes)
- SQLite schema with `addUpgradeStatement` for version 2
- Deprecation shims for gradual consumer migration
- SQLite FlexiRecord method implementations (fix 5 throwing stubs)
- Demo mode schema parity checks

**Addresses:** Individual record storage (foundation), Schema version migration, Platform-agnostic facade updates, SQLite FlexiRecord implementations (table stakes), Demo mode isolation verification

**Avoids:** Pitfall 1 (schema setup must be bulletproof), Pitfall 3 (demo mode divergence), Pitfall 5 (circular dependencies -- establish pattern first), Pitfall 7 (SQLite stubs throwing)

**Research flag:** Standard patterns (skip research-phase) -- all technologies and patterns are well-documented and already in use

---

#### Phase 2: Sections Normalization
**Rationale:** Simplest data type with lowest record count (~5-10 sections per group). Every other data type references sectionid as foreign key. No dependencies -- everything depends on sections. Proves the migration pattern works end-to-end before tackling complex types.

**Delivers:**
- Sections normalized to individual records keyed by `sectionid`
- Migration from single blob (`viking_sections_offline`) to normalized store
- Bulk upsert method for sections
- Section query methods (getAll, getById)
- Consumer file updates for sections access

**Uses:** Zod validation, idb built-in migrations, established Members pattern

**Implements:** Repository per domain pattern, Platform adapter with identical interface

**Addresses:** Individual record storage with natural keys, Secondary indexes, Bulk upsert within single transaction

**Avoids:** Pitfall 2 (single source of truth established), Pitfall 4 (no silent fallback for normalized sections)

**Research flag:** Standard patterns (skip research-phase)

---

#### Phase 3: Events Normalization
**Rationale:** Events are referenced by attendance and flexi records. Medium complexity. Currently blob-per-section (`viking_events_{sectionId}_offline`). ~50-200 events per section per term. Depends on sections (foreign key: sectionid).

**Delivers:**
- Events normalized to records keyed by `eventid`
- Indexes: `sectionid`, `termid`, `startdate`
- Migration from blob-per-section to normalized store
- Bulk upsert for events
- Query methods: getBySection, getByTerm, getById
- Delete-before-insert replacement for section scope

**Addresses:** Individual record storage, Secondary indexes on query dimensions, Delete-before-insert replacement strategy

**Avoids:** Pitfall 2 (audit all event read/write paths before migration), Pitfall 6 (blob cleanup only after migration validated)

**Research flag:** Standard patterns (skip research-phase)

---

#### Phase 4: Attendance Normalization
**Rationale:** Most critical for offline operation (event check-in). Depends on events and members. ~20-60 attendance records per event. Versioning/conflict tracking metadata must be preserved.

**Delivers:**
- Attendance normalized to records keyed by `[eventid, scoutid]`
- Compound indexes: `eventid` index, `scoutid` index
- Shared attendance normalization (keyed by `[eventid, sectionid]`)
- Timestamp tracking on every record (`updated_at`)
- Cross-store transactional writes (events + attendance together)
- Version tracking preservation for conflict detection

**Addresses:** Individual record storage, Compound index for attendance lookups, Timestamp tracking on every record, Cross-store transactional writes

**Avoids:** Pitfall 2 (attendance has most dual-write risk -- strict single source of truth), Performance trap (N+1 reads -- use batch read by index)

**Research flag:** Standard patterns (skip research-phase)

---

#### Phase 5: Terms Normalization
**Rationale:** CurrentActiveTermsService already partially normalized. Full terms blob still exists (`viking_terms_offline`). ~3-6 terms per section. Depends on sections.

**Delivers:**
- Terms normalized to records keyed by `termid`
- Indexes: `sectionid`, `startdate`
- Integration with existing CurrentActiveTermsService
- Migration from full terms blob

**Addresses:** Individual record storage, Secondary indexes

**Avoids:** Pitfall 2 (CurrentActiveTermsService is source of truth, ensure other code paths don't read old blob)

**Research flag:** Standard patterns (skip research-phase)

---

#### Phase 6: Flexi Records Normalization
**Rationale:** Most complex data structure. Three related stores (lists, structure, data). Composite keys. Depends on events, sections, terms. Variable record count, can be large. This is the highest-risk normalization -- should be last.

**Delivers:**
- flexi_lists normalized: keyPath `[sectionid, recordid]`, index: `sectionid`
- flexi_structure normalized: keyPath `recordid`
- flexi_data normalized: keyPath `[recordid, sectionid, termid]`, indexes: `recordid`, `sectionid`
- Migration from blob keys with composite patterns
- FlexiRecordDataService becomes single source of truth
- Store-level metadata records for sync tracking

**Addresses:** Individual record storage (complex composite keys), Secondary indexes, Store-level metadata record

**Avoids:** Pitfall 2 (flexi already has dual-write issues per Task 90 -- must eliminate all backdoor access), Performance trap (full store scan for demo mode filtering -- use separate DBs)

**Research flag:** May need research-phase -- flexi records have complex query patterns and three interrelated stores. Consider deeper research on optimal index strategy and query patterns.

---

#### Phase 7: Service Consolidation & Cleanup
**Rationale:** All data types normalized, all consumers migrated. Time to remove legacy code and establish new patterns as standard.

**Delivers:**
- Remove DEPRECATED_ shims (database.js, unifiedStorageService.js, indexedDBService.js)
- Remove UnifiedStorageService key routing logic
- Remove old blob key references from all consumer files
- Update all imports to use new StorageService
- Remove localStorage fallback for migrated data types
- Extension of getStoreInfo() diagnostic method to all new stores

**Addresses:** Old blob key cleanup (table stakes), Store info diagnostic method

**Avoids:** Pitfall 6 (cleanup only after all consumers verified migrated)

**Research flag:** Standard patterns (skip research-phase)

---

### Phase Ordering Rationale

- **Infrastructure first** prevents rework -- all phases use the same migration pattern
- **Sections before events before attendance** follows natural foreign key dependencies
- **Simplest (sections) to most complex (flexi)** validates pattern early, builds confidence
- **Terms after attendance** because CurrentActiveTermsService already works -- lower priority
- **Flexi last** due to three-store complexity and existing dual-write issues
- **Cleanup as final phase** ensures no premature blob deletion while code still references old keys

This ordering avoids the critical pitfalls:
- Schema setup phase prevents mid-upgrade failures (Pitfall 1)
- Single source of truth established per phase prevents dual-write (Pitfall 2)
- Demo mode verification in Phase 1 prevents divergence (Pitfall 3)
- No silent fallback allowed for migrated types prevents masking (Pitfall 4)
- Dependency direction enforced from start prevents circular imports (Pitfall 5)
- Blob cleanup only in final phase prevents premature deletion (Pitfall 6)
- SQLite stubs fixed in Phase 1 prevents native crashes (Pitfall 7)

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 6 (Flexi Records):** Complex three-store structure with interrelated queries. Sparse documentation on optimal IndexedDB compound index strategy for this pattern. May need research-phase to validate index design.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Infrastructure):** All technologies already in use, patterns established by Members normalization
- **Phase 2 (Sections):** Simple keyPath change, direct application of established pattern
- **Phase 3 (Events):** Standard one-to-many relationship (section has many events), well-documented
- **Phase 4 (Attendance):** Compound key pattern established by member_section store
- **Phase 5 (Terms):** CurrentActiveTermsService already proves the pattern
- **Phase 7 (Cleanup):** No new patterns, purely removing old code

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended technologies already in use and verified. Zod is industry-standard runtime validation. idb and @capacitor-community/sqlite migration mechanisms documented and proven. |
| Features | HIGH | Members normalization already completed successfully and serves as reference implementation. Feature requirements derived from codebase analysis (20+ files, existing patterns, documented issues). |
| Architecture | HIGH | Existing architecture already implements the target pattern for Members. Extending to remaining data types is well-understood. Platform adapter pattern verified via Members dual-store implementation. |
| Pitfalls | HIGH | 7 critical pitfalls identified from codebase analysis (Task 90 dual-write issues, 5 throwing SQLite stubs, CONCERNS.md documented circular dependencies) and IndexedDB/Capacitor community issues. All have concrete avoidance strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Flexi records index strategy:** The three-store flexi structure (lists, structure, data) has complex query patterns not fully documented in research. During Phase 6 planning, may need to analyze actual query patterns in FlexiRecordDataService to determine optimal index configuration.

- **Migration progress reporting UX:** Research documents migration utility pattern (CurrentActiveTermsService.migrateFromTermsBlob as reference), but does not specify UI/UX for long-running migrations. During each phase, determine if migration is fast enough to run synchronously or needs background operation with progress indicator. Performance traps document suggests 200+ records may need batching.

- **Rollback strategy:** Pitfalls research identifies recovery steps per failure mode, but does not specify rollback mechanism if a migration is partially complete and must be reverted. During Phase 1, establish migration state tracking to enable safe rollback (e.g., migration_status metadata record with phase number and completion flag).

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All 5 storage service files in `src/shared/services/storage/`
- Codebase analysis: `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONCERNS.md`
- Existing normalized pattern: Members implementation (core_members, member_section stores, saveMembers/getMembers methods)
- idb library (Context7 `jakearchibald/idb`) -- v8.0.3, migration patterns, transaction handling
- @capacitor-community/sqlite (Context7) -- v7.x `addUpgradeStatement` API, upgrade patterns
- Zod documentation (Context7 `colinhacks/zod`) -- v4 release notes, v3 stable default, runtime validation patterns

### Secondary (MEDIUM confidence)
- MDN IndexedDB documentation -- transaction abort behavior, upgrade handler constraints
- Capacitor storage migration forum posts (Ionic Forum, GitHub Issues) -- data loss patterns during migrations
- RxDB documentation on IndexedDB performance -- batch write patterns, transaction overhead
- LogRocket: Offline-first frontend apps in 2025 -- IndexedDB best practices

### Tertiary (LOW confidence)
- Community blog posts on IndexedDB pitfalls -- general guidance, not project-specific

---
*Research completed: 2026-02-15*
*Ready for roadmap: yes*
