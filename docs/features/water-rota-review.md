# Water Rota — Review, Gap Analysis & Red-Team (2026-07-13)

Purpose: take stock of the shipped Water Session Permit Rota before a term-model
rework. Three parts: **what's built** (as-built PRD), **what was asked** (intended
spec across sessions), the **gap**, and a **real-world red-team**. Ends with how the
outstanding requests map onto the red-team risks and the open decisions.

Sources: `docs/features/water-rota.md` (as-built spec), `water-rota-handover.md`,
the `water-rota-feature` memory, direct code reading, and a traced red-team audit.

---

## 1. As-built PRD (what shipped — v2.19.0 → v2.22.0)

| Area | As built |
|---|---|
| **Storage unit** | One OSM FlexiRecord **per calendar year** — `"Viking Water Rota <year>"` — in a leader-chosen **host section** (usually Adults; must contain all permit holders) |
| **Session identity** | One column per session, **keyed by absolute date**: `S_<yyyymmdd>_<sectionid>`. Immutable (OSM has no column rename/delete); "removed" sessions marked not-on-water `c:1`, never deleted |
| **Config** | `RotaConfig` column holds the whole-plan JSON (date range, per-section defaults); each editor writes the full config to their own row; readers take last-writer-wins by `(v, at)` |
| **Writes** | Each user writes **only their own member row's cell** → signups are conflict-free; session metadata is a candidate `m` merged LWW across rows. Promise-chain lock → live re-fetch → merge own cell → single `updateFlexiRecord` → optimistic cache patch. Online-only (`WRITE_UNAVAILABLE` offline) |
| **Board** (`/water-rota`) | **Current calendar year only**, host section's **current active term** only. Term overview strip (week navigation — NOT a picker), week-bucketed session cards, one-tap signup, section filter, "sync programme" action, offline banner |
| **Detail / edit** | `SessionDetailModal` + `SessionEditForm` (activity, times, expected kids, permits-needed, notes, not-on-water toggle) |
| **My week** (`/water-rota/me`) | User's commitments bucketed this/next/later, inline withdraw |
| **Setup** (`/water-rota/setup`) | 3-step wizard: host + **all participating sections** + date range → per-section programme review → resumable create + config write. Term dropdown added v2.22.0 but **setup-only, single term per run** |
| **Identity** | Own member row resolved by stored choice → unique full-name match → one-time picker (`useRotaIdentity`) |
| **Cover status** | green covered / amber covered-only-with-backups / red short / grey not-on-water or target-unset, computed as `confirmed >= needed` |

Everything is anchored to the **host section's current active term** at the API and
cache layer: `getSingleFlexiRecord`/`getFlexiStructure`/`updateFlexiRecord` and the
SQLite/IndexedDB cache all key on `termid` (`WHERE extraid=? AND sectionid=? AND
termid=?`), and `resolveRotaTermId` returns whatever term is currently active.

## 2. Intended spec (what was asked, across sessions)

The **core** (agreed 2026-07-10) matches the build: per-section on-water planning
from the OSM programme, permit-holder confirmed/backup signup, at-a-glance cover
status for leaders. Three **structural** requests are NOT met:

1. **Term-based, not date-based** ("don't build on dates") — the rota should be
   organised by **term** and roll over with OSM terms, not pinned to a calendar year
   and absolute session dates.
2. **A term picker on the board** — to view/switch the term you're looking at; not a
   one-off dropdown buried in setup.
3. **Plan one section at a time** — a per-section workflow, not all-sections-in-one-run.

## 3. The gap

| Requirement | Built? | Nature of the gap |
|---|---|---|
| Term-based model | ❌ | Rework: record naming, **session-column keys (date → term/week)**, discovery, board loading, cache keys |
| Term picker on board | ❌ (setup-only, single-term) | `useWaterRota()` hard-binds to `new Date().getFullYear()` + current active term |
| One section at a time | ❌ | Wizard multi-selects all sections; per-section *merge* was a **v2.21.1 bug fix**, not a designed workflow |

**Crux:** the as-built spec already named the term model as the intended fallback and
never verified it — spike **#3**: *"confirm cell values persist when the host section's
term changes… **Fallback: record per term**"* and spike **#1**: *"one record per term
(~13 columns)"* if the year record grows too big. Those spikes were never run against
live OSM. "Term-based" resolves an open design question, it doesn't invent a new one.

## 4. Red-team — real-world failure modes

Traced against how a real group runs a summer rota. **Model** = flaw in the
year/date/term-keyed storage design; **bug** = local defect.

### Top 5 highest-impact risks

1. **Term-rollover data "disappearance" (HIGH, model).** The whole read/write/cache
   layer keys on the host section's *current active term*. When OSM rolls the term:
   *offline* users get a **blank board** from a cache-key miss (old grid cached under
   the old termid, never read); *online* users lose the **entire season's signups/config**
   *if* OSM scopes flexi values by term (spike #3, unverified). This is the feature's
   foundational unverified assumption. The documented fallback is record-per-term — a
   design change, not a patch.
2. **Green ≠ covered (HIGH, model).** Cover is purely `confirmed >= needed`, but
   `prefillRegulars` writes every regular as **confirmed** — a regular on holiday shows
   green until they personally withdraw. No permit-type match (4 kayak permits satisfy a
   powerboat session) and `needed` ignores expected-YP `k` (no ratio check). A leader can
   be shown a fully-green week that is actually uncovered — defeats the core promise.
3. **Permanent wrong-identity, no re-pick UI (HIGH, bug).** `useRotaIdentity.clear()`
   exists but **is wired to nothing** — no component surfaces a "not you?" control. One
   mis-tap makes a user sign up / withdraw / edit **as someone else forever**. Cheap to
   fix, high frequency (shared family names).
4. **Cross-device config wipe still possible (HIGH, model).** The write lock is
   module-level (per tab, not per user). Two leaders setting up concurrently read config
   v5, merge their own section, and both write v6 to the **same anchor cell** — the later
   write silently drops the earlier leader's whole section. `mergeSectionConfig` (v2.21.1)
   narrows the window but cannot see a concurrent write, so it doesn't close it.
5. **Permit holders outside the host section are invisible (HIGH, model).** Everything
   (members, identity picker, assign-modal) is host-section rows only. A permit holder on
   a youth roster but not Adults/host can't self-sign (picker dead-ends at "ask your
   admin") and can't be assigned. No setup-time validation catches it; non-host leaders
   are silently dropped.

### Also real (lower frequency)

- **Phantom write success (bug, latent):** `detectWriteFailure` deliberately doesn't
  treat `result:0` as failure; if OSM ever signals a rejected flexi write as `200 {result:0}`,
  the user sees a confirmed signup that didn't persist until the next refresh.
- **Dec→Jan season split (model):** the record is named for `range.start`'s year, so a
  winter season's January sessions live in the previous year's record and vanish from the
  board on 1 Jan (data intact, unreachable — no year picker).
- **Setup prefill rate-limit (model-adjacent):** ~40 sequential `multiUpdateFlexiRecord`
  with no throttle; a rate-limited setup leaves a partially-green board that looks like
  real cover.
- **Setup re-run repair is incomplete:** re-running setup restores section *defaults* but
  **not** regulars-as-signups (prefill only targets newly-added columns), and if a wipe
  left config null the wizard starts blank and can re-replace rather than merge.

## 5. How the three requests map onto the red-team risks

The outstanding requests are not cosmetic — they resolve **three of the top five** risks:

| Request | Fixes red-team risk |
|---|---|
| **Term-based model** (record + columns keyed by term/week, not absolute date) | **#1 term-rollover disappearance** (rollover becomes a natural record boundary, not a data-loss event) and the **Dec→Jan split** |
| **Term picker on board** | Reaching prior/other terms once the model is term-scoped (today the board can't leave the current year/term) |
| **One section at a time** (likely per-section plan/record) | **#4 cross-device config wipe** (separate section plans → leaders stop sharing one config cell) and eases **#5** (a leader plans their own section against their own roster) |

Risks **not** addressed by the three requests — worth deciding separately:
- **#2 Green ≠ covered** — cover-status semantics (opt-in vs auto-confirm regulars,
  permit-type awareness, ratio). Independent of the term/section rework.
- **#3 wrong-identity re-pick** — a cheap standalone bug fix; wire up `clear()`.

## 6. Decisions (resolved 2026-07-13)

1. **Term model — DECIDED: one FlexiRecord per term.** `Viking Water Rota <term>`, with
   session columns covering all sections (up to 9). Session column key becomes
   term+week/meeting instead of `yyyymmdd`. Rationale: a per-term record holds *fewer*
   columns than today's per-year record (a year spans multiple terms), so the verified
   ~43-column/year headroom means per-term is strictly safer on column count. Rollover
   becomes a clean new record; the old term's record stays intact and reachable via the
   picker. (Rejected: one-record-per-section-with-terms-as-columns.)
2. **Planning — DECIDED: per-section workflow.** Each section leader plans only their own
   section: their on-water weeks, their regular leaders, how many permit holders they
   need. Not the all-sections wizard. The board stays multi-section for the term (cover
   overview); setup is scoped to one section.
3. **Design consequence of 1 + 2 (config isolation):** with a single shared per-term
   record, per-section planning only becomes truly non-colliding if **config is stored
   per-section** (each section's plan in its own cell/column), replacing today's single
   shared `RotaConfig` doc written to one anchor row. Session columns are already
   per-section. This is what closes red-team risk #4 (cross-device config wipe) — the
   v2.21.1 merge did not.
4. **Term picker on the board — DECIDED (in scope):** board-level term selection driving
   `useWaterRota(term)`; today it hard-binds to current year/active term.

### Still open

5. **Migration — DECIDED: none.** The existing `Viking Water Rota 2026` data is all
   **test** data and will be deleted. Clean rebuild on the term model, no back-compat, no
   migration path (fits the repo's remove-deprecated policy). Delete the test FlexiRecord(s)
   in OSM when convenient.
6. **Live-OSM spike (#3 cross-term persistence):** no longer a *data-loss* concern (no real
   data yet), but still worth confirming so the **new** design reads/writes each per-term
   record under the term it was created in (store the record's termid, don't re-resolve to
   "current active term"). **Simon to confirm against live OSM.** Cheap, non-blocking.
7. **Independent risks — fold in or ship first?** #2 green≠covered (auto-confirmed
   regulars, no permit-type/ratio) and #3 identity re-pick (`clear()` unwired) are
   orthogonal to the term/section rework. Proposed: **fix #3 now** (tiny), **fold #2 into
   the rework**.

---

*Next step: write the rework plan / PRD from decisions 1–4 (per-term records, per-section
planning, per-section config, board term picker), resolve the open items (5–7), then
build. This review is the input to that plan.*
