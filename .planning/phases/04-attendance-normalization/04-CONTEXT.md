# Phase 4: Attendance Normalization - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Attendance (regular and shared) migrated from blob-in-a-key storage to individual indexed records with compound keys, queryable by event or member on both IndexedDB and SQLite. Shared event metadata stored in its own small store. Old blob storage cleaned up. No UI changes — this is a storage layer migration.

</domain>

<decisions>
## Implementation Decisions

### Compound Key Design
- Regular attendance keyed by compound keyPath array `[eventid, scoutid]` in IndexedDB (not concatenated string)
- Shared attendance uses the same store as regular attendance, with a marker field (e.g., `source: 'shared'` or `isSharedSection: true`) to distinguish cross-section records
- Store core API fields only (scoutid, attending, patrol, notes, eventid, sectionid) — do NOT store enrichment fields (eventname, eventdate, sectionname). Join with events/sections stores at read time
- Standardize `attending` field on write to a consistent format (resolve mixed string/number API values during Zod validation)
- Zod schema uses passthrough mode (allow unknown fields) but log unknown fields to Sentry as a warning so API shape changes are tracked

### Sync & Upsert Scope
- Attendance loads on-demand per event (when user views an event), NOT in a batch refresh of all events
- Summary counts for events come from the events store (already normalized in Phase 3), detailed attendance loads only when needed
- Bulk upsert uses per-event atomic replace: delete all records for eventid, then insert fresh batch, wrapped in a single IndexedDB transaction
- Shared attendance follows the same per-event atomic replace pattern
- On sync failure: show stale cached data with a visible warning indicator, allow manual retry

### Shared Attendance Handling
- Regular and shared attendance records go into ONE store (no separate shared_attendance store) since this is a single-user store with no cross-exposure risk
- Shared attendance records marked with a distinguishing field to identify cross-section scouts
- Shared event metadata (which sections participate) gets its OWN small normalized store, separate from events — keyed by eventid
- Shared attendance brings in scouts from sections the user doesn't normally have access to — these need enrichment from the shared data itself since section/scout mapping isn't available in normal data downloads

### Migration & Dual-Write
- No migration of existing blob data — start fresh, let on-demand sync populate the new store when each event is viewed
- Clean up old blob keys (viking_attendance_*_offline, viking_shared_attendance_*) immediately during DB upgrade, not deferred to Phase 7
- No dual-write period — all writes go directly to the new normalized store only. Old blob path becomes dead code
- Remove the in-memory cache layer (attendanceDataService.attendanceCache) — rely solely on IndexedDB/SQLite store for reads

### Claude's Discretion
- Exact Zod schema field definitions and standardized attending value format (string enum vs number enum)
- IndexedDB secondary index configuration (which fields get indexes beyond the compound primary key)
- SQLite table column definitions and index strategy
- How to surface the "stale data" warning in the UI layer (toast, banner, inline indicator)
- Transaction error handling and retry logic details
- Shared event metadata store schema

</decisions>

<specifics>
## Specific Ideas

- Summary attendance counts already live in the events data from Phase 3 — only load full attendance records when an event is opened
- Shared attendance includes scouts from inaccessible sections where we don't have section data or scout-to-section mapping from normal downloads — the shared attendance response itself is the source of truth for enriching these records
- Follow the same patterns established in Phase 3 events normalization for transaction wrapping and atomic operations

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-attendance-normalization*
*Context gathered: 2026-02-16*
