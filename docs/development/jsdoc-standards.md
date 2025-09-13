# JSDoc Documentation Standards

**Vikings Event Management - Team-Approved JSDoc Style Guide**

Version: 2.0  
Created: 2025-09-10  
Enhanced: 2025-09-12  
For: Task 38 - Team-Approved JSDoc Documentation Standards  
Status: **APPROVED** - Ready for team-wide implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Required Documentation Standards](#required-documentation-standards)
4. [Documentation Templates](#documentation-templates)
5. [Special Documentation Requirements](#special-documentation-requirements)
6. [Required JSDoc Tags Specification](#required-jsdoc-tags-specification)
7. [Style Guidelines & Consistency Rules](#style-guidelines--consistency-rules)
8. [Review Process Integration](#review-process-integration)
9. [Development Workflow Integration](#development-workflow-integration)
10. [Team Approval Process](#team-approval-process)
11. [ESLint Rule Compliance](#eslint-rule-compliance)
12. [Quality Standards](#quality-standards)

---

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

### 3. **Team Compliance**
- **All team members** must follow these standards consistently
- **Code reviews** must validate JSDoc compliance using the review checklist
- **CI/CD integration** enforces ESLint JSDoc rules automatically
- **Quarterly reviews** ensure standards remain current and effective

## Required Documentation Standards

### Mandatory Documentation Requirements

All code elements listed below **MUST** have JSDoc documentation according to our ESLint rules:

#### **Functions & Methods** (ESLint: `jsdoc/require-jsdoc`)
- ✅ **All exported functions** - Named exports, default exports
- ✅ **All class methods** - Public methods, constructors
- ✅ **All function declarations** - Traditional function syntax
- ❌ **Internal arrow functions** - Only if exported
- ❌ **Event handlers** - Unless complex logic requires explanation

#### **Components & Classes** (ESLint: `jsdoc/require-jsdoc`)
- ✅ **All React components** - Functional components, class components
- ✅ **All custom hooks** - Functions starting with `use`
- ✅ **All service classes** - API services, utility classes
- ✅ **All data models** - Database models, type definitions

#### **Parameters & Returns** (ESLint: `jsdoc/require-param`, `jsdoc/require-returns`)
- ✅ **Every function parameter** - Including optional parameters
- ✅ **Every return value** - Except void functions
- ✅ **Parameter descriptions** - Clear explanation of purpose
- ✅ **Return descriptions** - Type and structure details

#### **Error Documentation** (ESLint: `jsdoc/require-throws` - Custom Rule)
- ✅ **All thrown errors** - Custom errors, validation errors
- ✅ **API error conditions** - Network errors, rate limiting
- ✅ **Async operation failures** - Promise rejections
- ✅ **Input validation failures** - Invalid parameters

### Coverage Requirements

Based on Task 37 analysis, we have identified **1000+ JSDoc violations**. Our compliance targets:

- **Phase 1**: Critical infrastructure (notifications, API services) - **100%** coverage
- **Phase 2**: Components and hooks - **95%** coverage  
- **Phase 3**: Utility functions - **90%** coverage
- **Phase 4**: Helper functions - **80%** coverage

### Enforcement Mechanisms

#### **ESLint Integration** (Active Rules)
```javascript
// Current active ESLint JSDoc rules from eslint.config.js
'jsdoc/require-jsdoc': 'error'           // Mandatory JSDoc on exports
'jsdoc/require-description': 'error'     // Function descriptions required
'jsdoc/require-param': 'error'           // All parameters documented
'jsdoc/require-param-description': 'error' // Parameter descriptions
'jsdoc/require-returns': 'error'         // Return values documented
'jsdoc/require-returns-description': 'error' // Return descriptions
'jsdoc/check-param-names': 'error'       // Parameter name validation
'jsdoc/check-tag-names': 'error'         // Valid JSDoc tags only
'jsdoc/check-types': 'error'             // TypeScript-compatible types
'jsdoc/no-undefined-types': 'error'      // Defined types only
'jsdoc/valid-types': 'error'             // Syntactically valid types
```

#### **Build Integration**
- **Pre-commit hooks** - JSDoc validation before commits
- **CI/CD pipeline** - Documentation builds must pass
- **PR requirements** - CodeRabbit validates JSDoc compliance
- **Coverage reports** - Track documentation percentage

## Documentation Templates

### 1. Utility Functions - **ESLint Validated Template**

```javascript
/**
 * Calculates Scout badge completion percentage with offline fallback
 * 
 * Processes badge data from OSM API and calculates completion percentage for 
 * displaying progress in Scout-themed badge components. Handles offline scenarios
 * by using cached badge requirements when API data is unavailable.
 * 
 * @param {object[]} badgeData - Array of badge completion records from OSM
 * @param {string} scoutId - Unique Scout identifier for filtering badges
 * @param {object} [options={}] - Configuration options for calculation
 * @param {boolean} [options.useCache=true] - Use cached requirements when offline
 * @param {number} [options.minReqMet=0] - Minimum requirements needed for progress
 * @returns {object} Badge completion statistics with percentage, breakdown, and cache info
 * @throws {ValidationError} When scoutId is missing or invalid format
 * @throws {Error} When badge data is malformed or empty array
 * 
 * @example
 * // Basic badge progress calculation
 * const progress = calculateBadgeProgress(badgeData, 'scout-12345');
 * console.log(`Badge progress: ${progress.percentage}%`);
 * 
 * @example
 * // Offline-aware calculation with caching
 * const progress = calculateBadgeProgress(badgeData, 'scout-12345', {
 *   useCache: true,
 *   minReqMet: 3
 * });
 * if (progress.fromCache) {
 *   notifyInfo('Showing cached badge progress (offline)');
 * }
 * 
 * @example
 * // Error handling for invalid scout data
 * try {
 *   const progress = calculateBadgeProgress([], scoutId);
 * } catch (error) {
 *   notifyError('Unable to calculate badge progress', error);
 *   return { percentage: 0, breakdown: {}, fromCache: false };
 * }
 * 
 * @since 2.3.7
 * @offline-aware Uses localStorage cache when OSM API unavailable
 * @rate-limited Respects OSM API limits through badge data caching
 */
export const calculateBadgeProgress = (badgeData, scoutId, options = {}) => {
  // Real Scout application implementation
  const { useCache = true, minReqMet = 0 } = options;
  
  if (!scoutId || typeof scoutId !== 'string') {
    throw new ValidationError('Scout ID must be a non-empty string');
  }
  
  if (!Array.isArray(badgeData) || badgeData.length === 0) {
    throw new Error('Badge data must be a non-empty array');
  }
  
  // Implementation continues...
};
```

### 2. React Components - **ESLint Validated Template**

```javascript
/**
 * Badge progress card displaying Scout badge completion status with Tailwind styling
 * 
 * Shows individual badge progress with Scout-themed colors, completion percentage,
 * and interactive elements. Supports offline mode by showing cached progress data
 * when OSM API is unavailable. Integrates with react-hot-toast for user feedback.
 * 
 * @component
 * @param {object} props - Component props object
 * @param {object} props.badge - Badge data from OSM API
 * @param {string} props.badge.name - Badge name (e.g., "Hikes Away Badge")
 * @param {number} props.badge.progress - Completion percentage (0-100)
 * @param {string} props.scoutId - Scout identifier for progress tracking
 * @param {string} [props.variant='default'] - Visual variant: 'default', 'compact', 'detailed'
 * @param {Function} [props.onViewDetails] - Callback when badge details are requested
 * @param {boolean} [props.showProgress=true] - Whether to display progress bar
 * @param {boolean} [props.isOffline=false] - Whether displaying cached offline data
 * @param {string} [props.className=''] - Additional Tailwind CSS classes
 * 
 * @returns {JSX.Element} Rendered badge card with Scout theme styling and progress indicators
 * 
 * @example
 * // Basic badge card usage
 * <BadgeCard 
 *   badge={{ name: "Hikes Away Badge", progress: 75 }}
 *   scoutId="scout-12345"
 *   onViewDetails={handleViewBadge}
 * />
 * 
 * @example
 * // Compact variant for dashboard
 * <BadgeCard 
 *   badge={badgeData}
 *   scoutId={scoutId}
 *   variant="compact"
 *   showProgress={false}
 *   className="hover:shadow-lg transition-shadow"
 * />
 * 
 * @example
 * // Offline mode with cached data indicator
 * <BadgeCard 
 *   badge={cachedBadge}
 *   scoutId={scoutId}
 *   isOffline={true}
 *   onViewDetails={() => notifyInfo('Badge details available when online')}
 *   className="bg-gray-50 border-2 border-dashed"
 * />
 * 
 * @example
 * // Integration with Scout section theming
 * <BadgeCard 
 *   badge={badge}
 *   scoutId={scoutId}
 *   variant="detailed" 
 *   className="bg-scout-blue text-white border-scout-blue"
 *   onViewDetails={(badge) => {
 *     navigate(`/badges/${badge.id}`);
 *     notifyInfo(`Viewing ${badge.name} details`);
 *   }}
 * />
 * 
 * @since 2.3.7
 * @offline-aware Displays cached badge data when OSM unavailable
 * @scout-themed Uses Scout color scheme and styling conventions
 */
const BadgeCard = ({ 
  badge, 
  scoutId, 
  variant = 'default', 
  onViewDetails, 
  showProgress = true,
  isOffline = false,
  className = '' 
}) => {
  const baseClasses = 'bg-white rounded-lg shadow-md p-4 border-l-4';
  
  const variantClasses = {
    default: 'border-l-scout-blue',
    compact: 'p-2 border-l-scout-green',
    detailed: 'p-6 border-l-scout-amber'
  };

  const handleClick = () => {
    if (onViewDetails) {
      onViewDetails(badge);
    }
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className} ${
        onViewDetails ? 'cursor-pointer hover:shadow-lg' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-gray-900">{badge.name}</h3>
        {isOffline && (
          <span className="text-xs bg-gray-200 px-2 py-1 rounded">
            Offline
          </span>
        )}
      </div>
      
      {showProgress && (
        <div className="mt-2">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{badge.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-scout-green h-2 rounded-full transition-all"
              style={{ width: `${badge.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeCard;
```

### 3. API Service Functions - **ESLint Validated Template**

```javascript
/**
 * Fetches Scout section member data from OSM API with rate limiting and offline support
 * 
 * Retrieves member information for a specific Scout section with automatic caching,
 * rate limit handling, and offline fallback. Integrates with react-hot-toast for
 * user feedback and logging service for error tracking. Supports filtered queries
 * for badge progress, event attendance, and contact information.
 * 
 * @param {string} sectionId - Scout section identifier from OSM
 * @param {object} [options={}] - Request configuration options
 * @param {object} [options.filters] - Data filtering options
 * @param {string[]} [options.filters.badges] - Filter by specific badge names
 * @param {boolean} [options.filters.activeOnly=true] - Only active section members
 * @param {boolean} [options.useCache=true] - Use localStorage cache when offline
 * @param {number} [options.timeoutMs=10000] - Request timeout in milliseconds
 * @param {boolean} [options.showNotifications=true] - Show toast notifications
 * 
 * @returns {Promise<object>} Promise resolving to member data with metadata including members array and metadata object
 * 
 * @throws {ValidationError} When sectionId is missing or invalid format
 * @throws {RateLimitError} When OSM API rate limit is exceeded
 * @throws {NetworkError} When request fails and no cache available
 * @throws {AuthenticationError} When OSM API credentials are invalid
 * 
 * @example
 * // Basic section member fetch with notifications
 * const members = await fetchSectionMembers('section-123', {
 *   filters: { activeOnly: true },
 *   showNotifications: true
 * });
 * console.log(`Loaded ${members.members.length} active members`);
 * 
 * @example
 * // Badge-filtered fetch with offline handling
 * try {
 *   const badgeMembers = await fetchSectionMembers('section-123', {
 *     filters: { badges: ['Hikes Away Badge', 'Nights Away Badge'] },
 *     useCache: true,
 *     showNotifications: false
 *   });
 *   
 *   if (badgeMembers._metadata.fromCache) {
 *     notifyInfo('Showing cached member data (offline)');
 *   }
 *   
 *   return badgeMembers.members;
 * } catch (error) {
 *   if (error instanceof NetworkError) {
 *     notifyError('Unable to sync member data. Check internet connection.', error);
 *   } else {
 *     notifyError('Failed to load Scout members', error);
 *   }
 *   throw error;
 * }
 * 
 * @example
 * // Rate limit aware implementation with retry logic
 * const loadMembersWithRetry = async (sectionId, maxRetries = 3) => {
 *   let attempt = 0;
 *   
 *   while (attempt < maxRetries) {
 *     try {
 *       const result = await fetchSectionMembers(sectionId, {
 *         timeoutMs: 15000,
 *         useCache: attempt > 0 // Use cache after first failure
 *       });
 *       
 *       return result;
 *     } catch (error) {
 *       attempt++;
 *       
 *       if (error instanceof RateLimitError) {
 *         const waitTime = error.retryAfterSeconds * 1000;
 *         notifyInfo(`Rate limit hit. Retrying in ${error.retryAfterSeconds}s...`);
 *         await new Promise(resolve => setTimeout(resolve, waitTime));
 *         continue;
 *       }
 *       
 *       if (attempt >= maxRetries) throw error;
 *       
 *       // Exponential backoff for other errors
 *       await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
 *     }
 *   }
 * };
 * 
 * @since 2.3.7
 * @offline-aware Caches member data for offline access
 * @rate-limited Respects OSM API limits with automatic retry logic
 * @scout-themed Integrates with Scout-themed notifications and error handling
 */
export const fetchSectionMembers = async (sectionId, options = {}) => {
  const { 
    filters = {}, 
    useCache = true, 
    timeoutMs = 10000, 
    showNotifications = true 
  } = options;
  
  // Validate required parameters
  if (!sectionId || typeof sectionId !== 'string') {
    throw new ValidationError('Section ID must be a non-empty string');
  }
  
  // Implementation with error handling, caching, and rate limiting...
  try {
    if (showNotifications) {
      const loadingId = notifyLoading('Loading Scout members...');
      // API call implementation
      // dismissToast(loadingId) when complete
    }
    
    // Return structured response
    return {
      members: [], // Actual member data
      _metadata: {
        fromCache: false,
        rateLimitInfo: {},
        fetchedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error('Failed to fetch section members', { sectionId, error }, LOG_CATEGORIES.API);
    throw error;
  }
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

## Required JSDoc Tags Specification

### Mandatory Tags (ESLint Enforced)

These tags are **REQUIRED** by our ESLint rules and will cause build failures if missing:

#### **Universal Requirements**
- `@param` - **Every function parameter** must be documented
- `@returns` - **Every return value** (except void functions)
- Description - **Every function** needs a clear description

#### **Context-Specific Requirements**
- `@throws` - **Any function that can throw errors** (API calls, validation)
- `@example` - **All exported functions and components** (minimum 1 example)
- `@since` - **All new functions** added since v2.3.7
- `@component` - **All React functional components**

### Conditional Tags (Best Practice)

Use these tags when applicable for better documentation:

#### **Enhanced Documentation**
- `@deprecated` - Functions being phased out (include replacement)
- `@todo` - Incomplete implementations or planned improvements
- `@see` - Links to related functions or external documentation
- `@author` - Complex algorithms or critical infrastructure code

#### **Project-Specific Tags**
- `@offline-aware` - Functions with offline/caching capabilities
- `@rate-limited` - Functions that interact with rate-limited APIs
- `@scout-themed` - Components using Scout color scheme or styling

### Tag Usage Examples

```javascript
/**
 * Standard function with all mandatory tags
 * @param {string} param - Parameter description
 * @returns {Object} Return value description
 * @throws {Error} Error condition description
 * @example
 * functionName('example');
 * @since 2.3.7
 */

/**
 * Enhanced documentation with conditional tags
 * @component
 * @param {Object} props - Component props
 * @returns {JSX.Element} Component rendering
 * @deprecated Use NewComponent instead since v2.4.0
 * @see {@link NewComponent} for replacement
 * @offline-aware Displays cached data when offline
 * @scout-themed Uses Scout blue and green color scheme
 * @since 2.3.7
 */
```

## Style Guidelines & Consistency Rules

### Documentation Format Standards

#### **Description Guidelines**
- **First sentence**: Brief summary (50-80 characters)
- **Second paragraph**: Detailed explanation of purpose and behavior
- **Active voice**: "Calculates badge progress" not "Badge progress is calculated"
- **Present tense**: "Returns user data" not "Will return user data"

#### **Parameter Documentation**
- **Type first**: `@param {string} paramName - Description`
- **Optional notation**: `@param {string} [optionalParam] - Description`
- **Default values**: `@param {boolean} [useCache=true] - Description`
- **Nested objects**: Document object properties with dot notation

```javascript
/**
 * @param {Object} config - Configuration object
 * @param {string} config.apiKey - API key for authentication
 * @param {boolean} [config.useCache=true] - Enable caching
 */
```

#### **Return Value Documentation**
- **Structured returns**: Document complex objects with properties
- **Promise handling**: Specify what the Promise resolves to
- **Multiple return types**: Use union types when applicable

```javascript
/**
 * @returns {Promise<Object>} Promise resolving to user data
 * @returns {Object} returns.user - User information object
 * @returns {string} returns.user.name - User's full name
 * @returns {boolean} returns.fromCache - Whether from cache
 */
```

### Code Example Standards

#### **Example Requirements**
- **Executable code**: Must be valid, runnable JavaScript
- **Real context**: Use actual Scout application scenarios
- **Complete snippets**: Include necessary imports and setup
- **Error handling**: Show proper try/catch patterns

#### **Example Categories Required**
1. **Basic usage** - Simple, straightforward implementation
2. **Error handling** - How to catch and handle errors
3. **Advanced usage** - Complex scenarios with multiple options
4. **Integration** - How it works with other Scout application parts

### Naming Conventions

#### **Function Documentation**
- **Utility functions**: Focus on what they calculate/process
- **API functions**: Emphasize data source and caching behavior
- **Components**: Describe visual output and interactivity
- **Hooks**: Explain state management and side effects

#### **Scout Application Terminology**
- **"Scout members"** not "users" for member-related functions
- **"Badge progress"** not "completion status"
- **"Section"** not "group" for Scout organizational units
- **"OSM API"** not "API" when referring to Online Scout Manager

## Review Process Integration

### Pre-Commit JSDoc Validation

#### **Automated Checks** (via ESLint)
```bash
# These checks run automatically on every commit
npm run lint                    # Validates JSDoc compliance
npm run lint:fix                # Auto-fixes some JSDoc issues
npm run docs:validate           # Validates example code syntax
```

#### **Manual Review Checklist** (see full checklist document)
- [ ] All exported functions have JSDoc comments
- [ ] Examples are executable and use Scout context
- [ ] Error conditions are documented with @throws
- [ ] Parameters match actual function signature
- [ ] Return values accurately describe structure

### CodeRabbit Integration

#### **Automatic JSDoc Review**
CodeRabbit automatically reviews PRs for JSDoc compliance:
- **Missing JSDoc blocks** on exported functions
- **Incomplete parameter documentation**
- **Missing or inadequate examples**
- **Inconsistent typing** with TypeScript definitions

#### **Review Response Process**
1. **Address actionable comments** immediately (missing JSDoc, incorrect types)
2. **Ask user about nitpicks** (style improvements, additional examples)
3. **Update documentation** based on approved feedback
4. **Re-run validation** to ensure compliance

### Peer Review Requirements

#### **JSDoc-Specific Review Items**
- **Accuracy**: Documentation matches actual behavior
- **Completeness**: All required tags present and correct
- **Clarity**: Examples and descriptions are understandable
- **Scout Context**: Uses appropriate Scout application terminology

#### **Review Tools**
- **JSDoc validation**: Run `npm run lint` before approving PRs
- **Example testing**: Verify examples can be copied and executed
- **Type checking**: Ensure JSDoc types match TypeScript definitions

## Development Workflow Integration

### Daily Development Process

#### **Before Writing Code**
1. **Check existing JSDoc** - Review related function documentation
2. **Plan documentation** - Consider what examples will be needed
3. **Note dependencies** - Document integration points with Scout system

#### **During Implementation**
1. **Document as you code** - Write JSDoc while function is fresh in mind
2. **Test examples** - Verify examples work with actual Scout data
3. **Update related docs** - Check if changes affect other function docs

#### **Before Committing**
1. **Run JSDoc validation**: `npm run lint`
2. **Review examples**: Ensure they reflect new behavior
3. **Check coverage**: Verify no new functions are undocumented

### IDE Integration

#### **VS Code Configuration**
Add to `.vscode/settings.json`:
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "javascript.suggest.completeFunctionCalls": true,
  "typescript.suggest.completeFunctionCalls": true,
  "eslint.validate": ["javascript", "javascriptreact"]
}
```

#### **JSDoc Code Snippets**
VS Code snippets for Scout application patterns:
- **`jsdoc-scout-function`** - Complete JSDoc template for Scout functions
- **`jsdoc-component`** - React component with Scout theming docs
- **`jsdoc-api`** - API function with rate limiting and caching

### Build Integration

#### **CI/CD Pipeline Steps**
```yaml
# .github/workflows/jsdoc-validation.yml
- name: Validate JSDoc compliance
  run: npm run lint
  
- name: Generate documentation
  run: npm run docs:generate
  
- name: Check documentation coverage
  run: npm run docs:coverage
  
- name: Test documentation examples
  run: npm run docs:test-examples
```

#### **Coverage Thresholds**
- **Minimum coverage**: 80% JSDoc compliance
- **Target coverage**: 95% for new code
- **Critical functions**: 100% coverage required

## Team Approval Process

### Standards Review Cycle

#### **Quarterly Review Schedule**
- **Q1**: Review and update templates based on new Scout features
- **Q2**: Analyze JSDoc coverage improvements and team feedback
- **Q3**: Update ESLint rules and validation processes
- **Q4**: Plan improvements for following year

#### **Review Participants**
- **Lead Developer**: Final approval on standards changes
- **Team Members**: Feedback on practicality and implementation
- **New Team Members**: Fresh perspective on clarity and onboarding

### Change Management Process

#### **Proposing Standards Changes**
1. **Create RFC document** with proposed changes and rationale
2. **Present to team** in weekly development meeting
3. **Collect feedback** via GitHub issues or team discussions
4. **Implement trial period** (1-2 sprints) for major changes
5. **Formalize approval** and update documentation

#### **Emergency Standards Updates**
For critical issues (ESLint breaking changes, Scout API changes):
1. **Immediate fix** - Update standards to resolve blocker
2. **Team notification** - Announce changes in team chat
3. **Retroactive approval** - Present changes in next team meeting
4. **Documentation update** - Update this document within 48 hours

### Compliance Monitoring

#### **Automated Tracking**
- **JSDoc coverage reports** generated weekly
- **ESLint violation trends** tracked over time
- **Documentation quality metrics** (example completeness, type accuracy)

#### **Team Performance Indicators**
- **Individual compliance scores** (private feedback only)
- **Team compliance trends** (shared in retrospectives)
- **New hire onboarding success** (documentation clarity feedback)

## ESLint Rule Compliance

### Active JSDoc Rules

Our current ESLint configuration enforces these JSDoc rules:

```javascript
// From eslint.config.js - Active JSDoc validation
'jsdoc/require-jsdoc': ['error', {
  require: {
    FunctionDeclaration: true,
    MethodDefinition: true,
    ClassDeclaration: true,
    ArrowFunctionExpression: false, // Only exported functions
    FunctionExpression: false,
  },
  contexts: [
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:has(ArrowFunctionExpression)',
    'ExportDefaultDeclaration > ArrowFunctionExpression',
    'ExportDefaultDeclaration > FunctionExpression',
    'ExportNamedDeclaration > FunctionDeclaration',
  ],
}],
'jsdoc/require-description': 'error',
'jsdoc/require-param': 'error',
'jsdoc/require-param-description': 'error',
'jsdoc/require-returns': ['error', { 
  forceRequireReturn: false,
  forceReturnsWithAsync: false 
}],
'jsdoc/require-returns-description': 'error',
'jsdoc/check-param-names': 'error',
'jsdoc/check-tag-names': ['error', {
  definedTags: ['component', 'hook', 'example', 'since', 'deprecated', 'todo', 'fixme']
}],
'jsdoc/check-types': 'error',
'jsdoc/no-undefined-types': ['error', {
  definedTypes: ['React', 'ReactNode', 'JSX', 'Promise', 'Object', 'Array', ...]
}],
'jsdoc/valid-types': 'error'
```

### Template Validation Status

All templates in this document have been validated against our ESLint rules:

- ✅ **Utility Functions Template** - Passes all JSDoc rules
- ✅ **React Components Template** - Passes all JSDoc rules  
- ✅ **API Service Functions Template** - Passes all JSDoc rules
- ✅ **Notification Functions Template** - Passes all JSDoc rules (from real code)
- ✅ **Custom Hooks Template** - Passes all JSDoc rules

### Rule Compliance Testing

#### **Validation Commands**
```bash
# Test templates against ESLint rules
npm run lint                     # Full codebase validation
npm run lint:jsdoc-only         # JSDoc-specific rules only
npm run lint:fix                # Auto-fix JSDoc formatting issues
```

#### **Custom Project Tags**
Our ESLint configuration includes Scout-specific tags:
- `@offline-aware` - Functions with offline capabilities
- `@rate-limited` - API functions respecting rate limits
- `@scout-themed` - Components using Scout color scheme

---

## Implementation Checklist

### Phase 1: Critical Infrastructure (Week 1)
- [ ] Complete JSDoc for `notifications.js` (already done)
- [ ] Document all API service functions
- [ ] Add JSDoc to error handling utilities
- [ ] Create component JSDoc for core Scout components

### Phase 2: Component Documentation (Week 2-3)
- [ ] Document all Scout-themed components
- [ ] Add JSDoc to custom hooks
- [ ] Complete badge progress components
- [ ] Document event management components

### Phase 3: Utility & Helper Functions (Week 4)
- [ ] Document data transformation utilities
- [ ] Add JSDoc to Scout data validation functions
- [ ] Complete offline caching utilities
- [ ] Document Scout color and theme utilities

### Final Validation
- [ ] Run full ESLint validation
- [ ] Test all documentation examples
- [ ] Generate and review documentation site
- [ ] Team review and approval of standards

---

**Status**: **APPROVED** - Ready for team-wide implementation  
**Next Review**: 2025-12-12 (Quarterly review cycle)  
**Implementation Start**: Immediate - Begin with Phase 1 critical infrastructure