# Roadmap: Data Storage Normalization

## Overview

This project normalizes all remaining data types (sections, events, attendance, terms, flexi records) from blob-in-a-key storage to individual indexed records across both IndexedDB and SQLite. The work proceeds from infrastructure through each data type in dependency order (simplest to most complex), ending with legacy code cleanup. The Members normalization serves as the reference pattern throughout.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure & Schema** - Schema definitions, validation layer, and platform parity for all data types
- [ ] **Phase 2: Sections Normalization** - Simplest data type normalized as pattern validation
- [ ] **Phase 3: Events Normalization** - Events stored as individual indexed records with section/term scoping
- [ ] **Phase 4: Attendance Normalization** - Attendance and shared attendance with compound keys
- [ ] **Phase 5: Terms Normalization** - Terms normalized with CurrentActiveTermsService integration preserved
- [ ] **Phase 6: Flexi Records Normalization** - Three interrelated stores (lists, structures, data) normalized
- [ ] **Phase 7: Cleanup & Consolidation** - Legacy blob storage, dual-write paths, and fallbacks removed

## Phase Details

### Phase 1: Infrastructure & Schema
**Goal**: All schema definitions, validation schemas, and platform migrations are in place so subsequent phases can focus purely on data normalization logic
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, XCUT-01, XCUT-04
**Success Criteria** (what must be TRUE):
  1. App opens successfully on both web and native with the new DATABASE_VERSION and all new object stores/tables exist (empty)
  2. Demo mode database has identical schema version and store definitions as production database
  3. Zod validation schemas exist for every data type and reject malformed input with descriptive errors
  4. DatabaseService facade exposes method stubs for all normalized data types on both platforms
  5. All storage operations log errors to Sentry with consistent formatting
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md -- Install Zod, create validation schemas and schema constant files
- [ ] 01-02-PLAN.md -- IndexedDB version bump, SQLite flexi tables, DatabaseService stubs, Sentry consistency

### Phase 2: Sections Normalization
**Goal**: Sections are stored as individual records and queryable by sectionid on both platforms, proving the end-to-end normalization pattern works
**Depends on**: Phase 1
**Requirements**: SECT-01, SECT-02, SECT-03, SECT-04
**Success Criteria** (what must be TRUE):
  1. Sections data synced from API is stored as individual records keyed by sectionid (not as a blob array)
  2. Calling getSections() returns the same data shape on both IndexedDB and SQLite platforms
  3. Bulk upsert replaces the entire sections dataset atomically without leaving partial state
**Plans**: 1 plan

Plans:
- [ ] 02-01-PLAN.md -- IndexedDB store migration, DatabaseService sections bypass, integration tests

### Phase 3: Events Normalization
**Goal**: Events are stored as individual indexed records queryable by section, term, and date on both platforms
**Depends on**: Phase 2
**Requirements**: EVNT-01, EVNT-02, EVNT-03, EVNT-04, EVNT-05
**Success Criteria** (what must be TRUE):
  1. Events synced from API are stored as individual records keyed by eventid with working indexes on sectionid, termid, and startdate
  2. Querying events by section, by term, or by individual ID returns correct results on both platforms
  3. Syncing events for a section replaces all events in that section scope atomically (delete-before-insert in one transaction)
  4. Event data round-trips through Zod validation without data loss
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md -- IndexedDB events store migration and new CRUD methods
- [ ] 03-02-PLAN.md -- DatabaseService events bypass, SQLite transaction wrapping, integration tests

### Phase 4: Attendance Normalization
**Goal**: Attendance (regular and shared) is stored as individual records with compound keys, queryable by event or member on both platforms
**Depends on**: Phase 3
**Requirements**: ATTN-01, ATTN-02, ATTN-03, ATTN-04, ATTN-05, ATTN-06
**Success Criteria** (what must be TRUE):
  1. Attendance records are stored with compound key [eventid, scoutid] and retrievable by either eventid or scoutid index
  2. Shared attendance records are stored with compound key [eventid, sectionid] and queryable by event
  3. Bulk upsert for attendance replaces records per event scope atomically
  4. Attendance query methods return identical data shapes on IndexedDB and SQLite
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md -- Zod schemas, IndexedDB v6 upgrade (compound key store, shared_event_metadata, blob cleanup), CRUD methods
- [ ] 04-02-PLAN.md -- DatabaseService attendance methods (Zod validation, IndexedDB/SQLite), integration tests
- [ ] 04-03-PLAN.md -- Consumer updates (remove cache, data services, hooks, API layer to normalized store)

### Phase 5: Terms Normalization
**Goal**: Terms are stored as individual indexed records while preserving existing CurrentActiveTermsService integration
**Depends on**: Phase 2
**Requirements**: TERM-01, TERM-02, TERM-03, TERM-04, TERM-05
**Success Criteria** (what must be TRUE):
  1. Terms are stored as individual records keyed by termid with indexes on sectionid and startdate
  2. CurrentActiveTermsService continues to function correctly reading from normalized terms store
  3. Terms query methods return consistent shapes on both IndexedDB and SQLite
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Flexi Records Normalization
**Goal**: All three flexi record stores (lists, structures, data) are normalized with proper composite keys, and FlexiRecordDataService is the single source of truth
**Depends on**: Phase 3, Phase 5
**Requirements**: FLEX-01, FLEX-02, FLEX-03, FLEX-04, FLEX-05, FLEX-06, FLEX-07
**Success Criteria** (what must be TRUE):
  1. Flexi record lists, structures, and data are each stored as individual records with appropriate composite keys and secondary indexes
  2. All five SQLite FlexiRecord methods work without throwing Error (currently broken on native)
  3. FlexiRecordDataService is the only code path that reads/writes flexi data -- no backdoor access through UnifiedStorageService
  4. Bulk upsert methods exist for all three flexi store types
  5. Flexi data round-trips correctly on both platforms with consistent query shapes
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Cleanup & Consolidation
**Goal**: All legacy blob storage code, dual-write paths, and localStorage fallbacks are removed -- normalized stores are the only data path
**Depends on**: Phase 4, Phase 5, Phase 6
**Requirements**: CLNP-01, CLNP-02, CLNP-03, CLNP-04, CLNP-05, XCUT-02, XCUT-03
**Success Criteria** (what must be TRUE):
  1. No code references old blob storage keys (viking_*_offline pattern) anywhere in the codebase
  2. UnifiedStorageService blob-routing logic and key mapping code is removed
  3. No localStorage fallback paths exist for any data type (auth/token storage excluded)
  4. Every data type follows a single write path: API -> validate -> normalize -> store individual records
  5. All consumer files import from normalized storage services with no dual-write code paths remaining
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
(Phases 4 and 5 can potentially run in parallel after Phase 3/2 respectively)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Schema | 2/2 | Complete | 2026-02-15 |
| 2. Sections Normalization | 0/1 | Planned | - |
| 3. Events Normalization | 0/1 | Not started | - |
| 4. Attendance Normalization | 0/1 | Not started | - |
| 5. Terms Normalization | 0/1 | Not started | - |
| 6. Flexi Records Normalization | 0/2 | Not started | - |
| 7. Cleanup & Consolidation | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-15*
*Last updated: 2026-02-15 (Phase 2 planned)*
