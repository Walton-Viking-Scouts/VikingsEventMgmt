# Codebase Structure

**Analysis Date:** 2026-04-26

## Directory Layout

```
ios app/                                # Project root (path contains a space)
├── src/                                # Application source
│   ├── App.jsx                         # Root React component (renders AppRouter + Toaster)
│   ├── main.jsx                        # Browser entry: mounts React, initializes Sentry, wraps in AuthProvider
│   ├── index.css                       # Tailwind + global styles
│   ├── DIRECTORY_SCHEMA.md             # In-repo description of the target feature-based layout
│   ├── assets/                         # Static assets imported into JS
│   ├── config/                         # Environment + demo mode configuration
│   │   ├── env.js                      # Validates VITE_API_URL, exposes config singleton
│   │   └── demoMode.js                 # Demo detection + fixtures + storage-name isolation
│   ├── features/                       # Feature-sliced domain code
│   │   ├── auth/                       # Authentication, OAuth, token lifecycle
│   │   ├── events/                     # Event browsing, attendance, camp groups, FlexiRecord
│   │   ├── sections/                   # Scout sections, members, medical info
│   │   ├── movements/                  # Section movers / transfer planning (drag-and-drop)
│   │   ├── admin/                      # Admin tools (DataClearPage)
│   │   ├── young-leaders/              # Young Leaders directory page
│   │   └── index.js                    # Re-exports every feature barrel
│   ├── shared/                         # Cross-feature infrastructure
│   │   ├── components/                 # Reusable UI primitives, layouts, guards
│   │   │   ├── ui/                     # Modal, Alert, ConfirmModal, MemberDetailModal, etc.
│   │   │   ├── layout/                 # MainNavigation, ResponsiveLayout
│   │   │   ├── guards/                 # RouteGuard, RequireAuth
│   │   │   ├── forms/                  # (placeholder - barrel only)
│   │   │   ├── sync/                   # NetworkStatusIndicator
│   │   │   └── *.jsx                   # ErrorBoundary, VikingHeader, LoginScreen, etc.
│   │   ├── constants/                  # Shared constants (signInDataConstants.js)
│   │   ├── contexts/                   # React contexts
│   │   │   └── app/AppStateContext.tsx # useReducer-based app navigation state (TS)
│   │   ├── hooks/                      # Cross-feature hooks (useURLSync, useSignInOut)
│   │   ├── services/                   # All non-UI services
│   │   │   ├── api/api/                # HTTP API resource modules (auth, events, members, terms, flexiRecords)
│   │   │   ├── auth/                   # tokenService, authHandler (singleton circuit breaker)
│   │   │   ├── data/                   # Loading/orchestration/transformation services
│   │   │   ├── network/                # NetworkStatusManager (Capacitor Network)
│   │   │   ├── referenceData/          # referenceDataService.js
│   │   │   ├── storage/                # database.js (SQLite), indexedDBService.js, schemas/
│   │   │   └── utils/                  # logger.js, sentry.js
│   │   ├── utils/                      # Pure utility functions (date, age, network, notifications, etc.)
│   │   └── index.js                    # Barrel re-exporting components/hooks/services
│   ├── layouts/                        # Layout shells selected by ResponsiveLayout
│   │   ├── MobileLayout.jsx
│   │   └── DesktopLayout.jsx
│   ├── routes/                         # Routing configuration
│   │   ├── AppRouter.jsx               # BrowserRouter, AppStateProvider, lazy routes, guards
│   │   └── README.md
│   └── test/                           # Vitest setup
│       ├── setup.js                    # Loaded via vite.config.js test.setupFiles
│       └── setup.test.js
├── public/                             # Static assets copied verbatim (favicons, manifest, _redirects)
├── dist/                               # Vite build output (generated)
├── ios/                                # Capacitor-generated Xcode project (App/, capacitor-cordova-ios-plugins/)
├── cypress/                            # E2E tests, fixtures, support
│   ├── e2e/
│   ├── fixtures/
│   ├── support/
│   ├── screenshots/
│   └── videos/
├── docs/                               # Project documentation portal
├── scripts/                            # Build/release helpers (sync-version.js, release.sh, etc.)
├── node_modules/                       # Installed dependencies
├── .planning/                          # GSD planning artifacts (PROJECT, ROADMAP, milestones, codebase docs)
├── .github/                            # GitHub Actions workflows
├── .claude/                            # Claude Code settings
├── .cursor/                            # Cursor settings
├── .vscode/                            # VS Code settings
├── .devcontainer/                      # Devcontainer config
├── index.html                          # Vite HTML entry (loads /src/main.jsx)
├── vite.config.js                      # Vite + Sentry plugin + dev HTTPS + manualChunks
├── capacitor.config.json               # Capacitor app id/name/webDir
├── tailwind.config.js                  # Tailwind theme (scout colors)
├── postcss.config.js                   # Tailwind/PostCSS pipeline
├── eslint.config.js                    # Flat ESLint config
├── jsconfig.json                       # JS/TS path aliases (@/* -> src/*)
├── jsdoc.config.json                   # JSDoc generation config
├── cypress.config.js                   # Cypress configuration
├── package.json                        # Scripts + dependencies (React 19, Capacitor 7, Vite 7, Vitest 3)
├── package-lock.json                   # npm lockfile
├── README.md                           # Project README
├── RELEASE_PROCESS.md                  # Release/version automation docs
├── CLAUDE.md                           # Claude project instructions
├── localhost.pem / localhost-key.pem   # Local HTTPS certs for `npm run dev`
└── .env / .env.example / .env.test     # Environment variables (not read directly here)
```

## Directory Purposes

**`src/` (root):**
- Purpose: All TypeScript/JSX application source
- Contains: Entry files (`main.jsx`, `App.jsx`), top-level CSS (`index.css`), feature-based structure
- Key files: `src/main.jsx`, `src/App.jsx`, `src/DIRECTORY_SCHEMA.md`

**`src/features/`:**
- Purpose: Domain code grouped by user-facing feature
- Contains: One subdirectory per feature with `components/`, `hooks/`, `services/`, `index.js`
- Key files: `src/features/index.js` (barrel), one `index.js` per feature

**`src/features/auth/`:**
- Purpose: Authentication state, OAuth orchestration, token lifecycle
- Key files: `src/features/auth/hooks/useAuth.jsx` (AuthProvider + useAuth), `src/features/auth/hooks/useRouteGuards.js`, `src/features/auth/services/auth.js`, `src/features/auth/services/simpleAuthHandler.js`

**`src/features/events/`:**
- Purpose: Largest feature - events listing, attendance management, camp groups, sign-in/out, FlexiRecord
- Key files: `src/features/events/components/EventsRouter.jsx`, `EventsContainer.jsx`, `EventDashboard.jsx`, `EventCard.jsx`, `EventsRegister.jsx`, `EventsOverview.jsx`, `CampGroupsView.jsx`, `attendance/EventAttendance.jsx`, `attendance/DetailedTab.jsx`, `attendance/RegisterTab.jsx`, `services/flexiRecordService.js`, `services/campGroupAllocationService.js`, `hooks/useAttendanceData.js`

**`src/features/sections/`:**
- Purpose: Scout section browsing, member lists, medical data, filtering
- Key files: `src/features/sections/components/SectionsPage.jsx`, `SectionsList.jsx`, `SectionFilter.jsx`, `MedicalDataDisplay.jsx`, `SectionCardsFlexMasonry.jsx`

**`src/features/movements/`:**
- Purpose: Section transfer planning UI with drag-and-drop assignment
- Key files: `src/features/movements/components/MoversPage.jsx`, `SectionMovementTracker.jsx`, `AssignmentInterface.jsx`, `DraggableMover.jsx`, `SectionDropZone.jsx`, `TermMovementCard.jsx`, `hooks/useSectionMovements.js`, `hooks/useVikingSectionMovers.js`

**`src/features/admin/`:**
- Purpose: Administrative tools (currently a single data-clear page)
- Key files: `src/features/admin/components/DataClearPage.jsx`

**`src/features/young-leaders/`:**
- Purpose: Young Leaders single-page directory
- Key files: `src/features/young-leaders/components/YoungLeadersPage.jsx`

**`src/shared/components/`:**
- Purpose: Reusable React components shared by all features
- Sub-areas: `ui/` (primitives), `layout/` (chrome), `guards/` (route protection), `forms/` (placeholder), `sync/` (network UI)
- Key files: `src/shared/components/VikingHeader.jsx`, `ErrorBoundary.jsx`, `LoadingScreen.jsx`, `LoginScreen.jsx`, `TokenExpiredDialog.jsx`, `ui/Modal.jsx`, `ui/Alert.jsx`, `ui/MemberDetailModal.jsx`, `layout/MainNavigation.jsx`, `layout/ResponsiveLayout.jsx`, `guards/RouteGuard.jsx`

**`src/shared/services/`:**
- Purpose: All non-UI logic - API, storage, auth, network, data orchestration, observability
- Sub-areas: `api/api/` (HTTP), `auth/`, `data/`, `storage/`, `network/`, `referenceData/`, `utils/`
- Key files: `src/shared/services/api/api/base.js`, `src/shared/services/api/api/index.js`, `src/shared/services/storage/database.js`, `src/shared/services/storage/indexedDBService.js`, `src/shared/services/auth/tokenService.js`, `src/shared/services/data/dataLoadingService.js`, `src/shared/services/data/dataServiceOrchestrator.js`, `src/shared/services/network/NetworkStatusManager.js`, `src/shared/services/utils/logger.js`, `src/shared/services/utils/sentry.js`

**`src/shared/utils/`:**
- Purpose: Pure utility functions (no React, no I/O)
- Key files: `src/shared/utils/notifications.js`, `rateLimitQueue.js`, `scoutErrorHandler.js`, `networkUtils.js`, `dateFormatting.js`, `timeFormatting.js`, `ageUtils.js`, `phoneUtils.js`, `medicalDataUtils.js`, `sectionHelpers.js`, `flexiRecordTransforms.js`, `sectionMovements/`

**`src/shared/hooks/`:**
- Purpose: Reusable hooks not tied to a single feature
- Key files: `src/shared/hooks/useURLSync.js`, `src/shared/hooks/useSignInOut.js`

**`src/shared/contexts/`:**
- Purpose: App-wide React contexts
- Key files: `src/shared/contexts/app/AppStateContext.tsx` (TypeScript, uses `useReducer` + URL sync)

**`src/shared/constants/`:**
- Purpose: Shared constant values
- Key files: `src/shared/constants/signInDataConstants.js`

**`src/layouts/`:**
- Purpose: Page chrome (mobile vs desktop) used by `ResponsiveLayout`
- Key files: `src/layouts/MobileLayout.jsx`, `src/layouts/DesktopLayout.jsx`

**`src/routes/`:**
- Purpose: Top-level routing configuration
- Key files: `src/routes/AppRouter.jsx`

**`src/config/`:**
- Purpose: Runtime configuration helpers
- Key files: `src/config/env.js`, `src/config/demoMode.js`

**`src/test/`:**
- Purpose: Vitest setup and self-tests
- Key files: `src/test/setup.js` (referenced by `vite.config.js` test.setupFiles), `src/test/setup.test.js`

**`cypress/`:**
- Purpose: End-to-end tests, fixtures, support utilities
- Key files: `cypress/e2e/`, `cypress/fixtures/`, `cypress/support/`, `cypress.config.js`

**`docs/`:**
- Purpose: Long-form project documentation portal
- Key files: `docs/README.md` (entry), plus subdirectories for getting-started, architecture, features, development, reference

**`scripts/`:**
- Purpose: Build, release, and audit automation
- Key files: `scripts/sync-version.js` (prebuild), `scripts/release.sh`, `scripts/setup-branch-protection.sh`, `scripts/audit-components.js`, `scripts/sentry-sync-analyzer.js`

**`ios/`:**
- Purpose: Capacitor-generated Xcode project for native iOS builds
- Generated: Yes (by `npx cap add ios` / `npx cap sync`)
- Committed: Yes (project skeleton + Cordova plugins)

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes (`npm run build`)
- Committed: No (in `.gitignore`)

**`.planning/`:**
- Purpose: GSD planning artifacts (project state, roadmap, milestones, phases, codebase analysis)
- Key files: `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/MILESTONES.md`, `.planning/codebase/*` (output of this analyzer)

## Key File Locations

**Entry Points:**
- `src/main.jsx`: React/Sentry/AuthProvider bootstrap
- `src/App.jsx`: Root component (`AppRouter` + `Toaster`)
- `src/routes/AppRouter.jsx`: Router, providers, lazy routes, guards
- `index.html`: HTML shell loaded by Vite
- `ios/App/`: Capacitor iOS project entry

**Configuration:**
- `vite.config.js`: Vite, Sentry plugin, dev HTTPS, manual chunks, version resolution
- `capacitor.config.json`: appId/appName/webDir for Capacitor
- `tailwind.config.js`: Scout color theme
- `postcss.config.js`: PostCSS pipeline
- `eslint.config.js`: Flat ESLint config (large, ~10KB)
- `jsconfig.json`: Path aliases (`@/* -> src/*`)
- `jsdoc.config.json`: JSDoc generation
- `cypress.config.js`: Cypress E2E config
- `src/config/env.js`: Runtime env validation
- `src/config/demoMode.js`: Demo mode behavior

**Core Logic:**
- `src/shared/services/api/api/base.js`: API base URL, token validation, error class, rate-limit/auth handling
- `src/shared/services/api/api/index.js`: Flat API surface (re-exports per-resource modules)
- `src/shared/services/storage/database.js`: Cross-platform SQLite/localStorage persistence singleton
- `src/shared/services/storage/indexedDBService.js`: Web cache via `idb`
- `src/shared/services/auth/tokenService.js`: Token storage and expiration
- `src/shared/services/data/dataLoadingService.js`: Post-auth load orchestration
- `src/shared/services/data/dataServiceOrchestrator.js`: FlexiRecord domain orchestration
- `src/features/auth/hooks/useAuth.jsx`: AuthProvider + useAuth hook
- `src/shared/contexts/app/AppStateContext.tsx`: App-wide state context

**Testing:**
- `src/test/setup.js`: Vitest setup (Testing Library, jest-axe, fake-indexeddb wiring)
- `src/test/setup.test.js`: Sanity tests for the setup
- Co-located unit tests: `src/**/__tests__/*.test.js` (e.g., `src/shared/services/data/__tests__/`, `src/shared/services/storage/__tests__/`, `src/shared/utils/__tests__/`, `src/features/events/services/__tests__/`)
- E2E: `cypress/e2e/`

## Naming Conventions

**Files:**
- React components: `PascalCase.jsx` (e.g., `EventCard.jsx`, `SectionsPage.jsx`)
- React Context written in TypeScript: `PascalCase.tsx` (e.g., `AppStateContext.tsx`)
- Hooks: `useCamelCase.js` or `useCamelCase.jsx` (e.g., `useAuth.jsx`, `useURLSync.js`, `useSignInOut.js`)
- Services: `camelCaseService.js` or `camelCaseManager.js` (e.g., `eventsService.js`, `tokenService.js`, `NetworkStatusManager.js` - note PascalCase for class-based managers)
- Utilities: `camelCase.js` (e.g., `dateFormatting.js`, `notifications.js`, `rateLimitQueue.js`)
- Barrels: always `index.js` (or `index.ts` for the TS context folder)
- Schemas: `<topic>Schema.js` (e.g., `sqliteSchema.js`, `indexedDBSchema.js`)
- Tests: `<sourceName>.test.js` co-located in `__tests__/` next to the module

**Directories:**
- All directories: lowercase with hyphens for multi-word features (e.g., `young-leaders`, `referenceData` is camelCase exception)
- Feature names: singular plural follows domain (`events`, `sections`, `movements`, `admin`)
- Sub-area folders inside features: always `components/`, `hooks/`, `services/`

**Components:**
- Page components: `<FeatureName>Page.jsx` (e.g., `SectionsPage.jsx`, `MoversPage.jsx`, `YoungLeadersPage.jsx`, `DataClearPage.jsx`)
- Containers: `<Feature>Container.jsx` (e.g., `EventsContainer.jsx`)
- Routers: `<Feature>Router.jsx` (e.g., `EventsRouter.jsx`)
- Cards: `<Feature>Card.jsx` (e.g., `EventCard.jsx`, `CampGroupCard.jsx`, `SectionMovementCard.jsx`)
- Lists: `<Feature>List.jsx` (e.g., `SectionsList.jsx`)
- Modals: `<Purpose>Modal.jsx` (e.g., `ConfirmModal.jsx`, `MemberDetailModal.jsx`, `ClearSignInDataModal.jsx`, `GroupNamesEditModal.jsx`)

**Functions/Variables:**
- Functions and variables: `camelCase`
- React components and classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE` (e.g., `LOG_CATEGORIES`, `STORES`, `SCOUT_COLORS`, `TOKEN_CONFIG`)
- Custom error classes: `PascalCase` ending in `Error` (e.g., `TokenExpiredError`)

## Where to Add New Code

**New Feature (full vertical slice):**
- Primary code: `src/features/<feature-name>/`
- Components: `src/features/<feature-name>/components/<Component>.jsx` + `index.js` barrel
- Hooks: `src/features/<feature-name>/hooks/use<Name>.js` + `index.js`
- Services: `src/features/<feature-name>/services/<name>Service.js` + `index.js`
- Feature root: `src/features/<feature-name>/index.js` re-exporting components/hooks/services
- Register lazy route in `src/routes/AppRouter.jsx` (use `React.lazy` + `RouteGuard`)
- Add tab in `src/shared/components/layout/MainNavigation.jsx` if user-facing top-level

**New Page in Existing Feature:**
- Add `<Name>Page.jsx` to `src/features/<feature>/components/`
- Export from feature `components/index.js`
- Wire route in either `src/routes/AppRouter.jsx` or the feature's nested router (e.g., `EventsRouter.jsx`)

**New Reusable UI Component:**
- Implementation: `src/shared/components/ui/<Component>.jsx`
- Export from `src/shared/components/ui/index.js`
- Use Tailwind classes; follow scout color palette (`scout-blue`, `scout-red`, etc.)

**New Layout Component:**
- Implementation: `src/shared/components/layout/<Component>.jsx`
- Export from `src/shared/components/layout/index.js`
- Layout shells (full-screen wrappers) go in `src/layouts/`

**New API Endpoint Wrapper:**
- Implementation: extend an existing resource module under `src/shared/services/api/api/` (`auth.js`, `events.js`, `members.js`, `terms.js`, `flexiRecords.js`) or add a new resource file
- Re-export from `src/shared/services/api/api/index.js`
- Use `validateTokenBeforeAPICall` and `withRateLimitQueue` patterns from `base.js`

**New Persisted Entity:**
- Add Zod schema in `src/shared/services/storage/schemas/validation.js`
- Add SQLite table in `src/shared/services/storage/schemas/sqliteSchema.js` (`SQLITE_SCHEMAS` and `SQLITE_INDEXES`)
- Add IndexedDB store in `src/shared/services/storage/indexedDBService.js` (`STORES` constant + `upgrade` block; bump `DATABASE_VERSION`)
- Add CRUD methods to `src/shared/services/storage/database.js`

**New Cross-Feature Hook:**
- Implementation: `src/shared/hooks/use<Name>.js`
- Export from `src/shared/hooks/index.js`

**New Pure Utility:**
- Implementation: `src/shared/utils/<name>.js` (no React imports, no I/O side effects beyond logging)
- Co-locate tests in `src/shared/utils/__tests__/<name>.test.js`

**New Service (cross-feature):**
- Choose sub-area under `src/shared/services/`: `data/`, `storage/`, `auth/`, `network/`, `referenceData/`, `utils/`
- Export from the sub-area's `index.js` if one exists, then ensure `src/shared/services/index.js` chain still works

**New Configuration:**
- Add to `src/config/env.js` (validate the env var, add to exported `config`)
- Document in `.env.example`
- Reference via `import { config } from '@/config/env.js'` (or relative path)

**Tests:**
- Unit tests: `src/<path>/__tests__/<file>.test.js` next to the code under test
- Setup hooks: `src/test/setup.js`
- E2E: `cypress/e2e/<spec>.cy.js`

**Logging Calls:**
- Always: `import logger, { LOG_CATEGORIES } from '<relative>/shared/services/utils/logger.js'`
- Pattern: `logger.info('Message', { context }, LOG_CATEGORIES.<CATEGORY>)`

**Notifications:**
- Always: `import { notifySuccess, notifyError, notifyWarning } from '<relative>/shared/utils/notifications.js'`

## Special Directories

**`dist/`:**
- Purpose: Vite production bundle
- Generated: Yes (`npm run build`)
- Committed: No (excluded by `.gitignore`)

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes (`npm install`)
- Committed: No

**`ios/`:**
- Purpose: Capacitor iOS Xcode project
- Generated: Yes (`npx cap add ios`, refreshed by `npx cap sync`)
- Committed: Yes (project skeleton)

**`public/`:**
- Purpose: Static assets copied verbatim into the build
- Contains: Favicons, web manifest, `_redirects` file (for SPA routing on hosting providers)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD workflow artifacts (project state, roadmap, milestones, codebase docs)
- Generated: Partially - `codebase/*` written by mappers like this one; `phases/`, `milestones/`, `research/` curated manually or by other GSD commands
- Committed: Yes

**`.taskmaster/`:**
- Purpose: Task Master AI task management (located at the parent project root `/Users/simon/vsCodeProjects/VikingEventMgmt/.taskmaster/`, NOT inside `ios app/`)
- Generated: Yes (Task Master MCP)
- Committed: Yes (in parent repo)

**`docs/`:**
- Purpose: Long-form project documentation portal (separate from `.planning/`)
- Generated: No (manually curated; some auto-generated JSDoc output in `docs/api/`)
- Committed: Yes

**`scripts/`:**
- Purpose: Helper scripts invoked by npm scripts or developers manually
- Notable: `sync-version.js` runs as `prebuild` to keep package.json version aligned with the resolved release version

**`cypress/screenshots/`, `cypress/videos/`, `cypress/downloads/`:**
- Purpose: Cypress test artifacts
- Generated: Yes (during E2E runs)
- Committed: Typically no (check `.gitignore`)

---

*Structure analysis: 2026-04-26*
