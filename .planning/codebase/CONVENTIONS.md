# Coding Conventions

**Analysis Date:** 2026-04-26

## Language & Module System

- **Language:** JavaScript (ES2022) with JSX. Project uses `jsconfig.json` (no TypeScript), but with `@types/react` and `@types/react-dom` available for IDE typing. JSDoc-style typing is the convention.
- **Module system:** Native ES modules (`"type": "module"` in `package.json`). Use `import`/`export`, never `require`.
- **File extensions:** `.js` for utilities/services/hooks, `.jsx` for any file containing React JSX. Imports must include the file extension (e.g., `import logger from '../services/utils/logger.js'`).
- **Source language:** `ecmaVersion: 2022`, `sourceType: 'module'` per `eslint.config.js`.

## Naming Patterns

**Files:**
- React components: `PascalCase.jsx` - `EventDashboard.jsx`, `MemberDetailModal.jsx`, `LoadingScreen.jsx`
- Hooks: `camelCase.js` prefixed `use` - `useAttendanceData.js`, `useSharedAttendance.js`
- Services: `camelCase.js` - `tokenService.js`, `flexiRecordService.js`, `indexedDBService.js`
- Utilities: `camelCase.js` - `asyncUtils.js`, `scoutErrorHandler.js`, `dateFormatting.js`
- Test files: `<name>.test.js` co-located in `__tests__/` directories
- Constants modules: `camelCase` ending in `Constants.js` - `signInDataConstants.js`
- Barrel files: `index.js`

**Directories:**
- `kebab-case` allowed for multi-word feature dirs (e.g., `young-leaders/`)
- All other directories use `lowercase` single words (e.g., `components/`, `services/`, `utils/`, `hooks/`, `__tests__/`)
- Test directories named `__tests__/` (Jest-style convention) co-located with source

**Functions:**
- `camelCase` for all functions: `getScoutFriendlyMessage`, `safeGetItem`, `calculateSectionMovements`
- React components: `PascalCase`: `function EventDashboard(...)`, `const Modal = (...)`
- Custom hooks: prefixed `use` (`useAttendanceData`, `useAuth`)

**Variables:**
- `camelCase` for variables and parameters
- `UPPER_SNAKE_CASE` for module-level constants and enum-like objects: `LOG_LEVELS`, `LOG_CATEGORIES`, `SCOUT_ERROR_MESSAGES`, `SCOUT_COLORS`, `CLEAR_STRING_SENTINEL`
- Underscore prefix `_` allowed only for intentionally unused vars/args (matches ESLint `varsIgnorePattern: '^_'`)

**Types/Classes:**
- `PascalCase` for classes: `IndexedDBService`, `ErrorBoundary`
- `PascalCase` for component prop types/interfaces (documented via JSDoc, not TypeScript)

## Code Style

**Formatting (`.prettierrc.json`):**
- Single quotes (`singleQuote: true`)
- Semicolons required (`semi: true`)
- Trailing commas: `es5` (Prettier) / `always-multiline` (ESLint)
- 2-space indentation, no tabs
- Print width: 80 columns
- Bracket spacing: `true`
- JSX bracket on new line (`bracketSameLine: false`)
- Arrow parens: `always` - `(x) => x`
- LF line endings

**Linting (`eslint.config.js`):**
- `no-unused-vars`: error (with `^_` escape pattern)
- `eqeqeq`: error (always use `===`)
- `no-var`: error (use `let`/`const`)
- `prefer-const`: error
- `no-undef`: error
- `react-hooks/exhaustive-deps`: warn
- `react/prop-types`: off (JSDoc-style props instead)
- `react/react-in-jsx-scope`: off (React 17+ JSX transform)
- `import/no-cycle`: error (max depth 10)
- `import/no-self-import`: error
- `import/no-restricted-paths`: warn — enforces feature isolation (see Module Boundaries below)

**Run commands:**
```bash
npm run lint            # Check
npm run lint:fix        # Auto-fix
npm run format          # Prettier write
npm run format:check    # Prettier check
```

## Import Organization

**Style (observed):**
- React import first when needed: `import React from 'react'` (or `import React, { useState, useEffect, useRef } from 'react'`)
- Then third-party packages (`react-hot-toast`, `clsx`, `@sentry/react`, `framer-motion`, `idb`)
- Then internal absolute paths to shared infra (`../../shared/services/...`)
- Then relative imports for sibling/local files

**Example from `src/features/events/components/EventDashboard.jsx`:**
```javascript
import React, { useState, useEffect, useRef } from 'react';
import { getToken, generateOAuthUrl } from '../../../shared/services/auth/tokenService.js';
import { authHandler } from '../../../shared/services/auth/authHandler.js';
import { useAuth } from '../../auth/hooks/index.js';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import EventCard from './EventCard.jsx';
```

**Path Aliases:**
- Configured in `jsconfig.json` (baseUrl `./src`):
  - `@/*` → `src/*`
  - `@/components/*` → `src/components/*`
  - `@/services/*` → `src/services/*`
  - `@/utils/*` → `src/utils/*`
  - `@/hooks/*` → `src/hooks/*`
  - `@/contexts/*` → `src/contexts/*`
  - `@/assets/*` → `src/assets/*`
- Aliases are configured but most code uses **relative imports** with explicit `.js`/`.jsx` extensions (the de-facto convention in this codebase).

**Barrel files:**
- Each feature and shared layer exposes `index.js` re-exports
- Examples: `src/shared/index.js`, `src/features/events/index.js`, `src/shared/components/index.js`
- Top-level barrels typically `export * from` sub-barrels

## Module Boundaries (enforced via ESLint)

Defined in `eslint.config.js` under `import/no-restricted-paths` (currently `warn`):

- **Features cannot import from other features directly.** Cross-feature comms must go through `src/shared/` or explicit interfaces.
- Restricted feature dirs: `auth`, `events`, `sections`, `movements`, `admin`.
- **Shared resources cannot import from features** (prevents circular deps).
- **Global contexts (`src/contexts/**/*`) cannot import from features.**

## React Component Patterns

- **Functional components only.** No class components except `ErrorBoundary` (`src/shared/components/ErrorBoundary.jsx`) which must be a class to use `getDerivedStateFromError` / `componentDidCatch`.
- **Component declaration:** Use either `function Name(props) { ... }` or `const Name = (props) => { ... }`. Both are present; functional declarations dominate top-level components, arrow functions appear for highly-decorated UI primitives (e.g., `Modal.jsx`).
- **Default export at the bottom** of component files: `export default ComponentName;`
- **Props destructured** in the function signature with defaults: `function LoadingScreen({ message = 'Loading...' }) { ... }`
- **State hooks** declared at the top of the component body, grouped logically.
- **Effects** declared after state, with explicit dependency arrays.
- **No PropTypes.** Document props via JSDoc `@param {Object} props.foo - description` blocks.
- **Strict Mode** enabled at the root in `src/main.jsx`.

## JSDoc Documentation

JSDoc is the project's typing system. Per `CLAUDE.md`: "Add JSDoc to all functions and components with reasonable coverage."

**Required:**
- Exported React components must have JSDoc (enforced by `jsdoc/require-jsdoc` for `ExportNamedDeclaration > FunctionDeclaration[id.name=/^[A-Z]/]` and `ExportDefaultDeclaration > FunctionDeclaration[id.name=/^[A-Z]/]`).
- Public utility functions and services should have JSDoc with `@param`, `@returns`, and at least one `@example`.

**Custom tags allowed:** `@component`, `@hook`, `@context`, `@service`, `@util`, `@constant`.

**File-level overview** documented with `@file`, `@module`, `@version`, `@since`, `@author` (e.g., `src/shared/utils/scoutErrorHandler.js`, `src/shared/services/utils/logger.js`).

**Example component JSDoc** (`src/shared/components/ui/MemberDetailModal.jsx`):
```javascript
/**
 * Member Detail Modal Component
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.member - Member data object
 * @param {boolean} props.isOpen - Whether the modal is currently open
 * @param {Function} props.onClose - Callback function to close the modal
 * @returns {JSX.Element|null} Modal dialog with member details or null if closed
 *
 * @example
 * <MemberDetailModal member={selectedMember} isOpen={showModal} onClose={() => setShowModal(false)} />
 */
function MemberDetailModal({ member, isOpen, onClose }) { ... }
```

## Comments

- **Inline comments are discouraged.** Per `CLAUDE.md`: "DO NOT ADD INLINE COMMENTS unless explicitly requested (JSDoc documentation is required, inline comments are not)."
- Existing inline comments tend to be short context notes (e.g., `// Reset storage mocks`, `// Mock window.location`) and `eslint-disable-line` markers.
- Use JSDoc blocks above functions/components instead.

## Error Handling

**Pattern:** Try/catch with structured logging + Sentry capture + safe fallback.

**Logger usage** (from `src/shared/services/utils/logger.js`):
```javascript
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
logger.error('Storage write failed', { operation: 'localStorage.setItem', key, error: error.message }, LOG_CATEGORIES.ERROR);
logger.warn(message, contextObject, LOG_CATEGORIES.OFFLINE);
logger.info(message, contextObject, LOG_CATEGORIES.SYNC);
```

Log signature: `logger.<level>(message: string, data: object, category: LOG_CATEGORIES)`

**Sentry capture** alongside logger for errors:
```javascript
import { sentryUtils } from '../services/utils/sentry.js';
sentryUtils.captureException(error, {
  tags: { operation: 'storage_set', storage_type: 'localStorage' },
  contexts: { storage: { key, valueType: typeof value } },
});
```

**Safe-wrapper pattern** (e.g., `src/shared/utils/storageUtils.js`):
- Catch all errors at the boundary
- Log with structured context
- Capture to Sentry with tags and contexts
- Return a safe fallback (`defaultValue`, `false`, `null`)

**User-facing error conversion** (`src/shared/utils/scoutErrorHandler.js`):
- All errors shown to users go through `getScoutFriendlyMessage()` or `handleScoutError()`
- Pre-built handlers for common ops in `commonErrorHandlers`: `sync`, `load`, `save`, `upload`, `login`, `refresh`, `search`, `export`
- React error boundaries (`src/shared/components/ErrorBoundary.jsx`) call `getScoutFriendlyMessage(error, 'loading the application')` and render `ErrorState`

**Error notification** via `notifyError`/`notifyWarning` (in `src/shared/utils/notifications.js`, backed by `react-hot-toast`).

**Custom error classes:** Per shared standards, "throw custom error classes with descriptive messages". Plain `Error` with rich messages currently dominates; include validation context in the message string (see `asyncUtils.js`).

## Logging

**Framework:** Custom centralized logger at `src/shared/services/utils/logger.js`.

**Log levels:** `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL` (via `LOG_LEVELS`).

**Log categories:** `APP`, `API`, `AUTH`, `NAVIGATION`, `USER_ACTION`, `PERFORMANCE`, `OFFLINE`, `SYNC`, `COMPONENT`, `HOOK`, `ERROR` (via `LOG_CATEGORIES`).

**When to log:**
- All caught exceptions: `logger.error(message, contextData, LOG_CATEGORIES.ERROR)` plus `sentryUtils.captureException(error, ...)`
- Validation failures (e.g., `asyncUtils.js` `sleep` rejecting negative ms)
- Network/sync state transitions: `LOG_CATEGORIES.SYNC` / `OFFLINE`
- User actions worth tracking: `LOG_CATEGORIES.USER_ACTION`
- Avoid `console.log` in production code; use the logger instead. The logger handles dev-vs-prod console output.

## Function Design

**Size:** No enforced max, but utility files prefer many small focused functions (`storageUtils.js` exports `safeGetItem`, `safeSetItem`, `safeGetSessionItem`, `safeSetSessionItem`).

**Parameters:**
- Prefer destructured object args for 3+ parameters or for options bags (e.g., `handleScoutError(error, context, { showNotification, isWarning })`).
- Default values inline in destructuring: `function safeGetItem(key, defaultValue = null) { ... }`.

**Return values:**
- Safe utilities return a sentinel/default on failure rather than throwing (caller can branch on falsy).
- Async functions return Promises explicitly typed in JSDoc as `Promise<T>`.
- Boolean operations return explicit `true`/`false`.

## Module Design

**Exports:**
- Named exports preferred for utilities, services, hooks, and constants.
- Default exports for React components and the singleton `logger`.
- Mixed exports common (e.g., `logger.js` has `export default logger` + named `LOG_LEVELS`, `LOG_CATEGORIES`).

**Barrel files (`index.js`):**
- Used at every layer (`src/shared`, `src/features`, `src/features/events`, `src/shared/components`, etc.).
- Top-level barrels typically `export * from './sub'`.
- Allows `import { useAuth } from '../../auth/hooks/index.js'` style.

## Styling

- **Tailwind CSS v4** is the styling system (`tailwind.config.js`, `@tailwindcss/postcss`).
- Class composition via `cn()` helper (`src/shared/utils/cn.js`) which wraps `clsx`.
- Custom Scout theme tokens used throughout: `scout-blue`, `scout-green`, `scout-red`, `scout-orange`, plus `*-dark` variants (see `Alert.jsx`).
- Component-level Tailwind classes; no CSS modules, no styled-components.
- Hex theme colors duplicated in `src/shared/utils/notifications.js` `SCOUT_COLORS` for non-Tailwind contexts (toast styles).

## Test Authoring Conventions

(See `TESTING.md` for full details.)

- Use `vi.mock(...)` at top of file to stub all external deps (logger, sentry, services).
- Use `vi.clearAllMocks()` in `beforeEach`; restore via `afterEach` if `vi.useFakeTimers` was used.
- Group with `describe` (one per module/function), individual cases with `it('should ...', ...)` or `it('does X', ...)`.
- Always assert call arguments with `expect(mockFn).toHaveBeenCalledWith(...)` for side-effecting code.

---

*Convention analysis: 2026-04-26*
