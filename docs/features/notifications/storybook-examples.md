---
title: "Notification Storybook Examples"
description: "Interactive examples and best practices for notification components"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["notifications", "storybook", "examples", "development"]
related_docs: ["README.md", "implementation-guide.md", "best-practices.md"]
---

# Notification Storybook Examples

This document provides links and explanations for the interactive Storybook examples that demonstrate notification system usage and best practices.

## 🚀 Getting Started with Storybook

### Storybook Configuration
Storybook is fully configured for the project with comprehensive notification examples and all dependencies are installed.

### Running Storybook
```bash
# Start Storybook development server
npm run storybook

# Build Storybook for production
npm run build-storybook
```

The configuration exists in `.storybook/` and stories are available in `src/stories/`. Storybook will start on `http://localhost:6006/`.

## 📚 Available Stories

### Core Notification Stories

#### 1. **Toast.stories.tsx**
**Interactive toast notification examples**
- Basic toast types (success, error, warning, info)
- Auto-dismiss timing configurations
- Swipe-to-dismiss interactions
- Mobile-optimized positioning
- Accessibility features

**Key Examples:**
- Success confirmations
- Error handling
- Progress updates
- Offline status notifications

#### 2. **Banner.stories.tsx** 
**Persistent banner notification examples**
- System status banners
- Ongoing process indicators
- Dismissible vs persistent banners
- Action button integration

**Key Examples:**
- "You're offline" status
- "Syncing data..." progress
- "New version available" updates
- Critical system alerts

#### 3. **AlertAdapter.stories.tsx**
**Modal alert dialog examples**
- Confirmation dialogs
- Error alerts requiring action
- Custom action buttons
- Legacy compatibility patterns

**Key Examples:**
- Delete confirmations
- Permission requests
- Critical error handling
- Data loss warnings

### Advanced Usage Stories

#### 4. **NotificationPlayground.stories.tsx**
**Interactive playground for testing combinations**
- Multiple notification types simultaneously
- Queue management demonstration
- Performance testing with many notifications
- Custom styling examples

#### 5. **MigrationGuide.stories.tsx**
**Before/after migration examples**
- Legacy alert patterns (deprecated)
- New notification system equivalents
- Step-by-step migration examples
- Side-by-side comparisons

#### 6. **ComplexScenarios.stories.tsx**
**Real-world usage patterns**
- Form validation with notifications
- Multi-step process feedback
- Error recovery workflows
- Offline/online state transitions

### Specialized Stories

#### 7. **ResponsiveBehavior.stories.tsx**
**Mobile and responsive design examples**
- Phone vs tablet layouts
- Portrait vs landscape orientations
- Touch interaction patterns
- Safe area considerations

#### 8. **Accessibility.stories.tsx**
**Accessibility feature demonstrations**
- Screen reader announcements
- Keyboard navigation
- High contrast mode
- Reduced motion preferences

#### 9. **AnimationTransitions.stories.tsx**
**Animation and transition examples**
- Enter/exit animations
- Smooth state transitions
- Performance optimizations
- Custom animation configurations

#### 10. **NotificationContainers.stories.tsx**
**Container component examples**
- ToastContainer positioning
- BannerContainer integration
- Z-index management
- Multiple container scenarios

#### 11. **NotificationHistory.stories.tsx**
**Notification history and management**
- Notification queue visualization
- History tracking
- Cleanup and memory management
- Debug information display

## 🎯 Key Learning Examples

### Basic Implementation Pattern
```tsx
// From Toast.stories.tsx
const { toast } = useNotificationUtils();

const handleSuccess = () => {
  toast.success('Event saved successfully!', {
    duration: 3000,
    dismissible: true
  });
};
```

### Advanced Banner Usage
```tsx
// From Banner.stories.tsx
const { banner } = useNotificationUtils();

const showOfflineStatus = () => {
  banner.warning('You are currently offline', {
    persistent: true,
    id: 'offline-status',
    action: {
      label: 'Retry',
      onClick: () => attemptReconnection()
    }
  });
};
```

### Modal Alert Patterns
```tsx
// From AlertAdapter.stories.tsx
const { alert } = useNotificationUtils();

const confirmDelete = () => {
  alert.confirm({
    title: 'Delete Event',
    description: 'This action cannot be undone. Are you sure?',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    variant: 'destructive',
    onConfirm: () => deleteEvent(),
    onCancel: () => console.log('Cancelled')
  });
};
```

## 🔧 Development Workflow

### Using Stories for Development
1. **Start Storybook**: `npm run storybook`
2. **Find relevant story**: Browse by component or use case
3. **Interact with controls**: Modify props in real-time
4. **Copy code examples**: Use the "Show code" feature
5. **Test edge cases**: Use playground stories for complex scenarios

### Creating New Stories
When adding new notification patterns:
1. Create story in `src/stories/`
2. Follow existing naming conventions
3. Include accessibility examples
4. Add mobile-specific variants
5. Document in this guide

### Testing with Stories
- **Visual Testing**: Verify appearance across devices
- **Interaction Testing**: Test touch and keyboard interactions
- **Accessibility Testing**: Use screen reader and keyboard navigation
- **Performance Testing**: Monitor with many simultaneous notifications

## 📱 Mobile-Specific Examples

### Touch Interactions
Stories demonstrate:
- Swipe-to-dismiss gestures
- Touch-friendly button sizes
- Safe area handling
- Orientation changes

### Performance Considerations
Examples show:
- Efficient rendering patterns
- Memory cleanup
- Animation performance
- Queue management

## 🐛 Debugging with Stories

### Debug Mode
Enable debug logging in stories:
```tsx
<NotificationProvider debug={true}>
  {/* Story content */}
</NotificationProvider>
```

### Common Issues
Stories help identify:
- Z-index conflicts
- Animation glitches
- Accessibility problems
- Mobile layout issues

## 📈 Migration Examples

The **MigrationGuide.stories.tsx** provides comprehensive before/after examples:

### Legacy Pattern (Don't Use)
```tsx
// Old alert pattern
if (window.confirm('Delete this event?')) {
  deleteEvent();
}
```

### New Pattern (Recommended)
```tsx
// New notification system
alert.confirm({
  title: 'Delete Event',
  description: 'This action cannot be undone.',
  onConfirm: () => deleteEvent()
});
```

## 🎨 Customization Examples

Stories demonstrate:
- Custom styling approaches
- Theme integration
- Brand color usage
- Animation customization

---

*Storybook configuration and stories are available but dependencies need to be installed. The stories provide comprehensive examples of notification patterns and usage.*