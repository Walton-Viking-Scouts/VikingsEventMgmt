# Architecture

**Analysis Date:** 2026-02-15

## Pattern Overview

**Overall:** Feature-based layered architecture with offline-first capability and client-side routing

**Key Characteristics:**
- Offline-first with automatic fallback from SQLite (native) to IndexedDB (web) to localStorage
- Multi-feature organization with shared services layer
- OAuth-based authentication with token expiration handling
- React context-based state management with URL synchronization
- Lazy-loaded feature modules for performance optimization
- Comprehensive data caching and synchronization layer

## Layers

**Presentation Layer:**
- Purpose: React components and UI rendering
- Location: `src/features/{feature}/components/`, `src/shared/components/`
- Contains: Page components, form components, UI components, layout components
- Depends on: Custom hooks, context providers, utility functions
- Used by: Router and feature-specific layout wrappers

**Routing & Navigation:**
- Purpose: URL-based routing and page navigation
- Location: `src/routes/AppRouter.jsx`, `src/layouts/`
- Contains: React Router configuration, lazy-loaded feature pages, route guards
- Depends on: React Router DOM, Auth hooks, Context providers
- Used by: Main App component, all page-level routing

**State Management:**
- Purpose: Global application state and navigation state
- Location: `src/shared/contexts/app/AppStateContext.tsx`
- Contains: Navigation data, current view, sync status, UI state
- Depends on: localStorage/IndexedDB for persistence
- Used by: All components requiring global state or navigation context

**Authentication Layer:**
- Purpose: OAuth authentication, token management, user session
- Location: `src/features/auth/`, `src/shared/services/auth/`
- Contains: OAuth flow handling, token storage/validation, user info management, session state
- Depends on: OSM OAuth server, token storage service
- Used by: Route guards, auth context, login/logout flows

**Business Logic & Services:**
- Purpose: Domain-specific logic and data operations
- Location: `src/features/{feature}/services/`, `src/shared/services/data/`
- Contains: Event services, attendance services, movement calculators, data orchestration
- Depends on: Storage layer, API clients, data transformation utilities
- Used by: Custom hooks, components, page components

**Data & Synchronization:**
- Purpose: Data persistence, caching, and sync coordination
- Location: `src/shared/services/data/`, `src/shared/services/storage/`
- Contains: Database service, storage orchestration, data loading, sync tracking
- Depends on: Capacitor SQLite, IndexedDB API, localStorage
- Used by: All services requiring persistence, auth system

**API Integration:**
- Purpose: External API communication
- Location: `src/shared/services/api/`
- Contains: HTTP client configuration, API endpoints, request/response handling
- Depends on: Fetch API, network detection service
- Used by: Data loading services, feature services

**Infrastructure & Utilities:**
- Purpose: Cross-cutting concerns and helpers
- Location: `src/shared/services/utils/`, `src/shared/utils/`, `src/config/`
- Contains: Logging, error handling, date utilities, validation, environment config
- Depends on: Sentry (error tracking), external libraries
- Used by: All layers

## Data Flow

**Authentication Flow:**

1. User visits app → AppRouter checks auth status via useAuth hook
2. useAuth checks localStorage/storage for existing token and user info
3. If OAuth callback detected (access_token in URL) → token stored and user data fetched
4. Auth state determined: 'authenticated', 'token_expired', 'cached_only', 'no_data'
5. AppContent rendered with appropriate UI (login, offline, or main app)

**Data Loading Flow:**

1. App initializes → useAuth triggers auth check and cached data validation
2. If authenticated or cached data exists → dataLoadingService starts loading
3. loadInitialReferenceData fetches sections, members, reference data from API
4. Data stored in database service (SQLite/IndexedDB/localStorage)
5. AppState context updated with lastSyncTime and sync status
6. Components access data via feature services and custom hooks

**Offline Sync Flow:**

1. Network status monitored by NetworkDetectionService
2. If online: dataLoadingService queues pending operations
3. Pending data (created/modified records) synced to backend via API
4. Sync status tracked in database (sync_status table)
5. If offline: UI shows offline indicator, data stored locally, sync deferred

**Component Rendering Flow:**

1. Route matched → Lazy-loaded feature component loads
2. Component uses feature-specific hooks (useEvents, useSections, etc.)
3. Hooks interact with feature services for business logic
4. Feature services read from storage or API services
5. Data bound to component state, rendered with React hooks
6. AppStateProvider supplies global navigation context via useAppState

**Token Expiration Flow:**

1. checkTokenExpiration runs on interval (30s dev, 60s prod)
2. If token expired and offline mode available → show TokenExpiredDialog
3. User can: re-login (clears cache, restarts auth) or stay offline
4. If online required but token expired → force login
5. Auth state updates, triggers re-authentication flow

## Key Abstractions

**AppState Context:**
- Purpose: Global application navigation and UI state
- Examples: `src/shared/contexts/app/AppStateContext.tsx`
- Pattern: useReducer for state updates, localStorage persistence, URL sync

**Storage Abstraction (Database Service):**
- Purpose: Platform-agnostic data persistence
- Examples: `src/shared/services/storage/database.js`, `src/shared/services/storage/indexedDBService.js`
- Pattern: Unified interface supporting SQLite (native), IndexedDB (web), localStorage (fallback)

**Data Loading Service:**
- Purpose: Orchestrate data fetching and caching lifecycle
- Examples: `src/shared/services/data/dataLoadingService.js`
- Pattern: Async orchestration of API calls → storage → state updates with error recovery

**Feature Services:**
- Purpose: Domain-specific business logic
- Examples: `src/features/events/services/flexiRecordService.js`, `src/features/movements/services/movementCalculator.js`
- Pattern: Pure functions or class-based with dependency injection

**Custom Hooks for Feature Logic:**
- Purpose: Encapsulate feature-specific stateful logic
- Examples: `src/features/auth/hooks/useAuth.jsx`, `src/shared/hooks/useSignInOut.js`
- Pattern: useState, useCallback, useEffect for lifecycle management with context access

**Unified Storage Service:**
- Purpose: Consistent storage API across platforms and storage types
- Examples: `src/shared/services/storage/unifiedStorageService.js`
- Pattern: Adapter pattern wrapping database, IndexedDB, localStorage

## Entry Points

**Application Bootstrap:**
- Location: `src/main.jsx`
- Triggers: HTML page load
- Responsibilities: Initialize Sentry error tracking, create React root, render App with AuthProvider

**App Component:**
- Location: `src/App.jsx`
- Triggers: Bootstrap
- Responsibilities: Render AppRouter and Toast notifications

**AppRouter:**
- Location: `src/routes/AppRouter.jsx`
- Triggers: App component
- Responsibilities: Set up BrowserRouter, AppStateProvider context, lazy-load feature pages, handle OAuth callbacks

**AppContent:**
- Location: `src/routes/AppRouter.jsx` (internal to AppRouter)
- Triggers: AppStateProvider setup
- Responsibilities: useAuth hook integration, auth state display, route rendering with guards

**Feature Pages:**
- Location: `src/features/{feature}/components/{Feature}Page.jsx`
- Triggers: Route match (e.g., /events, /sections, /movers)
- Responsibilities: Feature-specific UI, data loading, component composition

## Error Handling

**Strategy:** Multi-layered with Sentry integration, user-facing error boundaries, and graceful degradation

**Patterns:**

- **API Errors:** Caught in data services, logged to Sentry, cached data shown if available, user notified via toast
- **Storage Errors:** Fallback from SQLite → IndexedDB → localStorage, logged but not blocking
- **Authentication Errors:** Managed by useAuth hook, token expired dialog, re-login prompt
- **Component Errors:** ErrorBoundary component at app level catches render errors, Sentry reports critical issues
- **Network Errors:** Handled by offline detection, queued for sync when online, user sees offline indicator
- **Validation Errors:** Input validation in forms, error messages shown in UI, not sent to Sentry

**Error Utilities:**
- Location: `src/shared/services/utils/scoutErrorHandler.js`
- Provides: Structured error logging with context, categorization for Sentry grouping

## Cross-Cutting Concerns

**Logging:**
- Implementation: `src/shared/services/utils/logger.js`
- Approach: Categorized logging (AUTH, DATA, ERROR, APP) with environment-aware levels
- Usage: Import logger, call logger.debug/info/warn/error with message and context

**Validation:**
- Implementation: Scattered across components and services (input validation at form level)
- Approach: Custom validation functions in services, JSDoc type hints
- Usage: Components validate before submission, services validate API responses

**Authentication:**
- Implementation: `src/features/auth/` with OAuth flow and token management
- Approach: useAuth context provider at root level, RouteGuard components for protected routes
- Usage: All authenticated features wrapped in RouteGuard, token checks in auth service

**Network Detection:**
- Implementation: `src/shared/services/network/`
- Approach: Monitor online/offline status, queue operations when offline
- Usage: Automatically triggered by data services, exposes isOnline flag to components

**Data Synchronization:**
- Implementation: `src/shared/services/data/dataServiceOrchestrator.js`, `src/shared/services/storage/database.js`
- Approach: Track sync status per data item, sync pending changes when online
- Usage: Background sync triggered by network reconnection

**Error Tracking:**
- Implementation: Sentry integration via `src/shared/services/utils/sentry.js`
- Approach: Initialize at app bootstrap, capture exceptions and messages with context
- Usage: Automatic capture of unhandled errors, manual Sentry.captureException() calls

---

*Architecture analysis: 2026-02-15*
