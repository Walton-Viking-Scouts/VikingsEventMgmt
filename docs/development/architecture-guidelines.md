# Architecture Guidelines

**Development Guidelines for Viking Event Management Frontend**

This document provides guidelines for developers contributing to the Viking Event Management system, focusing on maintaining the feature-based architecture and ensuring code quality.

## Overview

The Viking Event Management frontend follows a **feature-based architecture** with enforced directory boundaries to maintain code quality, prevent circular dependencies, and ensure scalable development.

## Directory Structure Rules

### 1. **Feature Isolation**

Each feature should be self-contained and follow these rules:

```javascript
// ✅ CORRECT: Import within same feature
import { ComponentName } from './components/ComponentName.jsx';
import { useFeatureHook } from '../hooks/useFeatureHook.js';

// ❌ INCORRECT: Direct import from other features
import { useAuth } from '../../auth/hooks/useAuth.js';
import { SectionsList } from '../../sections/components/SectionsList.jsx';
```

**Why**: Direct cross-feature imports create tight coupling and make refactoring difficult.

### 2. **Use Shared Resources for Cross-Feature Needs**

When you need functionality from another feature, use shared resources:

```javascript
// ✅ CORRECT: Import from shared resources
import { useAuth } from '../../shared/hooks/useAuth.js';
import { Button } from '../../shared/components/ui/Button.jsx';
import { apiClient } from '../../shared/services/api/client.js';

// ✅ CORRECT: Import from feature's public interface
import { AuthButton } from '../auth'; // Uses feature's index.js
```

### 3. **Layered Import Hierarchy**

Follow the import hierarchy to prevent circular dependencies:

```
Pages → Features → Shared → Config/Utils
  ↓        ↓         ↓           ↓
Can import from all lower layers
```

```javascript
// ✅ CORRECT: Pages can import from features and shared
// pages/events/EventsPage.jsx
import { EventDashboard } from '../../features/events';
import { notifySuccess, notifyError } from '../../shared/utils/notifications.js';

// ❌ INCORRECT: Features importing from pages
// features/events/components/EventList.jsx
import { EventsPage } from '../../../pages/events/EventsPage.jsx';
```

## ESLint Rules and Enforcement

The codebase includes automated enforcement of these rules:

### Current ESLint Rules

1. **`import/no-restricted-paths`** - Prevents cross-feature imports
2. **`import/no-cycle`** - Detects circular dependencies
3. **`import/no-self-import`** - Prevents self-imports

### Running Lint Checks

```bash
# Check all files
npm run lint

# Check specific file
npm run lint -- path/to/file.js

# Fix automatically fixable issues
npm run lint -- --fix
```

### Common ESLint Violations

#### Cross-Feature Import Violation
```
error: Unexpected path "../../auth/services/auth.js" imported in restricted zone. Features cannot import from other features directly.
```

**Solution**: Move shared functionality to `shared/` directory or use feature's public interface.

#### Circular Dependency Violation
```
error: Dependency cycle via ./api/index.js:15=>./base.js:17
```

**Solution**: Refactor to remove circular references, often by extracting shared interfaces.

## Best Practices by File Type

### Components

#### Feature Components
```javascript
// features/events/components/EventCard.jsx
import React from 'react';
import { Button } from '../../../shared/components/ui/Button.jsx';
import { useEventData } from '../hooks/useEventData.js';
import { formatDate } from '../../../shared/utils/dateUtils.js';

const EventCard = ({ eventId }) => {
  const { event, isLoading } = useEventData(eventId);
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h3>{event.name}</h3>
      <p>{formatDate(event.date)}</p>
      <Button onClick={() => handleRegister(eventId)}>Register</Button>
    </div>
  );
};

export default EventCard;
```

#### Shared Components
```javascript
// shared/components/ui/Button.jsx
import React from 'react';

const Button = ({ children, variant = 'primary', onClick, ...props }) => {
  const baseClasses = 'px-4 py-2 rounded font-medium';
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  };
  
  return (
    <button 
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
```

### Hooks

#### Feature-Specific Hooks
```javascript
// features/events/hooks/useEventData.js
import { useState, useEffect } from 'react';
import { eventService } from '../services/eventService.js';
import { notifyError } from '../../../shared/utils/notifications.js';

export function useEventData(eventId) {
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadEvent = async () => {
      try {
        setIsLoading(true);
        const eventData = await eventService.getEvent(eventId);
        setEvent(eventData);
      } catch (error) {
        notifyError('Failed to load event');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (eventId) {
      loadEvent();
    }
  }, [eventId, notifyError]);
  
  return { event, isLoading };
}
```

### Services

#### Feature Services
```javascript
// features/events/services/eventService.js
import { apiClient } from '../../../shared/services/api/client.js';
import { logger } from '../../../shared/services/utils/logger.js';

class EventService {
  async getEvents(filters = {}) {
    try {
      const response = await apiClient.get('/events', { params: filters });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch events', { error: error.message });
      throw error;
    }
  }
  
  async createEvent(eventData) {
    try {
      const response = await apiClient.post('/events', eventData);
      logger.info('Event created successfully', { eventId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Failed to create event', { error: error.message });
      throw error;
    }
  }
}

export const eventService = new EventService();
```

## Feature Public Interfaces

Each feature should export its public interface through an `index.js` file:

```javascript
// features/events/index.js
// Components
export { default as EventCard } from './components/EventCard.jsx';
export { default as EventDashboard } from './components/EventDashboard.jsx';
export { EventsList } from './components/EventsList.jsx';

// Hooks
export { useEventData } from './hooks/useEventData.js';
export { useEventRegistration } from './hooks/useEventRegistration.js';

// Services
export { eventService } from './services/eventService.js';

// Types (if using TypeScript)
export type { Event, EventFilter } from './types/event.js';
```

## Creating New Features

### 1. Feature Directory Structure

When creating a new feature, follow this structure:

```
src/features/my-feature/
├── components/
│   ├── FeatureComponent.jsx
│   └── index.js
├── hooks/
│   ├── useFeatureData.js
│   └── index.js
├── services/
│   ├── featureService.js
│   └── index.js
├── types/ (if using TypeScript)
│   └── feature.js
└── index.js
```

### 2. Feature Checklist

Before creating a new feature, ensure:

- [ ] Feature has a clear, single responsibility
- [ ] Dependencies are minimal and well-defined
- [ ] Shared functionality is moved to `shared/`
- [ ] Public interface is exported through `index.js`
- [ ] ESLint passes without violations
- [ ] Tests are included
- [ ] Documentation is updated

### 3. Feature Template

Use this template for new features:

```javascript
// features/my-feature/index.js
// Public interface for my-feature

// Components
export { default as MyFeatureComponent } from './components/MyFeatureComponent.jsx';

// Hooks
export { useMyFeatureData } from './hooks/useMyFeatureData.js';

// Services
export { myFeatureService } from './services/myFeatureService.js';

// Constants
export const MY_FEATURE_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_ITEMS: 100,
};
```

## Refactoring Guidelines

### Moving Shared Code

When you identify code that's used by multiple features:

1. **Move to appropriate shared directory**:
   - UI components → `shared/components/ui/`
   - Business logic → `shared/services/`
   - Utilities → `shared/utils/`
   - Hooks → `shared/hooks/`

2. **Update imports** across the codebase
3. **Run ESLint** to ensure no violations
4. **Update tests** and documentation

### Breaking Circular Dependencies

Common strategies:

1. **Extract interfaces**: Create shared interfaces/types
2. **Dependency injection**: Pass dependencies as parameters
3. **Event-driven architecture**: Use events instead of direct calls
4. **Inversion of control**: Move dependencies to higher-level modules

## Testing Guidelines

### Test Organization

Tests should be co-located with their source files:

```
src/features/events/
├── components/
│   ├── EventCard.jsx
│   ├── EventCard.test.jsx
│   └── __tests__/
│       └── EventCard.integration.test.jsx
├── hooks/
│   ├── useEventData.js
│   └── useEventData.test.js
└── services/
    ├── eventService.js
    └── eventService.test.js
```

### Test Independence

Tests should not depend on other features directly:

```javascript
// ✅ CORRECT: Mock external dependencies
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import EventCard from './EventCard.jsx';

// Mock shared dependencies
vi.mock('../../../shared/contexts/notifications', () => ({
}));

// Mock notification utilities
vi.mock('../../shared/utils/notifications.js', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  notifyWarning: vi.fn(),
  notifyInfo: vi.fn(),
}));

test('renders event card with event data', () => {
  // Test implementation
});
```

## Performance Considerations

### Code Splitting

Features should be lazy-loaded when possible:

```javascript
// pages/events/EventsPage.jsx
import React, { Suspense, lazy } from 'react';

const EventDashboard = lazy(() => import('../../features/events/components/EventDashboard.jsx'));

const EventsPage = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <EventDashboard />
  </Suspense>
);

export default EventsPage;
```

### Bundle Analysis

Regularly analyze bundle size to ensure features aren't causing bloat:

```bash
npm run build
npm run analyze  # If analyzer is configured
```

## Documentation Requirements

### Component Documentation

Every component should include:

1. **Purpose**: What the component does
2. **Props**: Description of all props with types
3. **Usage examples**: How to use the component
4. **Dependencies**: External dependencies

```javascript
/**
 * EventCard Component
 * 
 * Displays event information in a card format with registration functionality.
 * 
 * @param {string} eventId - Unique identifier for the event
 * @param {boolean} showRegistration - Whether to show registration button
 * @param {function} onRegister - Callback when registration is clicked
 * 
 * @example
 * <EventCard 
 *   eventId="123" 
 *   showRegistration={true}
 *   onRegister={handleRegister}
 * />
 */
const EventCard = ({ eventId, showRegistration = false, onRegister }) => {
  // Implementation
};
```

### Service Documentation

Services should document their API:

```javascript
/**
 * Event Service
 * 
 * Handles all event-related API operations including CRUD operations,
 * registration management, and data synchronization.
 * 
 * @example
 * import { eventService } from '../services/eventService.js';
 * 
 * const events = await eventService.getEvents({ status: 'active' });
 * const newEvent = await eventService.createEvent(eventData);
 */
class EventService {
  /**
   * Retrieves events with optional filtering
   * 
   * @param {Object} filters - Filter criteria
   * @param {string} [filters.status] - Event status filter
   * @param {Date} [filters.startDate] - Start date filter
   * @returns {Promise<Event[]>} Array of events
   */
  async getEvents(filters = {}) {
    // Implementation
  }
}
```

## Common Patterns

### Error Handling

Use consistent error handling patterns:

```javascript
// services/eventService.js
import { logger } from '../../../shared/services/utils/logger.js';
import { ApiError } from '../../../shared/utils/errors.js';

class EventService {
  async getEvent(eventId) {
    try {
      const response = await apiClient.get(`/events/${eventId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch event', {
        eventId,
        error: error.message,
        stack: error.stack,
      });
      
      if (error.response?.status === 404) {
        throw new ApiError('Event not found', 'NOT_FOUND');
      }
      
      throw new ApiError('Failed to load event', 'FETCH_ERROR');
    }
  }
}
```

### Loading States

Use consistent loading state patterns:

```javascript
// hooks/useEventData.js
export function useEventData(eventId) {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });
  
  useEffect(() => {
    const loadEvent = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        const eventData = await eventService.getEvent(eventId);
        setState({ data: eventData, isLoading: false, error: null });
      } catch (error) {
        setState({ data: null, isLoading: false, error: error.message });
      }
    };
    
    if (eventId) {
      loadEvent();
    }
  }, [eventId]);
  
  return state;
}
```

## Migration Strategy

### Fixing Existing Violations

To address current ESLint violations:

1. **Identify shared code** that's used across features
2. **Move shared code** to appropriate `shared/` directories
3. **Update imports** throughout the codebase
4. **Create feature interfaces** for necessary cross-feature communication
5. **Test thoroughly** to ensure functionality isn't broken

### Priority Order

Fix violations in this order:

1. **Circular dependencies** (highest priority)
2. **Shared importing from features** (prevents future violations)
3. **Cross-feature imports** (move to shared or create interfaces)
4. **Clean up unused imports** and dead code

## Tools and Automation

### Development Tools

- **ESLint**: Enforces architectural rules
- **Prettier**: Code formatting consistency
- **Husky**: Git hooks for pre-commit checks
- **lint-staged**: Run linters on staged files

### Recommended VS Code Extensions

- **ESLint**: Real-time linting feedback
- **Prettier**: Automatic code formatting
- **Auto Import**: Helps maintain correct import paths
- **Path Intellisense**: Autocomplete for file paths

### Git Hooks

Ensure quality with pre-commit hooks:

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "src/**/*.{js,jsx}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ]
  }
}
```

---

**Remember**: These guidelines exist to maintain code quality and developer productivity. When in doubt, prioritize clarity, maintainability, and team consistency over clever optimizations.