# Water Session Permit Rota

Plan and staff regular on-water sessions across sections (e.g. Cubs Tuesday, Scouts Friday)
over a summer date range. Section leaders see per-session cover status; permit holders sign
up (confirmed or backup) and see their week at a glance.

Full design plan: agreed 2026-07-10 (see PR description). Term-model rework (per-section
records, season-bucket picker): agreed 2026-07-13/14, see
`docs/features/water-rota-term-model-prd.md`. This document tracks the as-built storage
design.

## Feature map

- `/water-rota` — the board: a **season picker** (only buckets with a discovered record
  are offered) driving the term overview strip (one status dot per session per week),
  week-bucketed session cards with one-tap `I'm in` / `Backup` signup pills, section
  filter, offline banner, and (for plan editors) a "Sync programme" action that appends
  columns for newly added programme meetings and flags vanished ones.
- Tap a card → **SessionDetailModal**: signup lists with relative times, session notes,
  edit form (activity presets, times, expected-kids defaulting to the section YP total,
  permit-holders-needed, notes) and a restorable "Not on water this week" toggle.
- `/water-rota/me` — **My week**: the user's commitments bucketed this week / next week /
  later, aggregated across every record in the selected season, with inline withdraw
  (confirm dialog when leaving a session short).
- `/water-rota/setup` — per-section wizard: section + its own term (host section
  auto-detected, read-only) → programme review for that section only, with on-water
  checkboxes (weekly-slot fallback) → preview + resumable creation + initial config
  write. Re-running against an already-set-up (section, term) seeds the wizard from its
  existing record.
- Identity: signups write to the user's own member row, resolved once per **host
  section** by stored choice → unique full-name match → one-time picker
  (`useRotaIdentity`), with a "Change who I am" re-pick control on the board and My week.
- Cover status: green covered / amber covered-only-with-backups / red short / grey
  not-on-water or target-unset (`rotaDisplay.js`).

## Storage design

One OSM FlexiRecord per **(planning section, that section's own term)**, all hosted in
the Adults section (it must contain all permit holders; auto-detected by
`findHostSection`) — not one record per calendar year. Each record covers exactly one
planning section's sessions and config.

**Record name:** `Viking Water Rota <SectionName> <SeasonBucket> [<sectionid>.<termid>]`,
e.g. `Viking Water Rota Scouts Summer 2026 [49097.924956]`. `<sectionid>.<termid>` are the
**planning** section's own ids — record identity is fully name-derived and never depends
on term resolution. `<SeasonBucket>` (`Spring/Summer/Autumn <year>`) is a deterministic
label computed from the planning term's date-range midpoint
(`seasonBucketForRange`, `rotaTemplates.js`), not the raw OSM term name (raw names are
unreliable across sections — see spikes below). The app never shows the raw record name;
it displays section + bucket labels. Parsing lives in `parseRotaRecordName`
(`rotaTemplates.js`).

The **host section's** termid is not part of a record's identity — it is a mere API/cache
parameter for structure/grid reads, resolved at call time from the app's cached
current-active-term lookup (`CurrentActiveTermsService.getCurrentActiveTerm`) inside
`loadRota`. Discovery is one `getFlexiRecords` call on the host section
(`discoverRotaRecords`), grouping the parsed records by season bucket; the board's season
picker loads all records in the chosen bucket and aggregates them into one group view
(`loadRotaGroup` / `assembleRotaGroup`) so `rotaDisplay.js` and the board/My-week
components consume the same shape as before the rework.

Rows are host-section members. Two column kinds per record:

- `RotaConfig` — a single-section plan config JSON (date range, one section's defaults —
  `sid`/`sname`/`act`/`st`/`en`/`k`/`p`/`regulars`, plus per-session overrides). Each plan
  editor writes the full config to **their own row**; readers take the last-writer-wins
  winner across rows by `(v, at)`. There is nothing to merge across sections — a record
  covers exactly one section, so no config-merge step exists.
- `S_<yyyymmdd>_<sectionid>` — one column per session. Column name is the session
  identity (immutable, matching OSM's lack of column rename/delete); the sectionid stays
  in the key so session keys never collide when the board aggregates records from
  multiple sections. A cell holds the row member's signup (`s`: `"I"` in / `"B"` backup,
  `sat` timestamp) plus an optional session-metadata candidate (`m`: activity, times,
  expected kids `k`, permits needed `p`, notes `n`, not-on-water flag `c`), merged LWW
  across the column.

Key property: **each user only ever writes their own row**, so signups can never
conflict across users; only metadata needs LWW resolution. Encoding/merging lives in
`src/features/water-rota/services/rotaEncoding.js` (pure, clock-free, zod-validated).

Sessions are generated from each section's OSM programme meetings (dates + times), with
a manual weekly-slot fallback for sections whose programme is empty
(`src/features/water-rota/utils/rotaDates.js`).

## Spikes — resolved (verified 2026-07-13, live OSM)

1. **Column count** — no longer a concern: a record now covers one section's sessions
   (~14 columns + config) instead of a full-summer, all-sections year record.
2. **Cell size** — confirmed a ~4KB cell value round-trips `update-flexi-record` safely.
3. **Cross-term persistence** — confirmed: flexi cell values are per-member and
   **not term-scoped**; `termid` only selects the read/roster context, never the data.
   Term rollover never loses data. This is what makes the host termid a pure call-time API
   parameter (above) rather than part of a record's identity — the actual problem the old
   year-model had was record *discovery* depending on the current active term, not data
   loss.
4. **Programme endpoint shape** — confirmed `GET /ext/programme/` returns usable
   `starttime`/`endtime` for our sections; no fallback needed in practice.
5. **Permissions key** — confirmed and in use to gate plan editing and signup
   (`useRotaPermissions.js`).

Additional live-OSM fact that shaped the term-model rework: **OSM terms are per-section**
— each section has its own termids, names, and dates, and no termid is shared across
sections, so no single record can be scoped to "the group's" term. See
`water-rota-term-model-prd.md` §1 for the full write-up.

## Deferred beyond v1

- Ratio-aware cover by permit type + permit registry with expiry dates (the versioned
  `m` object extends without column changes).
- Notifications when a session is short or a holder withdraws.
- Auto-promotion of backups; safety-boat / first-aider role tracking; export/print.
