# HANDOVER — Water Rota: outstanding work, redesign, and honest evaluation

Self-contained handover for a fresh session. The Water Rota feature ships across PRs **#211–#218** (frontend `Walton-Viking-Scouts/VikingsEventMgmt`) + backend **#51** (`/get-programme-summary`, merged). A live rota exists in the user's OSM (Adults host, ~43 columns, regulars set for Tuesday Cubs, Tuesday Cubs needs 4). App root: `/Users/simon/vsCodeProjects/VikingEventMgmt/ios app` (note the space). Feature dir: `src/features/water-rota/`.

## Repo state — READ FIRST
- Branch `feature/water-rota-regulars` (based on `feature/water-rota-polish` = PR #217; regulars = PR #218).
- **Uncommitted WIP from an interrupted session** (decide: finish or `git checkout --` and redo cleanly — nothing is committed):
  - `components/setup/RotaSetupWizard.jsx` — added `activeSectionSid` state + `activeSid`/`activeSection` derivation, **but the Step-2 render still `.map`s all sections, so those vars are unused → this WILL fail `npm run lint`.** Intent was: edit one section at a time + per-meeting activity dropdown + show session name (see item 5).
  - `services/rotaSetupService.js` — `activateWaterSession()` is **complete** (creates a session column + writes meta `c:0` to put a greyed week on the water) but **not yet wired to any UI**. Import of `writeSessionMeta` added. Implementation reference at the end of this doc.
  - `components/SessionDetailModal.jsx` — **not yet changed**; needs the "Put on the water" wiring to call `activateWaterSession` (see item 4).
- Gate before any commit: `npm run lint && npm run test:run && npm run build` (825 tests green as of PR #218 tip; the WIP breaks lint).

## What's built (so it's not re-done)
Programme-driven session generation; per-year FlexiRecord in a host (Adults) section; one column per water session (`S_<yyyymmdd>_<sectionid>`); `RotaConfig` cell holds the plan (LWW-merged). Board (`RotaBoardPage`) = term strip + week-bucketed `SessionCard` list; signups (self, one-tap); identity resolution to the host member row; not-on-water weeks stored config-only (no column) and shown greyed; cover status green/amber/red; regulars pre-filled as confirmed signups; idempotent create (fixed a real dup-column bug in `flexiRecordCreationService.getExistingFieldNames`). Storage/encoding in `services/rotaEncoding.js` (zod, pure, LWW). Cell size proven fine at ~3.2 KB live.

---

## HARD EVALUATION — why it isn't doing what it should
1. **The board optimises for the wrong actor and action.** It's a tall column of full-width cards each dominated by big **I'm in / Backup** buttons. But the primary user is a **section leader scanning "who's covering what across the week"**, not a permit holder mashing a button. The signup is over-weighted; the at-a-glance cover picture is under-weighted. → **Redesign to a compact week grid (item 1).**
2. **Editing is trapped in the setup wizard.** Every change — a session's activity, putting a greyed week on the water, adding a person — forces a long, group-wide wizard trip. The natural model is **per-session editing from the board**; the wizard should be first-run scaffolding only. → items 4 & 5.
3. **Faces are initials.** Signup rows carry `{scoutid, name}` but not `photo_guid`, so `MemberAvatar` falls back to initials even though the app renders OSM photos everywhere else. Makes the rota look half-finished. → item 2.
4. **"Regulars" solved the standing crew but not the core ask: a section lead adding the permit holders they know are coming.** There's no board control to add another person to a session — only self-signup + setup-time regulars. Writing another member's row is already supported (`prefillRegulars` → `multiUpdateFlexiRecord`), so this is mostly UI + a small write path. → item 3.

---

## OUTSTANDING WORK (priority order)

### 1. Board redesign — compact day-row card grid  ★ latest ask
**User's words:** "long list of unnecessarily wide cards, with big I am in buttons… more square… row per day with sections as cards on that row."
**Design:** replace the week-bucketed full-width list with a **week view = one row per day; each section running that day is a small square-ish card in that row.** Each mini-card shows: section chip colour, activity (short), cover as `2/4` + a small overlapping **photo** avatar cluster, and a status tint (green/amber/red; grey = not on water). Tapping a mini-card opens the existing `SessionDetailModal` — **signup moves into the modal**, off the grid (no giant inline buttons). Keep a compact week pager (reuse/shrink `TermOverviewStrip`). Must stay usable on a phone: a day-row scrolls horizontally if a day has many sections, or wraps.
**Files:** `components/RotaBoardPage.jsx` (re-layout; it already resolves + week-buckets sessions — regroup by day within a week), new `components/SessionMiniCard.jsx` (or restyle `SessionCard`), keep `SessionDetailModal.jsx` as the signup/edit surface. `MyCommitmentsPage` can stay list-style.

### 2. Photo avatars, not initials
`MemberAvatar` (`src/shared/components/ui/MemberAvatar.jsx`) shows a photo when `member` has `scoutid` + `photo_guid` (via `buildMemberPhotoUrl` in `src/shared/utils/memberPhotos.js` — public CDN, no auth; see the `osm-member-photos` memory). Signups don't carry `photo_guid`. **Fix:** in `loadRota` (`services/rotaService.js`) build a `scoutid → photo_guid` map from the cached member store (`databaseService.getMembers` / core_members carry `photo_guid`) and attach it so `mergeSessionColumn` signups (and the members list) include `photo_guid`; then pass `{scoutid, photo_guid, name}` to `MemberAvatar` in `SessionCard`/`SignupList`/the new mini-card (currently they pass `{name}` only). Unit-test the enrichment.

### 3. Section lead adds a permit holder they know  ★ core requirement, not yet done
From a session's detail (and/or the mini-card), a leader picks a person and marks them confirmed/backup — writing **that person's** row, not their own. Reuse the write-other-rows path (`updateFlexiRecord`/`multiUpdateFlexiRecord` with an explicit `scoutid`, as `prefillRegulars` does). Candidate list = host-section members (all permit-holding adults) — reuse/extend `useSectionLeaders` or add a host-members hook. New service e.g. `rotaService.assignSignup({ rota, fieldId, scoutid, status, by, token })` that merges into the target's cell (read-merge to preserve their meta) under the write lock. UI: an "Add permit holder" button in `SessionDetailModal` opening a searchable member picker (mirror `IdentityPickerModal`). Note the concurrency shift (no longer own-row-only) — the lock + re-read handles it.

### 4. Edit / activate a greyed (not-on-water) session from the board  ★ WIP, service done
Config-only greyed weeks (`fieldId: null`) currently only offer "add via Edit plan". Wire `activateWaterSession` (already written in `rotaSetupService.js`) into `SessionDetailModal`: for a config-only session + `canEdit`, show `SessionEditForm` (prefilled from section defaults) with a **"Put on the water"** submit that calls `activateWaterSession({ rota, date, sectionId, fields, by: identity.name, scoutid: identity.scoutid, token })`, then `refresh()` + close. `SessionEditForm` needs an optional `submitLabel` prop (currently hard-codes "Save session"). Column-backed cancelled sessions already have "Back on the water".

### 5. Setup Step 2 polish  ★ WIP, partially edited
- **Per-meeting activity must be a real dropdown.** It's currently a `<input list=datalist>` text field (reads as "one activity you can't change"). Make each meeting row a `<select>` of `ACTIVITY_PRESETS` (include the current value if custom). Show the per-section "Default activity" dropdown only in the weekly-slot (`!hasProgramme`) fallback.
- **Show the session name** (programme `meeting.title`) on each meeting row so leaders can identify which session it is (the title was removed when the activity field was added).
- **Edit one section at a time**: a section selector (chips/tabs) at the top of Step 2; render only the active section's block (the `activeSectionSid`/`activeSection` scaffolding is already added — finish the render).
Files: `components/setup/RotaSetupWizard.jsx` (Step-2 block ~lines 517-716), `components/SessionEditForm.jsx` (submitLabel).

### 6. Open PR-review items still worth doing (from the #211–#218 review)
- Config isn't replicated: it's written to one deterministic anchor row; if that member leaves the host section the plan can go null/stale. Consider also writing config to the editor's own row.
- `discoverRotaRecord` can't tell "no rota" from "couldn't check" (offline/transient) → shows first-run "Set up the rota", risking a duplicate. Gate the first-run screen on `online`, or distinguish the states.
- `syncRotaWithProgramme` silently drops sections whose programme fetch fails, then reports success — surface partial failures.
- Extract + unit-test the wizard's pure `buildSessionOverrides` / `sessionsForSection`; add a `writeConfig` version-bump-over-rival test.

---

## Testing method that works here (reuse it)
Live verification via headless Chrome against real OSM, since the dev server is HTTPS+OAuth:
1. Ask the user to log into OSM in normal Chrome, Refresh Data, then **Cmd+Q** (flushes the token to disk).
2. Copy the profile (`~/Library/Application Support/Google/Chrome/Default`: Local Storage, IndexedDB, Session Storage, Cookies, Network + root `Local State`) to a scratch dir.
3. Drive with `playwright-core` (bun-cached 1.58.2) + Chrome-for-Testing at `~/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/...`, `launchPersistentContext(profile, { ignoreHTTPSErrors: true })`. Backend base for API probes: `https://site--vikings-event-management--ytnrhtcfzsqn.code.run`.
4. **OSM tokens expire ~1 hour** — re-copy/re-login between runs; a 403 on `/get-user-roles` means expired. Delete the profile copy after (it holds the session).

Gotchas learned: backend is **Northflank** (not onrender); GitHub pushes to the backend repo need `gh auth switch -u vikings-simon` (frontend = `simons-plugins`); OSM programme summary has **no per-meeting times** (use section default time); FlexiRecord **columns can't be deleted** (only whole records) — so a botched setup means deleting the record in OSM and recreating; cell size fine to ≥3.2 KB.

## Verification for the above
Unit (Vitest) for each pure/service change (photo-map enrichment, `assignSignup`, `activateWaterSession`, wizard helpers). Then live: put a greyed week on the water from the board; add a permit holder to a session as a leader and confirm it writes their row and shows their photo; confirm the day-row grid renders cover + faces and signup happens in the modal. `npm run lint && npm run test:run && npm run build` each PR; `feat:` titles for semver.

---

## Reference — the finished `activateWaterSession` (in case the WIP is reset)
Lives in `services/rotaSetupService.js`; imports `writeSessionMeta` from `rotaService.js`; uses `createOrCompleteRota` + `loadRota` + `buildSessionColumnName` already imported there.

```js
export async function activateWaterSession({ rota, date, sectionId, fields, by, scoutid, token }) {
  const result = await createOrCompleteRota({
    hostSection: rota.hostSection, year: rota.year, termId: rota.termId,
    sessions: [{ date, sectionId }], token,
  });
  if (!result.success) throw new Error(result.errors?.[0]?.error || 'Could not create the session');
  const reloaded = await loadRota(rota.year, token);
  const columnName = buildSessionColumnName(date, sectionId);
  const session = (reloaded?.sessions ?? []).find(
    (s) => s.fieldId && buildSessionColumnName(s.date, s.sectionId) === columnName,
  );
  if (!session) throw new Error('Session column was not created');
  // meta.c:0 wins over the config's not-on-water override → on the water without rewriting config.
  await writeSessionMeta({ rota: reloaded, fieldId: session.fieldId, scoutid, by, fields: { ...fields, c: 0 }, token });
  return reloaded;
}
```
