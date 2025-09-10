# Component Size and Responsibility Guidelines

**Enforcing maintainable component architecture with size limits and single-responsibility principles.**

## Overview

This document establishes enforceable guidelines for React component development in the Viking Event Management system, focusing on maintaining code quality through size constraints and clear responsibility boundaries.

## The 500-Line Rule

### Why 500 Lines?

Components exceeding 500 lines typically indicate:
- **Multiple responsibilities** mixed into a single component
- **Difficulty in testing** and debugging
- **Poor maintainability** and reduced readability
- **Challenging code reviews** and collaboration

### Current Violations (As of Sept 2024)

Based on our component audit, the following components require immediate refactoring:

| Component | Lines | Responsibilities | Priority |
|-----------|-------|------------------|----------|
| `AttendanceView.jsx` | 2,240 | 9 | 🔴 Critical |
| `CampGroupsView.jsx` | 1,728 | 7 | 🔴 Critical |
| `EventDashboard.jsx` | 998 | 8 | 🔴 Critical |
| `SectionsList.jsx` | 656 | 7 | 🟡 High |

## Single Responsibility Principle

### Definition

Each component should have **one clear reason to change**. If a component handles multiple concerns, it violates SRP and should be decomposed.

### Identifying Mixed Responsibilities

Components with multiple responsibilities often exhibit:

- **State Management**: Multiple `useState` hooks for unrelated concerns
- **API Operations**: Direct API calls mixed with UI logic
- **Data Processing**: Complex data transformations within render logic
- **Event Handling**: Multiple event types handled in one component
- **Styling Logic**: Complex conditional styling based on multiple factors

### Example: Responsibility Audit

```javascript
// ❌ BAD: Multiple responsibilities in one component
const EventDashboard = () => {
  // Responsibility 1: Event data fetching
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Responsibility 2: Filter state management
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(null);
  
  // Responsibility 3: Registration handling
  const [registrations, setRegistrations] = useState([]);
  
  // Responsibility 4: Export functionality
  const handleExport = async () => { /* complex export logic */ };
  
  // Responsibility 5: Navigation state
  const [activeTab, setActiveTab] = useState('overview');
  
  // 500+ lines of mixed concerns...
};
```

```javascript
// ✅ GOOD: Single responsibility components
const EventDashboard = () => {
  return (
    <div>
      <EventFilters />
      <EventTabNavigation />
      <EventDataDisplay />
      <EventExportTools />
    </div>
  );
};
```

## Refactoring Strategies

### 1. Extract Child Components

Break large components into smaller, focused components:

```javascript
// Before: 500+ line component with multiple concerns
const AttendanceView = () => {
  // Massive component with filtering, data display, registration, etc.
};

// After: Decomposed into focused components
const AttendanceView = () => {
  return (
    <>
      <AttendanceHeader />
      <AttendanceFilters />
      <AttendanceTabNavigation />
      <AttendanceContent />
    </>
  );
};
```

### 2. Extract Custom Hooks

Move complex logic to reusable hooks:

```javascript
// Before: Logic mixed in component
const EventDashboard = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Complex data fetching logic
    const fetchEvents = async () => { /* ... */ };
    fetchEvents();
  }, []);
  
  // More mixed logic...
};

// After: Logic extracted to custom hook
const useEventData = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // All event data logic here
  return { events, loading, refetch };
};

const EventDashboard = () => {
  const { events, loading } = useEventData();
  
  if (loading) return <LoadingSpinner />;
  return <EventList events={events} />;
};
```

### 3. Service Layer Extraction

Move API calls and business logic to services:

```javascript
// Before: API calls in component
const AttendanceView = () => {
  const handleSignInOut = async (memberId, action) => {
    try {
      const response = await fetch(`/api/attendance/${memberId}`, {
        method: 'POST',
        body: JSON.stringify({ action }),
        headers: { 'Content-Type': 'application/json' }
      });
      // Complex response handling...
    } catch (error) {
      // Error handling...
    }
  };
};

// After: Service layer handles API logic
// services/attendanceService.js
export class AttendanceService {
  async updateMemberStatus(memberId, action) {
    // All API and error handling logic here
  }
}

// Component focuses on UI
const AttendanceView = () => {
  const { updateStatus } = useAttendanceService();
  
  const handleSignInOut = (memberId, action) => {
    updateStatus(memberId, action);
  };
};
```

## Code Splitting and Lazy Loading

### When to Use Lazy Loading

Implement lazy loading for:
- **Large feature components** (>200 lines)
- **Rarely used components** (modals, admin panels)
- **Route-level components** (page components)

### Implementation Examples

#### Basic Lazy Loading

```javascript
// pages/EventsPage.jsx
import { lazy, Suspense } from 'react';

const EventDashboard = lazy(() => import('../features/events/components/EventDashboard'));

const EventsPage = () => (
  <Suspense fallback={<LoadingScreen />}>
    <EventDashboard />
  </Suspense>
);
```

#### Feature-Based Code Splitting

```javascript
// Router configuration with lazy loading
import { lazy } from 'react';

// Split by feature
const EventsFeature = lazy(() => import('../features/events'));
const SectionsFeature = lazy(() => import('../features/sections'));
const MovementsFeature = lazy(() => import('../features/movements'));

const AppRouter = () => (
  <Routes>
    <Route path="/events/*" element={
      <Suspense fallback={<LoadingScreen />}>
        <EventsFeature />
      </Suspense>
    } />
    <Route path="/sections/*" element={
      <Suspense fallback={<LoadingScreen />}>
        <SectionsFeature />
      </Suspense>
    } />
  </Routes>
);
```

#### Conditional Loading for Complex Components

```javascript
// Load heavy components only when needed
const AttendanceView = () => {
  const [showCampGroups, setShowCampGroups] = useState(false);
  
  // Lazy load only when tab is active
  const CampGroupsTab = useMemo(() => 
    lazy(() => import('./CampGroupsView')), 
    []
  );
  
  return (
    <div>
      <TabNavigation onTabChange={setShowCampGroups} />
      {showCampGroups && (
        <Suspense fallback={<div>Loading camp groups...</div>}>
          <CampGroupsTab />
        </Suspense>
      )}
    </div>
  );
};
```

## Development Workflow Integration

### Pre-Development Checklist

Before starting a new component:

- [ ] **Define single responsibility** - What is this component's ONE job?
- [ ] **Estimate complexity** - Will this likely exceed 500 lines?
- [ ] **Plan decomposition** - How can I split this into smaller parts?
- [ ] **Identify reusable logic** - What can be extracted to hooks or services?

### During Development

- [ ] **Monitor line count** - Use IDE line counter or wc -l
- [ ] **Watch for mixed concerns** - Are you adding unrelated state or logic?
- [ ] **Extract early** - Don't wait until 500 lines to refactor
- [ ] **Use TypeScript props** - Define clear interfaces for component contracts

### Code Review Guidelines

Reviewers should flag components that:

- **Exceed 300 lines** (warning threshold)
- **Have more than 5 useState hooks**
- **Mix UI logic with business logic**
- **Handle multiple unrelated event types**
- **Contain complex data transformations**

## Automated Enforcement

### ESLint Rules (Future Implementation)

We plan to implement custom ESLint rules to enforce these guidelines:

```javascript
// .eslintrc.js (planned)
module.exports = {
  rules: {
    'component-size/max-lines': ['error', { max: 500 }],
    'component-responsibility/single-concern': 'warn',
    'component-structure/extract-hooks': 'warn'
  }
};
```

### Pre-commit Hooks

```json
// package.json (planned enhancement)
{
  "husky": {
    "hooks": {
      "pre-commit": [
        "lint-staged",
        "npm run component-audit"
      ]
    }
  }
}
```

### Component Audit Script

```bash
# Run component size audit
npm run component-audit

# Check specific file
npm run component-audit -- --file=EventDashboard.jsx

# Get refactoring suggestions
npm run component-audit -- --suggest-refactor
```

## Best Practices by Component Type

### Page Components

**Target:** 50-100 lines

```javascript
// ✅ Good: Focused page component
const EventsPage = () => {
  return (
    <PageLayout>
      <EventsHeader />
      <EventsContent />
    </PageLayout>
  );
};
```

### Feature Components

**Target:** 100-300 lines

```javascript
// ✅ Good: Single feature component
const EventCard = ({ event }) => {
  const { isRegistered, handleRegister } = useEventRegistration(event.id);
  
  return (
    <Card>
      <EventDetails event={event} />
      <EventActions 
        isRegistered={isRegistered}
        onRegister={handleRegister}
      />
    </Card>
  );
};
```

### Layout Components

**Target:** 50-150 lines

```javascript
// ✅ Good: Simple layout logic
const ResponsiveLayout = ({ children }) => {
  const { isMobile } = useBreakpoint();
  
  return isMobile ? (
    <MobileLayout>{children}</MobileLayout>
  ) : (
    <DesktopLayout>{children}</DesktopLayout>
  );
};
```

### UI Components

**Target:** 20-100 lines

```javascript
// ✅ Good: Focused UI component
const Card = ({ variant, children, className, ...props }) => {
  const classes = useCardStyles({ variant });
  
  return (
    <div className={cn(classes, className)} {...props}>
      {children}
    </div>
  );
};
```

## Migration Strategy

### Phase 1: Critical Components (Immediate)

1. **AttendanceView.jsx** (2,240 lines → 4-5 components)
   - `AttendanceHeader.jsx` (~100 lines)
   - `AttendanceFilters.jsx` (~150 lines)
   - `AttendanceTabNavigation.jsx` (~50 lines)
   - `AttendanceOverview.jsx` (~200 lines)
   - `AttendanceRegister.jsx` (~200 lines)

2. **CampGroupsView.jsx** (1,728 lines → 3-4 components)
   - Extract group management logic
   - Separate drag-and-drop functionality
   - Split view and edit modes

### Phase 2: High Priority (Next Sprint)

1. **EventDashboard.jsx** (998 lines)
2. **SectionsList.jsx** (656 lines)

### Phase 3: Monitoring (Ongoing)

- Implement automated size checking
- Regular component audits
- Developer education and tooling

## Performance Considerations

### Bundle Size Impact

Large components affect:
- **Initial bundle size** - Especially without code splitting
- **Memory usage** - Large components create bigger React fiber trees
- **Hot reload speed** - Development experience suffers

### Lazy Loading Benefits

- **Reduced initial load** - Only load what's needed
- **Better user experience** - Faster time to interactive
- **Improved caching** - Smaller chunks cache better

### Code Splitting Strategy

```javascript
// Feature-based splitting
const routes = [
  {
    path: '/events',
    component: lazy(() => import('./features/events'))
  },
  {
    path: '/sections', 
    component: lazy(() => import('./features/sections'))
  }
];

// Component-based splitting for large features
const EventsRouter = () => (
  <Routes>
    <Route path="overview" element={
      <Suspense fallback={<Loading />}>
        <EventsOverview />
      </Suspense>
    } />
    <Route path="attendance" element={
      <Suspense fallback={<Loading />}>
        <AttendanceView />
      </Suspense>
    } />
  </Routes>
);
```

## Testing Strategy

### Unit Testing Smaller Components

Smaller components are easier to test:

```javascript
// Easy to test - single responsibility
test('EventCard displays event information', () => {
  const mockEvent = { id: 1, name: 'Test Event' };
  render(<EventCard event={mockEvent} />);
  
  expect(screen.getByText('Test Event')).toBeInTheDocument();
});

// Harder to test - multiple responsibilities
test('EventDashboard complex behavior', () => {
  // 50+ lines of setup for complex component
  // Multiple mocks for different concerns
  // Fragile tests that break easily
});
```

### Integration Testing

Focus on testing component composition:

```javascript
test('EventsPage integrates components correctly', () => {
  render(<EventsPage />);
  
  // Test that child components are rendered
  expect(screen.getByTestId('events-header')).toBeInTheDocument();
  expect(screen.getByTestId('events-list')).toBeInTheDocument();
});
```

## Documentation Requirements

### Component Documentation Template

```javascript
/**
 * EventCard Component
 * 
 * **Responsibility**: Display individual event information with registration actions
 * 
 * **Size**: ~150 lines (within guidelines)
 * **Dependencies**: useEventRegistration hook, EventDetails component
 * 
 * @param {Object} event - Event object with id, name, date, description
 * @param {Function} onRegister - Callback for registration action
 * 
 * @example
 * <EventCard 
 *   event={{ id: 1, name: "JOTI 2024" }}
 *   onRegister={handleRegister}
 * />
 */
const EventCard = ({ event, onRegister }) => {
  // Implementation
};
```

### Refactoring Documentation

When refactoring large components, document:

1. **Original responsibilities** identified
2. **New component structure** created  
3. **Migration notes** for future developers
4. **Breaking changes** if any public APIs changed

## Tools and Resources

### VS Code Extensions

- **Component Line Counter** - Track component size in real-time
- **React Component Visualizer** - See component hierarchy
- **ESLint** - Automated rule enforcement
- **TypeScript** - Better component interfaces

### Command Line Tools

```bash
# Count lines in component
wc -l src/features/events/components/EventDashboard.jsx

# Find large components
find src -name "*.jsx" -exec wc -l {} + | sort -nr | head -10

# Component complexity analysis
npm run component-audit
```

### Development Workflow

```bash
# Start with component planning
npm run create-component -- EventCard --template=feature

# Monitor size during development  
npm run dev -- --component-watch

# Pre-commit component check
npm run pre-commit-check
```

## Enforcement Timeline

### Immediate (This Sprint)

- [ ] Document guidelines (this document)
- [ ] Audit existing violations
- [ ] Plan refactoring roadmap

### Short Term (Next 2 Sprints)  

- [ ] Refactor critical violations (AttendanceView, CampGroupsView)
- [ ] Implement basic size checking
- [ ] Update code review process

### Medium Term (Next Quarter)

- [ ] Complete all violation refactoring
- [ ] Implement automated ESLint rules
- [ ] Add pre-commit hooks

### Long Term (Ongoing)

- [ ] Regular component audits
- [ ] Developer training program
- [ ] Continuous monitoring dashboard

---

**Remember**: These guidelines exist to maintain code quality and developer productivity. Small, focused components are easier to understand, test, maintain, and reuse. When in doubt, favor smaller components over larger ones.