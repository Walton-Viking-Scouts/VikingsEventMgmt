# Handover — Page-aware post-login loading (deep-link fast path)

**Status:** In progress — mechanism verified & plan corrected 2026-07-13 (see "Corrected mechanism" below); implementation started.
**Created:** 2026-07-13 · **Surfaced:** 2026-07-12 (while testing water-rota deep-link sharing)
**Type:** Refactor of the shared auth + data-loading layer (offline-first).

---

## Problem

After OAuth, the app runs a **global post-login bootstrap** that every route shares: `useAuth.jsx` shows a "Syncing data from OSM…" toast and runs `dataLoadingService.loadAllDataAfterAuth()`, which loads reference data → all sections' events → all attendance → flexi.

**Corrected mechanism (verified 2026-07-13 — the original framing below was imprecise):**

- **First paint is NOT hard-blocked by the `await`.** `useAuth.jsx:243` calls `setIsLoading(false)` and logs *"UI ready to render"* **before** the `await loadAllDataAfterAuth` at line 256. `AppContent` gates the full-screen loader only on `isLoading` (`AppRouter.jsx:40`), so React commits the render and mounts the target route while the bootstrap runs in the background. "Remove the await gate" (old Option A) is therefore *already effectively true* for first paint.
- **The real coupling is data dependency, not the await.** `loadRota` is only independent when the cache is already **warm**. On a **cold-cache deep link** (the shared-link recipient case), it can't even discover the record: `discoverRotaRecord` (`rotaService.js:82`) scans `databaseService.getSections()`; `resolveRotaTermId` reads cached terms; the member/photo/name maps read cached members. **All of these are populated only by the bootstrap's reference-data step** (`getUserRoles()` → `saveSections()` at `api/auth.js:55`, plus terms + members in `loadInitialReferenceData`).
- **Consequence on a cold cache:** page renders → `useWaterRota` fires `loadRota` on mount → `getSections()` returns `[]` → `discoverRotaRecord` returns `null` → empty rota. And `useWaterRota`'s effect depends only on `[targetYear]`, so it **never re-runs** when reference data lands moments later — the recipient is stuck on an empty board (or waits out the whole sync) rather than getting a fast rota. It's also a race against the lazy route chunk load.

So the fix is **not** "unblock rendering" — it's **reference-data-first sequencing**: load terms/sections/members first, *then* trigger the target route's own loader, then let the heavy tail (all-section attendance + flexi) finish in the background — and make the route's loader actually re-run once reference data is ready.

**Why it matters now:** pre-existing app behavior, not caused by the deep-link feature. The share flow (PRs #211–#217, shipped v2.19.0) just made it *visible*: people now land on a specific page via a link and notice the whole-app sync. Confirmed live: shared link → sign in → long full sync, not a fast rota load.

## Where it lives (verified 2026-07-13)

| What | Location |
|---|---|
| The blocking `await` + "Syncing data from OSM…" toast | `src/features/auth/hooks/useAuth.jsx:254-256` |
| The global bootstrap itself | `src/shared/services/data/dataLoadingService.js:28` — `async loadAllDataAfterAuth(token, callbacks)` |
| Other callers (manual refresh paths) | `src/features/events/components/EventDashboard.jsx:139`, `src/routes/AppRouter.jsx:63` |
| Rota's own light loader (the fast path we'd prefer) | `src/features/water-rota/hooks/useWaterRota.js:22` → `loadRota` (`src/features/water-rota/services/rotaService.js`) |
| Reference-data load inside the bootstrap | `src/shared/services/referenceData/referenceDataService.js` (`loadAllDataAfterAuth` orchestrates it) |
| **loadRota's cold-cache dependency** (why the fast path isn't truly independent) | `discoverRotaRecord` → `databaseService.getSections()` (`rotaService.js:82`); `resolveRotaTermId` → cached terms; member/photo maps → cached members |
| Where sections get written to cache | `getUserRoles()` → `databaseService.saveSections()` (`src/shared/services/api/api/auth.js:55`), part of `loadInitialReferenceData` |
| **useWaterRota re-run gap** (effect deps only `[targetYear]`, so no reload when reference data lands) | `src/features/water-rota/hooks/useWaterRota.js:41-43` |

## Options considered

- **A — render-first, sync-in-background.** Drop the `await`/gate so the landing page renders as soon as its own data is ready. ⚠️ **Largely a no-op:** verification shows first paint is already unblocked (`setIsLoading(false)` precedes the await). Does nothing for a cold-cache recipient, whose problem is missing reference data, not a blocked render.
- **B — page-aware fast path.** On a deep link, load only that route's data first (rota → `loadRota`; event → that event's attendance), then kick off the rest. Best UX for shares — but on a cold cache B **requires reference data first** (sections/terms/members), so it can't stand alone.
- **C — reference-first, then prioritise the landing route's loader** inside/around `loadAllDataAfterAuth`, heavy tail (all-section attendance + flexi) after. This is the load-bearing option: it satisfies loadRota's real dependency.

## Read vs. write (open nuance)

The captured requirement is framed around the **read / first-paint** priority — load the rota/event view first. The user also asked to prioritise the **write** path (rota signups) on a deep link.

- Reads: covered directly by loading the target route first.
- Writes: currently **implicit** — once `loadRota` completes, the own-cell signup write path (`writeOwnCell` / the own-cell write lock in `rotaService.js`) is available. It is **not** separately specified as "prioritise the write."
- **Decision needed next session:** do we make "the target view is interactive (readable *and* writable) before the full sync completes" an explicit acceptance criterion, or leave writes as a natural consequence of the read fast-path? (Recommend making it explicit for rota, since the whole point of a shared rota link is to sign up.)

## Recommended approach (starting point, not locked)

Lean **C + B hybrid** (revised from A + B after verification):

1. **Split the bootstrap into two phases.** Phase 1 = reference data only (terms/sections/members via `loadInitialReferenceData`) — cheap, and the precondition for every page-first loader. Phase 2 = the heavy tail (all-section events + attendance + flexi), fired in the background behind the existing non-blocking indicator.
2. **Between the phases, let the landing route's own loader run** (rota → `loadRota`; event → that event's attendance). The route then paints from its own lighter fetch, not the whole-app sync.
3. **Make the route loader re-run when reference data becomes ready.** `useWaterRota` today fires `loadRota` once on mount and, on a cold cache, silently shows empty. Give it a signal (reference-ready flag/event, or await a shared "reference ready" promise) so it reloads once sections/terms/members exist.

First paint is already unblocked, so dropping the `await` (old A) is not the mechanism — sequencing + a re-run signal is. Keep offline-first cache pre-warm intact; keep a single source of truth for "reference ready" so the fast path and the background tail don't double-fetch it.

## Acceptance criteria (draft)

1. **Cold-cache** shared rota link → sign in → after reference data lands, the **rota renders from its own `loadRota`** without waiting on all-section events/attendance/flexi; a signup can be made before that heavy tail finishes.
2. **useWaterRota re-runs** once reference data is ready — no manual refresh needed, no stuck-empty board on a cold cache (the current failure mode).
3. Same reference-first fast-path for a deep link to a specific event.
4. A normal (non-deep-link) login still completes the full sync; no data category is silently dropped, and the two-phase split doesn't drop the heavy tail.
5. The "Syncing data from OSM…" indicator stays **non-blocking** (background) through the heavy tail, and partial-failure reporting (`referenceDataService` per-category errors) still surfaces.
6. Offline-first behavior unchanged — cached data still serves when offline.
7. No regression to the identity/startup-data path (globals still populate; see the recent TTL fix, v2.19.4).

## Implemented (2026-07-13, branch `feature/deep-link-reference-first-fast-path`)

Delivered the **rota** cold-cache fast path (the live/reported case):

- **New `referenceDataReady` signal** — `src/shared/services/data/referenceDataReady.js` (`mark`/`is`/`reset`/`subscribe`). Single source of truth for "reference data is cached this session."
- **Bootstrap fires it** — `dataLoadingService` calls `markReferenceDataReady()` immediately after the reference step succeeds, *before* the heavy tail.
- **`useWaterRota` re-runs on the signal** and, on a cold cache, **stays in `loading`** instead of flashing "no rota" (distinguishes "sections not cached yet" from "no rota exists this year" via `isReferenceDataReady()`).
- **Priority fast-path** — `loadRota` takes a `priority` option, threaded into `getFlexiRecords`/`getFlexiStructure`/`getSingleFlexiRecord` → `osmRequest` → the existing priority-ordered `rateLimitQueue`. The hook loads at priority **5** (above background reads at 0, below writes at 10), so the rota's reads jump ahead of the bootstrap flood.
- **Reset on logout** — `useAuth.logout()` calls `resetReferenceDataReady()` so a new session's cold-cache loaders don't act on a stale flag.
- **Tests** — `referenceDataReady.test.js` (signal) + `useWaterRota.test.jsx` (warm load / cold-stays-loading-then-fills / no-rota / error / priority arg). Lint + build clean; existing rota/dataLoading/flexi suites green.

**Writes:** signup becomes available as a natural consequence — once `loadRota` completes, `writeOwnCell` is usable; the write path already runs at priority 10 (above the fast-path reads), so a signup on the freshly-loaded board isn't starved.

### Deferred follow-ups

- **Event deep-link fast path (criterion #3):** the same reference-first + priority + re-run treatment for the events route's own loader is **not** done — event loading lives in a different area (`eventDataLoader`/`EventDashboard`) and warrants its own pass. The `referenceDataReady` signal is reusable for it.
- **Dedupe vs the bootstrap:** the fast-path rota reads and the background flexi tail can still both fetch the same flexi list/structure; priority makes the rota win, but a shared in-flight dedupe would cut redundant OSM calls. Watch the queue depth logs.
- **Live-device verification:** validate the actual shared-link → sign-in → fast-rota flow on hardware (per the `ios-qa` skill) before closing out.

## Guardrails / do-NOT

- **Scope it as its own piece** (`/spec` or a plan review first) — this touches shared auth + `dataLoadingService` + offline-first pre-warm. Do **not** drive-by edit it inside another change.
- `loadAllDataAfterAuth` is called from 3 places (`useAuth`, `EventDashboard`, `AppRouter`) — changing its contract affects all three; check each.
- Preserve the mobile-Safari OAuth constraints (no return-path `replaceState`/`popstate` restore on the web callback — see the `mobile-safari-oauth-returnpath-hang` memory / v2.19.2 revert).
- Watch OSM rate limits — the fast path must not *duplicate* fetches the full sync will also do (dedupe rota/event loads against the bootstrap).

## Related

- PRD `docs/PRD-functional-rebuild.md`: **§5.7 line ~330** (Landing-route-first requirement), **§7.9** (deep linking & shareable views), **known limitation #10 line ~653** (post-login sync blocks first paint → recommends landing-route-first).
- Memory: `post_login_full_sync_refactor.md` (source of this handover), `water_rota_feature.md`, `mobile_safari_oauth_returnpath_hang.md`.
- Share feature that surfaced it: water-rota deep links + copy-link (PRs #211–#217).
