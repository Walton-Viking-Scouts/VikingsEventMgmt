# Viking Event Management — Data Storage Normalization

## What This Is

A data storage normalization layer for the Viking Event Management iOS/web app. All data types (sections, events, attendance, terms, flexi records) are now stored as properly keyed, individually queryable records in IndexedDB (web) and SQLite (native), with Zod validation at every write boundary. The legacy blob-in-a-key storage pattern and UnifiedStorageService have been fully removed.

## Core Value

Every data type stored as properly keyed, individually queryable records — no more blob arrays stuffed under a single key. Clean, predictable data shapes in and out.

## Requirements

### Validated

- ✓ Events stored as individual records keyed by eventid, indexed by sectionid/termid — v1.0
- ✓ Attendance stored as individual records keyed by [eventid, scoutid], indexed by eventid — v1.0
- ✓ Sections stored as individual records keyed by sectionid — v1.0
- ✓ Terms normalized from blob to individual records per section — v1.0
- ✓ FlexiRecord lists stored as individual records, not blob arrays — v1.0
- ✓ FlexiRecord structures stored as individual records with proper indexes — v1.0
- ✓ FlexiRecord data stored as individual records keyed by record+section — v1.0
- ✓ Shared attendance stored as individual records with proper indexes — v1.0
- ✓ Old blob storage keys removed (viking_*_offline pattern) — v1.0
- ✓ UnifiedStorageService blob-routing logic removed — v1.0
- ✓ localStorage fallback paths for data storage removed — v1.0
- ✓ Dual-write code paths eliminated — v1.0
- ✓ All data flows through: API → validate → normalize → store individual records — v1.0
- ✓ Query functions return consistent shapes regardless of platform — v1.0
- ✓ Members normalized into core_members + member_section dual-store — existing
- ✓ IndexedDB service operational with 14 object stores — v1.0
- ✓ localStorage → IndexedDB migration complete — existing
- ✓ current_active_terms normalized from blob to table — existing
- ✓ Demo mode uses separate IndexedDB database — existing
- ✓ person_type reads from member_section, not calculated — existing

### Active

(No active requirements — next milestone not yet planned)

### Out of Scope

- Authentication/token storage — stays in sessionStorage/localStorage (not data)
- UI component refactoring — data layer only, UI reads through existing service interfaces
- Automatic sync/conflict resolution — manual sync only, read-only offline (existing design)
- State management migration (AppStateContext phases) — separate project
- Circular dependency refactor (Task 91) — separate concern

## Context

- **Shipped:** v1.0 Data Storage Normalization (2026-02-17)
- **Stats:** 7 phases, 21 plans, 74 commits, 117 files changed, +14,036/-3,339 LOC
- **Codebase:** React 19 + Capacitor 7, IndexedDB v8 (13 active stores), SQLite with matching schemas
- **Storage backends:** IndexedDB (web via idb), SQLite (native via @capacitor-community/sqlite)
- **API source:** Node.js Express backend proxying OSM (Online Scout Manager) API
- **Tech debt:** SQLite terms table creation was missing (fixed in PR #175), 3 minor items tracked in audit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Follow members dual-store pattern | Proven, working, well-tested reference implementation | ✓ Good — all 7 data types follow same pattern |
| Both platforms in scope | SQLite methods throwing Error was blocking native | ✓ Good — all methods implemented |
| Full cleanup, no gradual migration | Backwards compatibility not required; clean break is simpler | ✓ Good — UnifiedStorageService fully deleted |
| Data layer only, no UI changes | Minimize blast radius; services return same shapes | ✓ Good — zero UI component changes needed |
| Zod validation at write boundary | Catch malformed API data before storage | ✓ Good — graceful degradation via safeParseArray |
| Compound keys for attendance | [eventid, scoutid] enables efficient queries | ✓ Good — both indexes used |
| Read-time member enrichment | Don't store firstname/lastname in attendance | ✓ Good — single source of truth in core_members |
| .passthrough() on flexible schemas | Preserve dynamic fields (f_1, parsedFieldMapping) | ✓ Good — prevented data loss bug |

## Constraints

- **Offline-first**: All normalized stores support offline reads
- **Rate limiting**: No additional API calls — normalization happens at storage time
- **Platform parity**: IndexedDB and SQLite schemas store same data shapes
- **No UI changes**: Components call same service methods

---
*Last updated: 2026-02-17 after v1.0 milestone*
