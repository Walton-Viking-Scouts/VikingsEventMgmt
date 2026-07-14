# Handover — Water Rota term-model rework

> **⚠️ SUPERSEDED 2026-07-14.** Live-OSM review found terms are per-section (no group-wide
> term; Adults has year-terms only), which breaks this doc's shared-record-per-term model.
> The revised design — **one record per (section, its own term), all hosted in Adults,
> single RotaConfig column per record, season-bucket board picker** — lives in
> `water-rota-term-model-prd.md`. Decisions below stand EXCEPT #1 (shared per-term record)
> and #4 (per-section config columns), both replaced by per-section records.

**Status:** Decisions locked, not started. Next session's work.
**Created:** 2026-07-13 · **Companion:** `water-rota-review.md` (as-built PRD, gap analysis, full red-team — read it first).
**Type:** Storage-model + workflow rework of the Water Session Permit Rota. Clean rebuild, **no back-compat, no migration**.

---

## Why this exists

The shipped rota (v2.19.0→v2.22.0) diverged from spec on three structural points, and a red-team found the divergence is also the source of the top real-world risk. See `water-rota-review.md` for the full as-built PRD, gap table, and ranked red-team. This handover carries the **decisions** so next session can write the PRD/plan and build.

## Decisions locked (2026-07-13, agreed with Simon)

1. **One FlexiRecord per term** — `Viking Water Rota <term>` (not per calendar year). Store the record's **termid** and read/write it under *that* term forever — never re-resolve to "current active term" (`resolveRotaTermId` today returns the current active term, which is the rollover bug). Per-term holds *fewer* columns than today's per-year record, so column-count is safer, not riskier.
2. **Sessions keep their real dates.** "Don't build on dates" = **record identity + term resolution**, not date-free sessions. A session still happens on 15 July and its column can stay `S_<yyyymmdd>_<sectionid>`; it just lives inside a term-anchored record read under that record's term.
3. **Per-section planning.** Each section leader plans only their own section — their on-water weeks (from their programme), their regular leaders, and how many permit holders they need. **Not** the all-sections wizard.
4. **Per-section config (the key structural change).** Replace today's single shared `RotaConfig` doc (written to one anchor row → the cross-device wipe, red-team risk #4) with **per-section config** (each section's plan in its own cell/column, e.g. `RotaConfig_<sectionid>` written to the editor's own row, LWW). Session columns are already per-section. Then two leaders setting up different sections at once physically cannot clobber each other — closes risk #4, which the v2.21.1 merge only narrowed.
5. **Board term picker.** Board-level term selection driving `useWaterRota(term)`; today it hard-binds to `new Date().getFullYear()` + current active term. Board still shows the whole term's group-wide cover; setup is scoped to one section.
6. **Migration: none.** The existing `Viking Water Rota 2026` data is all **test**. **Simon is deleting the old OSM FlexiRecord.** Clean rebuild going forward.
7. **Independent fixes:** **do #3 now** (identity re-pick — `useRotaIdentity.clear()` exists but is wired to nothing; one mis-tap = act as someone else forever; surface a "Change who I am" control). **Fold #2 into the rework** (cover semantics — see below).

## Target model (one line)

> One record **per term** → per-section **date-bearing** session columns (read under the record's own term) + per-section **config** (isolated cells) → board shows the term's whole-group cover with a **term picker** → setup is **per-section**.

## Must-resolve before/while building

- **SPIKE (feasibility gate) — does OSM let you read/write a flexi record under an arbitrary/past termid?** The whole per-term-record approach assumes you can read term T's record using T's termid even after the term rolls. Two sub-questions from the original spike #3 (`water-rota.md:61-63`, never run):
  - Are flexi cell values term-scoped at all, or per-member (term only selects roster)?
  - If term-scoped, does OSM return data when you pass a *past* termid?
  If past terms are unreadable, past-term rotas can't be shown (maybe acceptable — you mostly care about the current/next term); confirm and design accordingly. **Simon to check against live OSM.** Cheap.
- **Cover semantics (#2) — how regulars count.** Today `prefillRegulars` writes every regular as **confirmed** (`s:"I"`), so a regular on holiday shows green until they withdraw → green lies. Options for the rework: a distinct "regular / assumed" status that counts separately from "confirmed (opted-in)", or don't prefill signups and show `confirmed X / needed Y (+Z regulars pencilled)`. Decide during PRD. Permit-type match + YP ratio remain deferred but the board should stop implying "covered" when it isn't.

## What gets removed (clean rebuild, no deprecation)

- `buildRotaRecordName(year)` → `buildRotaRecordName(term)`; year-based discovery/loading.
- `resolveRotaTermId` "current active term" → pinned per-record termid.
- The all-sections setup wizard → per-section setup.
- The single shared `RotaConfig` doc → per-section config cells.

## Where it lives (files to touch)

- Encoding/naming: `src/features/water-rota/services/rotaEncoding.js`, `rotaTemplates.js` (`buildRotaRecordName`, `buildSessionColumnName`, config encode/merge).
- Load/discover/write: `rotaService.js` (`discoverRotaRecord`, `loadRota`, `resolveRotaTermId`, `writeConfig`, `writeOwnCell`, `prefillRegulars`).
- Setup: `components/setup/RotaSetupWizard.jsx`, `services/rotaSetupService.js`, `utils/rotaSetupPlan.js` (`mergeSectionConfig` → likely gone with per-section config).
- Board + hook: `components/RotaBoardPage.jsx`, `hooks/useWaterRota.js` (add term param + picker), `TermOverviewStrip.jsx`.
- Cover: `utils/rotaDisplay.js` (cover-status semantics).
- Identity: `hooks/useRotaIdentity.js` (wire up `clear()`), a UI control in `RotaBoardPage`/`MyCommitmentsPage`.

## Suggested build sequence

0. Simon: delete old test record + run the spike.
1. Encoding/storage: per-term record naming, pinned termid, per-section config columns (pure fns + tests first).
2. Load/discover/write on the new model.
3. Per-section setup workflow.
4. Board term picker + whole-term view.
5. Cover semantics (#2) + identity re-pick (#3).
6. Delete the year-model / all-sections-wizard / shared-config code.

## Guardrails

- Own-row write discipline stays (signups conflict-free); keep the promise-chain write lock and LWW for metadata/config.
- Offline-first: reads serve cache, writes online-only (`WRITE_UNAVAILABLE`).
- Watch OSM rate limits in setup prefill (today ~40 sequential `multiUpdateFlexiRecord`, no throttle — red-team risk).
- Write the PRD/plan first (`/spec` or a plan review) — this is a model rework, not a patch.

## Related

- `water-rota-review.md` (this session's full review — READ FIRST), `water-rota.md` (as-built spec + original spikes), `water-rota-handover.md` (original build handover).
- Memory: `[[water-rota-feature]]`, `[[post-login-full-sync-refactor]]`.
