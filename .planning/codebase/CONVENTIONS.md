# Coding Conventions

**Analysis Date:** 2026-02-15

## Naming Patterns

**Files:**
- **React components:** PascalCase (e.g., `SectionsList.jsx`, `MemberDetailModal.jsx`)
- **Utilities and services:** camelCase (e.g., `asyncUtils.js`, `storageUtils.js`, `logger.js`)
- **Hooks:** camelCase prefixed with `use` (e.g., `useAuth.jsx`)
- **Tests:** `[name].test.js` format co-located with source in `__tests__` directories
- **Index files:** Use barrel exports from `index.js` in component directories

**Functions:**
- **camelCase** for all function declarations and arrow functions
- **Descriptive names** indicating action/purpose (e.g., `getScoutFriendlyMessage`, `handleMemberClick`, `createErrorHandler`)
- **Handler functions:** Prefix with `handle` or `on` for event handlers (e.g., `handleMemberClick`, `onSectionToggle`)
- **Utility functions:** Prefix with verb describing action (e.g., `calculate`, `format`, `parse`, `group`, `create`)

**Variables:**
- **camelCase** for all variable declarations
- **Constants:** UPPER_SNAKE_CASE only for module-level constants (e.g., `SCOUT_ERROR_MESSAGES`, `LOG_CATEGORIES`)
- **Boolean variables:** Prefix with `is`, `has`, `can`, `should` (e.g., `isSelected`, `hasDefaultValue`, `canAccess`)
- **State variables:** Use descriptive names with optional `state` suffix (e.g., `loading`, `selectedMember`, `showMemberModal`)

**Types/Interfaces:**
- **React component props:** Defined as object parameter with destructuring above component function
- **Type comments:** Use JSDoc style (not TypeScript interfaces)
- **API response types:** Document with JSDoc in utility files or service files

## Code Style

**Formatting:**
- **Tool:** Prettier with config in `.prettierrc.json`
- **Print width:** 80 characters
- **Tab width:** 2 spaces
- **Quotes:** Single quotes for strings
- **Trailing commas:** Always (es5 mode)
- **Semicolons:** Always required
- **Arrow parens:** Always required (e.g., `(x) => x + 1`, not `x => x + 1`)

**Linting:**
- **Tool:** ESLint with flat config in `eslint.config.js`
- **Key rules:**
  - `eqeqeq: 'error'` - Enforce strict equality (`===`)
  - `no-var: 'error'` - Require `const`/`let` over `var`
  - `prefer-const: 'error'` - Use `const` by default
  - `indent: ['error', 2]` - Enforce 2-space indentation
  - `no-unused-vars` - Flag unused variables, allow underscore prefix to ignore intentionally unused
  - `comma-dangle: ['error', 'always-multiline']` - Trailing commas in multiline structures
  - JSDoc rules are mostly warnings except for syntax and param name validation

## Import Organization

**Order:**
1. **External libraries** (React, third-party packages) - `import React, { useState } from 'react'`
2. **Internal services** (API, database, auth) - `import { getToken } from '../../../shared/services/auth/tokenService.js'`
3. **UI components** (shared components, icons) - `import { MemberDetailModal } from '../../../shared/components/ui'`
4. **Utilities** (formatting, calculations, helpers) - `import { calculateAge } from '../../../shared/utils/ageUtils.js'`
5. **Styles/assets** (CSS, images)

**Path Aliases:**
- Use relative paths exclusively (no `@/` aliases in actual code, though aliases are configured in jsconfig.json)
- Pattern: `import { foo } from '../../../shared/services/something.js'`
- Navigate up (`../`) to appropriate level, then into shared/features directories

**Import statement format:**
- Use ES modules: `import { named } from 'module'`
- Default exports at component level: `export default ComponentName`
- Named exports for utilities and services: `export const functionName = ...`
- No mixed default and named exports in utility files

## Error Handling

**Patterns:**
- **Try-catch blocks:** Use in async functions, wrap with meaningful context
- **Error conversion:** Use `getScoutFriendlyMessage()` to convert technical errors to user-friendly messages
- **Error logging:** Always log errors with `logger.error()` including context
- **Sentry reporting:** Use `sentryUtils.captureException()` for unexpected errors with tags and context
- **User notification:** Show converted Scout-friendly messages via `notifyError()` utility
- **Error boundary:** Errors propagate naturally, handled at component level with try-catch

**Error handling example:**
```javascript
try {
  const data = await loadMembers(sections);
  setMembers(data);
} catch (error) {
  console.error('Failed to load members:', error);
  const message = getScoutFriendlyMessage(error, 'loading members');
  notifyError(message);
}
```

**Validation errors:**
- Throw custom Error objects with descriptive messages
- Include context in logging (type, value, expected format)
- Report to Sentry with tags and context objects for debugging

## Logging

**Framework:** `logger` utility from `src/shared/services/utils/logger.js`

**Patterns:**
- **logger.debug()** - Verbose diagnostic info (development)
- **logger.info()** - General informational messages
- **logger.warn()** - Warning conditions (recoverable errors)
- **logger.error()** - Error conditions (failed operations)
- **Always include category:** `LOG_CATEGORIES.APP`, `LOG_CATEGORIES.API`, `LOG_CATEGORIES.ERROR`

**Logging format:**
```javascript
logger.error('Converting error to Scout-friendly message', {
  originalError: errorMessage,
  context,
  errorDetails,
}, LOG_CATEGORIES.ERROR);
```

**What to log:**
- All async operation start/completion
- Data parsing errors with original value and parsed value
- Storage operations (get/set) with success/failure
- API calls with parameters and responses
- Validation failures with detailed context

**What NOT to log:**
- Sensitive data (auth tokens, passwords, personal info)
- Repeated debug messages in loops
- Inline comments instead of structured logging

## Comments

**When to Comment:**
- Do NOT use inline comments - use JSDoc instead
- Document exported functions and components with JSDoc blocks
- Document complex algorithms or non-obvious logic with JSDoc `@example` tags
- Document context for Scout-specific requirements

**JSDoc/TSDoc:**
- **Required for:** All exported functions, all React components, all hooks, all service methods
- **Format:** Multi-line JSDoc blocks with `/** ... */`
- **Tags used:**
  - `@param` - Parameter documentation with type and description
  - `@returns` - Return value documentation
  - `@throws` - Exceptions thrown
  - `@example` - Usage examples with real code
  - `@file` - File overview for complex modules
  - `@module` - Module/service identification
  - `@version` - Semantic version for utilities
  - `@since` - When feature was added/changed
  - Custom tags: `@component`, `@hook`, `@context`, `@service`, `@util`, `@constant`

**JSDoc example:**
```javascript
/**
 * Converts technical errors to Scout-friendly messages
 *
 * @param {Error|string|Object} error - The error to convert
 * @param {string} [context=''] - Optional context about what was being done
 * @returns {string} Scout-friendly error message
 * @throws {Error} Re-throws validation errors with context
 *
 * @example
 * // Basic error conversion
 * const message = getScoutFriendlyMessage(error, 'loading member data');
 * // Returns: "Unable to load member data. Check your internet..."
 */
export function getScoutFriendlyMessage(error, context = '') {
  // Implementation
}
```

## Function Design

**Size:**
- Keep functions focused on single responsibility
- Aim for under 50 lines for most functions
- Break complex logic into smaller helper functions
- Large component render functions (100+ lines) should extract sub-components

**Parameters:**
- Use object destructuring for 2+ related parameters
- Provide default values for optional parameters
- Document all parameters in JSDoc `@param` tags

**Return Values:**
- Return promises for async operations (no callback-style)
- Return consistent types (e.g., null or default value, not undefined)
- Document return type in JSDoc `@returns` tag

**Arrow functions:** Use for callbacks, event handlers, and utility functions
**Named functions:** Use for exported APIs, component definitions, and complex operations

## Module Design

**Exports:**
- **React components:** Always use `export default ComponentName` at end of file
- **Utilities:** Use named exports `export const functionName = ...`
- **Services:** Use named exports with default object export for backwards compatibility
- **Hooks:** Use named exports `export const useHookName = ...`

**Barrel Files:**
- Create `index.js` in directories exporting commonly used items
- Example: `src/shared/components/ui/index.js` exports `MemberDetailModal`, `MedicalDataPill`
- Simplifies imports: `import { MemberDetailModal } from '../../../shared/components/ui'`

**File organization:**
- One component/hook per file
- Co-locate tests in `__tests__` subdirectory
- Group related utilities in same directory with descriptive names
- Group services by domain (API, auth, storage, utils)

**Service organization:**
- Services handle external communication (API, storage, auth)
- Utils handle pure transformations (formatting, calculations)
- Hooks handle React state and lifecycle
- Components handle rendering and interaction

## React Patterns

**Components:**
- **Functional components only** - No class components
- **Hooks only** - Use `useState`, `useEffect`, `useContext`, etc.
- **Props destructuring:** Define props interface above component, then destructure in function parameters
- **Component structure:** Props definition → component function → event handlers → render → export default

**Hooks:**
- Extract complex logic into custom hooks
- Custom hooks file pattern: `useHookName.jsx` in features or shared/hooks
- Always document hook dependencies in `useEffect` dependency arrays
- Use `React.useMemo` for expensive computations over lists

**State management:**
- Use `useState` for component-local state
- Use context for global state (auth, database, app settings)
- Don't over-use context for frequently changing values

