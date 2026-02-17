# Requirements: Data Storage Normalization

**Defined:** 2026-02-15
**Core Value:** Every data type stored as properly keyed, individually queryable records — no more blob arrays stuffed under a single key.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Schema & Infrastructure

- [ ] **INFR-01**: IndexedDB schema bumped to DATABASE_VERSION 5 with all new object stores, keyPaths, and indexes defined
- [ ] **INFR-02**: SQLite schema updated with CREATE TABLE statements for all normalized data types
- [ ] **INFR-03**: Demo mode database receives same schema version as production database on app startup
- [ ] **INFR-04**: Zod validation schemas defined for all data types at API boundary

### Sections

- [ ] **SECT-01**: Sections stored as individual records keyed by sectionid in IndexedDB
- [ ] **SECT-02**: Sections stored as individual rows keyed by sectionid in SQLite
- [ ] **SECT-03**: Bulk upsert method for sections replaces entire dataset atomically
- [ ] **SECT-04**: Section query methods return consistent shapes on both platforms

### Events

- [ ] **EVNT-01**: Events stored as individual records keyed by eventid in IndexedDB
- [ ] **EVNT-02**: Events indexed by sectionid, termid, and startdate
- [ ] **EVNT-03**: Events stored as individual rows keyed by eventid in SQLite
- [ ] **EVNT-04**: Bulk upsert for events uses delete-before-insert within single transaction per section scope
- [ ] **EVNT-05**: Event query methods (getBySection, getByTerm, getById) work on both platforms

### Attendance

- [ ] **ATTN-01**: Attendance stored as individual records keyed by [eventid, scoutid] in IndexedDB
- [ ] **ATTN-02**: Attendance has compound indexes on eventid and scoutid for efficient lookups
- [ ] **ATTN-03**: Attendance stored as individual rows in SQLite with matching compound key
- [ ] **ATTN-04**: Shared attendance stored as individual records keyed by [eventid, sectionid]
- [ ] **ATTN-05**: Bulk upsert for attendance replaces records per event scope atomically
- [ ] **ATTN-06**: Attendance query methods return consistent shapes on both platforms

### Terms

- [ ] **TERM-01**: Terms stored as individual records keyed by termid in IndexedDB
- [ ] **TERM-02**: Terms indexed by sectionid and startdate
- [ ] **TERM-03**: Terms stored as individual rows keyed by termid in SQLite
- [ ] **TERM-04**: Integration with existing CurrentActiveTermsService preserved
- [ ] **TERM-05**: Terms query methods return consistent shapes on both platforms

### Flexi Records

- [ ] **FLEX-01**: Flexi record lists stored as individual records keyed by [sectionid, extraid] in IndexedDB
- [ ] **FLEX-02**: Flexi record structures stored as individual records keyed by extraid in IndexedDB
- [ ] **FLEX-03**: Flexi record data stored as individual records keyed by [extraid, sectionid, termid] in IndexedDB
- [ ] **FLEX-04**: All three flexi stores have appropriate secondary indexes (sectionid, extraid)
- [ ] **FLEX-05**: SQLite FlexiRecord methods implemented (5 currently throwing Error) with matching schemas
- [ ] **FLEX-06**: FlexiRecordDataService becomes single source of truth — no backdoor access via UnifiedStorageService
- [ ] **FLEX-07**: Flexi bulk upsert methods for all three store types

### Cleanup

- [ ] **CLNP-01**: Old blob storage keys (viking_*_offline pattern) removed from all code paths
- [ ] **CLNP-02**: UnifiedStorageService blob-routing logic and key mapping removed
- [ ] **CLNP-03**: localStorage fallback paths for data storage removed
- [ ] **CLNP-04**: Dual-write code paths eliminated — single write path per data type
- [ ] **CLNP-05**: All consumer files updated to use new storage service methods

### Cross-Cutting

- [ ] **XCUT-01**: All storage operations have consistent error handling with Sentry reporting
- [ ] **XCUT-02**: All data flows through: API → validate → normalize → store individual records
- [ ] **XCUT-03**: Query functions return consistent shapes regardless of platform (IndexedDB or SQLite)
- [ ] **XCUT-04**: DatabaseService facade updated with methods for all normalized data types

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Robustness

- **ROB-01**: Timestamp tracking (updated_at) on every record for staleness checks
- **ROB-02**: Store-level metadata records for sync freshness tracking
- **ROB-03**: Cross-store transactional writes for events + attendance together
- **ROB-04**: Defensive record validation on write (reject records missing required fields)

### Diagnostics

- **DIAG-01**: getStoreInfo() diagnostic method extended to cover all new stores
- **DIAG-02**: Migration progress reporting for long-running data transitions

### Performance

- **PERF-01**: Batch read by index (getAllFromIndex) to avoid N+1 query patterns
- **PERF-02**: Differential sync based on updated_at timestamps

## Out of Scope

| Feature | Reason |
|---------|--------|
| Member storage changes | Already normalized and working — reference implementation |
| Authentication/token storage | Stays in sessionStorage/localStorage — not data storage |
| UI component refactoring | Data layer only — UI reads through existing service interfaces |
| Automatic background sync | App uses manual sync intentionally — no Service Worker complexity |
| Conflict resolution (CRDT/OT) | Single-source read-heavy app — last-write-wins is sufficient |
| Reactive/observable storage | Data changes only on explicit sync — React state management handles UI updates |
| Full-text search indexes | Dataset small enough for in-memory Array.filter() |
| Encryption at rest | Rely on OS-level encryption (iOS Data Protection, Android file-based) |
| Offline write queue | Only attendance is writable; existing local-store-then-push pattern works |
| IndexedDB cursor pagination | Datasets too small to benefit — getAll() is sufficient |
| Schema ORM layer | DatabaseService facade is sufficient — adding Dexie.js would over-engineer |
| State management migration | Separate project (AppStateContext phases) |
| Circular dependency refactor | Separate concern (Task 91) — can benefit from this work |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Pending |
| INFR-04 | Phase 1 | Pending |
| SECT-01 | Phase 2 | Pending |
| SECT-02 | Phase 2 | Pending |
| SECT-03 | Phase 2 | Pending |
| SECT-04 | Phase 2 | Pending |
| EVNT-01 | Phase 3 | Pending |
| EVNT-02 | Phase 3 | Pending |
| EVNT-03 | Phase 3 | Pending |
| EVNT-04 | Phase 3 | Pending |
| EVNT-05 | Phase 3 | Pending |
| ATTN-01 | Phase 4 | Pending |
| ATTN-02 | Phase 4 | Pending |
| ATTN-03 | Phase 4 | Pending |
| ATTN-04 | Phase 4 | Pending |
| ATTN-05 | Phase 4 | Pending |
| ATTN-06 | Phase 4 | Pending |
| TERM-01 | Phase 5 | Pending |
| TERM-02 | Phase 5 | Pending |
| TERM-03 | Phase 5 | Pending |
| TERM-04 | Phase 5 | Pending |
| TERM-05 | Phase 5 | Pending |
| FLEX-01 | Phase 6 | Pending |
| FLEX-02 | Phase 6 | Pending |
| FLEX-03 | Phase 6 | Pending |
| FLEX-04 | Phase 6 | Pending |
| FLEX-05 | Phase 6 | Pending |
| FLEX-06 | Phase 6 | Pending |
| FLEX-07 | Phase 6 | Pending |
| CLNP-01 | Phase 7 | Pending |
| CLNP-02 | Phase 7 | Pending |
| CLNP-03 | Phase 7 | Pending |
| CLNP-04 | Phase 7 | Pending |
| CLNP-05 | Phase 7 | Pending |
| XCUT-01 | Phase 1 | Pending |
| XCUT-02 | Phase 7 | Pending |
| XCUT-03 | Phase 7 | Pending |
| XCUT-04 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after roadmap creation*
