# Codebase Structure

**Analysis Date:** 2026-02-15

## Directory Layout

```
vikings-eventmgmt-mobile/
├── src/                        # Application source code
│   ├── features/               # Feature modules (auth, events, sections, movements, admin)
│   ├── shared/                 # Shared services, components, hooks, utilities
│   ├── routes/                 # Router configuration
│   ├── layouts/                # Layout components for responsive design
│   ├── config/                 # Configuration files
│   ├── test/                   # Test configuration and setup
│   ├── assets/                 # Static assets (images, icons)
│   ├── App.jsx                 # Root app component
│   ├── App.css                 # App-level styles
│   ├── main.jsx                # Application entry point
│   ├── index.css               # Global styles
│   └── DIRECTORY_SCHEMA.md     # Directory structure documentation
├── public/                     # Public assets served as-is
├── docs/                       # Project documentation
├── cypress/                    # E2E test specifications
├── ios/                        # Native iOS app (Capacitor)
├── vite.config.js              # Vite build configuration
├── package.json                # Project dependencies and scripts
├── vitest.config.js            # Vitest configuration
├── .eslintrc.js                # ESLint configuration
├── .prettierrc                 # Prettier formatting configuration
├── index.html                  # HTML entry point
└── dist/                       # Built application (generated)
```

## Directory Purposes

**src/features/:**
- Purpose: Feature-specific code organized by domain (auth, events, sections, movements, admin)
- Contains: Components, hooks, services for each feature
- Key files: `{Feature}Page.jsx` (main page), service files, custom hooks

**src/features/auth/:**
- Purpose: Authentication system with OAuth flow and token management
- Contains: Login components, OAuth callback handling, token service, session state
- Key files: `src/features/auth/hooks/useAuth.jsx`, `src/features/auth/services/auth.js`

**src/features/events/:**
- Purpose: Event management, attendance tracking, camp group allocation
- Contains: EventsPage, EventDetails, AttendanceGrid, FlexiRecord components
- Key files: `src/features/events/services/flexiRecordService.js`, `src/features/events/hooks/`

**src/features/sections/:**
- Purpose: Scout section management and member lists
- Contains: SectionsPage, SectionsList, SectionCard, MemberCard components
- Key files: `src/features/sections/components/`, `src/features/sections/services/`

**src/features/movements/:**
- Purpose: Calculate and manage member movements between sections by age
- Contains: MoversPage, movement calculation logic
- Key files: `src/features/movements/services/movementCalculator.js`

**src/features/admin/:**
- Purpose: Administrative utilities for data management
- Contains: DataClearPage for clearing cached data
- Key files: `src/features/admin/components/DataClearPage.jsx`

**src/shared/:**
- Purpose: Shared utilities, services, and components used across all features
- Contains: Global state, API services, storage layer, UI components, hooks
- Key files: Multiple subdirectories below

**src/shared/services/:**
- Purpose: Core services for API, database, authentication, data loading
- Location breakdown:
  - `api/` - HTTP client and API configuration
  - `auth/` - Token management and user info storage
  - `storage/` - Database abstraction, SQLite/IndexedDB/localStorage
  - `data/` - Data loading, transformation, and orchestration
  - `network/` - Network detection service
  - `utils/` - Logging, error handling, Sentry integration
  - `referenceData/` - Reference data (sections, members) loading

**src/shared/services/storage/:**
- Purpose: Unified storage layer with platform-specific implementations
- Key files:
  - `database.js` - Main SQLite service with platform detection
  - `indexedDBService.js` - IndexedDB fallback for web
  - `unifiedStorageService.js` - Adapter layer providing consistent API
  - Tables: sections, events, attendance, members, sync_status, etc.

**src/shared/services/data/:**
- Purpose: Data loading pipeline and synchronization
- Key files:
  - `dataLoadingService.js` - Orchestrates loading sections, members, events
  - `dataServiceOrchestrator.js` - Coordinates data operations
  - `eventsService.js` - Event-specific operations
  - `attendanceDataService.js` - Attendance record management
  - `flexiRecordDataService.js` - FlexiRecord data handling

**src/shared/contexts/:**
- Purpose: React Context API state management
- Contains: AppStateContext for navigation and UI state
- Key files: `src/shared/contexts/app/AppStateContext.tsx`

**src/shared/components/:**
- Purpose: Reusable UI components and layout wrappers
- Subdirectories:
  - `ui/` - Basic UI components (Modal, Button, Card, etc.)
  - `layout/` - ResponsiveLayout, header, footer
  - `forms/` - Form components and fields
  - `guards/` - RouteGuard for authentication checks
  - `sync/` - Sync status indicators (private)

**src/shared/hooks/:**
- Purpose: Custom React hooks for shared logic
- Key files:
  - `useSignInOut.js` - Sign in/out with data loading
  - `useURLSync.js` - Synchronize component state with URL parameters

**src/shared/utils/:**
- Purpose: Utility functions for data transformation, calculations, etc.
- Key subdirectories:
  - `sectionMovements/` - Age-based movement calculations
- Key files:
  - `storageUtils.js` - Safe localStorage access
  - `asyncUtils.js` - Async operation helpers
  - `eventDashboardHelpers.js` - Event-specific utilities
  - `termUtils.js` - Term/date calculations
  - `scoutErrorHandler.js` - Error categorization for Sentry

**src/routes/:**
- Purpose: Application routing configuration
- Key files: `AppRouter.jsx` - Main router with lazy-loaded feature pages

**src/layouts/:**
- Purpose: Responsive layout wrappers for desktop and mobile views
- Key files: `MobileLayout.jsx`, `DesktopLayout.jsx`

**src/config/:**
- Purpose: Configuration files and constants
- Contains: Environment variables, API endpoints, app settings

**src/test/:**
- Purpose: Test infrastructure and setup
- Key files: `setup.js` - Vitest configuration, mocks, test utilities

**docs/:**
- Purpose: Project documentation
- Subdirectories:
  - `architecture/` - System design documents
  - `features/` - Feature-specific guides
  - `development/` - Development workflow and debugging guides
  - `getting-started/` - Setup and installation
  - `reference/` - Database schema, API specs

**cypress/:**
- Purpose: End-to-end test specifications
- Subdirectories:
  - `e2e/` - Test files (.cy.js)
  - `fixtures/` - Test data
  - `support/` - Test utilities and commands

## Key File Locations

**Entry Points:**
- `src/main.jsx` - Initializes Sentry, creates React root, mounts app
- `src/App.jsx` - Root component rendering AppRouter
- `src/routes/AppRouter.jsx` - Router setup with lazy-loaded pages and auth context
- `index.html` - HTML entry point with root div

**Configuration:**
- `vite.config.js` - Build configuration with Sentry plugin, HTTPS setup, chunk splitting
- `package.json` - Dependencies, build scripts, version management
- `vitest.config.js` - Test runner configuration (globals, jsdom environment)
- `.eslintrc.js` - Linting rules and plugins
- `.prettierrc` - Code formatting configuration

**Core Logic:**
- `src/features/auth/hooks/useAuth.jsx` - Main authentication hook with token expiration
- `src/shared/services/storage/database.js` - SQLite database service with all table operations
- `src/shared/services/data/dataLoadingService.js` - Orchestrates loading all app data
- `src/shared/contexts/app/AppStateContext.tsx` - Global navigation and UI state

**State Management:**
- `src/shared/contexts/app/AppStateContext.tsx` - AppState context with navigation data, sync tracking
- `src/features/auth/hooks/useAuth.jsx` - Auth context provider and hook

**Testing:**
- `src/test/setup.js` - Test environment setup, mocks, globals
- `cypress/support/` - E2E test utilities and custom commands
- Feature test files co-located: `src/features/{feature}/services/__tests__/`

## Naming Conventions

**Files:**
- Components: `PascalCase.jsx` (e.g., `EventCard.jsx`, `SectionsPage.jsx`)
- Hooks: `camelCase.js` starting with "use" (e.g., `useAuth.jsx`, `useSignInOut.js`)
- Services: `camelCase.js` ending with "Service" (e.g., `eventDataService.js`, `authService.js`)
- Utilities: `camelCase.js` (e.g., `storageUtils.js`, `termUtils.js`)
- Contexts: `{Name}Context.tsx` (e.g., `AppStateContext.tsx`)
- Tests: `{name}.test.js` or `{name}.spec.js` in `__tests__/` folder

**Directories:**
- Features: lowercase with hyphens (e.g., `features/events/`, `features/young-leaders/`)
- Subdirectories: lowercase (e.g., `components/`, `services/`, `hooks/`)
- Shared subdirectories: lowercase (e.g., `shared/components/`, `shared/services/`)

**Components:**
- Page components: `{Feature}Page.jsx` (e.g., `EventsPage.jsx`)
- List components: `{Feature}List.jsx` (e.g., `SectionsList.jsx`)
- Card/item components: `{Feature}Card.jsx` (e.g., `EventCard.jsx`)
- Form components: `{Feature}Form.jsx` (e.g., `AttendanceForm.jsx`)

**React Patterns:**
- Functional components with hooks (no class components)
- Props interface/JSDoc above component
- Export default at bottom of file
- JSDoc documentation on all functions and components

## Where to Add New Code

**New Feature:**
1. Create directory: `src/features/{feature-name}/`
2. Add subdirectories: `components/`, `hooks/`, `services/`
3. Create main page: `src/features/{feature-name}/components/{Feature}Page.jsx`
4. Add route in: `src/routes/AppRouter.jsx` (lazy load the page)
5. Create index.js barrel exports in each subdirectory
6. Add feature service: `src/features/{feature-name}/services/{feature}Service.js`
7. Add feature hook: `src/features/{feature-name}/hooks/use{Feature}.js`

**New Component:**
- Feature-specific: `src/features/{feature}/components/{ComponentName}.jsx`
- Shared/reusable: `src/shared/components/{category}/{ComponentName}.jsx` (e.g., `ui/`, `layout/`, `forms/`)
- Add to barrel export in `index.js` in same directory

**New Hook:**
- Feature-specific: `src/features/{feature}/hooks/useFeature{Name}.js`
- Shared/reusable: `src/shared/hooks/use{Name}.js`
- Include in feature or shared index.js export

**New Service:**
- Feature-specific: `src/features/{feature}/services/{featureName}Service.js`
- Shared data: `src/shared/services/data/{dataType}Service.js`
- Shared utilities: `src/shared/services/utils/{utilityName}.js`

**New Utility:**
- Co-located with usage if feature-specific
- Shared utilities: `src/shared/utils/{utilityName}.js`
- Group related utilities: `src/shared/utils/{category}/` (e.g., `sectionMovements/`)

**Tests:**
- Create `src/{path}/__tests__/{name}.test.js`
- Use Vitest describe/it/expect syntax
- Mock services and APIs as needed

## Special Directories

**src/test/:**
- Purpose: Test infrastructure
- Generated: No
- Committed: Yes
- Contains: setup.js with Vitest globals, jsdom environment setup, mock utilities

**src/assets/:**
- Purpose: Static assets (images, icons, etc.)
- Generated: No
- Committed: Yes
- Usage: Import in components as needed

**cypress/:**
- Purpose: End-to-end test specifications
- Generated: Partially (screenshots/, videos/ are generated)
- Committed: Partially (only .cy.js test files and fixtures committed)

**dist/:**
- Purpose: Built production-ready application
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)
- Output of Vite build process with source maps for Sentry

**docs/:**
- Purpose: Project documentation (architecture, features, setup guides)
- Generated: Partially (JSDoc API docs can be generated)
- Committed: Yes
- See docs/README.md for structure and links

**node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-02-15*
