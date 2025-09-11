# JSDoc Documentation Standards

**Vikings Event Management - JSDoc Style Guide**

Version: 1.0  
Created: 2025-09-10  
For: Task 35 - Comprehensive JSDoc Documentation Coverage

## Overview

This document establishes JSDoc documentation standards for the Vikings Event Management codebase, specifically adapted for our post-simplification architecture with Tailwind-first components and react-hot-toast notifications.

## Core Principles

### 1. **Developer-First Documentation**
- Documentation should help developers understand **how** and **why** to use functions
- Include practical examples that work in our Scout-themed application
- Document offline-first patterns and Scout color usage

### 2. **Consistency with Simplified Architecture**
- Reflect the new Tailwind-first approach (no Card/Badge abstractions)
- Document react-hot-toast integration patterns
- Include Scout theme color constants where relevant

### 3. **Required Documentation**
- **All exported functions and components** must have JSDoc comments
- **Public API methods** require comprehensive documentation
- **Complex algorithms** need explanation and examples
- **Error conditions** must be documented with @throws

## Documentation Templates

### 1. Utility Functions

```javascript
/**
 * Brief description of what the function does and its purpose
 * 
 * @param {Type} paramName - Description of parameter and its expected format
 * @param {Type} [optionalParam] - Description of optional parameter with default behavior
 * @returns {Type} Description of return value and its structure
 * @throws {Error} Description of when this error is thrown
 * 
 * @example
 * // Basic usage example
 * const result = functionName('param1', 'param2');
 * console.log(result); // Expected output
 * 
 * @example
 * // Error handling example
 * try {
 *   functionName(invalidInput);
 * } catch (error) {
 *   console.error('Handle the error:', error.message);
 * }
 * 
 * @since 2.3.7
 */
export const functionName = (paramName, optionalParam = 'default') => {
  // Implementation
};
```

### 2. React Components

```javascript
/**
 * Component description explaining its purpose and when to use it
 * 
 * @component
 * @param {Object} props - Component props object
 * @param {string} props.title - Title text to display
 * @param {string} [props.variant='primary'] - Visual variant: 'primary', 'secondary', 'success', 'error'
 * @param {Function} [props.onClick] - Click handler function
 * @param {React.ReactNode} [props.children] - Child elements to render
 * @param {string} [props.className] - Additional Tailwind CSS classes
 * 
 * @returns {JSX.Element} Rendered component with Scout theme styling
 * 
 * @example
 * // Basic usage with Scout theme
 * <ComponentName 
 *   title="Scout Event" 
 *   variant="primary"
 *   onClick={handleClick}
 * />
 * 
 * @example
 * // With custom Tailwind classes (post-simplification pattern)
 * <ComponentName 
 *   title="Badge Progress"
 *   className="bg-scout-green text-white px-4 py-2 rounded-md"
 * >
 *   <BadgeIcon className="w-5 h-5" />
 * </ComponentName>
 * 
 * @since 2.3.7
 */
const ComponentName = ({ title, variant = 'primary', onClick, children, className }) => {
  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {/* Implementation */}
    </div>
  );
};

export default ComponentName;
```

### 3. API Service Functions

```javascript
/**
 * Fetches data from the OSM API with rate limiting and offline fallback
 * 
 * @param {string} endpoint - API endpoint path (e.g., 'events', 'members')
 * @param {Object} [options={}] - Request configuration options
 * @param {Object} [options.params] - Query parameters for the request
 * @param {boolean} [options.useCache=true] - Whether to use localStorage cache for offline
 * @param {number} [options.timeoutMs=5000] - Request timeout in milliseconds
 * 
 * @returns {Promise<Object>} Promise resolving to API response data
 * @returns {Object} returns.data - The actual data from the API
 * @returns {Object} returns._rateLimitInfo - Rate limiting information
 * @returns {boolean} returns._fromCache - Whether data came from cache
 * 
 * @throws {Error} When network request fails and no cache available
 * @throws {RateLimitError} When API rate limit is exceeded
 * 
 * @example
 * // Fetch events with caching
 * try {
 *   const response = await fetchFromAPI('events', {
 *     params: { termId: '12345' },
 *     useCache: true
 *   });
 *   console.log('Events:', response.data);
 *   console.log('From cache:', response._fromCache);
 * } catch (error) {
 *   notifyError('Failed to load events', error);
 * }
 * 
 * @example
 * // Offline-first usage pattern
 * const loadData = async () => {
 *   try {
 *     const data = await fetchFromAPI('members', { useCache: true });
 *     if (data._fromCache) {
 *       notifyInfo('Showing cached data (offline)');
 *     }
 *     return data;
 *   } catch (error) {
 *     notifyError('No data available offline', error);
 *     throw error;
 *   }
 * };
 * 
 * @since 2.3.7
 */
export const fetchFromAPI = async (endpoint, options = {}) => {
  // Implementation
};
```

### 4. Notification Functions (react-hot-toast)

```javascript
/**
 * Displays a success notification with Scout green theme
 * 
 * @param {string} message - Success message to display to user
 * @returns {string} Toast ID for dismissing the notification if needed
 * 
 * @example
 * // Basic success notification
 * notifySuccess('Event saved successfully!');
 * 
 * @example
 * // Store toast ID for manual dismissal
 * const toastId = notifySuccess('Uploading...');
 * // Later dismiss if needed
 * dismissToast(toastId);
 * 
 * @since 2.3.7 - Post-notification system simplification
 */
export const notifySuccess = (message) => {
  return toast.success(message, {
    // Scout-themed configuration
  });
};
```

### 5. Hooks and State Management

```javascript
/**
 * Custom hook for managing section data with offline sync
 * 
 * @param {string} sectionId - Section ID to load data for
 * @param {Object} [options={}] - Hook configuration options
 * @param {boolean} [options.autoRefresh=true] - Whether to auto-refresh data
 * @param {number} [options.refreshInterval=30000] - Auto-refresh interval in ms
 * 
 * @returns {Object} Hook return object
 * @returns {Array} returns.sections - Array of section data
 * @returns {boolean} returns.loading - Loading state indicator
 * @returns {Error|null} returns.error - Current error state
 * @returns {Function} returns.refresh - Manual refresh function
 * @returns {boolean} returns.isOffline - Whether currently offline
 * 
 * @example
 * // Basic usage in component
 * const MyComponent = () => {
 *   const { sections, loading, error, refresh } = useSectionData('12345');
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return (
 *     <div>
 *       {sections.map(section => <SectionCard key={section.id} {...section} />)}
 *       <button onClick={refresh}>Refresh</button>
 *     </div>
 *   );
 * };
 * 
 * @since 2.3.7
 */
export const useSectionData = (sectionId, options = {}) => {
  // Hook implementation
};
```

## Special Documentation Requirements

### 1. Scout Theme Colors
Document color usage when relevant:

```javascript
/**
 * @example
 * // Using Scout theme colors
 * className="bg-scout-blue text-white"   // Official Scout blue
 * className="bg-scout-green text-white"  // Success/positive actions
 * className="bg-scout-red text-white"    // Errors/negative actions
 */
```

### 2. Offline-First Patterns
Always document offline behavior:

```javascript
/**
 * @param {boolean} [useCache=true] - Use localStorage cache when offline
 * @throws {Error} When network fails and no cache available
 * @example
 * // Handles offline gracefully
 * const data = await loadData({ useCache: true });
 */
```

### 3. Rate Limiting
Document rate limiting awareness:

```javascript
/**
 * @throws {RateLimitError} When OSM API rate limit exceeded
 * @returns {Object} returns._rateLimitInfo - Current rate limit status
 */
```

## Required JSDoc Tags

### Mandatory for All Functions
- `@param` - For each parameter
- `@returns` - For return value (except void functions)
- `@example` - At least one working example
- `@since` - Version when function was added/modified

### Mandatory for Complex Functions
- `@throws` - For all possible error conditions
- `@see` - Links to related functions/documentation
- Multiple `@example` tags for different use cases

### Mandatory for React Components
- `@component` - Identifies as React component
- `@param {Object} props` - Props object description
- Individual prop documentation with types
- Tailwind class documentation for styling

### Optional but Recommended
- `@deprecated` - For functions being phased out
- `@todo` - For incomplete implementations
- `@author` - For complex algorithms
- `@version` - For version-specific behaviors

## File-Level Documentation

Each file should start with a file-level comment:

```javascript
/**
 * @fileoverview Scout-themed notification utilities using react-hot-toast
 * 
 * This module provides notification functions with Scout color theming and
 * consistent styling across the application. Replaces the previous complex
 * notification system as part of the codebase simplification.
 * 
 * @module notifications
 * @version 2.3.7
 * @since 2.3.7 - Created during notification system simplification
 */
```

## Quality Standards

### Examples Must Be
1. **Executable** - Copy-pasteable code that actually works
2. **Realistic** - Using actual Scout data/scenarios when possible
3. **Complete** - Include necessary imports and setup
4. **Educational** - Show best practices and common patterns

### Error Documentation Must Include
1. **When** the error occurs
2. **What** causes the error
3. **How** to handle/prevent the error
4. **Example** of error handling

### Parameter Documentation Must Specify
1. **Type** information (use TypeScript-style types)
2. **Required vs optional** parameters
3. **Default values** when applicable
4. **Valid values** or ranges when constrained
5. **Format expectations** (e.g., ISO date strings)

## Documentation Generation

### Scripts to Add to package.json
```json
{
  "scripts": {
    "docs:generate": "jsdoc -c jsdoc.config.json",
    "docs:serve": "npx http-server docs/api",
    "docs:coverage": "documentation build src/** -f html -o docs/api --coverage"
  }
}
```

### CI Integration
- Documentation generation runs on every PR
- Coverage reports block PRs below 80% threshold
- Examples are tested for syntax validity

---

**Implementation Priority**: Start with `notifications.js` as it's critical infrastructure with 0% documentation coverage.