# State Management Migration Guide

## Overview

This guide provides step-by-step instructions for migrating components to use the new AppStateContext and URL synchronization system.

## Quick Reference

### Before Migration
- Local component state for navigation data
- Manual state passing via navigate() calls
- No URL parameter integration
- Limited state persistence

### After Migration
- Centralized AppStateContext
- Automatic URL synchronization
- localStorage persistence
- Multi-source data loading

## Migration Steps

### Step 1: Import Required Hooks

Add the necessary imports to your component:

```jsx
// Add these imports
import { useAppState } from '../../shared/contexts/app';
import { useURLSync } from '../../hooks/useURLSync.js';
```

### Step 2: Replace Local State

#### Before (Local State Pattern)
```jsx
function EventsOverview() {
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // Try to get from location state
      if (location.state?.events) {
        setEvents(location.state.events);
        setMembers(location.state.members || []);
      } else {
        // Load from database
        const eventsData = await databaseService.getEvents();
        setEvents(eventsData);
      }
    };
    loadData();
  }, [location.state]);
}
```

#### After (Context Pattern)
```jsx
function EventsOverview() {
  const location = useLocation();
  const { state } = useAppState();
  const { updateNavigationData } = useURLSync();
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      let eventsData = null;
      let membersData = null;

      // 1. Check app state context first
      if (state.navigationData.events?.length > 0) {
        eventsData = state.navigationData.events;
        membersData = state.navigationData.members || [];
      }
      // 2. Check router location state
      else if (location.state?.events) {
        eventsData = location.state.events;
        membersData = location.state.members || [];
      }
      // 3. Fallback: load from database
      else {
        eventsData = await databaseService.getEvents();
        if (eventsData?.length > 0) {
          const sectionsInvolved = Array.from(new Set(eventsData.map(e => e.sectionid)));
          membersData = await databaseService.getMembers(sectionsInvolved);
        }
      }

      setEvents(eventsData || []);
      setMembers(membersData || []);

      // Update context for URL synchronization
      if (eventsData?.length > 0) {
        updateNavigationData({
          events: eventsData,
          members: membersData || []
        });
      }
    };
    loadData();
  }, [location.state, state.navigationData, updateNavigationData]);
}
```

### Step 3: Update Navigation Calls

#### Before (Standard Navigation)
```jsx
const handleEventClick = (eventName) => {
  navigate(`/events/detail/${encodeURIComponent(eventName)}`, {
    state: { events, members }
  });
};

const handleBackToOverview = () => {
  navigate('/events/overview');
};
```

#### After (State-Preserving Navigation)
```jsx
const handleEventClick = (eventName) => {
  navigateWithState(`/events/detail/${encodeURIComponent(eventName)}`, {
    preserveParams: true,
    state: { events, members }
  });
};

const handleBackToOverview = () => {
  navigateWithState('/events/overview', {
    preserveParams: true,
    state: { events, members }
  });
};
```

### Step 4: URL Parameter Integration

For components that should reflect state in the URL:

```jsx
function EventsDetail() {
  const { eventId } = useParams();
  const { updateNavigationData } = useURLSync();
  
  useEffect(() => {
    if (eventName && eventsData) {
      // Update context with URL parameter integration
      updateNavigationData({
        events: eventsData,
        members: membersData,
        selectedEvent: decodeURIComponent(eventName)
      });
    }
  }, [eventName, eventsData, membersData, updateNavigationData]);
}
```

## Migration Patterns

### Pattern 1: Data-Heavy Components

For components that load significant data (events, members, attendance):

```jsx
// Multi-source loading with context integration
const loadEventsData = async () => {
  try {
    let eventsData = null;
    let membersData = null;

    // Priority order: Context → Router state → Database
    if (state.navigationData.events?.length > 0) {
      eventsData = state.navigationData.events;
      membersData = state.navigationData.members || [];
      logger.debug('Data loaded from context');
    }
    else if (location.state?.events?.length > 0) {
      eventsData = location.state.events;
      membersData = location.state.members || [];
      logger.debug('Data loaded from router state');
    }
    else {
      eventsData = await databaseService.getEvents();
      if (eventsData?.length > 0) {
        const sections = Array.from(new Set(eventsData.map(e => e.sectionid)));
        membersData = await databaseService.getMembers(sections);
      }
      logger.debug('Data loaded from database');
    }

    setEvents(eventsData || []);
    setMembers(membersData || []);

    // Update context for other components
    if (eventsData?.length > 0) {
      updateNavigationData({
        events: eventsData,
        members: membersData || []
      });
    }
  } catch (error) {
    logger.error('Failed to load events data', { error: error.message });
    setError(error.message);
  }
};
```

### Pattern 2: Navigation-Heavy Components

For components with multiple navigation paths:

```jsx
const { navigateWithState } = useURLSync();

// Preserve state across all navigation
const handleNavigation = (path, additionalState = {}) => {
  navigateWithState(path, {
    preserveParams: true,
    state: { events, members, ...additionalState }
  });
};

// Usage
const goToEventDetail = (eventName) => {
  handleNavigation(`/events/detail/${encodeURIComponent(eventName)}`);
};

const goToOverview = () => {
  handleNavigation('/events/overview');
};
```

### Pattern 3: URL Parameter Components

For components that should reflect state in URLs:

```jsx
function EventsDetail() {
  const { eventId } = useParams();
  const { state } = useAppState();
  const { updateNavigationData } = useURLSync();
  
  // URL parameter handling
  const decodedEventName = decodeURIComponent(eventId);
  
  // State restoration from context
  useEffect(() => {
    if (state.navigationData.events && state.navigationData.members) {
      const contextEvents = state.navigationData.events;
      const contextMembers = state.navigationData.members;
      
      // Check if context data matches current event
      if (contextEvents.length > 0 && contextEvents[0].name === decodedEventName) {
        setEvents(contextEvents);
        setMembers(contextMembers);
        setLoading(false);
        logger.debug('State restored from context');
      }
    }
  }, [state.navigationData, decodedEventName]);
  
  // Context updates on data load
  useEffect(() => {
    if (eventsByName.length > 0) {
      updateNavigationData({
        events: eventsByName,
        members: membersData || [],
        selectedEvent: decodedEventName
      });
    }
  }, [eventsByName, membersData, decodedEventName, updateNavigationData]);
}
```

## Common Migration Scenarios

### Scenario 1: Simple List Component

**Before**: Component loads data independently
**After**: Check context first, fallback to database, update context

### Scenario 2: Detail Component with URL Parameters

**Before**: Relies solely on URL parameters and database
**After**: URL parameters + context state + automatic URL sync

### Scenario 3: Dashboard/Overview Component

**Before**: Passes state via navigation calls
**After**: Multi-source loading + context updates + state preservation

## Testing Migration

### Checklist for Migrated Components

- [ ] **Context Integration**: Component uses `useAppState` properly
- [ ] **URL Synchronization**: Uses `useURLSync` for navigation
- [ ] **Multi-source Loading**: Checks context → router state → database
- [ ] **State Updates**: Calls `updateNavigationData` when loading data
- [ ] **Navigation**: Uses `navigateWithState` with `preserveParams: true`
- [ ] **Error Handling**: Maintains existing error handling patterns
- [ ] **Logging**: Uses structured logging for debugging

### Manual Testing Steps

1. **Direct URL Access**: Navigate directly to component URLs
2. **Browser Navigation**: Test back/forward buttons
3. **Page Refresh**: Verify state persistence after refresh
4. **Multiple Tabs**: Test state synchronization across tabs
5. **Offline Mode**: Verify offline functionality still works

### Automated Testing

```javascript
// Test context integration
test('loads data from context when available', async () => {
  const contextValue = {
    state: {
      navigationData: {
        events: mockEvents,
        members: mockMembers
      }
    }
  };
  
  render(
    <AppStateContext.Provider value={contextValue}>
      <EventsOverview />
    </AppStateContext.Provider>
  );
  
  // Verify data is loaded from context, not database
  expect(screen.getByText(mockEvents[0].name)).toBeInTheDocument();
});
```

## Troubleshooting

### Common Issues

**Issue**: State not persisting across navigation
**Solution**: Ensure `preserveParams: true` and proper `updateNavigationData` calls

**Issue**: URL parameters not syncing
**Solution**: Check `useURLSync` hook implementation and parameter naming

**Issue**: Context not updating
**Solution**: Verify `updateNavigationData` is called after successful data loads

**Issue**: Performance degradation
**Solution**: Check for unnecessary re-renders and implement memoization

### Debug Steps

1. **Check localStorage**: Look for `viking_*` keys in browser storage
2. **Inspect Context**: Use React DevTools to examine context values
3. **Monitor URL Changes**: Watch for parameter updates during navigation
4. **Review Logs**: Check structured logging output for data loading paths

## Best Practices

### Do's ✅

- Always check context first in multi-source loading
- Update context when loading fresh data
- Use `navigateWithState` for all programmatic navigation
- Preserve URL parameters during navigation
- Implement proper error handling for all data sources
- Use structured logging for debugging

### Don'ts ❌

- Don't bypass context for data that might be cached
- Don't forget to call `updateNavigationData` after loading
- Don't use standard `navigate()` for state-dependent navigation
- Don't ignore URL parameters when they should drive state
- Don't remove existing error handling during migration
- Don't skip testing offline functionality

## Migration Timeline

### Phase 1: Core Infrastructure (✅ Complete)
- AppStateContext creation
- useURLSync hook implementation
- AppRouter integration

### Phase 2: Critical Components (✅ Complete)
- EventsDetail component
- EventsOverview component

### Phase 3: Additional Components (Planned)
- EventsRegister component
- EventsCampGroups component
- Dashboard components

### Phase 4: Testing and Optimization (Ongoing)
- Comprehensive testing
- Performance optimization
- Documentation updates

This migration guide ensures consistent implementation across all components while maintaining the offline-first architecture and improving user experience through URL-based navigation.