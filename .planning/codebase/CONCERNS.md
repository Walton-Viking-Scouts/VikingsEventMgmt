# Codebase Concerns

**Analysis Date:** 2026-04-26

## Tech Debt

**Auth circular dependency (HIGH PRIORITY):**
- Issue: `useAuth` hook lives in `features/auth/hooks/` but is needed by guards in `shared/components/guards/`. Importing it would violate the eslint `import/no-restricted-paths` rule (shared cannot import from features). Workaround: route guards mock auth state.
- Files: `src/shared/components/guards/RouteGuard.jsx`, `src/shared/components/guards/RequireAuth.jsx`, `src/shared/hooks/useSignInOut.js`, `src/shared/services/api/api/auth.js`, `src/shared/services/api/api/index.js`
- Impact: Route guards do NOT actually check authentication. `RouteGuard.jsx` lines 13-16 hardcode `authState = 'authenticated'` and `user = null`. `RequireAuth.jsx` lines 13-16 hardcode `authState = 'authenticated'` and `user = { id: 1 }`. All routes in `src/routes/AppRouter.jsx` (lines 79-111) currently use `authLevel="none"` so the mock is masked, but any attempt to enforce route-level auth will silently succeed because of the mock.
- Fix approach: Move `useAuth` (or a thin auth-context selector) into `src/shared/contexts/app/` or `src/shared/hooks/`. The `tokenService` already lives in `shared/services/auth/`; move the React context layer with it. Then re-enable real auth checks in both guard components and remove the four `// TODO: Move ... to avoid circular dependency` markers.

**Duplicate `authHandler` modules:**
- Issue: `src/shared/services/auth/authHandler.js` and `src/features/auth/services/simpleAuthHandler.js` are byte-identical copies of the same `SimpleAuthHandler` class, each exporting its own singleton. Different code paths use different singletons.
- Files: `src/shared/services/auth/authHandler.js`, `src/features/auth/services/simpleAuthHandler.js`, `src/features/auth/services/auth.js` (line 24), `src/features/events/components/EventDashboard.jsx` (line 4), `src/shared/services/api/api/base.js` (line 15)
- Impact: Auth-failure state (the `hasShownAuthError` flag and circuit breaker) is split across two singletons. A 401/403 in the API layer will not stop the auth feature from continuing to attempt operations, and vice versa. Sentry user resets and toast suppression can fire twice or be missed.
- Fix approach: Delete `src/features/auth/services/simpleAuthHandler.js`. Update `src/features/auth/services/auth.js` line 24 to import `authHandler` from `'../../../shared/services/auth/authHandler.js'`. Verify only one singleton remains.

**Duplicate token service implementation:**
- Issue: `getToken`, `setToken`, `clearToken`, `generateOAuthUrl`, `validateToken`, etc. are implemented twice — once in `src/features/auth/services/auth.js` (760 lines) and again in `src/shared/services/auth/tokenService.js` (180 lines). Most call sites import from the shared version, but a few features still pull from the feature version.
- Files: `src/features/auth/services/auth.js`, `src/shared/services/auth/tokenService.js`, callers: `src/features/auth/hooks/useAuth.jsx`, `src/features/movements/hooks/useVikingSectionMovers.js` (line 8)
- Impact: Two functions reading/writing the same `sessionStorage` keys with subtly different behavior (logging, Sentry calls, error wrapping). Bug fixes applied to one file silently miss the other.
- Fix approach: Make `src/features/auth/services/auth.js` re-export from `tokenService.js` for the functions that overlap (or delete duplicates entirely now that backwards compatibility is not required per `CLAUDE_SHARED.md`). Centralize all `sessionStorage.getItem('access_token')` reads in one module.

**Direct sessionStorage access scattered across 157 sites:**
- Issue: Despite `tokenService.js` providing `getToken()`, many modules read `sessionStorage` directly for `access_token`, `token_expired`, `token_invalid`, `token_expires_at`, `osm_blocked`, `user_info`, etc.
- Files: `src/features/auth/hooks/useAuth.jsx` (lines 178-185, 392, 583, 621, 670), `src/features/auth/services/auth.js` (lines 77, 127, 184, 510, 605), `src/shared/services/utils/logger.js` (line 123)
- Impact: Storage key strings are hardcoded in many places. Renaming a key, adding encryption, or migrating to Capacitor Preferences requires touching dozens of files. Easy to introduce typos that silently fail.
- Fix approach: Wrap all token-related storage reads/writes in `tokenService.js` and forbid raw `sessionStorage` access in auth-adjacent files via an eslint rule.

**Massive monolithic files:**
- Issue: Several files have grown well beyond comfortable maintenance size and mix many responsibilities.
- Files:
  - `src/shared/services/storage/database.js` — 2,149 lines (SQLite schema + CRUD for sections, events, attendance, members, sync, demo segregation)
  - `src/shared/services/storage/indexedDBService.js` — 1,967 lines (web fallback for the same surface)
  - `src/config/demoMode.js` — 1,030 lines (detection + full hand-coded demo dataset)
  - `src/features/events/services/flexiRecordService.js` — 1,023 lines
  - `src/features/events/components/attendance/EventAttendance.jsx` — 891 lines
  - `src/features/events/components/EventDashboard.jsx` — 817 lines
  - `src/features/events/components/CampGroupsView.jsx` — 776 lines
  - `src/features/auth/services/auth.js` — 760 lines
  - `src/features/auth/hooks/useAuth.jsx` — 735 lines (14 useState/useEffect hooks)
  - `src/shared/utils/flexiRecordTransforms.js` — 722 lines
- Impact: Hard to reason about, slow to test, change-risk amplified. Components mix data fetching, transformation, and rendering.
- Fix approach: Split storage services per entity (`sectionsRepository`, `eventsRepository`, `membersRepository`, `attendanceRepository`) with a thin `database.js` that handles connection only. Extract demo data into a JSON fixture loaded by `demoMode.js`. Break large components into presentation/container pairs.

**Outstanding refactor TODOs (8 total in source):**
- `src/shared/components/guards/RouteGuard.jsx:2,13` — auth circular dependency (above)
- `src/shared/components/guards/RequireAuth.jsx:3,13` — auth circular dependency (above)
- `src/shared/hooks/useSignInOut.js:5` — `getFlexiRecordStructure` needs to move to shared layer
- `src/shared/hooks/useSignInOut.js:474` — `handleApiAuthError` needs to move to shared layer
- `src/shared/services/api/api/auth.js:167` — user info should be stored in shared location
- `src/shared/services/api/api/index.js:55` — `getConsolidatedFlexiRecord` re-export blocked by layering
- `src/features/events/components/CampGroupCard.jsx:142` — `DraggableMember` should emit a full member object on mobile drags

**Layering rule downgraded to warning:**
- Issue: `eslint.config.js` line 91 declares `'import/no-restricted-paths': ['warn', ...]` with a comment "downgraded to warnings to unblock CI/CD".
- Files: `src/eslint.config.js` (line 91)
- Impact: Architectural boundaries between `features/*` and `shared/*` are not enforced — lint passes even when a feature imports from another feature or `shared/` imports from `features/`. Combined with the auth circular-dependency workaround above, this is how the mocked guards slipped in.
- Fix approach: After consolidating auth into `shared/`, restore the rule to `'error'`.

## Known Bugs

**`useVikingSectionMovers` hook has broken imports (DEAD CODE):**
- Symptoms: Import the hook and the module crashes at evaluation time with module-not-found errors.
- Files: `src/features/movements/hooks/useVikingSectionMovers.js` (lines 2-9), barrel re-export at `src/features/movements/hooks/index.js` (line 5)
- Trigger: Any component importing `useVikingSectionMovers` from `features/movements/hooks`. Currently no caller exists, so the bug is latent.
- Imports that point at non-existent files in `src/features/movements/services/`:
  - `discoverVikingSectionMoversFlexiRecords`, `getVikingSectionMoversData`, `extractVikingSectionMoversContext`, `validateVikingSectionMoversCollection` from `'../services/flexiRecordService.js'`
  - `getToken` from `'../services/auth.js'`
  - `logger, LOG_CATEGORIES` from `'../services/logger.js'`
- Workaround: None — file is currently unreachable through the UI.
- Fix approach: Either delete the file and remove the barrel export, or fix the imports to point at `src/shared/services/auth/tokenService.js`, `src/shared/services/utils/logger.js`, and `src/features/events/services/flexiRecordService.js`.

**Token expiration "corrupt value" auto-marks expired without explicit user notification:**
- Symptoms: A non-numeric value in `token_expires_at` (e.g., from a partially-completed write or older app version) is treated as expired silently. The user is logged out at next API call without context.
- Files: `src/shared/services/auth/tokenService.js` (lines 73-82)
- Trigger: Corrupted `sessionStorage` value (manual edit, partial write, browser quirk).
- Workaround: Logger emits a warning, but the user-visible UX is identical to a normal expiry.
- Fix approach: Distinguish corruption from expiry in `markTokenAsExpired` so the toast/dialog can offer a "session data was corrupted, please log in again" message.

**`validateToken()` does not actually validate:**
- Symptoms: Returns `true` for any non-empty token without contacting the backend. Comment on line 154 states: "Skip meaningless backend validation - just trust we have a token."
- Files: `src/shared/services/auth/tokenService.js` (lines 139-166)
- Trigger: Any call site that depends on `validateToken()` for genuine validity (e.g., post-login boot).
- Workaround: Real validation only occurs on the first API call that fails with 401/403 (handled via `authHandler`).
- Fix approach: Either remove the function (and all callers), or implement a lightweight `/auth/check` ping. Document that the function is a no-op so callers do not assume otherwise.

## Security Considerations

**SQLite database created with `no-encryption`:**
- Risk: Member personal data (names, dates of birth, contact info, medical data, addresses) is persisted to the device in plaintext SQLite, accessible to any app that can read the iOS sandbox or to a jailbroken device.
- Files: `src/shared/services/storage/database.js` (line 136: `this.sqlite.createConnection('vikings_db', false, 'no-encryption', 1, false)`)
- Current mitigation: iOS sandboxing protects against other apps; data is not synced off-device by the storage layer.
- Recommendations: Switch to encryption (Capacitor SQLite supports `'encryption'` mode with a key stored in iOS Keychain). Document the data-at-rest threat model in `docs/architecture/`. Consider whether medical fields specifically warrant a higher protection tier.

**Access tokens stored in `sessionStorage`:**
- Risk: `sessionStorage` is accessible to any JavaScript executing in the same origin, so an XSS bug anywhere in the app can exfiltrate the OSM token. The OAuth callback URL also contains the raw token in the query string before it is stripped.
- Files: `src/shared/services/auth/tokenService.js` (lines 20, 24, 44), `src/features/auth/hooks/useAuth.jsx` (lines 113, 178-185, 212), `src/features/auth/services/auth.js` (lines 82, 127, 184, 510)
- Current mitigation: URL token is removed via `url.searchParams.delete('access_token')` immediately after extraction (`useAuth.jsx` line 212). Sensitive query params are redacted in error logs (`useAuth.jsx` lines 137-140). No `dangerouslySetInnerHTML` or `eval()` were detected.
- Recommendations: Move tokens to the Capacitor Preferences plugin (native secure storage) on native builds. Add a Content Security Policy that blocks inline scripts on the web build. Audit all third-party React packages on each upgrade.

**OAuth callback errors captured to Sentry with URL search context:**
- Risk: `useAuth.jsx` (lines 154-167) captures URL parsing errors to Sentry. The redaction logic (lines 137-140) covers the documented sensitive keys but is silent-fail (lines 144-146 "Silently fail - redaction is best effort"). A novel OAuth provider parameter could leak a token to Sentry.
- Files: `src/features/auth/hooks/useAuth.jsx` (lines 129-167)
- Current mitigation: Explicit redact list for `access_token`, `token`, `token_type`, `id_token`, `refresh_token`, `auth`, `code`.
- Recommendations: Replace allowlist-by-redaction with allowlist-by-inclusion — only attach `pathname` to Sentry, never `search` or `href`. If raw URL is needed, redact ALL query params and only keep their keys.

**Demo mode bypasses real authentication:**
- Risk: `getToken()` returns the literal string `'demo-mode-token'` whenever demo mode is detected (URL param `?demo=true`, hostname starts with `demo.`, path starts with `/demo`, or env var). If any production code path checks "is there a token?" without checking "is this a real token?", demo mode could leak into production.
- Files: `src/features/auth/services/auth.js` (lines 70-83), `src/shared/services/auth/tokenService.js` (lines 10-21), `src/config/demoMode.js` (lines 11-47)
- Current mitigation: Demo mode segregates IndexedDB by name (`vikings-eventmgmt-demo` vs `vikings-eventmgmt`).
- Recommendations: Make `'demo-mode-token'` a non-string sentinel (e.g., `Symbol('demo')`) or namespace it (`demo://`) so any accidental use as an HTTP `Authorization` header is obvious in network logs. Add a startup assertion that production hostnames cannot enter demo mode.

**Console logs leak environment configuration in dev:**
- Risk: `src/config/env.js` (lines 109-116) logs `apiUrl`, environment, and Sentry status to the browser console when `actualEnvironment === 'development'`. Hostname checks include `*.netlify.app`, `*.vercel.app`, `*.onrender.com` as production — but anything else falls back to `MODE`. A misconfigured deploy could log internals to a real user's console.
- Files: `src/config/env.js` (lines 79-100, 108-117)
- Current mitigation: Sentry DSN is masked. OAuth client ID is server-side only.
- Recommendations: Gate the dev-config block on `import.meta.env.DEV` directly instead of `actualEnvironment === 'development'`.

## Performance Bottlenecks

**Storage services are 4,000+ lines of synchronous-looking async code:**
- Problem: `database.js` and `indexedDBService.js` execute many sequential awaits per operation (lookup, transform, validate, log). Writes that touch members or attendance can chain 5-10 awaits.
- Files: `src/shared/services/storage/database.js` (2,149 lines), `src/shared/services/storage/indexedDBService.js` (1,967 lines)
- Cause: Every CRUD function re-initializes the DB (`await this.initialize()`) and revalidates schema with Zod (`safeParseArray`). Bulk writes loop one-at-a-time rather than using transaction batching.
- Improvement path: Hoist `await this.initialize()` to a startup gate. Use `bulk*` IndexedDB transactions and SQLite `executeSet` for batch writes. Validate at the API boundary, not at every storage layer entry.

**`useAuth.jsx` re-renders the whole tree on auth state changes:**
- Problem: Single context provider with 14 hooks (useState/useEffect) means every state mutation re-renders consumers of `useAuth()`, including `EventDashboard`, `EventsLayout`, `EventsOverview`, etc.
- Files: `src/features/auth/hooks/useAuth.jsx` (735 lines)
- Cause: Monolithic context with no selector pattern. `lastSyncTime`, `showTokenExpiredDialog`, and `authState` change at different cadences but all flow through one provider value.
- Improvement path: Split into multiple contexts (auth state, sync state, dialog state) or use a selector library (`use-context-selector`) so consumers only re-render on the slices they read.

**Lazy-loaded routes already in use, but barrel files force eager evaluation of features:**
- Problem: `AppRouter.jsx` lazy-imports `MoversPage`, `SectionsPage`, etc., but each is loaded via `import('../features/movements/components').then(m => m.MoversPage)`. The barrel file (`src/features/movements/components/index.js`) re-exports every component in the directory, defeating tree-shaking on first render of any one route.
- Files: `src/routes/AppRouter.jsx` (lines 12-16), `src/features/*/components/index.js`
- Cause: Barrel re-exports.
- Improvement path: Lazy-import the leaf component directly: `React.lazy(() => import('../features/movements/components/MoversPage'))`.

**Demo dataset hardcoded as a 1,000-line JS module:**
- Problem: `src/config/demoMode.js` ships a full anonymized cache as JavaScript object literals, parsed and held in memory even when demo mode is off (the module is statically imported by `tokenService.js`, `auth.js`, etc.).
- Files: `src/config/demoMode.js` (1,030 lines)
- Cause: Hand-coded object literals.
- Improvement path: Move demo data to a JSON file loaded with dynamic `import()` only when `isDemoMode() === true`.

## Fragile Areas

**Authentication hook (`useAuth.jsx`):**
- Files: `src/features/auth/hooks/useAuth.jsx` (735 lines, 14 hooks)
- Why fragile: Mixes URL parsing, OAuth callback handling, token expiration monitoring, multi-tab broadcast, Sentry context, demo mode, login/logout, dialog management. Several deeply nested try/catch blocks. Refs (`isProcessingAuthRef`, `hasHandledExpiredToken`) coordinate race conditions implicitly.
- Safe modification: Add tests before changing anything (none exist today). Treat each `useEffect` as a separate concern when refactoring. Do not change `sessionStorage` key strings without coordinating across `auth.js`, `tokenService.js`, and `logger.js`.
- Test coverage: Zero unit/integration tests for this file.

**Storage services (`database.js` + `indexedDBService.js`):**
- Files: `src/shared/services/storage/database.js`, `src/shared/services/storage/indexedDBService.js`
- Why fragile: Two parallel implementations (native SQLite vs web IndexedDB) must stay schematically aligned. Schema migration version is currently 8 (`indexedDBService.js` line 7) — past migrations are not visibly versioned in code review terms. Caller code switches between `databaseService` and `IndexedDBService` ad-hoc.
- Safe modification: Always update both files together. Bump `DATABASE_VERSION` and add an `upgrade` clause. Run all `__tests__/` files in `shared/services/storage/__tests__/`.
- Test coverage: Strong coverage in `__tests__/` (11 test files covering normalization, members, indexedDB) — this is the best-tested area of the app.

**Rate limit queue (`rateLimitQueue.js`):**
- Files: `src/shared/utils/rateLimitQueue.js`
- Why fragile: Two `// CRITICAL FIX:` comments (lines 243, 371) signal previous bugs. Manages timers, listeners, async queue, and exponential backoff. Listener callbacks are wrapped in try/catch with logger fallback.
- Safe modification: Test all 429 paths — the comments suggest prior regressions were hard to catch. Verify cleanup of `setInterval` handles.
- Test coverage: No dedicated test file under `__tests__/`.

**Sign-in/out hook (`useSignInOut.js`):**
- Files: `src/shared/hooks/useSignInOut.js`
- Why fragile: Calls multiple sequential APIs with `STEP_DELAY_MS = 150` "to prevent API clashing" (line 17). Uses `AbortController` for cleanup but the contract for which calls are abortable is unclear. Has 2 outstanding circular-dependency TODOs (lines 5, 474).
- Safe modification: Preserve the 150ms delay until the underlying API rate-limit issue is fixed. Verify abort propagation when adding new sequential calls.
- Test coverage: None for the hook directly; constants tested via `signInDataConstants.test.js`.

## Scaling Limits

**Single-section assumption baked into many places:**
- Current capacity: App is built around Scout sections of ~30 members. Camp groups, attendance views, and member tables render flat lists.
- Limit: Member tables (`SectionsList.jsx` 656 lines, `MovementSummaryTable.jsx`) render every row without virtualization. ~500 members per section view will start to drag on lower-end iOS devices.
- Scaling path: Add `react-window` or similar virtualization for member-list and attendance components. Profile with React DevTools before changing.

**`saveMembers` deduplication logic:**
- Current capacity: Multi-section members are merged via `getMembersIntegration` and `saveMembersDataMerge` tests (covered).
- Limit: Member-merge cost is O(N×M) per save; high-volume groups could degrade write performance.
- Scaling path: Index by `scoutid` in `core_members` store (already done — see `indexedDBService.js`). Confirm via `objectStoreVerification.test.js`.

**SQLite write throughput:**
- Current capacity: Per-row inserts in loops.
- Limit: ~hundreds of rows/sec with no batching.
- Scaling path: Use `executeSet` for batch inserts in `database.js`. Existing schema in `schemas/sqliteSchema.js` already declares indexes — confirm they are created on every fresh install.

## Dependencies at Risk

**React 19 (released late 2024):**
- Risk: `package.json` line 70 pins `react: ^19.1.0`. Some peer deps (`@testing-library/react@^16.3.0`, `framer-motion@^12.23.12`) have only recently published React 19 compatibility.
- Impact: Regressions on any minor version bump. StrictMode in `main.jsx` will double-invoke effects in dev — verify auth flows are idempotent.
- Migration plan: Pin to a known-good minor (`19.1.x`) until ecosystem stabilizes. Watch `useEffect` cleanup paths during refactors.

**`@capacitor-community/sqlite` ^7.0.0:**
- Risk: Capacitor 7 SQLite plugin has been through API breakages between major versions. The encryption/migration story has changed in past releases.
- Impact: Locked to one major; future Capacitor 8 migration will require code changes in `database.js`.
- Migration plan: Add a thin adapter interface around the SQLite calls so the plugin can be swapped or upgraded without touching CRUD code.

**`zod` ^4.3.6:**
- Risk: Zod 4 is a major rewrite from Zod 3 with breaking error API changes (`safeParse` shape, error formatting).
- Impact: Any future schema additions need to use Zod 4 syntax. Existing schemas in `src/shared/services/storage/schemas/validation.js` should be audited.
- Migration plan: Stay current. Convert remaining Zod 3 patterns if any sneak in via copy-paste.

## Missing Critical Features

**No real route-level authorization:**
- Problem: As documented above, all `RouteGuard` instances use `authLevel="none"` and the guard component itself ignores its mocked auth state. `RequireAuth` is defined but only referenced in tests/comments — no real route uses it.
- Blocks: Any future feature that needs to gate a page on login state, role, or permission cannot do so until the circular-dependency workaround is resolved.

**No CI checking for unused exports / dead modules:**
- Problem: `useVikingSectionMovers` (broken imports, never called) survived because nothing detected it. The barrel re-export means a tree-shaking analyzer sees it as "used."
- Blocks: Confidence in refactors. Cleanup of dead code per the "No Backwards Compatibility Required" policy in `CLAUDE_SHARED.md`.

**No structured authorization model (roles/permissions):**
- Problem: `RouteGuard.jsx` has stub support for `requiredPermissions` (lines 47-50), but `user.permissions` is never populated anywhere. `getUserRoles` API exists but only returns sections, not permissions.
- Blocks: Admin-only features (e.g., `DataClearPage` is currently behind no guard at all).

## Test Coverage Gaps

**Component layer untested:**
- What's not tested: 0 component unit tests. No `*.test.jsx` files exist anywhere in `src/features/*/components/` or `src/shared/components/`.
- Files: All 70+ component files in `src/features/*/components/` and `src/shared/components/`
- Risk: Component refactors land with no safety net. Snapshot or behaviour tests would catch unintended renders.
- Priority: HIGH for `EventDashboard.jsx`, `EventAttendance.jsx`, `CampGroupsView.jsx`, `MemberDetailModal.jsx` (all 500+ line components handling user-visible Scout data).

**Auth flow untested:**
- What's not tested: `useAuth.jsx` (735 lines, the auth core), `useAuth` hook contract, OAuth callback parsing, token expiration UX, multi-tab broadcast.
- Files: `src/features/auth/hooks/useAuth.jsx`, `src/features/auth/services/auth.js`, `src/shared/services/auth/tokenService.js`, `src/shared/services/auth/authHandler.js`
- Risk: Auth bugs ship to production. Demo-mode/production switching could silently regress.
- Priority: HIGH.

**API layer thinly tested:**
- What's not tested: `src/shared/services/api/api/*.js` — only `signInDataConstants.test.js` exists in `events/services/__tests__/`. No tests for `base.js` rate-limit handling, `events.js`, `members.js`, `flexiRecords.js`, `terms.js`, `auth.js`.
- Files: All 7 files under `src/shared/services/api/api/`
- Risk: Rate-limit regressions, request-payload bugs, and OSM API contract changes go undetected.
- Priority: MEDIUM-HIGH.

**Hooks untested:**
- What's not tested: `useSignInOut.js`, `useAttendanceData.js`, `useSharedAttendance.js`, `useSectionMovements.js`, `useVikingSectionMovers.js` (and the latter is currently broken).
- Files: `src/features/*/hooks/`, `src/shared/hooks/`
- Risk: Custom hook regressions (race conditions, stale-closure, missing cleanup) only show up in manual QA.
- Priority: MEDIUM.

**Rate limiting untested:**
- What's not tested: `src/shared/utils/rateLimitQueue.js` (with two "CRITICAL FIX" comments hinting at past regressions).
- Files: `src/shared/utils/rateLimitQueue.js`
- Risk: 429 handling regressions cause OSM API blocking.
- Priority: HIGH.

**Cypress E2E coverage limited:**
- What's not tested: `04-offline-functionality.cy.js.skip` and `05-user-workflow.cy.js.skip` are both disabled (renamed to `.skip`). Only app loading, authentication smoke, and responsive layout E2E run.
- Files: `cypress/e2e/04-offline-functionality.cy.js.skip`, `cypress/e2e/05-user-workflow.cy.js.skip`
- Risk: Offline-first is a stated principle (see `CLAUDE.md`) but is not exercised in CI.
- Priority: HIGH — enable or rewrite the skipped specs.

---

*Concerns audit: 2026-04-26*
