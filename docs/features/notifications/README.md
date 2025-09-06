---
title: "Notification System Overview"
description: "Comprehensive notification system with toast, banner, and alert components"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["notifications", "toast", "banner", "alerts", "ui"]
related_docs: ["implementation-guide.md", "migration-guide.md", "best-practices.md"]
---

# Notification System Overview

The Vikings Event Management app features a comprehensive notification system designed for mobile-first interactions with three distinct notification types: **Toast**, **Banner**, and **Alert** notifications.

## 🎯 Notification Types

### 🍞 Toast Notifications
**Temporary, non-blocking messages for user feedback**
- **Use Case**: Success confirmations, info messages, warnings
- **Behavior**: Auto-dismiss after timeout, swipe to dismiss
- **Position**: Bottom of screen (mobile-optimized)
- **Examples**: "Event saved successfully", "Offline mode active"

### 📢 Banner Notifications  
**Persistent, contextual messages for ongoing states**
- **Use Case**: System status, ongoing processes, important context
- **Behavior**: Persist until manually dismissed or condition changes
- **Position**: Top of screen, below navigation
- **Examples**: "Syncing data...", "You're offline", "New version available"

### ⚠️ Alert Notifications
**Modal dialogs for critical actions requiring user decision**
- **Use Case**: Confirmations, errors requiring action, important warnings
- **Behavior**: Blocks interaction until dismissed
- **Position**: Center overlay with backdrop
- **Examples**: "Delete event?", "Connection lost", "Permission required"

## 🏗️ System Architecture

### Core Components
```
NotificationProvider (Context)
├── ToastContainer
├── BannerContainer  
└── AlertAdapter (Legacy compatibility)
```

### Key Features
- **🎨 Consistent Design**: Unified styling across all notification types
- **📱 Mobile Optimized**: Touch-friendly interactions and positioning
- **♿ Accessible**: ARIA labels, keyboard navigation, screen reader support
- **🔄 State Management**: Centralized notification state with React Context
- **⚡ Performance**: Efficient rendering with minimal re-renders
- **🎭 Animation**: Smooth enter/exit transitions

## 🚀 Quick Start

### Basic Usage
```tsx
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';

function MyComponent() {
  const { toast, banner, alert } = useNotificationUtils();

  const handleSuccess = () => {
    toast.success('Operation completed successfully!');
  };

  const handleWarning = () => {
    banner.warning('You are currently offline', { 
      persistent: true 
    });
  };

  const handleConfirmation = () => {
    alert.confirm({
      title: 'Delete Event',
      description: 'This action cannot be undone.',
      onConfirm: () => deleteEvent()
    });
  };

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleWarning}>Show Warning</button>
      <button onClick={handleConfirmation}>Show Confirmation</button>
    </div>
  );
}
```

### Provider Setup
```tsx
import { NotificationProvider } from '../contexts/notifications/NotificationContext';
import ToastContainer from '../components/notifications/ToastContainer';
import BannerContainer from '../components/notifications/BannerContainer';

function App() {
  return (
    <NotificationProvider>
      <BannerContainer />
      <main>
        {/* Your app content */}
      </main>
      <ToastContainer />
    </NotificationProvider>
  );
}
```

## 📚 Documentation

### Implementation Guides
- [Implementation Guide](implementation-guide.md) - Detailed implementation instructions
- [Migration Guide](migration-guide.md) - Migrating from legacy alert system
- [Best Practices](best-practices.md) - Development guidelines and patterns

### Developer Resources
- [Storybook Examples](storybook-examples.md) - Interactive component examples
- **Live Examples**: Run `npm run storybook` to see all notification patterns
- **Source Code**: `src/components/notifications/` and `src/contexts/notifications/`

## 🎨 Design System Integration

The notification system integrates seamlessly with the app's design system:
- **Colors**: Uses semantic color tokens (success, warning, error, info)
- **Typography**: Consistent with app typography scale
- **Spacing**: Follows 8px grid system
- **Animations**: Smooth transitions with reduced motion support
- **Dark Mode**: Automatic theme adaptation

## 🔧 Advanced Features

### Notification Queue Management
- **Smart Queuing**: Prevents notification spam
- **Priority Handling**: Critical notifications take precedence
- **Duplicate Prevention**: Automatic deduplication of similar messages

### Accessibility Features
- **Screen Reader Support**: Proper ARIA announcements
- **Keyboard Navigation**: Full keyboard accessibility
- **Reduced Motion**: Respects user motion preferences
- **High Contrast**: Maintains visibility in high contrast mode

### Performance Optimizations
- **Lazy Loading**: Components load only when needed
- **Memory Management**: Automatic cleanup of dismissed notifications
- **Efficient Rendering**: Minimal re-renders with optimized state updates

## 🐛 Troubleshooting

### Common Issues
- **Notifications not appearing**: Check NotificationProvider setup
- **Styling issues**: Verify TailwindCSS configuration
- **Performance problems**: Review notification frequency and cleanup

### Debug Mode
Enable debug logging in development:
```tsx
<NotificationProvider debug={true}>
```

## 📈 Migration Status

The notification system has been fully migrated from legacy alert patterns:
- ✅ **Toast System**: Complete with mobile optimizations
- ✅ **Banner System**: Implemented with persistent state management  
- ✅ **Alert System**: Legacy compatibility maintained
- ✅ **Storybook Documentation**: Comprehensive examples available
- ✅ **Accessibility**: Full WCAG compliance
- ✅ **Testing**: Unit tests and integration tests complete

---

*For detailed implementation instructions, see the [Implementation Guide](implementation-guide.md).*