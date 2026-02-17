# External Integrations

**Analysis Date:** 2026-02-15

## APIs & External Services

**Backend REST API:**
- Service: Vikings Event Management Backend (Node.js Express)
- Base URL: `https://vikings-osm-backend.onrender.com` (default in `BACKEND_URL`)
- Configuration: `VITE_API_URL` environment variable
- Used for: User authentication, member data, events, terms, FlexiRecord structures
- Fallback behavior: Offline-first with cached data when API unavailable
- Health check endpoint: `GET /health` for connectivity validation

**OSM Integration (via Backend):**
- Service: Open Source Mapping API integration
- Purpose: Scout member and section structure data
- Rate limiting: OSM enforces 429 status with `retryAfter` headers
- Monitoring: Rate limit info in response headers `_rateLimitInfo`
- Fallback: Backend queues requests if rate limit approached
- Configuration: Handled server-side by backend, no client-side OSM credentials needed

## Data Storage

**Databases:**
- SQLite (native)
  - Client: `@capacitor-community/sqlite` 7.0.0
  - Connection: `src/shared/services/storage/database.js` via Capacitor
  - Tables: sections, events, attendance, members, terms, flexi_records
  - Fallback: localStorage on web when SQLite unavailable
  - Demo mode isolation: Separate tables/storage for demo data

- IndexedDB (browser-based)
  - Client: `idb` 8.0.3
  - Service: `src/shared/services/storage/indexedDBService.js`
  - Used for: Member caching, cross-section member tracking
  - Purpose: High-capacity local data store for offline functionality
  - Testing: `fake-indexeddb` 6.2.2 for unit tests

**File Storage:**
- Local filesystem only - No cloud storage integration
- Data stored in browser: localStorage, IndexedDB, SQLite (native)
- No cloud sync or external file service integration

**Caching Strategy:**
- Multi-level caching: IndexedDB → localStorage → SessionStorage
- Graceful API call fallback: Tries API first, falls back to cached data if offline/auth fails
- Cache busting: Explicit cache clearing via `clearFlexiRecordCaches()` in base.js
- Demo mode: Separate cache keys with `demo_` prefix to isolate test data

## Authentication & Identity

**Auth Provider:**
- Custom backend-based authentication
- Implementation: Server-side OAuth handling (credentials NOT in frontend)
- Token storage: SessionStorage (`sessionStorage.getItem('token')`)
- Token expiration: Checked via `isTokenExpired()` in `tokenService.js`
- User info fallback: Retrieved from startup data, cached offline

**Session Management:**
- Token validation before API calls via `validateTokenBeforeAPICall()` in `src/shared/services/api/api/base.js`
- Automatic token expiration detection with graceful cache fallback
- Auth circuit breaker: Simple authentication handler prevents repeated failed requests
- User context: Set in Sentry after successful login to track user errors

**Token Service Location:**
- `src/shared/services/auth/tokenService.js` - Token management and validation
- `src/shared/services/auth/authHandler.js` - Auth state and circuit breaker

## Monitoring & Observability

**Error Tracking:**
- Sentry - Error monitoring and crash reporting
  - Organization: `walton-vikings`
  - Project: `viking-event-mgmt`
  - SDK: `@sentry/react` 9.32.0
  - Configuration: `src/shared/services/utils/sentry.js`
  - DSN: `VITE_SENTRY_DSN` environment variable (optional)
  - Initialization: `initSentry()` called in `src/main.jsx`

**Sentry Configuration:**
- Environment detection: Automatic via hostname pattern matching (production vs. dev)
- Release tracking: `vikings-eventmgmt-mobile@{version}`
- Performance monitoring: `tracesSampleRate` 0.1 (prod), 1.0 (dev)
- Session replay: 0.1 production sample rate with full media masking
- Integrations: Browser tracing, console logging, session replay (prod only)
- Custom error filtering: Network errors filtered out during offline mode
- Breadcrumbs: API calls tracked with method, URL, and status code

**Logs:**
- Console-based logging with categorized output
- Service: `src/shared/services/utils/logger.js`
- Categories: API, COMPONENT, AUTH, STORAGE, NETWORK
- Sentry logging integration: Captures console logs in production with experimental flag

**API Rate Limit Monitoring:**
- Tracked in response headers via `_rateLimitInfo`
- Warning threshold: < 20 requests remaining (logs warn)
- Critical threshold: < 10 requests remaining (logs error)
- Info logged: OSM remaining count, percentage used, API name

## CI/CD & Deployment

**Hosting:**
- Production: Render.com (configured in workflow and hostname detection)
- Alternative: Netlify/Vercel supported via hostname detection in config

**CI Pipeline:**
- GitHub Actions - Automated build, test, and deployment
- Release workflow: Automated version bumping and release creation
- Deployment trigger: Manual sync after PR merge to main branch
- Status checks: Lint, unit tests, build verification required before merge

**Version Management:**
- Automatic: GitHub Actions detects PR title and bumps version
- Version bump rules:
  - `feat:` or `feature:` prefix → minor version
  - `fix:` or `chore:` → patch version
  - `BREAKING CHANGE` or `[major]` tag → major version
- Source maps: Uploaded to Sentry before deployment via CI/CD
- Release tags: Created automatically (e.g., `v2.11.8`)

**Build Process:**
```bash
npm run build              # Production bundle via Vite
npm run sentry:sourcemaps  # Inject and upload source maps to Sentry
npm run release:create     # Create Sentry release
npm run release:finalize   # Finalize Sentry release
npm run release:deploy     # Record deployment in Sentry
```

## Environment Configuration

**Required env vars:**
- `VITE_API_URL` - Backend API endpoint (required for API calls)

**Optional env vars:**
- `VITE_SENTRY_DSN` - Sentry error tracking endpoint
- `VITE_APP_VERSION` - Override version string (CI-provided)
- `SENTRY_AUTH_TOKEN` - CI/CD token for uploading source maps
- `VITE_DEMO_MODE` - Enable demo mode for public access
- `HTTP_ONLY` - Force HTTP instead of HTTPS (development only)
- `SENTRY_DEBUG` - Enable Sentry debug output in console

**Secrets location:**
- GitHub Secrets (CI/CD environment variables)
- `.env` file (local development, not committed)
- `.env.*.local` files (gitignored)

## Webhooks & Callbacks

**Incoming:**
- None configured - This is a client-only mobile application

**Outgoing:**
- None configured - Backend handles all outbound API calls to OSM
- Event tracking: Sentry events sent via `@sentry/react` SDK

## Network & Connectivity

**Network Status:**
- Service: `src/shared/services/network/NetworkStatusManager.js`
- Detection: `@capacitor/network` 7.0.1 for native platforms
- Fallback: Browser online/offline detection for web
- Listener: Monitors network changes and updates app state

**Offline-First Architecture:**
- All functionality works without internet connection
- Data cached locally via SQLite/IndexedDB
- API calls queue when offline via rate limit queue
- Graceful fallback: Uses cache when API unavailable

**Rate Limiting:**
- Service: `src/utils/rateLimitQueue.js`
- Strategy: Sequential request queuing with configurable delays
- Handles: OSM API 429s and backend rate limits
- Exponential backoff: Respects `retryAfter` headers from API

## Data Synchronization

**Sync Status Tracking:**
- Service: `src/shared/services/storage/database.js`
- Tracks: Which data has been synced vs. pending sync
- Used for: Offline changes and eventual consistency

**FlexiRecord Updates:**
- Service: `src/shared/services/flexiRecordDataService.js`
- Single record update: `PUT /update-flexi-record`
- Batch update: `POST /multi-update-flexi-record`
- New record: `POST /create-flexi-record`
- Add column: `POST /add-flexi-column`

**Member & Section Data:**
- Endpoints: `/get-startup-data` (contains user info, sections)
- Member list: `/get-list-of-members` per section
- Terms: `/get-terms` for date context

## External Libraries & SDKs

**Error Handling SDK:**
- @sentry/react 9.32.0 - Distributed error tracking

**Animation:**
- framer-motion 12.23.12 - Smooth UI animations

**Icons:**
- @heroicons/react 2.2.0 - Hero Icons (Tailwind-compatible)

**Date Utilities:**
- date-fns 4.1.0 - Lightweight date manipulation

**Storage Utilities:**
- uuid 11.1.0 - Generate unique identifiers
- clsx 2.1.1 - Conditional CSS class utilities

---

*Integration audit: 2026-02-15*
