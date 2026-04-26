# Testing Patterns

**Analysis Date:** 2026-04-26

## Test Framework

**Unit/Integration runner:**
- **Vitest** `^3.2.4` — configured inline in `vite.config.js` (no separate `vitest.config.*`).
- Config block (`vite.config.js` lines 152-156):
  ```javascript
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  ```
- `globals: true` means `describe`, `it`, `expect`, `vi`, etc. are auto-injected (still imported explicitly in most test files for clarity).
- `environment: 'jsdom'` (provided by `jsdom` `^26.1.0`).

**Assertion library:**
- Vitest's built-in `expect` (Jest-compatible API).
- `@testing-library/jest-dom` (`^6.6.3`) loaded via `src/test/setup.js` for matchers like `toBeInTheDocument`, `toHaveTextContent`.

**React component testing:**
- `@testing-library/react` `^16.3.0`
- `@testing-library/dom` `^10.4.0`
- `@testing-library/user-event` `^14.6.1`

**Accessibility testing:**
- `jest-axe` `^10.0.0` available (devDep), not yet widely used in current tests.

**E2E runner:**
- **Cypress** `^14.5.0` — config in `cypress.config.js`.
- E2E specs at `cypress/e2e/**/*.cy.{js,jsx,ts,tsx}`.
- Cypress Cloud project ID `ehjysh` configured for parallel/recorded runs.
- Component testing also configured (vite + react bundler) with spec pattern `src/**/*.cy.{js,jsx,ts,tsx}` (no component specs currently exist).

**Run commands:**
```bash
npm run test            # Vitest watch mode
npm run test:run        # Vitest single run (CI mode)
npm run test:ui         # Vitest UI

npm run cypress:open    # Open Cypress runner
npm run cypress:run     # Headless Cypress run
npm run cypress:run:chrome  # Run in Chrome
npm run test:e2e        # Start dev server + run Cypress
npm run test:e2e:open   # Start dev server + open Cypress
npm run test:e2e:cloud  # Cypress Cloud run
npm run test:e2e:cloud:parallel  # Parallel cloud run

npm run test:ci         # Unit + cloud E2E
npm run test:all        # Unit + local E2E
```

## Test File Organization

**Unit/Integration tests:**
- Co-located with source in `__tests__/` subdirectories (Jest-style convention).
- Naming: `<sourceFileBase>.test.js`.
- Examples:
  - `src/shared/utils/__tests__/asyncUtils.test.js` (tests `src/shared/utils/asyncUtils.js`)
  - `src/shared/utils/__tests__/storageUtils.test.js`
  - `src/shared/utils/__tests__/scoutErrorHandler.test.js`
  - `src/shared/utils/__tests__/eventDashboardHelpers.test.js`
  - `src/shared/utils/__tests__/termUtils.test.js`
  - `src/shared/utils/sectionMovements/__tests__/ageCalculations.test.js`
  - `src/shared/services/storage/__tests__/indexedDBService.test.js`
  - `src/shared/services/storage/__tests__/saveMembersDataMerge.test.js`
  - `src/shared/services/data/__tests__/attendanceDataService.test.js`
  - `src/features/events/services/__tests__/signInDataConstants.test.js`
  - `src/features/movements/services/__tests__/movementCalculator.test.js`
- A self-test for setup itself: `src/test/setup.test.js`.

**E2E tests:**
- `cypress/e2e/<NN>-<feature>.cy.js` (numbered ordering).
- Skipped specs use `.cy.js.skip` extension to disable.
- Current specs:
  - `cypress/e2e/01-app-loading.cy.js`
  - `cypress/e2e/02-authentication.cy.js`
  - `cypress/e2e/03-responsive-layout.cy.js`
  - `cypress/e2e/04-offline-functionality.cy.js.skip`
  - `cypress/e2e/05-user-workflow.cy.js.skip`

**Structure:**
```
src/
├── shared/
│   ├── utils/
│   │   ├── asyncUtils.js
│   │   └── __tests__/
│   │       └── asyncUtils.test.js
│   └── services/
│       └── storage/
│           ├── indexedDBService.js
│           └── __tests__/
│               └── indexedDBService.test.js
└── test/
    ├── setup.js          # Global test setup (loaded by vitest)
    └── setup.test.js     # Tests verifying setup itself

cypress/
├── e2e/                  # E2E spec files
├── fixtures/             # JSON test data
├── support/
│   ├── commands.js       # Custom Cypress commands
│   ├── e2e.js            # Loaded automatically before each spec
│   └── api-mocks.js      # API interception system
├── downloads/
├── screenshots/
└── videos/
```

## Global Test Setup

**File:** `src/test/setup.js`

Key responsibilities:
- Imports `@testing-library/jest-dom` for DOM matchers.
- Imports `fake-indexeddb/auto` so `indexedDB` works in jsdom.
- Mocks `global.sessionStorage` (vi.fn-only stub).
- Mocks `global.localStorage` with a backing `Map` so reads return what was written.
- Mocks `window.location` (`href`, `origin`, `pathname`, `reload`, `assign`).

The setup is itself tested in `src/test/setup.test.js` (~555 lines covering every facet of the mocks).

## Test Structure

**Standard pattern** (from `src/shared/utils/__tests__/asyncUtils.test.js`):
```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleep } from '../asyncUtils.js';

vi.mock('../../services/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { APP: 'APP', API: 'API', ERROR: 'ERROR' },
}));

vi.mock('../../services/utils/sentry.js', () => ({
  sentryUtils: { captureException: vi.fn() },
}));

describe('Async Utilities', () => {
  let logger, sentryUtils;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    logger = (await import('../../services/utils/logger.js')).default;
    sentryUtils = (await import('../../services/utils/sentry.js')).sentryUtils;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });
  });
});
```

**Conventions:**
- Vitest globals are imported explicitly at the top of every test file even though `globals: true` is set.
- Top-level `describe` per module, nested `describe` per function/method.
- `it('should ...', ...)` is the dominant form; `it('does X', ...)` also accepted.
- Setup pattern: `vi.clearAllMocks()` in `beforeEach`. Use `vi.useFakeTimers()` / `vi.useRealTimers()` when timing matters.
- Re-import mocked modules inside `beforeEach` after `vi.clearAllMocks()` to grab the current mock references.
- Assertion pattern: assert both return values and side effects (mock invocations with `toHaveBeenCalledWith(...)`).

## Mocking

**Framework:** Vitest's `vi` API (`vi.mock`, `vi.fn`, `vi.spyOn`, `vi.useFakeTimers`).

**Module-level mocking** at the top of test files:
```javascript
vi.mock('../../utils/sentry.js', () => ({
  sentryUtils: { captureException: vi.fn() },
}));

vi.mock('../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { DATABASE: 'DATABASE', ERROR: 'ERROR' },
}));
```

**Module mock with closure state** (from `src/shared/services/storage/__tests__/indexedDBService.test.js`):
```javascript
let globalMockDB;
vi.mock('idb', () => {
  const mockOpenDB = vi.fn().mockImplementation(() => {
    return Promise.resolve(globalMockDB || createMockDB());
  });
  return { openDB: mockOpenDB };
});
```

**Storage mocks** are global (created in `src/test/setup.js`); reset per-test via:
```javascript
localStorage.getItem.mockClear();
localStorage.setItem.mockClear();
sessionStorage.getItem.mockClear();
sessionStorage.setItem.mockClear();
```

**What to mock:**
- The structured logger (`src/shared/services/utils/logger.js`) — always mocked to silence and assert.
- The Sentry wrapper (`src/shared/services/utils/sentry.js`) — always mocked.
- External libs that touch the network or filesystem (e.g., `idb`, `react-hot-toast`).
- Service modules at the import boundary (e.g., `databaseService`, `attendanceDataService`).

**What NOT to mock:**
- `localStorage` / `sessionStorage` — pre-mocked globally in `src/test/setup.js`.
- `indexedDB` — provided by `fake-indexeddb/auto`.
- Pure utility functions under test.
- Helpers that are part of the same module being tested.

## Fixtures and Factories

**No formal factory pattern.** Test data is defined inline at the top of `describe` blocks:

```javascript
const mockMembers = [
  {
    member_id: 1,
    first_name: 'Alice',
    last_name: 'Smith',
    date_of_birth: '2015-10-01',
    section_id: 10,
    sectionname: 'Wednesday Beavers',
  },
  // ...
];
```

**Cypress fixtures:** JSON files in `cypress/fixtures/`:
- `cypress/fixtures/members.json`
- `cypress/fixtures/events.json`
- `cypress/fixtures/sections.json`
- `cypress/fixtures/attendance.json`

Loaded via `cy.intercept('GET', '**/api/...', { fixture: 'name.json' })` or via the `cy.mockApiSuccess(endpoint, fixture)` custom command (`cypress/support/commands.js`).

**IndexedDB fixtures:** Integration tests use real `fake-indexeddb` and clean up by id-range:
```javascript
afterEach(async () => {
  const coreMembers = await db.getAll('core_members');
  for (const member of coreMembers) {
    if (member.scoutid >= 90000) {  // Test IDs reserved >= 90000
      await db.delete('core_members', member.scoutid);
    }
  }
});
```

## Coverage

**Requirements:** None enforced (no `coverage` block in `vite.config.js` test config; no thresholds defined).

**View coverage:**
```bash
# No npm script defined; run vitest directly with coverage flag
npx vitest run --coverage
```

The `coverage/` directory is in `.gitignore` / `.prettierignore` if generated.

## Test Types

**Unit Tests:**
- Pure utilities and services with all dependencies mocked.
- Examples: `asyncUtils.test.js`, `scoutErrorHandler.test.js`, `termUtils.test.js`, `signInDataConstants.test.js`.
- Heavy use of `vi.mock` to isolate.

**Integration Tests (Vitest, but talk to real fake-indexeddb):**
- `src/shared/services/storage/__tests__/saveMembersDataMerge.test.js` — exercises `databaseService.saveMembers` and `IndexedDBService.getCoreMember` against `fake-indexeddb`.
- `src/shared/services/storage/__tests__/getMembersIntegration.test.js`.
- `src/shared/services/storage/__tests__/indexedDBStoreCreation.test.js`.

**Component Tests:**
- `@testing-library/react` is a dependency, but no `*.test.jsx` component tests exist yet. Component testing is set up but not utilized.
- Cypress component testing also configured (`cypress.config.js` `component` block) but with no specs.

**E2E Tests (Cypress):**
- `cypress/e2e/01-app-loading.cy.js` — initial load, login screen visibility, responsive viewport checks, slow-network resilience, page-load perf.
- `cypress/e2e/02-authentication.cy.js`.
- `cypress/e2e/03-responsive-layout.cy.js`.
- `cypress/e2e/04-offline-functionality.cy.js.skip` (disabled).
- `cypress/e2e/05-user-workflow.cy.js.skip` (disabled).

**E2E timeouts** (`cypress.config.js`): `defaultCommandTimeout: 8000`, `requestTimeout: 8000`, `responseTimeout: 8000`, `pageLoadTimeout: 15000`.

**Retries:** `runMode: 2`, `openMode: 0`.

## Cypress Custom Commands

Defined in `cypress/support/commands.js`:

| Command | Purpose |
|---------|---------|
| `cy.login({ skipUI, mockAuth })` | Mock OAuth by writing `access_token` + `user_info` to sessionStorage |
| `cy.logout()` | Click logout button and verify login screen |
| `cy.testMobile()` | Set viewport to 375×667 (iPhone SE) |
| `cy.testTablet()` | Set viewport to 768×1024 (iPad) |
| `cy.testDesktop()` | Set viewport to 1280×720 |
| `cy.shouldBeMobileLayout()` | Assert mobile layout markers visible |
| `cy.shouldBeDesktopLayout()` | Assert desktop layout markers visible |
| `cy.waitForApp()` | Wait for `[data-testid="app-ready"]` |
| `cy.goOffline()` / `cy.goOnline()` | Stub `navigator.onLine` and dispatch events |
| `cy.mockApiSuccess(endpoint, fixture)` | `cy.intercept` with fixture |
| `cy.mockApiError(endpoint, statusCode)` | `cy.intercept` returning error |
| `cy.mockOSMBlocked()` | Simulate 429 from OSM |
| `cy.measurePageLoad()` | Capture page-load metrics |

## Cypress E2E Setup (`cypress/support/e2e.js`)

- Auto-imports `commands.js` and initializes the `api-mocks.js` interception system in a global `before` hook and again in `beforeEach` (re-arms for each test).
- `beforeEach` resets browser state (`clearAllLocalStorage`, `clearAllSessionStorage`, `clearCookies`) and sets a default 1280×720 viewport.
- `Cypress.on('uncaught:exception', ...)` swallows expected errors: `NetworkError`, `fetch`, React dev warnings, and `BLOCKED`/`rate limit` strings (which represent intentional OSM API blocking).

## Cypress API Mocking System (`cypress/support/api-mocks.js`)

- **Default:** All E2E tests block real API calls. Toggle with `Cypress.env('ENABLE_API_MOCKING')`.
- Intercepts auth endpoints, OSM proxy endpoints, and a catch-all `**/api/**`.
- Direct OSM domain (`onlinescoutmanager.co.uk`) is also intercepted as a safety net.
- Any other external `https://**` request that is not localhost is blocked and a warning is logged.
- See `cypress/README-API-MOCKING.md` for documentation.

## Common Patterns

**Async testing with fake timers** (`asyncUtils.test.js`):
```javascript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('should resolve after specified milliseconds', async () => {
  const promise = sleep(1000);
  vi.advanceTimersByTime(1000);
  await expect(promise).resolves.toBeUndefined();
});
```

**Error testing** (`asyncUtils.test.js`, `scoutErrorHandler.test.js`):
```javascript
it('should throw error for negative milliseconds', () => {
  expect(() => sleep(-100)).toThrow('Invalid sleep duration: -100. Must be a positive finite number.');

  expect(logger.error).toHaveBeenCalledWith(
    'Invalid sleep duration',
    { providedValue: -100, providedType: 'number', isFinite: true },
    'ERROR',
  );

  expect(sentryUtils.captureException).toHaveBeenCalledWith(
    expect.any(Error),
    {
      tags: { operation: 'async_utils_sleep', validation_error: true },
      contexts: { input: { value: -100, type: 'number', isFinite: true } },
    },
  );
});
```

**Mock module dynamic re-import** (capture mocks from a `vi.mock` factory after `vi.clearAllMocks()`):
```javascript
beforeEach(async () => {
  vi.clearAllMocks();
  logger = (await import('../../services/utils/logger.js')).default;
  sentryUtils = (await import('../../services/utils/sentry.js')).sentryUtils;
});
```

**Cypress data-testid selection** (`cypress/e2e/01-app-loading.cy.js`):
```javascript
cy.get('[data-testid="login-screen"]').should('be.visible');
cy.get('[data-testid="login-button"]').should('be.visible');
```
Components in `src/` should expose `data-testid` attributes for any element that E2E tests interact with.

**Slow-network resilience pattern:**
```javascript
cy.intercept('GET', '**/*.{js,css,png,jpg,svg}', { delay: 1000 }).as('slowAssets');
cy.get('body', { timeout: 15000 }).should('be.visible');
```

## Pre-commit Test Requirements

Per `CLAUDE.md` (frontend), before committing:
```bash
npm run lint            # Must pass
npm run test:run        # Must pass
npm run build           # Must pass
```

`npm run test:e2e:cloud` is run in CI (`test:ci` script).

---

*Testing analysis: 2026-04-26*
