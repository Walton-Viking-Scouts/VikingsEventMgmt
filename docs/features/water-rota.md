# Water Session Permit Rota

Plan and staff regular on-water sessions across sections (e.g. Cubs Tuesday, Scouts Friday)
over a summer date range. Section leaders see per-session cover status; permit holders sign
up (confirmed or backup) and see their week at a glance.

Full design plan: agreed 2026-07-10 (see PR description). This document tracks the storage
design and open spike questions.

## Feature map

- `/water-rota` — the board: term overview strip (one status dot per session per week),
  week-bucketed session cards with one-tap `I'm in` / `Backup` signup pills, section
  filter, offline banner, and (for plan editors) a "Sync programme" action that appends
  columns for newly added programme meetings and flags vanished ones.
- Tap a card → **SessionDetailModal**: signup lists with relative times, session notes,
  edit form (activity presets, times, expected-kids defaulting to the section YP total,
  permit-holders-needed, notes) and a restorable "Not on water this week" toggle.
- `/water-rota/me` — **My week**: the user's commitments bucketed this week / next week /
  later, with inline withdraw (confirm dialog when leaving a session short).
- `/water-rota/setup` — 3-step wizard: host section + sections + date range → per-section
  programme review with on-water checkboxes (weekly-slot fallback) → preview + resumable
  creation + initial config write.
- Identity: signups write to the user's own member row, resolved by stored choice →
  unique full-name match → one-time picker (`useRotaIdentity`).
- Cover status: green covered / amber covered-only-with-backups / red short / grey
  not-on-water or target-unset (`rotaDisplay.js`).

## Storage design

One OSM FlexiRecord per calendar year — `Viking Water Rota <year>` — created in a
leader-chosen **host section** (usually Adults; it must contain all permit holders).
Rows are host-section members. Two column kinds:

- `RotaConfig` — whole-plan config JSON (date range, per-section defaults). Each plan
  editor writes the full config to **their own row**; readers take the last-writer-wins
  winner across rows by `(v, at)`.
- `S_<yyyymmdd>_<sectionid>` — one column per session. Column name is the session
  identity (immutable, matching OSM's lack of column rename/delete). A cell holds the
  row member's signup (`s`: `"I"` in / `"B"` backup, `sat` timestamp) plus an optional
  session-metadata candidate (`m`: activity, times, expected kids `k`, permits needed
  `p`, notes `n`, not-on-water flag `c`), merged LWW across the column.

Key property: **each user only ever writes their own row**, so signups can never
conflict across users; only metadata needs LWW resolution. Encoding/merging lives in
`src/features/water-rota/services/rotaEncoding.js` (pure, clock-free, zod-validated).

Sessions are generated from each section's OSM programme meetings (dates + times), with
a manual weekly-slot fallback for sections whose programme is empty
(`src/features/water-rota/utils/rotaDates.js`).

## Spike questions (verify against live OSM before PR 3 ships)

Record findings here as they are confirmed:

1. **Column count** — is a record with ~40 custom columns (a full summer + config) fine
   in OSM's UI and API? Fallback if not: one record per term (~13 columns), encoding
   unchanged.
2. **Cell size** — confirm a ~4KB cell value survives `update-flexi-record` round-trips
   so session notes are safe. Cells are designed to stay under 1KB.
3. **Cross-term persistence** — confirm cell values persist when the host section's term
   changes (values should be per-member, term only selects the roster). Fallback: record
   per term.
4. **Programme endpoint shape** — exact query params and response fields of
   `GET /ext/programme/` for our sections (the public OSM API spec is anonymized).
   Confirm `starttime`/`endtime` presence; fall back to per-section preset times if
   absent.
5. **Permissions key** — the exact `section.permissions` key/threshold that indicates
   flexi-record write access (used to gate plan editing and signup).

## Deferred beyond v1

- Ratio-aware cover by permit type + permit registry with expiry dates (the versioned
  `m` object extends without column changes).
- Notifications when a session is short or a holder withdraws.
- Auto-promotion of backups; safety-boat / first-aider role tracking; export/print.
