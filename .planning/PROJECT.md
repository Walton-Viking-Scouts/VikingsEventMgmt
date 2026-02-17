# Viking Event Management — Data Storage Normalization

## What This Is

A data storage normalization project for the Viking Event Management iOS/web app. The member data has already been migrated to a normalized dual-store pattern (core_members + member_section with proper keys and indexes). This project extends that same treatment to all remaining data types — events, attendance, flexi records, terms, and sections — replacing the current blob-in-a-key storage pattern with individual indexed records. Both platforms (IndexedDB for web, SQLite for native) are in scope, and all legacy blob storage code will be removed.

## Core Value

Every data type stored as properly keyed, individually queryable records — no more blob arrays stuffed under a single key. Clean, predictable data shapes in and out.

## Requirements

### Validated

- ✓ Members normalized into core_members + member_section dual-store — existing
- ✓ IndexedDB service operational with 12+ object stores — existing
- ✓ localStorage → IndexedDB migration complete (phases 1-5) — existing
- ✓ current_active_terms normalized from blob to table — existing
- ✓ Demo mode uses separate IndexedDB database — existing
- ✓ person_type reads from member_section, not calculated — existing

### Active

- [ ] Events stored as individual records keyed by eventid, indexed by sectionid/termid
- [ ] Attendance stored as individual records keyed by [eventid, scoutid], indexed by eventid
- [ ] Sections stored as individual records keyed by sectionid
- [ ] Terms normalized from blob to individual records per section
- [ ] FlexiRecord lists stored as individual records, not blob arrays
- [ ] FlexiRecord structures stored as individual records with proper indexes
- [ ] FlexiRecord data stored as individual records keyed by record+section
- [ ] Shared attendance stored as individual records with proper indexes
- [ ] SQLite FlexiRecord methods implemented (5 methods currently throw Error)
- [ ] SQLite schemas match IndexedDB normalization for events, attendance, sections, terms
- [ ] Old blob storage keys removed (viking_*_offline pattern)
- [ ] UnifiedStorageService blob-routing logic removed
- [ ] localStorage fallback paths for data storage removed
- [ ] Dual-write code paths eliminated
- [ ] All data flows through: API → validate → normalize → store individual records
- [ ] Query functions return consistent shapes regardless of platform

### Out of Scope

- Member storage changes — already normalized and working
- Authentication/token storage — stays in sessionStorage/localStorage (not data)
- UI component refactoring — data layer only, UI reads through existing service interfaces
- Automatic sync/conflict resolution — manual sync only, read-only offline (existing design)
- State management migration (AppStateContext phases) — separate project
- Circular dependency refactor (Task 91) — separate concern, can benefit from this work but not blocked by it

## Context

- **Existing codebase**: React 19 + Capacitor 7 mobile/web app for Scout event management
- **Codebase map available**: `.planning/codebase/` has ARCHITECTURE.md, STACK.md, CONCERNS.md etc.
- **Storage backends**: SQLite (native via @capacitor-community/sqlite), IndexedDB (web via idb), localStorage (fallback — being removed)
- **API source**: Node.js Express backend proxying OSM (Online Scout Manager) API
- **Data types**: sections, terms, events, attendance, shared attendance, flexi records (lists/structures/data), members (done)
- **Current state**: All data moved from localStorage to IndexedDB (phases 84-89 done), but stored as blob arrays under old key patterns. Members are the only data type with proper per-record normalization.
- **Reference implementation**: Members dual-store (core_members + member_section) in indexedDBService.js and database.js — this is the pattern to follow
- **Existing Task Master tasks**: Tasks 69-71, 72-83, 85, 90, 91, 92 exist in `.taskmaster/tasks/tasks.json` — most will be cancelled/superseded by this project's tasks. Tasks 72-83 specifically should be cancelled.
- **Known issues**: FlexiRecord SQLite methods unimplemented (throw Error), storage layer fragmented across 3+ services, dual-write inconsistencies in flexi system (Task 90)

## Constraints

- **Backwards compatibility**: NOT required per project policy — old patterns can be deleted, not maintained alongside new
- **Offline-first**: All normalized stores must support offline reads — data must be accessible without network
- **Rate limiting**: No additional API calls — normalization happens at storage time, not fetch time. Same API responses, different storage format.
- **Platform parity**: IndexedDB and SQLite schemas must store the same data shapes — platform-specific implementation, but same logical schema
- **No UI changes**: Components continue to call the same service methods (getEvents, getAttendance, etc.) — only the storage internals change

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Follow members dual-store pattern | Proven, working, well-tested reference implementation | — Pending |
| Both platforms in scope | SQLite methods throwing Error is blocking native; normalize both simultaneously | — Pending |
| Full cleanup, no gradual migration | Backwards compatibility not required; clean break is simpler than maintaining two paths | — Pending |
| Cancel tasks 72-83 | Were for a member rewrite that's already done; replaced by this broader scope | — Pending |
| Data layer only, no UI changes | Minimize blast radius; services return same shapes to components | — Pending |

---
*Last updated: 2026-02-15 after initialization*
