# Alert Component Migration Guide

This guide covers migrating from the legacy Alert component to the new standardized notification system. The migration is designed to maintain backward compatibility while providing improved functionality and accessibility.

## 🎉 Migration Status Update

**MAJOR MIGRATIONS COMPLETED:**
- ✅ **App.jsx** - All dynamic notifications migrated to NotificationContext
- ✅ **NotificationCenter** - Full history tracking and search implemented  
- ✅ **OfflineIndicator** - Evaluated and kept as AlertAdapter (correct decision)

**CURRENT ARCHITECTURE:**
- 🔔 **NotificationContext** - User-facing notifications with history tracking
- 🏗️ **AlertAdapter** - System-level status indicators and layout banners
- 📋 **Clear decision criteria** - See detailed guide in `/docs/NOTIFICATION_MIGRATION_GUIDE.md`

## Quick Start

### 1. Basic Component Migration

**Before:**
```jsx
import { Alert } from './components/ui';

<Alert variant="success">Operation completed!</Alert>
```

**After:**
```jsx
import { AlertAdapter } from './adapters';

<AlertAdapter variant="success">Operation completed!</AlertAdapter>
```

### 2. Hook-Based Migration

**Before:**
```jsx
import { Alert } from './components/ui';

const [showAlert, setShowAlert] = useState(false);

{showAlert && <Alert variant="error">Error occurred</Alert>}
```

**After:**
```jsx
import { useAlertAdapter } from './adapters';

const { showErrorAlert } = useAlertAdapter();

// In event handler
showErrorAlert("Error occurred");
```

## Migration Approaches

### Approach 1: Direct Component Replacement (Recommended for complex layouts)

Use `AlertAdapter` as a drop-in replacement for Alert components that are part of your component structure:

```jsx
// Before
<Alert variant="warning" dismissible onDismiss={handleDismiss}>
  <Alert.Title>Warning</Alert.Title>
  <Alert.Description>Session will expire soon</Alert.Description>
  <Alert.Actions>
    <button onClick={extendSession}>Extend</button>
    <button onClick={logout}>Logout</button>
  </Alert.Actions>
</Alert>

// After
<AlertAdapter variant="warning" dismissible onDismiss={handleDismiss}>
  <AlertAdapter.Title>Warning</AlertAdapter.Title>
  <AlertAdapter.Description>Session will expire soon</AlertAdapter.Description>
  <AlertAdapter.Actions>
    <button onClick={extendSession}>Extend</button>
    <button onClick={logout}>Logout</button>
  </AlertAdapter.Actions>
</AlertAdapter>
```

### Approach 2: Hook-Based Notifications (Recommended for dynamic notifications)

Use `useAlertAdapter` hook for programmatic notifications:

```jsx
import { useAlertAdapter } from './adapters';

const MyComponent = () => {
  const { showWarningAlert, dismissAlert } = useAlertAdapter();

  const handleWarning = () => {
    const alertId = showWarningAlert("Session will expire soon", {
      title: "Warning",
      actions: [
        { label: "Extend", onClick: extendSession },
        { label: "Logout", onClick: logout }
      ],
      persistent: true
    });
  };

  // ... rest of component
};
```

## Setup Requirements

### 1. NotificationProvider Setup

Wrap your app with `NotificationProvider`:

```jsx
// In your App.jsx or main component
import { NotificationProvider } from './adapters';

function App() {
  return (
    <NotificationProvider>
      {/* Your app content */}
    </NotificationProvider>
  );
}
```

### 2. Import Updates

Update your imports:

```jsx
// Before
import { Alert } from './components/ui';

// After
import { AlertAdapter, useAlertAdapter } from './adapters';
```

## Variant Mapping

### Standard Variants

| Legacy Alert | Notification Type | Hook Method |
|--------------|------------------|-------------|
| `success` | `success` | `showSuccessAlert` |
| `warning` | `warning` | `showWarningAlert` |
| `error` | `error` | `showErrorAlert` |
| `info` | `info` | `showInfoAlert` |

### Scout-Themed Variants

| Legacy Alert | Notification Type | Hook Method |
|--------------|------------------|-------------|
| `scout-blue` | `info` | `showScoutBlueAlert` |
| `scout-green` | `success` | `showScoutGreenAlert` |
| `scout-red` | `error` | `showScoutRedAlert` |
| `scout-orange` | `warning` | `showScoutOrangeAlert` |

### Special Variants

| Legacy Alert | Notification Type | Hook Method |
|--------------|------------------|-------------|
| `neutral` | `info` | `showInfoAlert` |
| `dark` | `custom` | `showAlert` |

## Property Mapping

### AlertAdapter Props

| Legacy Alert Prop | AlertAdapter Prop | Notes |
|-------------------|------------------|-------|
| `variant` | `variant` | Same values supported |
| `dismissible` | `dismissible` | Same behavior |
| `onDismiss` | `onDismiss` | Same callback signature |
| `icon` | `icon` | Same behavior |
| `size` | `size` | Supported for compatibility |
| `className` | `className` | Applied to notification wrapper |
| - | `useToast` | New: Render as toast instead of banner |

### Hook Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `variant` | `string` | `'info'` | Notification variant |
| `message` | `string` | Required | Main notification message |
| `title` | `string` | - | Optional title |
| `description` | `string` | - | Optional description |
| `actions` | `Array` | `[]` | Action buttons |
| `dismissible` | `boolean` | `false` | Can be dismissed |
| `persistent` | `boolean` | `!dismissible` | Stays visible until dismissed |
| `duration` | `number` | `5000` | Auto-dismiss duration (if not persistent) |
| `icon` | `boolean` | `true` | Show notification icon |
| `useToast` | `boolean` | `false` | Render as toast vs banner |

## Migration Patterns

### 1. Form Validation Errors

**Before:**
```jsx
{errors.email && (
  <Alert variant="error" className="mt-2">
    {errors.email}
  </Alert>
)}
```

**After (Component Approach):**
```jsx
{errors.email && (
  <AlertAdapter variant="error" className="mt-2" useToast>
    {errors.email}
  </AlertAdapter>
)}
```

**After (Hook Approach):**
```jsx
// In form validation
const { showErrorAlert } = useAlertAdapter();

useEffect(() => {
  if (errors.email) {
    showErrorAlert(errors.email, { useToast: true });
  }
}, [errors.email, showErrorAlert]);
```

### 2. Success Confirmations

**Before:**
```jsx
{isSuccess && (
  <Alert variant="success" dismissible>
    Data saved successfully!
  </Alert>
)}
```

**After (Hook Approach - Recommended):**
```jsx
const { showSuccessAlert } = useAlertAdapter();

// On successful operation
if (isSuccess) {
  showSuccessAlert("Data saved successfully!", { 
    dismissible: true, 
    useToast: true 
  });
}
```

### 3. System Banners

**Before:**
```jsx
<Alert variant="warning" className="mb-4">
  <Alert.Title>Maintenance Notice</Alert.Title>
  <Alert.Description>
    System maintenance scheduled for tonight.
  </Alert.Description>
</Alert>
```

**After (Component Approach - Recommended):**
```jsx
<AlertAdapter variant="warning" className="mb-4" persistent>
  <AlertAdapter.Title>Maintenance Notice</AlertAdapter.Title>
  <AlertAdapter.Description>
    System maintenance scheduled for tonight.
  </AlertAdapter.Description>
</AlertAdapter>
```

### 4. Error Boundaries

**Before:**
```jsx
<Alert variant="error">
  <strong>Something went wrong</strong>
  <p>Error in {componentName} component</p>
</Alert>
```

**After:**
```jsx
<AlertAdapter variant="error" persistent>
  <AlertAdapter.Title>Something went wrong</AlertAdapter.Title>
  <AlertAdapter.Description>
    Error in {componentName} component
  </AlertAdapter.Description>
</AlertAdapter>
```

## Advanced Migration Scenarios

### 1. Custom Action Handlers

**Before:**
```jsx
<Alert variant="info">
  <Alert.Actions>
    <button onClick={handleAccept}>Accept</button>
    <button onClick={handleDecline}>Decline</button>
  </Alert.Actions>
</Alert>
```

**After (Component):**
```jsx
<AlertAdapter variant="info">
  <AlertAdapter.Actions>
    <button onClick={handleAccept}>Accept</button>
    <button onClick={handleDecline}>Decline</button>
  </AlertAdapter.Actions>
</AlertAdapter>
```

**After (Hook):**
```jsx
const { showInfoAlert } = useAlertAdapter();

showInfoAlert("Please make a choice", {
  actions: [
    { label: "Accept", onClick: handleAccept },
    { label: "Decline", onClick: handleDecline }
  ]
});
```

### 2. Scout-Themed Notifications

**Before:**
```jsx
<Alert variant="scout-green">
  <Alert.Title>Achievement Unlocked!</Alert.Title>
  <Alert.Description>You've completed the activity</Alert.Description>
</Alert>
```

**After (Component):**
```jsx
<AlertAdapter variant="scout-green">
  <AlertAdapter.Title>Achievement Unlocked!</AlertAdapter.Title>
  <AlertAdapter.Description>You've completed the activity</AlertAdapter.Description>
</AlertAdapter>
```

**After (Hook):**
```jsx
const { showScoutGreenAlert } = useAlertAdapter();

showScoutGreenAlert("You've completed the activity", {
  title: "Achievement Unlocked!",
  useToast: true
});
```

### 3. Conditional Notifications

**Before:**
```jsx
{networkError && (
  <Alert variant="error" dismissible onDismiss={() => setNetworkError(null)}>
    <Alert.Title>Connection Error</Alert.Title>
    <Alert.Description>
      Unable to connect to server. Please check your connection.
    </Alert.Description>
    <Alert.Actions>
      <button onClick={retryConnection}>Retry</button>
    </Alert.Actions>
  </Alert>
)}
```

**After (Hook Approach - Recommended):**
```jsx
const { showErrorAlert, dismissAlert } = useAlertAdapter();

useEffect(() => {
  let alertId;
  if (networkError) {
    alertId = showErrorAlert("Unable to connect to server. Please check your connection.", {
      title: "Connection Error",
      dismissible: true,
      actions: [
        { label: "Retry", onClick: retryConnection }
      ]
    });
  }
  
  return () => {
    if (alertId) dismissAlert(alertId);
  };
}, [networkError, showErrorAlert, dismissAlert, retryConnection]);
```

## Component vs Hook Decision Guide

### Use AlertAdapter Component When:

- ✅ Alert is part of your component's static structure
- ✅ Alert needs to be positioned within specific layout containers
- ✅ You're doing a minimal migration with existing component structure
- ✅ Alert is tied to component state (like form validation that shows/hides)

### Use useAlertAdapter Hook When:

- ✅ Alert is triggered by user actions or events
- ✅ You want centralized notification management
- ✅ Alert should appear as overlay (toast/banner)
- ✅ Multiple components need to trigger similar notifications
- ✅ Alert is temporary feedback (success, error messages)

## Troubleshooting

### 1. NotificationProvider Missing

**Error:** "useNotification must be used within a NotificationProvider"

**Solution:** Ensure your app is wrapped with NotificationProvider:

```jsx
// In your root App component
import { NotificationProvider } from './adapters';

function App() {
  return (
    <NotificationProvider>
      {/* Your components */}
    </NotificationProvider>
  );
}
```

### 2. Scout Variants Not Showing

**Issue:** Scout-themed variants look like standard variants

**Solution:** Ensure you have the scout color classes in your Tailwind config:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'scout-blue': {
          DEFAULT: '#003f5c',
          light: '#4a90a4',
          dark: '#002635'
        },
        'scout-green': {
          DEFAULT: '#2f7d32',
          light: '#60ad5e',
          dark: '#1b5e20'
        },
        'scout-red': {
          DEFAULT: '#c62828',
          light: '#ff5f52',
          dark: '#8e0000'
        },
        'scout-orange': {
          DEFAULT: '#ef6c00',
          light: '#ff9d3f',
          dark: '#b53d00'
        }
      }
    }
  }
}
```

### 3. Actions Not Working

**Issue:** Action buttons not responding

**Solution:** Ensure action objects have correct structure:

```jsx
// Correct format
const actions = [
  { label: "Button Text", onClick: () => console.log("clicked") }
];

// Incorrect - missing onClick
const badActions = [
  { label: "Button Text" }
];
```

### 4. Performance Issues

**Issue:** Too many notifications or re-renders

**Solution:** Use notification removal and debouncing:

```jsx
const { showErrorAlert, dismissAlert } = useAlertAdapter();
const alertRef = useRef();

const showError = useCallback(
  debounce((message) => {
    if (alertRef.current) {
      dismissAlert(alertRef.current);
    }
    alertRef.current = showErrorAlert(message);
  }, 300),
  [showErrorAlert, dismissAlert]
);
```

## Testing Migration

### Component Testing

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationProvider } from './adapters';
import MyComponent from './MyComponent';

const renderWithProvider = (component) => {
  return render(
    <NotificationProvider>
      {component}
    </NotificationProvider>
  );
};

test('shows error notification', () => {
  renderWithProvider(<MyComponent />);
  
  // Trigger error
  fireEvent.click(screen.getByText('Trigger Error'));
  
  // Check notification appears
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByText('Error message')).toBeInTheDocument();
});
```

### Hook Testing

```jsx
import { renderHook, act } from '@testing-library/react';
import { useAlertAdapter } from './adapters';
import { NotificationProvider } from './adapters';

const wrapper = ({ children }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

test('shows alert via hook', () => {
  const { result } = renderHook(() => useAlertAdapter(), { wrapper });
  
  act(() => {
    result.current.showSuccessAlert('Test message');
  });
  
  // Test that notification was triggered
  // (You'll need to spy on the notification context or test integration)
});
```

## Migration Checklist

### Phase 1: Setup
- [ ] Add `NotificationProvider` to app root
- [ ] Install/verify notification system dependencies
- [ ] Update import statements

### Phase 2: Component Migration
- [ ] Replace simple Alert components with AlertAdapter
- [ ] Convert compound Alert components (Title, Description, Actions)
- [ ] Update scout-themed Alert variants
- [ ] Test dismissible behavior

### Phase 3: Hook Migration
- [ ] Convert dynamic/conditional Alerts to hooks
- [ ] Replace form validation Alerts with hook calls
- [ ] Migrate success/error feedback to hooks
- [ ] Test action button functionality

### Phase 4: Testing & Cleanup
- [ ] Test all notification scenarios
- [ ] Verify accessibility (screen readers)
- [ ] Check mobile/responsive behavior
- [ ] Remove unused Alert imports
- [ ] Update component documentation

### Phase 5: Advanced Features
- [ ] Implement notification history (if needed)
- [ ] Add notification preferences (if needed)
- [ ] Integrate with user settings
- [ ] Performance optimization

## Best Practices

### 1. Notification Hierarchy

Use appropriate notification types based on urgency:

- **Toast notifications**: Temporary feedback, success confirmations
- **Banner notifications**: System status, warnings, persistent info
- **Inline alerts**: Form validation, contextual errors

### 2. Message Guidelines

- Keep messages concise and actionable
- Use active voice
- Provide clear next steps when possible
- Avoid technical jargon for user-facing messages

### 3. Action Buttons

- Limit to 2-3 actions maximum
- Use clear, action-oriented labels
- Provide a clear primary action
- Consider dismissal behavior

### 4. Accessibility

- Ensure proper ARIA attributes (handled automatically)
- Test with screen readers
- Provide keyboard navigation support
- Use appropriate color contrast

### 5. Performance

- Avoid showing multiple identical notifications
- Clean up notifications on component unmount
- Use debouncing for rapid-fire notifications
- Consider notification queuing for high-frequency events

## 🚀 New: Decision Framework for Migrations

**For new development or component evaluation, use our decision framework:**

### Quick Decision Tree
```
Is this a notification?
├─ YES: User-facing message → Use NotificationContext
└─ NO: System-level status → Use AlertAdapter
```

### When to Use NotificationContext
- ✅ User operation feedback (save, delete, sync)
- ✅ Event-driven notifications and alerts
- ✅ Messages that need history tracking
- ✅ Dismissible overlay notifications

### When to Keep AlertAdapter
- ✅ System status banners (like OfflineIndicator)
- ✅ Persistent layout-integrated components
- ✅ Fixed positioning requirements
- ✅ Modal workflow integration

**📚 Comprehensive Guide:** See [NOTIFICATION_MIGRATION_GUIDE.md](./docs/NOTIFICATION_MIGRATION_GUIDE.md) for detailed decision criteria, code examples, and architectural guidelines.

## Additional Resources

- [Notification Context API Reference](./src/contexts/notifications/NotificationContext.tsx)
- [AlertAdapter Component API](./src/components/ui/AlertAdapter.jsx)
- [useAlertAdapter Hook API](./src/hooks/useAlertAdapter.jsx)
- [Migration Utilities](./src/utils/alertMigration.jsx)
- [Notification Styles Guide](./src/components/notifications/NotificationStyles.tsx)
- **[Complete Migration Guide](./docs/NOTIFICATION_MIGRATION_GUIDE.md)** ⭐

---

**Need Help?** Check the examples in the [adapters index file](./src/adapters/index.js) for complete code samples and migration patterns.