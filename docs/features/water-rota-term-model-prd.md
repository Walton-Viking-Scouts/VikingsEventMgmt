# Water Rota — Term-Model Rework: PRD & Implementation Plan

**Status:** Ready to build · **Created:** 2026-07-13 · **Revised:** 2026-07-14 (per-section-record model, verified against live OSM)
**Type:** Storage-model + workflow rework. Clean rebuild, **no migration, no back-compat** (OSM verified CLEAN — zero water-rota records live or archived in any section).
**Companions:** `water-rota-review.md` (as-built + red-team), `water-rota-term-model-handover.md` (partially superseded — see §1), `water-rota.md` (as-built storage spec).
**Delivery:** ONE feature branch, ONE PR, clean commits per work package (§9).

---

## 1. Summary + goals / non-goals

### Problem

The shipped rota (v2.19.0→v2.22.0) is one FlexiRecord per calendar year, and every
read/write/cache keys on the host section's **current active term**
(`resolveRotaTermId`, `rotaService.js:109-120`). When OSM rolls the term, offline
users get a blank board from a cache-key miss (`getFlexiData` keys on `termid`,
`database.js:1611`). Setup is an all-sections wizard writing one shared
`RotaConfig` doc that two leaders can clobber cross-device (red-team #4).

### Live-OSM facts that shape the design (verified 2026-07-13/14, Simon)

1. **Flexi cell values are NOT term-scoped.** They are per-member and
   term-independent; `termid` only selects the roster/read context. Term rollover
   never loses data — the termid used for reads matters for **cache/read
   consistency only** (the SQLite/IndexedDB flexi cache keys on termid,
   `database.js:1611`).
2. **OSM terms are PER-SECTION.** Each section has its own termids, names, and
   dates. The Adults host section (11107) has ONLY whole-year terms ("2026",
   termid 901823, 2026-01-01→2026-12-31). Youth sections have seasonal terms with
   *different* termids and dates for the same season: eight sections' Summer-2026
   terms span Apr 1–Jul 17 through Apr 12–Aug 31 (termids 846930–927091), with
   names varying ("Summer 2026", "Summer Term 2026"; historically "2023-Summer",
   bare "Autumn"). **Term names are not reliable identifiers and no termid is
   shared across sections.**

Fact 2 kills any "one shared record per term" design: a record named for the
Cubs term is undiscoverable by a Scouts leader (different termid, name, dates) →
duplicate records by design. Dead.

### The model (one line, DECIDED with Simon 2026-07-13/14)

> **One FlexiRecord per (planning section, that section's own term), ALL hosted in
> the Adults host section.** Each record holds ONE plain `RotaConfig` column
> (single section → nothing to merge) plus that section's date-bearing
> `S_<yyyymmdd>_<sid>` columns. Record identity — planning sectionid, planning
> termid, season bucket — machine-parses from the record **name**. The board
> picks a **season bucket** ("Summer 2026"), loads ALL
> sections' records in that bucket, and aggregates them into the existing
> group-wide view.

Consequences vs. the shared-record draft: no join flow, no cross-section
first-setup race, no `RotaConfig_<sid>` columns, no config merging of any kind.
New cost: the board becomes a **multi-record aggregation** (§5).

### Goals

1. Per-(section, section-term) records hosted in Adults; record identity is
   fully name-derived and never depends on any term resolution
   (`resolveRotaTermId` and its year-model discovery deleted). The host termid is
   a mere API/cache parameter, resolved at call time from the cached
   current-active-term lookup (§3.3).
2. Per-section setup that creates/completes only that section's own record,
   against that section's own terms.
3. Board **season-bucket picker** driving `useWaterRota(seasonBucket)`; the board
   aggregates N records into the existing group-wide view; My-week aggregates
   across records.
4. Discovery = ONE `getFlexiRecords` call on the host section.
5. Identity resolved/stored **once per host section** (not per record) + a
   "Change who I am" re-pick control (`useRotaIdentity.clear()`, red-team #3).
6. Delete all year-model / all-sections-wizard / shared-config code.

### Non-goals (deferred / unchanged decisions)

- **Cover semantics (red-team #2) — DEFERRED.** Keep the auto-confirm status quo:
  `prefillRegulars` writes regulars as confirmed (`rotaService.js:381-419`),
  `coverStatus` stays `confirmed >= needed` (`rotaDisplay.js:33-47`). No change to
  `rotaDisplay.js` cover logic in this rework.
- **Migration — NONE.** OSM verified clean; no reader for the old year model ships.
- **Permit holders outside the host section (red-team #5)** — rows remain Adults
  members. Now an explicit design choice: Adults hosting is *why* any permit
  holder can sign up for any section's sessions.
- No new DB tables, no storage-layer migrations (do not touch
  `src/shared/services/storage/` schema).

---

## 2. Target model — encoding spec

Examples use planning section `49097` ("Scouts", own term 924956 "Summer 2026",
Apr 1–Aug 31) and host section `11107` (Adults, year-term 901823).

### 2.1 Record: one per (planning section, planning term), hosted in Adults

**Name format:** `Viking Water Rota <SectionName> <SeasonBucket> [<sectionid>.<termid>]`

> Example: `Viking Water Rota Scouts Summer 2026 [49097.924956]`

- `<SectionName>` — planning section's display name (readable in OSM's own UI).
- `<SeasonBucket>` — the deterministic season label (§2.2), **not** the raw OSM
  term name (raw names are unreliable: "Summer Term 2026", "2023-Summer",
  "Autumn"). Baking the bucket into the **name** (rather than config) is the
  proposed choice because discovery must group records into picker buckets from
  the cached flexi list alone — no record read, works offline.
- `[<sectionid>.<termid>]` — the machine key; **both ids are the planning
  section's own**:
  - `sectionid` — planning section whose sessions/config this record holds.
  - `termid` — the planning section's **own** term the plan was built from
    (identity + programme re-sync context).
- The host section's termid is deliberately **not** part of the record identity —
  it is a mere API/cache parameter, resolved at call time from the app's cached
  current-active-term lookup (§3.3).
- The app never displays the raw record name (it shows section + bucket labels).
- The old year-name parse (`Viking Water Rota 2026`) returns null — good.

```js
// rotaTemplates.js
export const ROTA_RECORD_NAME_PREFIX = 'Viking Water Rota';

export function buildRotaRecordName({ sectionName, seasonBucket, sectionId, termId }) {
  return `${ROTA_RECORD_NAME_PREFIX} ${sectionName} ${seasonBucket} [${sectionId}.${termId}]`;
}

export function parseRotaRecordName(name) {
  const match = /^Viking Water Rota (.+) ((?:Spring|Summer|Autumn) \d{4}) \[(\d+)\.(\d+)\]$/
    .exec(String(name ?? '').trim());
  return match
    ? { sectionName: match[1].trim(), seasonBucket: match[2],
        sectionId: match[3], termId: match[4] }
    : null;
}
```

`parseRotaRecordYear` (`rotaTemplates.js:120-123`) is **deleted**.

### 2.2 Season bucket — deterministic from the planning term's dates

Term names are unreliable; dates are not. Derive the bucket from the planning
term's date range **at creation time** (pure function in `rotaTemplates.js`):

```js
// Midpoint month -> UK school-season bucket: Jan–Mar Spring, Apr–Aug Summer, Sep–Dec Autumn.
export function seasonBucketForRange(startISO, endISO) {
  const mid = new Date((Date.parse(startISO) + Date.parse(endISO)) / 2);
  const month = mid.getUTCMonth() + 1;
  const season = month <= 3 ? 'Spring' : month <= 8 ? 'Summer' : 'Autumn';
  return `${season} ${mid.getUTCFullYear()}`;
}
```

All eight live Summer-2026 term variants (Apr 1–Jul 17 … Apr 12–Aug 31) midpoint
into May–June → `Summer 2026`. A Dec–Feb straddling term midpoints into January →
`Spring <later year>` — consistent across sections, which is all that matters:
the bucket is a deterministic *grouping key*, not a term name.

### 2.3 Session columns — UNCHANGED

`S_<yyyymmdd>_<sectionid>` stays (`rotaEncoding.js:117-134`). Per record they are
all one section's columns, but the sectionid **stays in the key for cross-record
uniqueness when the board aggregates** — the column name is the session's React
key and URL identity (`rotaDisplay.js:117-121`, `?session=` at
`RotaBoardPage.jsx:75`). `buildSessionColumnName` / `parseSessionColumnName` /
`parseSessionCell` / `mergeSessionColumn` / `encodeSignup` / `encodeSessionMeta`
are untouched.

### 2.4 Config — ONE plain `RotaConfig` column per record, single-section payload

The per-section `RotaConfig_<sid>` columns idea is **dead** — a single-section
record makes it redundant. Keep `ROTA_CONFIG_COLUMN = 'RotaConfig'`
(`rotaEncoding.js:29`) but reshape the payload to one section's plan:

```jsonc
{
  "v": 3,                         // LWW version
  "at": "2026-07-14T18:30:00Z",   // ISO instant, LWW tiebreak
  "by": "Jane Leader",
  "cfg": {
    "sid": "49097",
    "sname": "Scouts",
    "act": "Kayaking",            // section default activity
    "st": "18:30",
    "en": "20:00",
    "k": 24,                      // expected YP default (optional)
    "p": 4,                       // permit holders needed default (optional)
    "regulars": ["101", "102"],   // scoutids pre-filled as confirmed
    "start": "2026-06-02",        // plan date range
    "end":   "2026-07-21",
    "sessions": {                 // per-session overrides + not-on-water weeks
      "S_20260609_49097": { "c": 1, "pt": "Camp weekend" },
      "S_20260616_49097": { "act": "Canoeing", "pt": "River trip" }
    }
  }
}
```

- `cfg.termId` (today at `rotaEncoding.js:79`) is removed — identity lives in the
  record name. `cfg.sections[]` (array) becomes the flat single-section object.
- **Write target unchanged:** the deterministic **anchor row** (lowest-scoutid
  host member, `RotaSetupWizard.jsx:341-349`), LWW by `(v, at)` across rows via
  the existing locked read-merge-write (`rotaService.js:347-364`). This keeps
  "did setup finish" decoupled from identity resolution. The only concurrent
  writers are co-leaders of the *same* section, which LWW already resolves.
- **`mergeSectionConfig` (`rotaSetupPlan.js:46-76`) and the
  `mergeSections`/`transformCfg` path (`rotaSetupService.js:74-91`,
  `rotaService.js:343,355`) are deleted** — there is nothing to merge.

**Zod change** (`rotaEncoding.js`): `rotaConfigSchema.cfg` becomes the
single-section object (`sid`/`sname`/`act`/`st`/`en` required; `k`/`p`/`regulars`/
`start`/`end`/`sessions` optional; `.passthrough()` kept for forward-compat).
`sectionDefaultsSchema` (`rotaEncoding.js:41-54`) folds into it;
`sessionOverrideSchema`/`sessionMetaSchema`/`sessionCellSchema` unchanged.
`parseConfigCell` / `mergeLwwConfig` / `encodeConfig` keep their names and LWW
semantics — only the `cfg` shape changes.

### 2.5 Group-view assembly (board consumer shape preserved)

The board consumes `rota.config.cfg.sections[]` + `cfg.sessions{}`
(`rotaDisplay.js:84-91`, `RotaBoardPage.jsx:102-112`). Assemble that from the N
loaded records of a bucket so **`rotaDisplay.js` stays untouched**:

```js
// rotaService.js — pure
export function assembleGroupConfig(records) {   // records: LoadedRota[] (each .config may be null)
  const sections = [];
  const sessions = {};
  let start, end;
  for (const record of records) {
    const c = record.config?.cfg;
    if (!c) continue;
    sections.push({ sid: c.sid, sname: c.sname, act: c.act, st: c.st, en: c.en,
                    k: c.k, p: c.p, regulars: c.regulars ?? [] });
    Object.assign(sessions, c.sessions ?? {});   // S_<date>_<sid> keys never collide across records
    start = !start || (c.start && c.start < start) ? (c.start ?? start) : start;
    end   = !end   || (c.end   && c.end   > end)   ? (c.end   ?? end)   : end;
  }
  return sections.length ? { cfg: { start, end, sections, sessions } } : null;
}
```

Null when no record has config yet → the board's "setup isn't finished" banner
(`RotaBoardPage.jsx:378-397`) still triggers.

---

## 3. Discovery, season picker, and read-termid design

### 3.1 Host section resolution

All records live in the Adults section, so discovery resolves the host first.
Extract the wizard's existing heuristic (`RotaSetupWizard.jsx:111-116`) into a
shared pure helper:

```js
// rotaService.js
export function findHostSection(sections) {
  return (sections ?? []).find((s) =>
    `${s.section ?? ''} ${s.sectionname ?? ''}`.toLowerCase().includes('adult')) ?? null;
}
```

If no Adults section is visible to the user, discovery falls back to scanning all
cached sections' flexi lists (rare; a user without Adults access cannot read the
records anyway, so the fallback mostly shapes the empty-state message).

### 3.2 Discovery — ONE flexi-list call

```js
export async function discoverRotaRecords(token, priority = 0) {
  const sections = (await databaseService.getSections()) || [];
  const hostSection = findHostSection(sections);
  const scan = hostSection ? [hostSection] : sections;        // fallback per §3.1
  const byIdentity = new Map();                               // `${sectionId}.${termId}` -> descriptor
  for (const section of scan) {
    const list = await getFlexiRecords(section.sectionid, token, 'n', false, priority);
    for (const item of list?.items || []) {
      const parsed = parseRotaRecordName(item.name);
      if (!parsed) continue;
      const key = `${parsed.sectionId}.${parsed.termId}`;
      const existing = byIdentity.get(key);
      // NUMERIC lowest-extraid dedupe for accidental same-name duplicates.
      if (!existing || Number(item.extraid) < Number(existing.recordId)) {
        byIdentity.set(key, { ...parsed, recordId: item.extraid, hostSection: section });
      }
    }
  }
  return [...byIdentity.values()];
}
```

- Replaces the loop-over-all-sections discovery (`rotaService.js:81-101`) with one
  `getFlexiRecords` call on the host in the normal case, riding the same cached
  flexi list (`rotaService.js:87` pattern) so it works offline after first load.
- Descriptors carry record identity only (`sectionId`, `termId`, `seasonBucket`,
  `recordId`, `hostSection`); the host read-context termid is **not** in the
  descriptor — `loadRota` resolves it itself (§3.3).
- Dedupe is `Number(extraid)` comparison, not `localeCompare` (extraids `9` vs
  `10` must pick `9`).

### 3.3 Read-context termid — resolved at call time

`loadRota(descriptor, ...)` resolves the host read-context termid **at call time**
from the app's existing cached current-active-term lookup —
`CurrentActiveTermsService.getCurrentActiveTerm(descriptor.hostSection.sectionid)`
(`currentActiveTermsService.js:7-25`, an IndexedDB read: cached,
offline-capable) — and threads it through every
`getFlexiStructure`/`getSingleFlexiRecord` (`flexiRecords.js:57,82`),
`updateFlexiRecord`/`multiUpdateFlexiRecord`, and `saveFlexiData`/`getFlexiData`
(`database.js:1603,1674`) call as `(extraid, hostSectionId, hostTermid)`.

This is **not** the old `resolveRotaTermId` bug returning: the bug was that
record *identity* and *discovery* depended on the current active term, so
rollover orphaned the record. Here identity and season are fully name-derived;
the host termid is a mere API/cache parameter. `resolveRotaTermId`
(`rotaService.js:109-120`) is still **deleted** — the resolution lives inside
`loadRota` against the host section, not the planning section.

**Accepted edge:** a device offline across the host section's year-term
rollover (Jan 1) can cache-miss records whose season straddles the year — once
its current-active-terms store has rolled to the new Adults termid (any online
`getTerms` refresh, `terms.js:157-237`) but its flexi grids are still cached
under the old one, the board is blank until the next online load re-caches the
grids. Self-healing, and no data loss — values aren't term-scoped (fact 1).
**Operating assumption (Simon, 2026-07-14): water sessions run April–September
at most, so no season ever straddles New Year — this edge is theoretical for
this group.**

### 3.4 Season picker data source & default

- **Source:** group `discoverRotaRecords()` output by `seasonBucket`. Only buckets
  that actually have records appear — offline-safe, no `getTerms` needed.
- **Default selection:** the bucket whose season window contains today (derive the
  window from the label: Spring = Jan–Mar, Summer = Apr–Aug, Autumn = Sep–Dec of
  the labelled year); else the latest bucket by `(year, season order)`.
- **Setup term source (unchanged mechanism):** the wizard lists
  `getTerms(token)[sectionId]` for the **planning section's own terms**
  (`RotaSetupWizard.jsx:220-223`), defaulting to its current active term
  (`RotaSetupWizard.jsx:234-247`).

---

## 4. Per-section setup workflow

Replaces the 3-step all-sections wizard. **One section, one record, per run.**
There is no join flow and no cross-section race: each section's setup only ever
touches its own record.

### 4.1 Steps (UX)

**Step 1 — Section + term.**
- **Section:** single-select (today's multi-select chips at
  `RotaSetupWizard.jsx:457-480` become one choice; default = the leader's first
  youth section, reusing the waiting-list/adults filters at
  `RotaSetupWizard.jsx:109-124`).
- **Host:** auto-detected Adults (§3.1), shown read-only ("the rota roster lives
  here so every permit holder can sign up"). Error state if no Adults section.
- **Term:** dropdown of the planning section's **own** terms via `getTerms`,
  default current active. Date range seeds from the term and is fine-tunable
  (`RotaSetupWizard.jsx:482-529` behaviour kept).
- **Re-edit:** if `discoverRotaRecords()` already has a record for
  `(section, term)`, seed the wizard from its config (adapting the seed-from-
  config effect at `RotaSetupWizard.jsx:134-191`, minus the multi-section
  reconstruction).

**Step 2 — Programme review (this section only).** Fetch this section's programme
for the chosen term (`fetchProgrammeMeetings`), auto-pick water nights
(`looksLikeWaterSession`), section defaults (activity/times/expected-YP/permits),
regulars via `useSectionLeaders`/`useSectionYPCounts`. No section tab strip
(`RotaSetupWizard.jsx:544-563` deleted).

**Step 3 — Preview + create.** Resumable create-or-complete → config write →
regulars prefill.

### 4.2 Service calls

```
section = {sid, sname}; term = the section's own {termid, name, startdate, enddate}
hostSection = findHostSection(sections)
hostTermId  = (await CurrentActiveTermsService.getCurrentActiveTerm(hostSection.sectionid)).currentTermId
bucket      = seasonBucketForRange(term.startdate, term.enddate)

// A. Create or complete (idempotent — adds only missing columns, flexiRecordCreationService.js:224;
//    force-refreshes the list before any create, flexiRecordCreationService.js:103-107)
result = await createOrCompleteRota({
  hostSection, hostTermId,                         // hostTermId: resolved current host termid,
                                                   // used ONLY for the creation API's structure reads —
                                                   // it is NOT part of the record identity or name
  record: { sectionId: sid, sectionName: sname, termId: term.termid, seasonBucket: bucket },
  sessions: waterSessionsForThisSection,           // -> S_<date>_<sid> columns
  token,
})
// template.name   = buildRotaRecordName({sectionName, seasonBucket, sectionId, termId})  (§2.1)
// template.fields = [ROTA_CONFIG_COLUMN, ...sessionColumnNames]

// B. Load the record; write its config to the anchor row (as-built pattern, no merge)
rota = await loadRota(descriptor, token, { forceRefresh: true })
await writeConfig({ rota, configFieldId, scoutid: anchorRow.scoutid, by,
  cfg: { sid, sname, act, st, en, k, p, regulars,
         start: range.start, end: range.end,
         sessions: buildSessionOverrides(thisSectionsSessions, [sectionDefault]) },
  token })                                          // plain LWW-bumped replace

// C. Prefill this section's regulars onto newly created columns only
//    (result.addedFields guard as at RotaSetupWizard.jsx:384-399), throttled (§4.3)
await prefillRegulars({ rota, regularsBySection: { [sid]: regulars }, token, sessions: newSessions })
```

Re-running setup is idempotent end-to-end: only missing columns are added, and
prefill targets only `addedFields` (never re-touching sessions, so withdrawals
survive re-edits, as today).

### 4.3 Rate limiting — prefill throttle

`prefillRegulars` fires back-to-back `multiUpdateFlexiRecord` calls
(`rotaService.js:389-416`). Add a fixed inter-call delay:

```js
const PREFILL_THROTTLE_MS = 300;
// between session iterations:
await new Promise((resolve) => setTimeout(resolve, PREFILL_THROTTLE_MS));
```

Per-section setup fills one section's sessions per run (typically ≤ ~14), so this
adds ≤ ~4s worst case — cheap insurance on top of the underlying rate-limit queue.

### 4.4 Sync programme / activate session

`syncRotaWithProgramme` (`rotaSetupService.js:136-286`) simplifies to **one
record, one section**: fetch that section's programme for the record's own
planning `termId`, diff (`diffSessions`), append columns, backfill titles into the
single-section config. The multi-section loop and its unchecked/failed-sections
bookkeeping (`rotaSetupService.js:148-186`) collapse to a single section's result.
The board's "Sync programme" action iterates the bucket's records sequentially and
reports per section. `activateWaterSession` (`rotaSetupService.js:305-341`) keeps
its shape — it operates on the owning record's rota.

---

## 5. Board changes — season picker + multi-record aggregation

### 5.1 Loading: `useWaterRota(seasonBucket)` → `loadRotaGroup`

```js
// rotaService.js
export async function loadRotaGroup(seasonBucket, token, { forceRefresh = false, priority = 0 } = {}) {
  const descriptors = (await discoverRotaRecords(token, priority))
    .filter((d) => !seasonBucket || d.seasonBucket === seasonBucket);
  if (descriptors.length === 0) return null;
  const records = await Promise.all(descriptors.map((d) => loadRota(d, token, { forceRefresh, priority })));
  return assembleRotaGroup(seasonBucket, records.filter(Boolean));
}
```

- **Read cost, explicit:** cold load = 1 flexi-list read + N × (structure + grid)
  ≈ `1 + 2N` requests (N ≤ 9 sections → ≤ 19). Dispatched in parallel via
  `Promise.all` but **paced by the shared rate-limit queue** every flexi read
  already rides (`flexiRecords.js:57,82` → `withRateLimitQueue`), at the existing
  deep-link priority (`useWaterRota.js:35`). Warm loads serve the flexi cache;
  offline renders entirely from cache under each record's
  `(extraid, hostSectionId, resolved host termid)` key (§3.3).
- `loadRota(descriptor, ...)` is today's `loadRota` (`rotaService.js:136-215`)
  minus discovery, resolving the host read-termid per §3.3: structure validation
  (`vikingWaterRotaValidation.js` is unchanged in shape — single `RotaConfig` +
  `S_` columns), single-section config merge, session-column merges, grid cache
  write, photo map, members.

### 5.2 Group shape

```js
// assembleRotaGroup(seasonBucket, records) ->
{
  seasonBucket,                          // 'Summer 2026'
  hostSection,                           // shared Adults section (from any record)
  records,                               // LoadedRota[] — each keeps recordId, termId (host read-termid resolved at load, §3.3), configFieldId
  config: assembleGroupConfig(records),  // §2.5 — board consumer shape
  sessions,                              // union of records' sessions, each + { record } back-reference
  members,                               // Adults roster (same rows in every record — take from first)
  sectionNames,                          // as today (rotaService.js:224-236)
}
```

`LoadedRota.year` is **deleted**. Every aggregated session carries a `record`
back-reference so writes route to the owning record.

### 5.3 Write routing

`writeSignup` / `writeSessionMeta` / `assignSignup` keep their signatures
(`rotaService.js:267-331`) — callers pass `session.record` as the `rota`
argument. Two aggregation-specific fixes:

- **`fieldId` is only unique per record** (`f_1` exists in every record). The
  pending-state key in `useRotaSignup` (`useRotaSignup.js:35-42`,
  `pendingFieldId`) becomes the session **key** (column name — globally unique
  per §2.3); `setSignup(session, status)` replaces `setSignup(fieldId, status)`.
  Call sites updated: `RotaBoardPage.jsx:201-212,494,523`,
  `MyCommitmentsPage.jsx:56-63,148,170`, and `SessionDetailModal`.
- The module-level write lock (`rotaService.js:45-58`) already serializes across
  records (it is per-module, not per-record) — unchanged.

### 5.4 Picker UI + URL

- `RotaBoardPage` renders a season dropdown from the discovered buckets (§3.4);
  heading becomes "Water Rota {seasonBucket}".
- The picked bucket lives in the URL as `?season=Summer+2026` alongside the
  existing `?session=` / `?section=` params (`RotaBoardPage.jsx:74-94`) so shared
  links pin the season. Default when absent: §3.4.
- The deep-link fast path (`useWaterRota.js:49-116` — reference-data-ready
  re-run, raised priority, latest-request-wins epoch guard) is preserved
  verbatim; it wraps `loadRotaGroup` instead of `loadRota(year)`. Discovery needs
  cached sections, so the same ready-signal gating covers the picker list too.
- Section filter, YP counts, `resolveAllSessions`, `TermOverviewStrip`, week
  bucketing all read the assembled `config`/`sessions` and are unchanged
  (`RotaBoardPage.jsx:96-181`).

### 5.5 My week

`MyCommitmentsPage` reads the same aggregated group — `resolveAllSessions` +
`myStatusFor` (`MyCommitmentsPage.jsx:40-47`) already operate on the assembled
view, so commitments naturally span every section's record in the bucket.

---

## 6. Identity — once per host section + re-pick control

Every record shares the Adults roster, so identity must resolve **once**, not
once per record (today it is keyed per `recordId`, `useRotaIdentity.js:47-49`,
which under this model would prompt N times):

- `identityStorageKey(recordId)` → `viking_rota_identity_<hostSectionId>`.
  `useRotaIdentity(rotaGroup)` reads `rotaGroup.hostSection.sectionid` +
  `rotaGroup.members`; the resolution order (stored choice → unique full-name
  match → picker, `useRotaIdentity.js:63-100`) is unchanged.
- **Re-pick control (red-team #3, in scope):** `clear()`
  (`useRotaIdentity.js:114-119`) is wired to nothing today. Add a "Signed in as
  **{name}** · Change" control on `RotaBoardPage` (near the header) and a
  matching "Change who I am" affordance on `MyCommitmentsPage`
  (`MyCommitmentsPage.jsx:115-121`), both calling `clear()` then opening the
  existing `IdentityPickerModal` (`RotaBoardPage.jsx:501-509`,
  `MyCommitmentsPage.jsx:96-104`).

---

## 7. Deletion list (clean rebuild, no deprecation)

| File | Delete / replace |
|---|---|
| `services/rotaTemplates.js` | `buildRotaRecordName(year)` → identity-object form (§2.1); **delete** `parseRotaRecordYear`; **add** `parseRotaRecordName`, `seasonBucketForRange` |
| `services/rotaEncoding.js` | Reshape `rotaConfigSchema.cfg` to single-section (§2.4); **delete** `cfg.termId` and the `sections[]`-array shape (`sectionDefaultsSchema` folds in); keep `ROTA_CONFIG_COLUMN`, `parseConfigCell`, `mergeLwwConfig`, `encodeConfig` (payload shape change only) |
| `services/rotaService.js` | **Delete** `resolveRotaTermId` (`:109-120`) and year-based `discoverRotaRecord` (`:81-101`); **add** `findHostSection`, `discoverRotaRecords` (host-only, numeric dedupe), descriptor-based `loadRota` (resolves the host read-termid at call time, §3.3), `loadRotaGroup`, `assembleGroupConfig`, `assembleRotaGroup`; **delete** `writeConfig`'s `transformCfg` param (`:343,355`); throttle `prefillRegulars`; `LoadedRota.year` gone |
| `utils/rotaSetupPlan.js` | **Delete** `mergeSectionConfig` + `earlier`/`later` helpers (`:17-33,46-76`). Keep `buildSessionOverrides` |
| `services/rotaSetupService.js` | Rewrite `createOrCompleteRota` (record identity + single section), `writeRotaConfig` (drop `mergeSections`, `:74-91`), `syncRotaWithProgramme` (single record; drop multi-section loop `:148-186`), `activateWaterSession` (owning record) |
| `components/setup/RotaSetupWizard.jsx` | Remove sections multi-select (`:457-480`), per-section tab strip (`:544-563`), host-section select (`:436-455` → read-only Adults), multi-section seed reconstruction (`:154-180`); single-section flow |
| `hooks/useWaterRota.js` | Remove `new Date().getFullYear()` default (`:44`); take `seasonBucket`; wrap `loadRotaGroup` |
| `hooks/useRotaSignup.js` | `pendingFieldId` → pending session key; `setSignup(session, status)` |
| `hooks/useRotaIdentity.js` | Per-record storage key (`:47-49`) → per-host-section; accept the rota group |
| `components/RotaBoardPage.jsx` | Season picker + `?season=`; heading; identity re-pick; signup call-site updates |
| `components/MyCommitmentsPage.jsx` | Aggregated group; identity re-pick; signup call-site updates |
| `services/vikingWaterRotaValidation.js` | Unchanged in shape (single `RotaConfig` + `S_` columns) — doc-comment updates only |

### Tests removed / rewritten

- **Delete:** `rotaSetupPlan.test.js` `mergeSectionConfig` block (`:63-104`);
  `rotaSetupService.test.js` `mergeSections` config cases;
  `rotaService.test.js` year-based discovery cases (`:96-124`).
- **Rewrite:** `rotaEncoding.test.js` config round-trips (`:179-215`) to the
  single-section shape; `rotaService.test.js` `loadRota` (`:126-269`) for
  descriptor + call-time host read-termid; `rotaTemplates.test.js` naming;
  `useWaterRota.test.jsx` for bucket + group; `useRotaIdentity.test.jsx` for the
  per-host-section key.

---

## 8. Test plan

Vitest, colocated `__tests__` (existing pattern: pure functions direct; services
mock the flexi API + `databaseService` as `rotaService.test.js` already does).

### 8.1 Pure functions

| Function | Cases |
|---|---|
| `buildRotaRecordName` / `parseRotaRecordName` | round-trip; section names with spaces/digits ("1st Walton Scouts"); extracts both ids + bucket from the two-part bracket; old year name `Viking Water Rota 2026` → null; old three-part-bracket names → null; junk → null |
| `seasonBucketForRange` | all eight live Summer-2026 ranges (Apr 1–Jul 17 … Apr 12–Aug 31) → `Summer 2026`; Jan–Mar → Spring; Sep–Dec → Autumn; Dec–Feb straddle → Spring of the later year; UTC-deterministic |
| single-section `rotaConfigSchema` | encode/parse round-trip; rejects missing `sid`/`act`; keeps unknown fields (forward-compat, mirrors `rotaEncoding.test.js:67-71`); corrupt → null |
| `mergeLwwConfig` | unchanged LWW cases (`rotaEncoding.test.js:73-96`) over the new payload |
| `assembleGroupConfig` / `assembleRotaGroup` | N records → sections[] + merged sessions{} (no key collisions); range = min/max; configless records skipped; all-configless → null config; sessions carry `record` back-reference; members taken once |
| `findHostSection` | finds Adults by name; null when absent |

### 8.2 Services (mocked API)

- `discoverRotaRecords` — ONE `getFlexiRecords` call when Adults exists; fallback
  scan otherwise; parses identity + bucket from names; **numeric** lowest-extraid
  dedupe (extraids `9` vs `10` picks `9`); ignores non-rota names.
- `loadRota(descriptor)` — resolves the host read-termid once via
  `CurrentActiveTermsService.getCurrentActiveTerm(hostSectionId)` and every
  read/cache call receives that same value consistently (assert
  `getFlexiStructure`/`getSingleFlexiRecord`/`saveFlexiData` args); errors
  cleanly when no host term is cached; single-section config; null config
  tolerated (`rotaService.test.js:244` case preserved); threads `priority`.
- `loadRotaGroup` — filters by bucket; aggregates N records; null when bucket
  empty; a single failed record read fails the group load (surfaced via the
  hook's error state, as today's single-record load does).
- Write routing — `writeSignup` against `session.record` patches **that**
  record's cache slot; the write lock serializes writes to different records.
- `prefillRegulars` — throttle asserted with fake timers; one multi-update per
  on-water session (existing cases `:429-483` adapted).
- `createOrCompleteRota` — template = `[RotaConfig, ...cols]` under the new name;
  idempotent re-run adds only missing columns.
- `syncRotaWithProgramme` — single record: programme fetched under the record's
  own planning `termId`; title backfill into single-section config (existing
  cases `:214-343` adapted; multi-section unchecked/failed cases collapse).

### 8.3 Hooks / components

- `useRotaIdentity` — per-host-section key; same identity across two records;
  `clear()` re-opens the picker (existing tests adapted).
- `useRotaSignup` — pending keyed by session key; two same-`fieldId` sessions in
  different records don't cross-trigger pending state.
- `useWaterRota` — bucket param; deep-link fast path preserved
  (`useWaterRota.test.jsx` adapted).
- `RotaBoardPage` — season picker renders buckets; switching reloads; `?season=`
  round-trip; identity re-pick flow. `RotaSetupWizard` — single-section create.

---

## 9. Work packages (ordered, ONE branch)

Branch: `feature/water-rota-term-model`. Each package = one clean commit. After
**every** package, from `/Users/simon/vsCodeProjects/VikingEventMgmt/ios app`:

```bash
npm run lint && npm run test:run && npm run build
```

### WP1 — Encoding, naming, season bucket (pure)

- **Files:** `services/rotaTemplates.js`, `services/rotaEncoding.js`,
  `services/vikingWaterRotaValidation.js` (comments only); tests
  `rotaTemplates.test.js`, `rotaEncoding.test.js`.
- **Do:** §2.1, §2.2, §2.4 — record name build/parse with the two-part
  `[sid.termid]` bracket, `seasonBucketForRange`, single-section config
  schema. Delete `parseRotaRecordYear`, `cfg.termId`.
- **Acceptance:** §8.1 pure tests green; `git grep parseRotaRecordYear` empty;
  build passes.

### WP2 — Services: discovery, load, group aggregation, write routing

- **Files:** `services/rotaService.js`; tests `rotaService.test.js`.
- **Do:** §3, §5.1–5.3, §2.5 — `findHostSection`, `discoverRotaRecords` (one host
  call, numeric dedupe), descriptor-based `loadRota` resolving the host
  read-termid at call time (§3.3), `loadRotaGroup` +
  `assembleGroupConfig`/`assembleRotaGroup`; delete `resolveRotaTermId` +
  `transformCfg`; throttle `prefillRegulars`.
- **Acceptance:** §8.2 green; asserts prove every read/write/cache within one
  load uses the one consistently resolved host termid; `resolveRotaTermId` gone.

### WP3 — Per-section setup

- **Files:** `services/rotaSetupService.js`, `utils/rotaSetupPlan.js`,
  `components/setup/RotaSetupWizard.jsx`; tests `rotaSetupService.test.js`,
  `rotaSetupPlan.test.js`.
- **Do:** §4 — single-section wizard (section + own-term + read-only Adults
  host), `createOrCompleteRota` with the new record identity, plain config write,
  single-record `syncRotaWithProgramme`/`activateWaterSession`; delete
  `mergeSectionConfig`.
- **Acceptance:** setup tests green; two different sections' setups create two
  independent records in Adults (verified via `npm run dev` against live OSM);
  re-run idempotent.

### WP4 — Board season picker + multi-record aggregation + My week

- **Files:** `hooks/useWaterRota.js`, `hooks/useRotaSignup.js`,
  `components/RotaBoardPage.jsx`, `components/MyCommitmentsPage.jsx`,
  `components/SessionDetailModal.jsx` (signup call sites); tests
  `useWaterRota.test.jsx` + component tests.
- **Do:** §5 — `useWaterRota(seasonBucket)` over `loadRotaGroup`; season dropdown
  + `?season=`; write routing via `session.record`; pending-by-session-key; My
  week over the aggregate; heading label.
- **Acceptance:** board shows two sections' sessions for one bucket; signup on
  each routes to its own record; offline board renders from cache; deep-link fast
  path intact.

### WP5 — Identity: per-host-section + re-pick

- **Files:** `hooks/useRotaIdentity.js`, `components/RotaBoardPage.jsx`,
  `components/MyCommitmentsPage.jsx`; tests `useRotaIdentity.test.jsx`.
- **Do:** §6 — storage key per host section; group-shaped input; "Change who I
  am" controls wired to `clear()` + picker.
- **Acceptance:** one identity pick covers all records; re-pick clears and
  re-prompts; choice persists.

### WP6 — Deletion sweep + docs

- **Files:** anything in §7 not yet removed; `index.js` re-exports;
  `docs/features/water-rota.md` storage section.
- **Do:** grep-verify zero live references to `resolveRotaTermId`,
  `parseRotaRecordYear`, `mergeSectionConfig`, `transformCfg`, `mergeSections`,
  `rota.year`, `pendingFieldId`, year-based `buildRotaRecordName`; delete dead
  tests; update the as-built doc to the per-section-record model.
- **Acceptance:** `git grep` clean of all deleted symbols; full
  `lint && test:run && build` green; `npx cap sync` clean.

---

## 10. Risks & open questions

1. **Adults-host auto-detection is name-based (LOW, structural).**
   `findHostSection` matches "adult" in the section name — the same heuristic the
   wizard already uses (`RotaSetupWizard.jsx:111-112`), but it is now
   load-bearing for discovery, not just a wizard default. If the group renames
   the Adults section, discovery falls back to scanning all sections (still
   correct, slower). **Flag for Simon (minor):** confirm heuristic + fallback is
   acceptable vs. persisting a chosen host section id locally.

2. **Record-name suffix visible in OSM's web UI (COSMETIC).** Names like
   `Viking Water Rota Scouts Summer 2026 [49097.924956]` appear in OSM's flexi
   list. The app never shows the raw name. **Flag for Simon:** confirm the
   two-part id suffix is acceptable.

3. **N-record cold-load cost (LOW, quantified).** ≤ `1 + 2N` queued requests
   (≤ 19 for 9 sections) on a cold board load, paced by the existing rate-limit
   queue at deep-link priority; warm/offline loads are pure cache. Accept.

4. **Season-bucket edge cases (LOW).** Midpoint-month bucketing maps every
   verified live term correctly; a pathological term spanning two seasons lands
   in exactly one bucket deterministically, which is the only requirement (the
   label is a grouping key, not a term name).

5. **Duplicate records for the same (section, term) (LOW, non-destructive).**
   Only a same-section double-create race can produce one; numeric lowest-extraid
   dedupe converges every device on one record, and
   `createOrCompleteFlexiRecord` force-refreshes the list before create
   (`flexiRecordCreationService.js:103-107`). Orphans deletable in OSM.

6. **One failed record read degrades the whole bucket load (LOW).** §8.2 keeps
   fail-fast (matches today's single-record behaviour and the board's error +
   retry state, `RotaBoardPage.jsx:293-307`). Partial rendering with a per-record
   warning is a possible follow-up, not v1.

7. **Cover semantics still "green = confirmed count" (KNOWN, deferred)** per §1;
   revisit as a follow-up (red-team #2).

8. **Host-section-only permit holders (KNOWN, accepted).** Rows are Adults
   members (red-team #5) — now an explicit design choice enabling cross-section
   signups.
