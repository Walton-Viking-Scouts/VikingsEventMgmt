# External Integrations

**Analysis Date:** 2026-04-26

## APIs & External Services

**Backend API (proxy to Online Scout Manager / OSM):**
- Service: `vikingeventmgmtapi.onrender.com` (default in `.env.example`); fallback constant `https://vikings-osm-backend.onrender.com` declared in `src/shared/services/api/api/base.js`
  - SDK/Client: Native `fetch` with custom `APIQueue`, rate-limit handling, and `withRateLimitQueue` wrapper
  - Auth: Bearer token via `Authorization: Bearer <token>` header; token stored in `sessionStorage` under `access_token`
  - Configuration: `VITE_API_URL` env var (validated in `src/config/env.js`)
  - Base URL constant: `BACKEND_URL` exported from `src/shared/services/api/api/base.js`
- Endpoints called from `src/shared/services/api/api/`:
  - `GET /health` - Backend connectivity test (`base.js:343`)
  - `GET /oauth/login?state=<env>&frontend_url=<url>` - OAuth start (`src/features/auth/services/auth.js:424`)
  - `GET /get-user-roles` - Section/role lookup (`auth.js:149`)
  - `GET /get-startup-data` - User globals + bootstrap (`auth.js:290`)
  - `GET /get-terms` - Term data (`terms.js:198`)
  - `GET /get-members-grid` - Member grid data (`members.js:67`)
  - `GET /get-event-attendance` - Attendance (`events.js:165`)
  - `GET /get-event-summary` - Event summary (`events.js:254`)
  - `GET /get-events*` (additional events endpoints) - `events.js:60, 324, 381`
  - `GET /get-flexi-records` - FlexiRecord lists (`flexiRecords.js:65`)
  - `GET /get-single-flexi-record` - Individual record (`flexiRecords.js:139`)
  - `GET /get-flexi-structure` - Record schema (`flexiRecords.js:216`)
  - `POST /update-flexi-record` (`flexiRecords.js:305`)
  - `POST /multi-update-flexi-record` (`flexiRecords.js:394`)
  - `POST /create-flexi-record` (`flexiRecords.js:469`)
  - `POST /add-flexi-column` (`flexiRecords.js:541`)

**OSM Rate-Limit Awareness:**
- Backend returns `_rateLimitInfo` envelope; logged in `logRateLimitInfo()` at `src/shared/services/api/api/base.js:157`
- HTTP 429 handling parses `errorData.rateLimitInfo.retryAfter` (OSM source) vs `errorData.rateLimit.retryAfter` (internal backend) - `base.js:209-249`
- `osm_blocked` flag in `sessionStorage` when backend reports OSM blocking (`base.js:265-272`)

## Data Storage

**Native SQLite (mobile):**
- Library: `@capacitor-community/sqlite` ^7.0.0
- Service: `src/shared/services/storage/database.js` (`DatabaseService` class)
- Schema definitions: `src/shared/services/storage/schemas/sqliteSchema.js` (`SQLITE_SCHEMAS`, `SQLITE_INDEXES`)
- Validation: Zod schemas in `src/shared/services/storage/schemas/validation.js` (`SectionSchema`, `EventSchema`, `AttendanceSchema`, `SharedEventMetadataSchema`, `TermSchema`, `FlexiListSchema`, `FlexiStructureSchema`, `FlexiDataSchema`)
- Native iOS pod: `CapacitorCommunitySqlite` (`ios/App/Podfile`)

**IndexedDB (web/PWA):**
- Library: `idb` ^8.0.3
- Service: `src/shared/services/storage/indexedDBService.js`
- Database name: `vikings-eventmgmt` (production) / `vikings-eventmgmt-demo` (demo mode)
- Database version: 8
- Object stores (`STORES`): `cache_data`, `sections`, `startup_data`, `terms`, `current_active_terms`, `flexi_lists`, `flexi_structure`, `flexi_data`, `events`, `attendance`, `core_members`, `member_section`, `shared_event_metadata`

**Browser Storage:**
- `sessionStorage` keys: `access_token`, `token_invalid`, `token_expired`, `token_expires_at`, `oauth_return_path`, `osm_blocked` (used in `src/features/auth/services/auth.js`)
- `localStorage` keys (demo mode): `demo_viking_startup_data_offline`, `demo_viking_sections_offline`, plus prefix-scoped patterns (`demo_viking_events_*`, `demo_viking_attendance_*`, `demo_viking_members_*`, `demo_viking_flexi_lists_*`, `demo_viking_flexi_structure_*`, `demo_viking_flexi_data_*`, `demo_viking_shared_metadata_*`, `demo_viking_shared_attendance_*`)

**File Storage:**
- Local filesystem only (no S3/CDN integration detected)

**Caching:**
- Application-level cache via IndexedDB `cache_data` store and SQLite tables
- No Redis/Memcached integration

## Authentication & Identity

**Auth Provider:**
- Online Scout Manager (OSM) OAuth via backend proxy
- Implementation: `src/features/auth/services/auth.js` and `src/features/auth/services/simpleAuthHandler.js`
- Flow: Frontend redirects to `${BACKEND_URL}/oauth/login?state=<prod|dev>&frontend_url=<origin>` (see `generateOAuthUrl()` at `auth.js:410`); backend handles OSM OAuth and returns access token
- OAuth client ID is **not** held client-side - "OAuth client ID removed - now handled server-side for security" (`src/config/env.js:7`)
- Token storage: `sessionStorage.access_token`
- Return path persistence: `sessionStorage.oauth_return_path`
- Auth context: `AuthProvider` from `src/features/auth/hooks` wrapping `<App />` in `src/main.jsx`
- Token service: `src/shared/services/auth/tokenService.js` (`isTokenExpired`, `getToken`)
- Auth circuit breaker: `src/shared/services/auth/authHandler.js` (`authHandler.handleAPIResponse`, `shouldMakeAPICall`, `reset`)
- Demo mode bypass: `getToken()` returns `'demo-mode-token'` when `isDemoMode()` is true (`auth.js:72`)

## Monitoring & Observability

**Error Tracking:**
- Service: Sentry (`@sentry/react` ^9.32.0)
- Org: `walton-vikings`, Project: `viking-event-mgmt` (declared in `vite.config.js:73-74` and `.sentryclirc`)
- Init: `src/shared/services/utils/sentry.js` (`initSentry()`); invoked in `src/main.jsx:9`
- DSN: `VITE_SENTRY_DSN` env var (skips init if missing)
- Releases: Tagged as `vikings-eventmgmt-mobile@<version>` (set via `SENTRY_RELEASE` env var or `package.json` version)
- Integrations enabled: `browserTracingIntegration`, `consoleLoggingIntegration` (log/error/warn/info), `replayIntegration` (production only with `maskAllText: true`, `blockAllMedia: true`)
- Sample rates: `tracesSampleRate` 0.1 (prod) / 1.0 (dev); `replaysSessionSampleRate` 0.1 (prod); `replaysOnErrorSampleRate` 1.0
- Source map upload via `@sentry/vite-plugin` (`vite.config.js:72-93`) and `@sentry/cli` scripts (`sentry:sourcemaps`, `release:create`, `release:finalize`, `release:deploy`)
- User context attached on token set (`setToken` -> `sentryUtils.setUser`); cleared on logout

**Logging:**
- Approach: Centralized logger at `src/shared/services/utils/logger.js`
- Forwards to `Sentry.logger` (Sentry experimental logs feature) and console in dev
- Categories defined in `LOG_CATEGORIES` (e.g., `AUTH`, `API`, `DATABASE`, `SYNC`, `ERROR`)

**Performance:**
- Sentry browser tracing for HTTP spans (`sentryUtils.startSpan` used in API services, e.g., `getUserRoles` in `src/shared/services/api/api/auth.js:109`)

## CI/CD & Deployment

**Hosting:**
- Web: Render.com (`vikingeventmgmt.onrender.com`); deployed via webhook (`RENDER_DEPLOY_HOOK` GitHub secret) - see `.github/workflows/ci.yml` `deploy` job
- iOS: Native build via Xcode + Capacitor (manual / Apple Developer cert flow)
- Backend: Separate repo on Render (`vikings-osm-backend.onrender.com` / `vikingeventmgmtapi.onrender.com`)

**CI Pipeline:**
- Service: GitHub Actions
- Workflows: `.github/workflows/ci.yml` (jobs: `unit-tests`, `documentation`, `build`, `mobile-build`, `deploy`), `.github/workflows/release.yml`
- Custom action: `.github/actions/determine-version` for PR-title-based semver bumping (`feat:` -> minor, `fix:` -> patch, `BREAKING CHANGE` -> major)
- E2E: Cypress Cloud project ID `ehjysh` (`cypress.config.js:5`) - cloud uploads via `CYPRESS_RECORD_KEY` (currently disabled in `ci.yml`)
- iOS build job runs on `macos-latest` and only on `main` (`mobile-build` job)
- Build job creates Sentry release, uploads source maps, marks deploy in `production` environment

## Environment Configuration

**Required env vars:**
- `VITE_API_URL` - Backend API base URL (default in dev: `https://vikingeventmgmtapi.onrender.com`)

**Optional env vars (client):**
- `VITE_SENTRY_DSN` - Sentry DSN; init skipped if absent
- `VITE_DEMO_MODE` - Force demo mode (`'true'`)
- `VITE_USE_URL_ROUTING` - Feature flag (note: `AppRouter.jsx` indicates URL routing is now the only system)
- `VITE_APP_VERSION` - CI-provided version override

**Build/CI vars:**
- `SENTRY_AUTH_TOKEN` - For source map upload (GitHub secret)
- `SENTRY_DEBUG` - Enables Sentry plugin debug output
- `SENTRY_RELEASE` - Override release name for Sentry plugin
- `RENDER_DEPLOY_HOOK` - Webhook URL for production deploy
- `CYPRESS_RECORD_KEY`, `CYPRESS_PROJECT_ID` - Cypress Cloud
- `HTTP_ONLY` - Force HTTP dev server when certs missing

**Secrets location:**
- Local: `.env`, `.env.test`, `.env.sentry-build-plugin` (gitignored)
- CI: GitHub repository secrets (referenced as `${{ secrets.* }}` in workflow)
- iOS: No code signing secrets in repo (handled via Apple Developer account)
- TLS dev certs: `localhost-key.pem`, `localhost.pem` (committed - dev only, see `vite.config.js`)

## Webhooks & Callbacks

**Incoming:**
- OAuth callback handled server-side; frontend reads `access_token` from URL after backend redirect (referenced in `auth.js:97-100` JSDoc example)
- No frontend webhook receivers (SPA-only)

**Outgoing:**
- Render deploy hook: `RENDER_DEPLOY_HOOK` POST trigger from GitHub Actions `deploy` job (`.github/workflows/ci.yml`)
- Sentry CLI calls: release create/finalize, source map upload, deploy marker (via `npx @sentry/cli`)
- GitHub Releases API: `gh release create` from `.github/workflows/ci.yml`

## Native Platform Plugins (iOS)

- `@capacitor/core` - Capacitor runtime (`src/shared/utils/platform.js`, `networkUtils.js`, `database.js`, etc.)
- `@capacitor/ios` - iOS platform shell
- `@capacitor/network` - Network status monitoring (`src/shared/services/network/NetworkStatusManager.js`)
- `@capacitor-community/sqlite` - Native SQLite database
- CocoaPods declared in `ios/App/Podfile`: `Capacitor`, `CapacitorCordova`, `CapacitorCommunitySqlite`, `CapacitorNetwork`
- App identifier: `com.vikingscouts.vikingscoutsmanager` (`capacitor.config.json`, `ios/App/App/Info.plist`)

---

*Integration audit: 2026-04-26*
