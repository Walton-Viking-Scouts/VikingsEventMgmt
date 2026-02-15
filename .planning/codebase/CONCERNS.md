# Codebase Concerns

**Analysis Date:** 2026-02-15

## Tech Debt

**Circular Dependencies - Auth and Shared Components:**
- Issue: `RequireAuth` component disabled due to circular dependency. Currently mocking authentication state instead of using actual `useAuth` hook.
- Files: `src/shared/components/guards/RequireAuth.jsx`, `src/shared/components/guards/RouteGuard.jsx`
- Impact: Auth guard components do not enforce authentication. Any component wrapped with `RequireAuth` will render regardless of authentication status, allowing unauthorized access to protected features.
- Fix approach: Refactor auth hook into shared layer (`src/shared/hooks/useAuth.js`) instead of feature layer, breaking the circular dependency chain. Update all imports to use shared location.

**FlexiRecordDataService - Unimplemented SQLite Methods:**
- Issue: Five critical methods throw `Error` instead of implementing SQLite functionality: `getFlexiRecordListsFromSQLite()`, `getFlexiRecordStructuresFromSQLite()`, `getFlexiRecordDataFromSQLite()`, `storeFlexiRecordListsInSQLite()`, `storeFlexiRecordStructureInSQLite()`
- Files: `src/shared/services/flexiRecordDataService.js` (lines 396-419)
- Impact: SQLite persistence for FlexiRecords is completely bypassed. The app falls back to IndexedDB/localStorage, which have smaller storage limits and don't provide the persistent offline-first experience SQLite enables.
- Fix approach: Implement each method using the established database service pattern in `src/shared/services/storage/database.js`. Mirror the existing IndexedDB implementation for consistency.

**Storage Layer Abstraction Issues:**
- Issue: Multiple overlapping storage services: `UnifiedStorageService`, `IndexedDBService`, `DatabaseService`, and raw `localStorage`/`sessionStorage` access scattered throughout codebase.
- Files: `src/shared/services/storage/` (multiple files), `src/features/events/components/attendance/EventAttendance.jsx`, `src/features/auth/hooks/useAuth.jsx`
- Impact: Inconsistent storage strategy. Some features use SQLite, others use IndexedDB, others use localStorage directly. No clear ownership of storage layer. Makes offline-first guarantees unreliable.
- Fix approach: Establish single storage abstraction. Create `StorageService` facade that routes to appropriate backend (SQLite/IndexedDB/localStorage). All code accesses storage only through this facade.

**useAuth Hook - State Management Complexity:**
- Issue: `useAuth.jsx` is 738 lines with multiple overlapping state variables: `isAuthenticated`, `authState`, `isLoading`, `isBlocked`, `isOfflineMode`, token expiration tracking, cached data checks, and last sync time tracking. Complex interdependencies and async state resolution.
- Files: `src/features/auth/hooks/useAuth.jsx`
- Impact: Difficult to reason about auth state transitions. High risk of race conditions in async auth checks (see `isProcessingAuthRef` workaround on line 100). Token expiration logic interwoven with cache availability checks creating fragile dependency chains.
- Fix approach: Extract auth state machine into separate module using explicit state machine pattern (pending → authenticated → token_expired → no_data). Separate token validation from cache availability logic. Add unit tests for all state transitions.

## Known Bugs

**DraggableMember - Mobile Drag Data Inconsistency:**
- Symptoms: Members can be dragged between camp groups on desktop but behavior is unreliable on mobile. Drag handler sometimes receives incomplete member data.
- Files: `src/features/events/components/CampGroupCard.jsx` (line 142 TODO comment)
- Trigger: Drag member to different camp group on mobile device (iOS/Android)
- Workaround: Currently silent failure - malformed drag data is caught but not reported (line 155 empty catch block)
- Fix approach: Ensure `dragData.member` contains full member object on mobile drops. Add validation in `handleDrop()` and appropriate error logging/user notification on failure.

**Auth Guard Mock State:**
- Symptoms: RequireAuth component always allows access regardless of authentication status
- Files: `src/shared/components/guards/RequireAuth.jsx` (lines 13-16)
- Trigger: Navigate to any protected route while unauthenticated
- Workaround: None - component is effectively disabled
- Fix approach: Solve circular dependency (see Tech Debt above) and restore actual auth hook usage

## Security Considerations

**Token Exposure in URL:**
- Risk: OAuth tokens are visible in window.location.search during OAuth callback processing. While code attempts to redact in logs (lines 137-142 in useAuth.jsx), token remains in browser history and can be captured by browser extensions.
- Files: `src/features/auth/hooks/useAuth.jsx` (lines 112-128)
- Current mitigation: Token is stored in sessionStorage and URL params are processed but not cleared from browser history. Redaction happens only in log output.
- Recommendations:
  1. Implement `window.history.replaceState()` to remove token from URL after processing
  2. Use redirect-based flow without token in URL (server handles token in secure cookie)
  3. Log security event when OAuth token is received and cleaned from URL

**localStorage Write Errors Silently Ignored:**
- Risk: Multiple locations use localStorage without error handling. If quota exceeded or private browsing mode, writes fail silently and app operates with corrupted/missing data.
- Files: `src/features/auth/hooks/useAuth.jsx` (line 27), `src/features/events/components/attendance/EventAttendance.jsx` (line 90)
- Current mitigation: Try-catch blocks exist but only log at debug level - not actionable to user
- Recommendations:
  1. Detect localStorage unavailability at app initialization
  2. Set `isStorageAvailable` flag in app context
  3. Show user warning if storage quota exceeded
  4. Fall back to in-memory storage with session-only data

**Sentry Source Map Configuration:**
- Risk: Source maps uploaded to Sentry via `@sentry/cli` but timing between build, source map upload, and deployment can create misalignment. Bad source maps = "t is not a function" in Sentry.
- Files: `package.json` (lines 43-47)
- Current mitigation: New release workflow attempts to upload source maps before deployment, but if upload fails, deployment proceeds unnoticed
- Recommendations:
  1. Add error check after `sentry:sourcemaps` - fail build if upload fails
  2. Verify source map integrity before deployment
  3. Add rollback mechanism if source maps missing for version

**Rate Limiting Circuit Breaker:**
- Risk: `authHandler.shouldMakeAPICall()` (flexiRecords.js line 65) acts as crude circuit breaker but has no expiration. Once API rate limit hit, app uses stale cache indefinitely without retry mechanism.
- Files: `src/shared/services/api/api/flexiRecords.js`
- Current mitigation: None - broken state persists until app restart
- Recommendations:
  1. Add TTL to circuit breaker state (e.g., 5 minute cooldown with exponential backoff)
  2. Add observable metrics for when circuit breaker trips
  3. Implement graceful degradation: show stale data age to user, offer manual refresh

## Performance Bottlenecks

**EventAttendance Component - Multiple State Syncs:**
- Problem: Component has 11+ state variables (refreshTrigger, attendanceData, members, vikingEventData, activeTab, sortConfig, selectedMember, attendanceFilters, dataFilters, clearingSignInData, sectionFilters) causing excessive re-renders when any state changes. Each filter change, tab switch, or sort triggers full component re-render and dependent hooks.
- Files: `src/features/events/components/attendance/EventAttendance.jsx` (lines 37-112)
- Cause: No state compartmentalization. All UI state in single component. useAttendanceData hook refetches on ANY state change due to dependency array.
- Improvement path:
  1. Move filter state to custom hook (useAttendanceFilters) with memoization
  2. Use Context API or Zustand for attendance data state to prevent prop drilling
  3. Memoize filter computation with useMemo to prevent recalculation
  4. Profile with React DevTools - target <100ms render time

**Large Component Files:**
- Problem: Component files exceed 600-800 lines, combining multiple concerns (display, filtering, sorting, data loading, modal management)
- Files: `src/features/events/components/attendance/EventAttendance.jsx` (891 lines), `src/features/events/components/EventDashboard.jsx` (827 lines), `src/features/events/components/CampGroupsView.jsx` (822 lines), `src/features/events/components/attendance/DetailedTab.jsx` (628 lines)
- Cause: Feature-driven organization without component-level granularity
- Improvement path:
  1. Split EventAttendance into: AttendanceContainer (state/logic) + AttendanceView (render)
  2. Extract tabs into separate container components with own state
  3. Create reusable sub-components for member lists, filters, sorting
  4. Target: no component >400 lines

**FlexiRecordService - Inefficient Field Mapping:**
- Problem: Multiple transformation passes over FlexiRecord data (field mapping, section assignment, group allocation) in `flexiRecordService.js` and `flexiRecordTransforms.js`. Each transformation iterates full dataset.
- Files: `src/features/events/services/flexiRecordService.js` (1372 lines), `src/shared/utils/flexiRecordTransforms.js` (722 lines)
- Cause: Transforms developed incrementally without optimization
- Improvement path:
  1. Combine transforms into single pass where possible
  2. Index data by ID before lookups instead of finding by loop
  3. Profile with Chrome DevTools - target <500ms for 1000 members

**Database Query N+1 Problem:**
- Problem: `DatabaseService` queries may fetch data then loop to get related records. Example: fetch all members, then for each member fetch their event attendance.
- Files: `src/shared/services/storage/database.js` (1576 lines)
- Cause: Legacy query structure without JOIN optimization
- Improvement path:
  1. Audit all query patterns in database.js
  2. Add composite indices for common queries (section + term, member + event)
  3. Use SQLite JOINs instead of separate queries where possible
  4. Profile with SQLite EXPLAIN QUERY PLAN

## Fragile Areas

**OAuth Flow - Multiple State Machines:**
- Files: `src/features/auth/hooks/useAuth.jsx`, `src/features/auth/services/auth.js`, `src/shared/services/auth/tokenService.js`
- Why fragile: Three separate pieces handle auth state (hook state machine, service validation, token service expiration) with no enforced coordination. URL params parsing, session storage, localStorage writes, and Sentry context all interleaved.
- Safe modification:
  1. Never modify auth state directly in components - use provided hook only
  2. Any token changes must go through `setToken()` - never directly modify sessionStorage
  3. Test auth state transitions end-to-end with E2E tests
  4. Document the complete flow before making changes
- Test coverage: Unit tests exist for individual functions but no E2E tests for complete OAuth flow

**FlexiRecord API Contract:**
- Files: `src/shared/services/api/api/flexiRecords.js`, `src/features/events/services/flexiRecordService.js`, `src/features/events/services/campGroupAllocationService.js`
- Why fragile: Multiple services depend on specific OSM FlexiRecord API response shape. If field names, array structures, or ID formats change, cascading failures across transformation pipeline.
- Safe modification:
  1. Never assume API response shape - validate all fields before use
  2. Add type guards: `if (!data.items || !Array.isArray(data.items)) throw new Error('Invalid API response')`
  3. Any API contract changes require updates in three places (API service, transform utility, feature service)
  4. Add integration tests with mock OSM responses
- Test coverage: Minimal - mostly unit tests with mocked data, no API contract validation tests

**Demo Mode Data Segregation:**
- Files: `src/features/events/services/campGroupAllocationService.js`, `src/features/events/services/flexiRecordService.js`, `src/config/demoMode.js`
- Why fragile: Multiple services check `isDemoMode()` separately and maintain separate demo data. If demo flag logic changes, inconsistency between services.
- Safe modification:
  1. Centralize demo mode checks in unified storage service
  2. All services should NOT directly check isDemoMode - use storage service instead
  3. Demo data must be loaded on initialization, not checked at runtime
  4. Add clear separation: demo = localhost/demo URL, production = Render.com
- Test coverage: Demo mode has dedicated test data in `src/config/demoMode.js` but no end-to-end tests verifying demo behavior

**Attendance Data Synchronization:**
- Files: `src/shared/hooks/useSignInOut.js`, `src/features/events/hooks/useAttendanceData.js`, `src/features/events/services/signInDataService.js`
- Why fragile: Three separate hooks manage attendance-related state (sign in/out, attendance display, shared attendance). Manual refresh triggers required to keep state in sync.
- Safe modification:
  1. Changes to sign-in/out logic require testing both single-user and multi-section scenarios
  2. Data refresh failures must explicitly clear UI state to prevent showing stale data
  3. Any API failure in one hook doesn't prevent UI from rendering with old data
  4. Add explicit error boundaries around attendance operations
- Test coverage: Unit tests for individual functions, limited integration tests, no multi-user sync tests

## Scaling Limits

**SQLite Database Size on Mobile:**
- Current capacity: SQLite default limits on iOS/Android (typically 100MB+ available)
- Limit: With full member records (~5KB per member), audit logs, and historical attendance data, capacity may be exceeded at 10,000+ members across multiple sections
- Scaling path:
  1. Implement data archival - move old attendance records to separate archive
  2. Add field exclusion - don't store all custom fields, only required ones
  3. Implement incremental sync instead of full resync
  4. Consider partitioning by section or term

**IndexedDB Storage for Web:**
- Current capacity: Browser-dependent, typically 50MB but varies (Safari 50MB, Chrome 50%+ disk space)
- Limit: Large FlexiRecord structures and complete member data for multiple large sections may exceed quota
- Scaling path:
  1. Implement blob-based compression for large data
  2. Move historical data to server-side storage
  3. Use progressive loading - fetch only currently-needed sections
  4. Monitor quota usage and warn user when approaching limit

**API Rate Limiting - OSM Tier Limits:**
- Current capacity: OSM API default limits (exact limits depend on OSM tier)
- Limit: Multi-section events with frequent sign-in/out operations hit rate limits on OSM API
- Scaling path:
  1. Batch API operations - queue multiple sign-in/outs, submit together
  2. Implement client-side request coalescing
  3. Request higher tier from OSM if available
  4. Use bulk update endpoints instead of individual member updates

**Member List Rendering:**
- Current capacity: React can render 500-1000 items efficiently with virtualization, but current implementation likely renders full list
- Limit: Sections with 1000+ members will see sluggish UI with list scrolling/filtering
- Scaling path:
  1. Implement virtual scrolling using react-window or react-virtualized
  2. Add client-side filtering with indexed search
  3. Lazy-load member details instead of rendering all data upfront
  4. Test with 2000+ member lists

## Dependencies at Risk

**@capacitor-community/sqlite - Community-Maintained:**
- Risk: Community-maintained package, not officially supported by Capacitor team. May have delayed security updates or breaking changes.
- Impact: Security vulnerabilities in SQLite layer not patched promptly. Breaking changes could force major version upgrades.
- Migration plan: Monitor package health. If updates stall, evaluate alternatives: `@capacitor/sqlite` (if official released) or `sql.js` for cross-platform SQLite support.

**@sentry/react - Source Map Integration:**
- Risk: Source map upload timing requires manual coordination. Version mismatch between build and Sentry causes incomplete stack traces.
- Impact: Production errors show minified stack traces ("t is not a function") making debugging impossible.
- Migration plan: Implement automated source map verification in CI pipeline. Add pre-deployment source map check.

**@testing-library/react - Testing Library Maintenance:**
- Risk: If testing library changes async utilities API, all async tests break
- Impact: Test suite becomes unmaintainable
- Migration plan: Pin version strictly. Review upgrade notes before updating. Add integration tests before major upgrades.

## Missing Critical Features

**Offline-First Data Sync:**
- Problem: App claims offline-first but has no automatic sync queue. Sign-ins recorded offline don't sync when online unless user manually refreshes.
- Blocks: Reliable multi-user attendance tracking in low-connectivity environments (remote camps)

**Multi-User Conflict Resolution:**
- Problem: No conflict detection if two leaders modify same member's data offline. Last write wins, earlier changes lost.
- Blocks: Collaborative event management where multiple leaders work simultaneously

**Audit Trail:**
- Problem: No record of who changed what data or when. Sign-in times recorded but attribution missing (which leader signed in the member?).
- Blocks: Compliance requirements, debugging data issues, Leader accountability

**Rollback / Undo Capability:**
- Problem: Once data modified and synced, no way to undo. Accidental bulk operations cannot be recovered.
- Blocks: Data safety, operational recovery from user errors

## Test Coverage Gaps

**Authentication Flow - End-to-End:**
- What's not tested: Complete OAuth flow from login page through token receipt to authenticated state
- Files: `src/features/auth/hooks/useAuth.jsx`, `src/features/auth/services/auth.js`
- Risk: Auth system may work in development but fail in production OAuth flow. Circular dependency issue (see Tech Debt) may worsen without comprehensive E2E coverage.
- Priority: **High** - Auth is critical path, affects all users

**FlexiRecord API Contract Validation:**
- What's not tested: Actual OSM API responses - only mocked data tested. If API changes response structure, app breaks silently.
- Files: `src/shared/services/api/api/flexiRecords.js`, `src/features/events/services/flexiRecordService.js`
- Risk: API contract drift causes data corruption or missing attendance records
- Priority: **High** - Core functionality depends on API shape

**Multi-Section Member Handling:**
- What's not tested: Behavior when member belongs to multiple sections with attendance in multiple places
- Files: `src/shared/utils/flexiRecordTransforms.js`, `src/shared/services/storage/database.js`
- Risk: Members duplicated, attendance records mixed between sections
- Priority: **High** - Common use case (leaders serve multiple sections)

**Storage Fallback Behavior:**
- What's not tested: Behavior when localStorage/IndexedDB/SQLite unavailable. Does app handle gracefully?
- Files: `src/shared/services/storage/`, `src/features/auth/hooks/useAuth.jsx`
- Risk: Private browsing mode, quota exceeded, or permission denied silently breaks offline capability
- Priority: **Medium** - Edge case but critical for offline-first

**Network Disconnection Scenarios:**
- What's not tested: App behavior during network disconnection mid-operation (signing in, loading data, syncing)
- Files: `src/features/events/components/attendance/EventAttendance.jsx`, `src/shared/hooks/useSignInOut.js`
- Risk: Incomplete operations, stuck loading states, silent failures
- Priority: **Medium** - Common in mobile/outdoor environments

**Mobile Drag & Drop:**
- What's not tested: Actual drag operations on iOS/Android. Desktop tests only.
- Files: `src/features/events/components/CampGroupCard.jsx`, `src/features/events/components/CampGroupsView.jsx`
- Risk: Drag & drop completely broken on mobile (see Known Bugs above)
- Priority: **High** - Core feature for camp group assignment

**Sentry Integration:**
- What's not tested: Actual Sentry event transmission, source map alignment, error categorization
- Files: `src/shared/services/utils/sentry.js`
- Risk: Production errors not reaching Sentry or arriving with incomplete context
- Priority: **Medium** - Visibility into production issues

---

*Concerns audit: 2026-02-15*
