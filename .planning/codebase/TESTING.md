# Testing Patterns

**Analysis Date:** 2026-02-15

## Test Framework

**Runner:**
- **Vitest** v3.2.4 - Modern test runner (configured in `vite.config.js`)
- **Environment:** jsdom - Browser-like DOM environment for testing React components
- **Setup file:** `src/test/setup.js` - Initializes global mocks (localStorage, sessionStorage, window.location)

**Assertion Library:**
- **Vitest built-in expect** - Use `expect()` for all assertions
- **Testing Library** - `@testing-library/react` v16.3.0 for component testing
- **Jest DOM matchers** - `@testing-library/jest-dom` v6.6.3 for DOM assertions

**Run Commands:**
```bash
npm run test:run        # Run all tests once (CI mode)
npm run test            # Watch mode (development)
npm run test:ui         # Browser UI for test exploration
npm run test:e2e        # End-to-end tests with Cypress (starts dev server)
```

## Test File Organization

**Location:**
- Co-located with source in `__tests__` subdirectories
- Pattern: `src/shared/utils/__tests__/asyncUtils.test.js` → tests `src/shared/utils/asyncUtils.js`
- E2E/integration tests: `cypress/e2e/**/*.cy.js`

**Naming:**
- Unit tests: `[moduleName].test.js`
- Cypress tests: `[feature].cy.js`
- Example: `storageUtils.test.js`, `indexedDBService.test.js`

**Structure:**
```
src/
├── shared/
│   ├── utils/
│   │   ├── asyncUtils.js
│   │   └── __tests__/
│   │       └── asyncUtils.test.js
│   └── services/
│       ├── storage/
│       │   ├── indexedDBService.js
│       │   └── __tests__/
│       │       └── indexedDBService.test.js
└── features/
    └── movements/
        └── services/
            ├── movementCalculator.js
            └── __tests__/
                └── movementCalculator.test.js
```

## Test Structure

**Suite Organization:**
```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { functionToTest } from '../functionToTest.js';

// Mock external dependencies
vi.mock('../../services/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LOG_CATEGORIES: {
    APP: 'APP',
    API: 'API',
    ERROR: 'ERROR',
  },
}));

describe('Function Name', () => {
  let logger;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked modules after clearing
    logger = (await import('../../services/utils/logger.js')).default;
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('Specific behavior', () => {
    it('should do something specific', () => {
      const result = functionToTest('input');
      expect(result).toBe('expected output');
    });

    it('should handle edge cases', () => {
      expect(() => functionToTest(null)).toThrow('Expected error message');
    });
  });
});
```

**Patterns:**
- **Setup pattern:** Use `beforeEach` to reset mocks and import fresh module references
- **Teardown pattern:** Use `afterEach` for timer cleanup (e.g., `vi.useRealTimers()`)
- **Async testing:** Mark test as `async`, use `await import()` for fresh module imports
- **Assertion pattern:** Arrange-Act-Assert - Set up data, execute function, verify results

## Mocking

**Framework:** Vitest's `vi` module provides mocking utilities

**Patterns:**

### Module Mocking
```javascript
vi.mock('../../services/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LOG_CATEGORIES: {
    APP: 'APP',
    API: 'API',
    ERROR: 'ERROR',
  },
}));
```

### Spy and Implementation Mocking
```javascript
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.getItem.mockReturnValue(JSON.stringify({ key: 'value' }));
  localStorage.setItem.mockImplementation(() => {});
});
```

### Timer Mocking
```javascript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should resolve after specified time', async () => {
  const promise = sleep(1000);
  vi.advanceTimersByTime(1000);
  await expect(promise).resolves.toBeUndefined();
});
```

**What to Mock:**
- **Always mock:** External services (logger, sentry, storage, API clients)
- **Always mock:** Global objects with side effects (window.location, localStorage, sessionStorage)
- **Mock timers:** For functions using `setTimeout` or `setInterval`
- **Mock network calls:** Use Cypress for E2E network testing

**What NOT to Mock:**
- **Core utilities:** Pure functions (calculations, formatting, parsing)
- **React:** Don't mock React library itself
- **Test utilities:** Don't mock testing library functions
- **Your code:** Don't mock the module under test

## Fixtures and Factories

**Test Data:**

### Simple Fixtures
```javascript
const testData = {
  member: {
    scoutid: 123,
    firstname: 'John',
    lastname: 'Doe',
    date_of_birth: '2010-06-15',
  },
  section: {
    sectionid: 456,
    section: 'Scouts',
    sectionname: 'Scouts Monday',
  },
};
```

### Factory Functions (Realistic Approach)
```javascript
const createMockMember = (overrides = {}) => ({
  scoutid: 123,
  firstname: 'John',
  lastname: 'Doe',
  date_of_birth: '2010-06-15',
  patrol: 'Patrol A',
  section: 'Scouts',
  ...overrides,
});

it('should handle member with custom data', () => {
  const member = createMockMember({ firstname: 'Jane' });
  expect(member.firstname).toBe('Jane');
});
```

### Database Fixtures
```javascript
const createMockDB = () => {
  const stores = new Map();
  return {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore: (name, options) => {
      const store = {
        name,
        options,
        indexes: new Map(),
        createIndex: vi.fn((indexName, keyPath, options) => {
          store.indexes.set(indexName, { keyPath, options });
        }),
      };
      stores.set(name, store);
      return store;
    },
  };
};
```

**Location:**
- Fixtures in `__tests__/fixtures/` subdirectory if shared across multiple test files
- Inline test data in test file if only used once
- Use factory functions for complex or parameterized data

## Coverage

**Requirements:**
- No automatic coverage enforcement (not configured in Vitest)
- Aim for high coverage of critical paths (auth, storage, calculations)
- Focus on integration and behavior testing over line coverage

**View Coverage:**
```bash
npm run test:run -- --coverage
```

## Test Types

**Unit Tests:**
- **Scope:** Individual functions and utilities
- **Approach:** Test function in isolation with mocked dependencies
- **Examples:** `asyncUtils.test.js`, `storageUtils.test.js`, `ageCalculations.test.js`
- **Pattern:** Test single function behavior with various inputs and edge cases
- **Location:** `src/**/__tests__/` directories

**Integration Tests:**
- **Scope:** Multiple components/services working together
- **Approach:** Test API → database → UI flow or complex state transitions
- **Examples:** `getMembersIntegration.test.js`, `memberCRUDMethods.test.js`
- **Pattern:** Test realistic user workflows combining multiple modules
- **Location:** `src/**/__tests__/` directories with "integration" in name

**E2E Tests:**
- **Framework:** Cypress v14.5.0
- **Approach:** Test full user workflows in browser environment
- **Configuration:** `cypress.config.js`
- **Base URL:** `http://localhost:3001`
- **Pattern:** Navigate, interact, verify visible results
- **Location:** `cypress/e2e/**/*.cy.js`
- **Run command:** `npm run test:e2e` (starts dev server and runs tests)

## Common Patterns

**Async Testing:**
```javascript
it('should resolve after specified milliseconds', async () => {
  const promise = sleep(1000);

  vi.advanceTimersByTime(1000);

  await expect(promise).resolves.toBeUndefined();
});

it('should handle async errors', async () => {
  await expect(failingAsyncFunction()).rejects.toThrow('Expected error');
});
```

**Error Testing:**
```javascript
it('should throw error for invalid input', () => {
  expect(() => sleep(-100)).toThrow('Invalid sleep duration: -100. Must be a positive finite number.');

  expect(logger.error).toHaveBeenCalledWith(
    'Invalid sleep duration',
    {
      providedValue: -100,
      providedType: 'number',
      isFinite: true,
    },
    'ERROR',
  );

  expect(sentryUtils.captureException).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      tags: { operation: 'async_utils_sleep', validation_error: true },
    }),
  );
});
```

**Storage Testing:**
```javascript
it('should return parsed JSON data when item exists', () => {
  const testData = { theme: 'dark' };
  localStorage.getItem.mockReturnValue(JSON.stringify(testData));

  const result = safeGetItem('preferences');

  expect(result).toEqual(testData);
  expect(localStorage.getItem).toHaveBeenCalledWith('preferences');
});

it('should handle JSON parsing failure gracefully', () => {
  localStorage.getItem.mockReturnValue('invalid json {');
  const defaultValue = { theme: 'light' };

  const result = safeGetItem('preferences', defaultValue);

  expect(result).toEqual(defaultValue);
  expect(logger.warn).toHaveBeenCalledWith(
    'Storage retrieval failed',
    expect.objectContaining({
      operation: 'localStorage.getItem',
      key: 'preferences',
      error: expect.any(String),
    }),
    'ERROR',
  );
});
```

**Mock Assertion Pattern:**
```javascript
// Verify mock was called with specific arguments
expect(logger.error).toHaveBeenCalledWith(
  'Operation message',
  expect.objectContaining({
    operation: 'specific_operation',
    value: expect.any(String),
  }),
  'ERROR',
);

// Verify mock was called right number of times
expect(localStorage.setItem).toHaveBeenCalledTimes(1);

// Verify mock was called with any/specific arguments
expect(sentryUtils.captureException).toHaveBeenCalledWith(
  expect.any(Error),
  {
    tags: { operation: 'operation_name' },
  },
);
```

## Component Testing

**Testing Library approach:**
```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import ComponentName from '../ComponentName.jsx';

describe('ComponentName', () => {
  it('should render with initial props', () => {
    render(<ComponentName title="Test" />);

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    render(<ComponentName onSubmit={vi.fn()} />);

    const button = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(button);

    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });
});
```

## Test Best Practices

**DO:**
- Write tests that verify behavior, not implementation
- Test error cases and edge conditions
- Keep tests focused and independent
- Use descriptive test names explaining what is being tested
- Mock external dependencies consistently
- Clean up state/mocks in `afterEach` hooks
- Test async functions with `async`/`await`
- Verify error logging includes context

**DON'T:**
- Test implementation details (private functions, internal state)
- Make tests dependent on other tests
- Use arbitrary delays instead of fake timers
- Test library code (React, testing-library)
- Create highly coupled test data
- Test multiple concerns in one test
- Ignore error cases

## Cypress E2E Testing

**Configuration:** `cypress.config.js`

**Test file pattern:** `cypress/e2e/**/*.cy.js`

**Base URL:** Configured to `http://localhost:3001`

**Environment variables:**
- `ENABLE_API_MOCKING: true` - Mock API calls by default (can be disabled for real API testing)
- `CI: false` - Set to true in CI/CD pipeline

**Timeouts:**
- `defaultCommandTimeout: 8000` - 8 seconds for commands
- `requestTimeout: 8000` - Network request timeout
- `pageLoadTimeout: 15000` - Page load timeout
- `taskTimeout: 10000` - Custom task timeout

**Custom tasks available:**
- `cy.task('log', message)` - Log to console
- `cy.task('setOffline')` - Simulate offline conditions
- `cy.task('setOnline')` - Simulate online conditions

**Running tests:**
```bash
npm run test:e2e           # Run with dev server
npm run test:e2e:open     # Open interactive browser
npm run test:e2e:cloud    # Run in Cypress Cloud
npm run cypress:run       # Run without starting server
```

