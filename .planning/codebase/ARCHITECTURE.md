# Architecture

**Analysis Date:** 2026-04-26

## Pattern Overview

**Overall:** Feature-Based Modular React SPA with Offline-First Layered Service Architecture

**Key Characteristics:**
- Feature-sliced organization (`src/features/*`) with co-located components/hooks/services per feature
- Shared infrastructure layer (`src/shared/*`) for cross-feature concerns (API, storage, UI primitives, utilities)
- Offline-first design: all reads/writes flow through a local persistence layer (SQLite on native, IndexedDB on web) with API as a refresh source
- Hybrid mobile architecture using Capacitor to wrap the React/Vite web app for iOS (and web) deployment
- URL-based routing as the single source of navigation truth, with a responsive layout selector that swaps mobile/desktop chrome
- Centralized cross-cutting concerns: structured logging (`logger.js`), error tracking (`sentry.js`), notifications (`notifications.js`), rate-limit queue (`rateLimitQueue.js`)
- Lazy-loaded feature modules via `React.lazy` for performance

## Layers

**Routing & App Shell:**
- Purpose: Bootstraps React, wires global providers, defines top-level routes, and selects the responsive layout
- Location: `src/main.jsx`, `src/App.jsx`, `src/routes/AppRouter.jsx`
- Contains: `BrowserRouter`, `AuthProvider`, `AppStateProvider`, lazy feature route mounts, route guards
- Depends on: Auth hooks, shared layout/guards components, all feature `components` barrels
- Used by: Browser entry (`index.html` -> `main.jsx`)

**Layout Layer:**
- Purpose: Render mobile vs desktop chrome (header, navigation, footer) around routed content
- Location: `src/layouts/MobileLayout.jsx`, `src/layouts/DesktopLayout.jsx`, `src/shared/components/layout/ResponsiveLayout.jsx`, `src/shared/components/layout/MainNavigation.jsx`
- Contains: Layout shells, navigation tabs, viking branded header (`src/shared/components/VikingHeader.jsx`)
- Depends on: `src/shared/utils/platform.js` for mobile detection
- Used by: `AppRouter` -> wraps every page

**Feature Layer (`src/features/*`):**
- Purpose: Domain functionality grouped by user-facing concern
- Locations:
  - `src/features/auth/` - Authentication flows, OAuth handling, token lifecycle, AuthProvider/useAuth
  - `src/features/events/` - Event browsing, attendance grids, registers, camp groups, sign-in/out, FlexiRecord allocation
  - `src/features/sections/` - Scout section listing, members, medical info, filtering
  - `src/features/movements/` - Section transfer planning (movers), drag-and-drop assignment, term-based movement
  - `src/features/admin/` - Admin tools (`DataClearPage`)
  - `src/features/young-leaders/` - Young leaders directory page
- Each feature uses the canonical sub-structure: `components/`, `hooks/`, `services/`, `index.js` (some only have `components/`)
- Depends on: Shared services for API/storage/utils; React Router for navigation; sibling features through narrow imports
- Used by: `AppRouter` lazy-loads each feature's `components` barrel

**Shared Component Layer (`src/shared/components/`):**
- Purpose: Reusable UI primitives, layout wrappers, route guards, error boundaries
- Sub-areas:
  - `ui/` - `Modal.jsx`, `Alert.jsx`, `ConfirmModal.jsx`, `MemberDetailModal.jsx`, `ErrorState.jsx`, `RefreshButton.jsx`, `MedicalDataDisplay.jsx`, `SectionFilter.jsx`, `SectionCardsFlexMasonry.jsx`
  - `layout/` - `MainNavigation.jsx`, `ResponsiveLayout.jsx`
  - `guards/` - `RouteGuard.jsx`, `RequireAuth.jsx`
  - `forms/`, `sync/` - placeholders / network indicators
  - Top-level: `AuthButton.jsx`, `BlockedScreen.jsx`, `DataFreshness.jsx`, `ErrorBoundary.jsx`, `Footer.jsx`, `LoadingScreen.jsx`, `LoginScreen.jsx`, `TokenCountdown.jsx`, `TokenExpiredDialog.jsx`, `VikingHeader.jsx`
- Depends on: Tailwind classes, scout color palette, React Router for nav-aware components
- Used by: All features and the app shell

**Shared Hooks Layer (`src/shared/hooks/`):**
- Purpose: Cross-feature reusable React hooks
- Files: `useURLSync.js`, `useSignInOut.js`
- Used by: Feature components needing URL synchronization or sign-in/out actions

**Service Layer (`src/shared/services/*`):**
- Purpose: All non-UI logic - API calls, persistence, auth, networking, reference data
- Sub-modules:
  - `api/api/` - HTTP API surface split by resource: `base.js` (config, token validation, rate-limit handling), `auth.js`, `events.js`, `members.js`, `terms.js`, `flexiRecords.js`. Re-exported via `api/api/index.js` and `api/index.js`
  - `auth/` - `tokenService.js` (token storage, expiration), `authHandler.js` (singleton 401/403 circuit breaker)
  - `data/` - High-level data orchestration: `dataLoadingService.js` (post-auth load: Reference -> Events -> Attendance -> FlexiRecord), `dataServiceOrchestrator.js`, `dataTransformationService.js`, `eventDataLoader.js`, `eventsService.js`, `attendanceDataService.js`, `vikingEventDataService.js`, `vikingEventStorageService.js`, `flexiRecordStructureService.js`, `flexiRecordDataService.js`
  - `storage/` - `database.js` (Capacitor SQLite singleton with localStorage fallback), `indexedDBService.js` (web cache via `idb`), `currentActiveTermsService.js`, `schemas/` (`sqliteSchema.js`, `indexedDBSchema.js`, `validation.js` using Zod)
  - `network/` - `NetworkStatusManager.js` (Capacitor Network plugin wrapper, online/offline events)
  - `referenceData/` - `referenceDataService.js` (loads sections, terms, flexi structures)
  - `utils/` - `logger.js` (categorized structured logger with Sentry breadcrumbs), `sentry.js` (Sentry init/utils)
- Depends on: Backend HTTP API (`VITE_API_URL`), Capacitor plugins, IndexedDB, localStorage
- Used by: Features (services and hooks), App-level Auth provider, refresh handlers in `AppRouter`

**Feature Services Layer (`src/features/<feature>/services/`):**
- Purpose: Domain-specific service logic that builds on shared services
- Examples:
  - `src/features/auth/services/auth.js` - Top-level auth/OAuth orchestration, used by `useAuth`
  - `src/features/auth/services/simpleAuthHandler.js` - Local instance of auth circuit breaker
  - `src/features/events/services/flexiRecordService.js` - FlexiRecord domain operations
  - `src/features/events/services/campGroupAllocationService.js` - Camp group allocation logic
  - `src/features/events/services/signInDataService.js` - Sign-in data persistence
- Used by: Feature components and hooks within the same feature

**Configuration Layer (`src/config/`):**
- Purpose: Environment validation and demo-mode behavior toggle
- Files: `env.js` (validates `VITE_API_URL`, exposes `config` singleton), `demoMode.js` (large module controlling demo data isolation)
- Used by: API base, storage keys, auth flow

**State Management:**
- `AuthProvider` (in `src/features/auth/hooks/useAuth.jsx`) - Authentication state, token expiration, offline mode, cached data presence
- `AppStateProvider` (in `src/shared/contexts/app/AppStateContext.tsx`) - useReducer-based state for navigation data, current view, refresh/sync flags, last sync time, with localStorage persistence and URL synchronization
- Local `useState` within feature components for view-local state (e.g., `EventsContainer` toggles dashboard/attendance)

## Data Flow

**Application Bootstrap:**
1. `index.html` loads `src/main.jsx`
2. `main.jsx` calls `initSentry()`, then mounts `<StrictMode><AuthProvider><App /></AuthProvider></StrictMode>`
3. `App.jsx` renders `<AppRouter />` plus the global `<Toaster />`
4. `AppRouter` wraps everything in `BrowserRouter` -> `AppStateProvider` -> `AppContent`
5. `AppContent` consumes `useAuth`, shows `LoadingScreen` until auth check completes, then renders `ResponsiveLayout` containing the lazy-loaded routes

**Authentication & Initial Data Load:**
1. `useAuth` checks token validity on mount via `tokenService.isTokenExpired()` and cached user info
2. On successful auth or post-OAuth callback, `dataLoadingService.loadAllDataAfterAuth(token)` runs
3. Sequence: Reference Data (sections, terms, flexi structures) -> Events -> Attendance -> FlexiRecord Data
4. All results are persisted via `databaseService` (SQLite/localStorage) and `IndexedDBService` (web cache)
5. `lastSyncTime` is recorded in IndexedDB and reflected in the header

**Page Render & Data Read:**
1. User navigates to a route (e.g., `/sections`); `AppRouter` resolves the lazy module
2. Page component mounts (e.g., `SectionsPage`) and immediately reads from local persistence: `databaseService.getSections()`
3. UI renders from cache; manual `RefreshButton` triggers an authenticated fetch via shared API + writes through to storage
4. Notifications (`notifySuccess`/`notifyError`) confirm refresh outcomes

**API Request Path:**
1. Caller invokes a function from `src/shared/services/api/api/index.js` (e.g., `getEvents`)
2. The resource module calls helpers in `src/shared/services/api/api/base.js`
3. `validateTokenBeforeAPICall()` checks token presence/expiration; offline-first paths return cache-fallback signals instead of throwing
4. Requests are wrapped by `withRateLimitQueue` (in `src/shared/utils/rateLimitQueue.js`) and dispatched to `BACKEND_URL` (`VITE_API_URL`, default `https://vikings-osm-backend.onrender.com`)
5. Responses flow through `handleAPIResponseWithRateLimit` and `authHandler.handleAPIResponse` (401/403 circuit breaker)
6. Network status is observed via `NetworkStatusManager` (Capacitor Network plugin)

**Persistence Path:**
- Native (iOS via Capacitor): writes to SQLite tables defined in `src/shared/services/storage/schemas/sqliteSchema.js`, validated by Zod in `schemas/validation.js`
- Web: falls back to localStorage for relational-style data and uses IndexedDB (`idb`) for cache stores defined in `STORES` of `indexedDBService.js`
- Demo mode swaps the database name (`vikings-eventmgmt-demo`) so demo and live data never mix

**Routing & URL Sync:**
- All routes are URL-driven (`/events/*`, `/movers`, `/sections`, `/young-leaders`, `/clear`)
- `AppStateContext` listens to `useLocation`/`useSearchParams` and dispatches `SYNC_FROM_URL` so reducer state mirrors the URL
- `MainNavigation` reads `useLocation` to highlight the active tab
- `EventsRouter` (`/events/*`) provides nested routing for `index` (dashboard) and `attendance-viewer`

## Key Abstractions

**AuthProvider / useAuth:**
- Purpose: Central authentication state, OAuth orchestration, token expiration dialog control, offline-mode toggling
- Examples: `src/features/auth/hooks/useAuth.jsx`, consumed in `src/main.jsx` (provider) and `src/routes/AppRouter.jsx` (consumer)
- Pattern: React Context + custom hook with internal `useState`/`useRef` for re-entrancy guards

**AppStateContext:**
- Purpose: App-wide navigation state, view tracking, refresh/sync flags with URL sync and localStorage persistence
- Examples: `src/shared/contexts/app/AppStateContext.tsx`
- Pattern: `useReducer` with typed actions (TypeScript), provider consumed via `useAppState()`

**RouteGuard:**
- Purpose: Declarative auth-level gating for routes
- Examples: `src/shared/components/guards/RouteGuard.jsx` (currently neutralized due to circular-dep TODO), `src/shared/components/guards/RequireAuth.jsx`
- Pattern: Component prop `authLevel` (`none` | `offline_capable` | `authenticated`) with optional `requiredPermissions`

**Database Service (singleton):**
- Purpose: Cross-platform offline persistence with SQLite/localStorage detection
- Examples: `src/shared/services/storage/database.js` (default export `databaseService`)
- Pattern: Class instance exported as singleton; `Capacitor.isNativePlatform()` selects backend

**IndexedDBService:**
- Purpose: Web-side structured cache (sections, events, attendance, flexi data, sync metadata)
- Examples: `src/shared/services/storage/indexedDBService.js`
- Pattern: Module-level `dbPromise` lazy initializer using `idb.openDB`; static `STORES` constant

**API Module Boundary:**
- Purpose: Single import surface for all backend calls, organized by resource
- Examples: `src/shared/services/api/api/index.js` re-exports from `base.js`, `auth.js`, `events.js`, `members.js`, `terms.js`, `flexiRecords.js`
- Pattern: Barrel file preserving a flat import API regardless of internal modularization

**Logger / LOG_CATEGORIES:**
- Purpose: Structured leveled logging with Sentry integration
- Examples: `src/shared/services/utils/logger.js` (default export + named `LOG_CATEGORIES`)
- Pattern: Singleton with `trace/debug/info/warn/error/fatal` methods, every call tagged with a category constant

**Rate-Limit Queue:**
- Purpose: Throttle outgoing API calls to respect OSM backend limits
- Examples: `src/shared/utils/rateLimitQueue.js`
- Pattern: `withRateLimitQueue(fn)` wrapper used inside API modules

**NetworkStatusManager:**
- Purpose: Class wrapping Capacitor `Network` plugin, tracking online/offline transitions
- Examples: `src/shared/services/network/NetworkStatusManager.js`
- Pattern: Class with subscribe API, history buffer, debounced offline detection

**Data Service Orchestrator:**
- Purpose: Coordinate FlexiRecord structure + transformation + storage services
- Examples: `src/shared/services/data/dataServiceOrchestrator.js`
- Pattern: Constructor-injected dependencies (services), exposes high-level domain operations

**Notification Helpers:**
- Purpose: Scout-themed toast notifications
- Examples: `src/shared/utils/notifications.js` (`notifySuccess`, `notifyError`, `notifyWarning`)
- Pattern: Thin wrappers around `react-hot-toast` with shared style options

**Error Boundary:**
- Purpose: Catch render-time errors and present a Scout-friendly error screen with retry
- Examples: `src/shared/components/ErrorBoundary.jsx`
- Pattern: Class component using `getDerivedStateFromError` + `componentDidCatch`, delegates to `getScoutFriendlyMessage()`

## Entry Points

**Web Entry:**
- Location: `index.html` -> `src/main.jsx`
- Triggers: Vite dev server (`npm run dev`) or production build (`vite build`)
- Responsibilities: Mount React root, initialize Sentry, wrap in `AuthProvider`

**Native iOS Entry:**
- Location: `ios/App/` (Capacitor-generated Xcode project), bundled `dist/` is loaded as `webDir` per `capacitor.config.json`
- Triggers: `npx cap sync` then Xcode build
- Responsibilities: Embed the Vite-built web app inside an iOS WebView with native bridges (SQLite, Network)

**Routing Entry:**
- Location: `src/routes/AppRouter.jsx`
- Triggers: First render of `<App />`
- Responsibilities: Provide `BrowserRouter`, `AppStateProvider`, define top-level routes, lazy-load features, render `ResponsiveLayout`

**Auth Entry:**
- Location: `src/features/auth/hooks/useAuth.jsx` (`AuthProvider`)
- Triggers: Wrapped around `<App />` in `src/main.jsx`
- Responsibilities: Initialize auth check, OAuth callback processing, token expiration monitoring, expose `login`/`logout`/`handleReLogin`/`handleStayOffline`

**Feature Sub-Routers:**
- `EventsRouter` at `src/features/events/components/EventsRouter.jsx` for `/events/*`
- Each top-level page (`MoversPage`, `SectionsPage`, `YoungLeadersPage`, `DataClearPage`) is its own route entry

**Test Entry:**
- Location: `src/test/setup.js` (loaded by Vitest via `vite.config.js` `test.setupFiles`)
- Triggers: `npm run test` / `npm run test:run`

**E2E Entry:**
- Location: `cypress.config.js` -> `cypress/e2e/`
- Triggers: `npm run cypress:run`, `npm run test:e2e`

## Error Handling

**Strategy:** Layered defense - typed/named errors at the API edge, circuit breaker for auth failures, offline-first fallback to cache, top-level Error Boundary, structured logging + Sentry breadcrumbs throughout

**Patterns:**
- Custom `TokenExpiredError` thrown from `validateTokenBeforeAPICall` in `src/shared/services/api/api/base.js` (carries `status: 401`, `code: 'TOKEN_EXPIRED'`)
- Offline-first: API helpers accept `allowMissingToken` to return `{ shouldFallbackToCache: true }` instead of throwing
- `authHandler` singleton in `src/shared/services/auth/authHandler.js` and `src/features/auth/services/simpleAuthHandler.js` short-circuits API calls after the first 401/403 to prevent cascades
- Token expiration UX handled via `TokenExpiredDialog` (`src/shared/components/TokenExpiredDialog.jsx`) with `handleReLogin`/`handleStayOffline` from `useAuth`
- `scoutErrorHandler.js` (`src/shared/utils/scoutErrorHandler.js`) maps technical errors to Scout-friendly messages
- React `ErrorBoundary` (`src/shared/components/ErrorBoundary.jsx`) catches render errors and presents `ErrorState` with reload action
- All errors logged via `logger.error(message, { error }, LOG_CATEGORIES.ERROR)`; `sentryUtils` adds breadcrumbs and contexts
- User-facing notifications via `notifyError`/`notifyWarning`/`notifySuccess` (`src/shared/utils/notifications.js`)

## Cross-Cutting Concerns

**Logging:** Centralized in `src/shared/services/utils/logger.js`; every module imports `logger, { LOG_CATEGORIES }` and tags log calls with a category (APP, API, AUTH, DATABASE, DATA_SERVICE, ERROR, SYNC, etc.). Production logs route to Sentry breadcrumbs; development logs go to the console with emoji indicators.

**Validation:** Zod schemas in `src/shared/services/storage/schemas/validation.js` (e.g., `SectionSchema`, `EventSchema`, `AttendanceSchema`) used by the database service to safely parse arrays before persisting.

**Authentication:** OAuth handled server-side at the backend; frontend stores access token in `sessionStorage` (`tokenService.js`), tracks expiration timestamps, and broadcasts auth changes across tabs via a `localStorage` ping (`broadcastAuthSync` in `useAuth.jsx`). `RouteGuard` provides declarative gating but currently runs in permissive mode pending circular-dependency cleanup.

**Network Awareness:** `NetworkStatusManager` (`src/shared/services/network/NetworkStatusManager.js`) wraps Capacitor's Network plugin; `networkUtils.js` and `NetworkStatusIndicator.jsx` surface online/offline state in UI; offline mode is reflected in `useAuth` and `ResponsiveLayout` props.

**Rate Limiting:** All API calls funnel through `withRateLimitQueue` (`src/shared/utils/rateLimitQueue.js`); response headers are inspected by `handleAPIResponseWithRateLimit` and surfaced via `getAPIQueueStats`/`logRateLimitInfo`.

**Demo Mode:** `src/config/demoMode.js` (large module) provides demo detection, demo data fixtures, and storage-name suffixing so demo sessions are isolated from real data.

**Performance:** Feature modules are `React.lazy`-loaded in `AppRouter`; Vite `manualChunks` splits `vendor`, `router`, and `ui` chunks (`vite.config.js`); function names preserved in production builds (`keepNames: true`) for accurate Sentry stack traces.

**Observability:** Sentry initialized in `main.jsx` via `initSentry()` (`src/shared/services/utils/sentry.js`); source maps uploaded in build via `@sentry/vite-plugin`; release name set from resolved version.

---

*Architecture analysis: 2026-04-26*
