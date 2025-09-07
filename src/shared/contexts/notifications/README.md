# Viking Event Management - Notification System

A comprehensive, accessible, and mobile-first notification system for React applications. This system provides Toast and Banner components with full TypeScript support, accessibility features, and seamless integration with the Viking Event Management mobile application.

## 🚀 Features

- **📱 Mobile-First Design**: Optimized positioning and responsive behavior
- **♿ Accessibility**: Full WCAG compliance with screen reader support and keyboard navigation
- **🎨 Customizable**: Support for different types, icons, and Scout-themed variants
- **⚡ Performance**: Efficient rendering with automatic cleanup
- **🔄 Migration Support**: Drop-in replacement for legacy Alert components via AlertAdapter
- **🎯 Developer Experience**: Intuitive API with TypeScript support and comprehensive examples

## 📦 Installation

The notification system is already integrated into the Viking Event Management mobile app. To use it in your components:

```typescript
import { useNotification } from '@/contexts/notifications/NotificationContext';
import { useNotificationUtils } from '@/contexts/notifications/notificationUtils';
// or use the adapters for legacy code
import { AlertAdapter } from '@/adapters';
```

## 🏃‍♂️ Quick Start

### Basic Usage

```typescript
import React from 'react';
import { useNotificationUtils } from '@/contexts/notifications/notificationUtils';

const MyComponent = () => {
  const { toast, banner } = useNotificationUtils();

  const handleSuccess = () => {
    toast.success('Operation completed successfully!');
  };

  const handleError = () => {
    toast.error('Something went wrong', {
      actions: [
        { label: 'Retry', onClick: () => retryOperation() }
      ]
    });
  };

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
    </div>
  );
};
```

### Legacy Alert Migration

```typescript
// Before (legacy Alert)
import { Alert } from './ui';

<Alert variant="error">
  <Alert.Title>Error Loading Data</Alert.Title>
  <Alert.Description>Unable to fetch user information</Alert.Description>
  <Alert.Actions>
    <Button onClick={retry}>Retry</Button>
  </Alert.Actions>
</Alert>

// After (using AlertAdapter - drop-in replacement)
import { AlertAdapter } from '../adapters';

<AlertAdapter variant="error">
  <AlertAdapter.Title>Error Loading Data</AlertAdapter.Title>
  <AlertAdapter.Description>Unable to fetch user information</AlertAdapter.Description>
  <AlertAdapter.Actions>
    <Button onClick={retry}>Retry</Button>
  </AlertAdapter.Actions>
</AlertAdapter>
```

## 📋 Core Components

### 1. NotificationProvider

Wrap your application with the NotificationProvider to enable the notification system.

```typescript
import { NotificationProvider } from '@/contexts/notifications/NotificationContext';

function App() {
  return (
    <NotificationProvider>
      <YourAppContent />
    </NotificationProvider>
  );
}
```

### 2. Toast Notifications

Temporary notifications that appear at the corner of the screen. Perfect for status updates and feedback.

```typescript
const { toast } = useNotificationUtils();

// Different types
toast.success('Data saved successfully!');
toast.error('Failed to load data');
toast.warning('Session expires in 5 minutes');
toast.info('New features available');

// With custom options
toast.error('Critical error', {
  duration: 0, // Persistent (won't auto-dismiss)
  actions: [
    { label: 'Retry', onClick: () => retry() },
    { label: 'Report', onClick: () => reportError() }
  ]
});
```

### 3. Banner Notifications

Persistent notifications that appear at the top of content areas. Ideal for system-wide messages.

```typescript
const { banner } = useNotificationUtils();

// Basic banners
banner.success('Sync completed successfully');
banner.error('Unable to connect to server. Working offline.');

// With actions
banner.warning('Update available', {
  actions: [
    { label: 'Update Now', onClick: () => startUpdate() },
    { label: 'Later', onClick: () => dismissUpdate() }
  ]
});
```

## 🎛️ API Reference

### Notification Interface

```typescript
interface Notification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success' | 'custom';
  message: string;
  icon?: React.ReactNode;
  duration?: number; // milliseconds, 0 = persistent
  actions?: Array<{ label: string, onClick: () => void }>;
  persistent?: boolean; // overrides duration
  timestamp: number;
}
```

### useNotification Hook

Core hook for direct notification management:

```typescript
const {
  notifications,     // Current notifications array
  notify,            // Create custom notification
  notifyError,       // Quick error notification
  notifyWarning,     // Quick warning notification  
  notifyInfo,        // Quick info notification
  notifySuccess,     // Quick success notification
  remove,            // Remove specific notification
  removeAll          // Clear all notifications
} = useNotification();
```

### useNotificationUtils Hook

High-level utility hook with predefined patterns:

```typescript
const {
  toast: {
    success,    // Toast success message
    error,      // Toast error message
    warning,    // Toast warning message
    info        // Toast info message
  },
  banner: {
    success,    // Banner success message
    error,      // Banner error message
    warning,    // Banner warning message
    info        // Banner info message
  },
  formSubmission: {
    success,    // Form success handler
    error       // Form error handler
  }
} = useNotificationUtils();
```

### AlertAdapter Component

Legacy Alert component replacement:

```typescript
interface AlertAdapterProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'scout-blue' | 'scout-green' | 'scout-red' | 'scout-orange';
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: boolean | React.ReactNode;
  className?: string;
  useToast?: boolean; // Use toast instead of banner
  persistent?: boolean;
}

// Compound components
AlertAdapter.Title      // Maps to notification title
AlertAdapter.Description // Maps to notification message
AlertAdapter.Actions    // Maps to notification actions
```

## 🎨 Styling & Theming

### Scout-Themed Variants

The system includes special Scout-themed variants that maintain brand consistency:

```typescript
// Scout-themed notifications
toast.success('Achievement unlocked!'); // Uses scout-green internally
banner.info('Scout information', { variant: 'scout-blue' });

// Available scout variants
- scout-blue:   Scout information and general messages
- scout-green:  Success and achievements  
- scout-red:    Errors and alerts
- scout-orange: Warnings and cautions
```

### Custom Styling

Notifications use TailwindCSS classes and support dark mode:

```typescript
// Custom icons and styling
toast.success('Custom notification', {
  icon: <CustomIcon className="w-5 h-5" />,
  className: 'custom-notification-class'
});
```

## ♿ Accessibility Features

### Screen Reader Support

- Notifications are announced with appropriate ARIA live regions
- Screen reader text provides context about notification type
- Important notifications use `role="alert"` for immediate attention

### Keyboard Navigation

- Press `Escape` to dismiss dismissible notifications
- Action buttons are keyboard accessible
- Focus management ensures keyboard users aren't lost

### WCAG Compliance

- Sufficient color contrast ratios
- Non-color-dependent information (icons + text)
- Timing controls for auto-dismissing notifications
- Keyboard alternatives for all mouse interactions

```typescript
// Accessibility example
toast.error('Form validation failed', {
  // Screen reader will announce: "Error notification: Form validation failed"
  actions: [
    { label: 'Review Form', onClick: () => focusFirstError() } // Accessible action
  ]
});
```

## 📱 Mobile Considerations

### Positioning

- **Mobile**: Toasts appear at the bottom, banners at the top
- **Desktop**: Toasts at top-right, banners at the top
- Responsive positioning based on screen size

### Touch Interactions

- Swipe to dismiss on mobile devices
- Touch-friendly action button sizes (min 44px)
- Appropriate spacing for thumb navigation

## 🔄 Migration Guide

### Migrating from Legacy Alert Components

1. **Simple Replacement**:
```typescript
// Before
<Alert variant="success">Success message</Alert>

// After  
<AlertAdapter variant="success">Success message</AlertAdapter>
```

2. **Complex Component Migration**:
```typescript
// Before
<Alert variant="danger" dismissible onDismiss={handleDismiss}>
  <Alert.Title>Error</Alert.Title>
  <Alert.Description>Something went wrong</Alert.Description>
  <Alert.Actions>
    <Button onClick={retry}>Retry</Button>
  </Alert.Actions>
</Alert>

// After
<AlertAdapter variant="error" dismissible onDismiss={handleDismiss}>
  <AlertAdapter.Title>Error</AlertAdapter.Title>
  <AlertAdapter.Description>Something went wrong</AlertAdapter.Description>
  <AlertAdapter.Actions>
    <Button onClick={retry}>Retry</Button>
  </AlertAdapter.Actions>
</AlertAdapter>
```

3. **Utility Hook Migration**:
```typescript
// Before (custom notification code)
const showError = (message: string) => {
  setErrorMessage(message);
  setShowError(true);
  setTimeout(() => setShowError(false), 5000);
};

// After
const { toast } = useNotificationUtils();
const showError = (message: string) => {
  toast.error(message);
};
```

### Common Migration Patterns

| Legacy Pattern | New Pattern | Notes |
|---|---|---|
| `variant="danger"` | `variant="error"` | Standardized naming |
| Custom toast implementation | `useNotificationUtils().toast` | Unified API |
| Manual timeout handling | Built-in duration management | Automatic cleanup |
| Custom error display | `formSubmission.error()` | Form-specific patterns |

## 🧪 Testing

### Testing Notifications

```typescript
import { render, screen } from '@testing-library/react';
import { NotificationProvider } from '@/contexts/notifications/NotificationContext';

const TestWrapper = ({ children }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

test('shows success notification', async () => {
  render(
    <TestWrapper>
      <MyComponent />
    </TestWrapper>
  );
  
  // Test notification appears
  fireEvent.click(screen.getByText('Save'));
  expect(await screen.findByText('Data saved successfully')).toBeInTheDocument();
});
```

### Mocking Notifications

```typescript
// Mock the notification context
vi.mock('@/contexts/notifications/NotificationContext', () => ({
  useNotification: () => ({
    notify: vi.fn(),
    remove: vi.fn(),
    notifications: []
  })
}));
```

## 🎯 Best Practices

### When to Use Toast vs Banner

**Use Toasts for:**
- Status feedback (success/error after actions)
- Temporary information
- Non-critical alerts
- Progress updates

**Use Banners for:**
- System-wide messages
- Critical errors requiring immediate attention  
- Persistent status (offline mode, maintenance)
- Information affecting the entire session

### Message Guidelines

1. **Keep it concise**: Aim for under 50 characters
2. **Be specific**: "Failed to save event details" vs "Error occurred"
3. **Provide actions**: Always offer next steps for errors
4. **Use consistent tone**: Match your app's voice

### Performance Tips

1. **Limit notification count**: Default max is 5 simultaneous notifications
2. **Use appropriate durations**: Short for simple messages, longer for complex ones
3. **Avoid notification spam**: Debounce rapid-fire notifications
4. **Clean up**: Remove notifications when components unmount

## 🔧 Advanced Usage

### Custom Notification Types

```typescript
// Create custom notification with full control
const { notify } = useNotification();

notify({
  type: 'custom',
  message: 'Custom notification',
  icon: <CustomIcon />,
  duration: 8000,
  actions: [
    { label: 'Action 1', onClick: () => {} },
    { label: 'Action 2', onClick: () => {} }
  ]
});
```

### Global Error Handling Integration

```typescript
// Set up global error handler
window.addEventListener('error', (event) => {
  const { toast } = useNotificationUtils();
  toast.error('An unexpected error occurred', {
    actions: [
      { label: 'Report', onClick: () => reportError(event.error) }
    ]
  });
});
```

### Form Integration

```typescript
const { formSubmission } = useNotificationUtils();

const handleSubmit = async (data) => {
  try {
    await submitForm(data);
    formSubmission.success('Form submitted successfully!');
  } catch (error) {
    formSubmission.error(error); // Automatically extracts error message
  }
};
```

## 📚 Examples

For comprehensive examples covering real-world scenarios, see [examples.md](./examples.md).

## 🤝 Contributing

When adding new notification patterns:

1. Consider accessibility implications
2. Test on both mobile and desktop
3. Add TypeScript definitions
4. Include examples in documentation
5. Test with screen readers

## 📄 License

Part of the Viking Event Management mobile application.

---

For questions or issues, please consult the existing examples or reach out to the development team.