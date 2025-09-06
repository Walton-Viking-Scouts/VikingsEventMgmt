# Notification System Migration Guide

## Overview

This guide provides clear decision criteria for choosing between the **NotificationContext system** and **AlertAdapter** when implementing notifications in the Viking Event Management application.

## Quick Decision Tree

```
Is this a notification?
├─ YES: User-facing message about app events/status
│   ├─ Does user need to search/review this later? → Use NotificationContext
│   ├─ Is this triggered by user actions? → Use NotificationContext  
│   └─ Is this app-level feedback? → Use NotificationContext
│
└─ NO: System-level UI component
    ├─ Persistent system status banner? → Use AlertAdapter
    ├─ Fixed layout element? → Use AlertAdapter
    └─ System health indicator? → Use AlertAdapter
```

## Migration Decisions Made

### ✅ Migrated to NotificationContext

| Component | Status | Rationale |
|-----------|--------|-----------|
| **App.jsx notifications** | ✅ Complete | User-facing feedback, needs history tracking |
| **Dynamic user alerts** | ✅ Complete | Event-driven notifications, searchable |
| **Operation feedback** | ✅ Complete | Success/error messages, dismissible |

### ✅ Kept as AlertAdapter  

| Component | Status | Rationale |
|-----------|--------|-----------|
| **OfflineIndicator** | ✅ Evaluated | System status banner, persistent display |
| **System health banners** | ✅ Keep | Layout-integrated, not user notifications |
| **Authentication prompts** | ✅ Keep | Modal workflows, system-level UI |

## Detailed Decision Criteria

### Use NotificationContext When:

✅ **User-Generated or User-Facing Content**
- Operation feedback (save, delete, sync)
- Error messages from user actions
- Success confirmations
- Warning messages about user data

✅ **History Tracking Needed**
- Users might want to review past notifications
- Debugging/audit trail required
- Searchable notification history valuable

✅ **Dismissible Overlay Behavior**
- Temporary notifications that auto-dismiss
- Stack on top of content
- Don't affect layout positioning

✅ **Event-Driven Notifications**
- Triggered by app state changes
- Real-time updates and alerts
- Context-aware messaging

### Use AlertAdapter When:

✅ **System-Level Status Communication**
- Network connectivity status
- Sync operation status
- System health indicators
- Service availability banners

✅ **Persistent Display Required**
- Always visible when condition is true
- Part of the layout structure
- Non-dismissible system information

✅ **Fixed Positioning/Layout Integration**
- Top/bottom banners
- Sidebar status panels
- Header/footer system messages

✅ **Modal Integration Required**
- Authentication workflows
- System permission requests
- Critical system notifications

## Code Examples

### NotificationContext Usage

```jsx
// ✅ User operation feedback
import { useNotification } from '../contexts/notifications/NotificationContext';

function SaveButton() {
  const { notifySuccess, notifyError } = useNotification();
  
  const handleSave = async () => {
    try {
      await saveData();
      notifySuccess('Data saved successfully');
    } catch (error) {
      notifyError('Failed to save data. Please try again.');
    }
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

```jsx
// ✅ App-level notifications with custom duration
import { useNotification } from '../contexts/notifications/NotificationContext';

function RefreshButton() {
  const { notifyInfo } = useNotification();
  
  const handleOfflineRefresh = () => {
    notifyInfo(
      'Refresh is unavailable while offline.',
      { duration: 6000 }
    );
  };
  
  return <button onClick={handleOfflineRefresh}>Refresh</button>;
}
```

### AlertAdapter Usage

```jsx
// ✅ System status banner
import { AlertAdapter } from '../adapters';

function SystemStatusBanner({ isOnline, syncStatus }) {
  if (isOnline && !syncStatus) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <AlertAdapter
        variant={syncStatus?.status === 'error' ? 'error' : 'info'}
        className="rounded-none border-x-0 border-t-0"
        persistent
      >
        <div className="flex items-center justify-center gap-2">
          {syncStatus?.message || 'System status: Offline'}
        </div>
      </AlertAdapter>
    </div>
  );
}
```

```jsx
// ✅ Static compliance banner
import { AlertAdapter } from '../adapters';

function ComplianceBanner() {
  return (
    <AlertAdapter
      variant="info"
      persistent
      className="mb-4"
    >
      This application complies with Scout Association guidelines.
    </AlertAdapter>
  );
}
```

## Migration Best Practices

### 1. Audit Before Migration

```bash
# Search for AlertAdapter usage
grep -r "AlertAdapter" src/ --include="*.jsx" --include="*.tsx"

# Look for notification-like patterns
grep -r "alert\|notify\|message\|toast" src/ --include="*.jsx" --include="*.tsx"
```

### 2. Test Migration Impact

- ✅ Verify notification history works
- ✅ Check auto-dismiss behavior  
- ✅ Test accessibility (focus, ARIA)
- ✅ Confirm responsive design
- ✅ Validate error handling

### 3. Preserve User Experience

- ✅ Match original timing/duration
- ✅ Keep consistent styling
- ✅ Maintain accessibility features
- ✅ Preserve keyboard navigation

## Architecture Benefits

### NotificationContext Advantages
- 📱 **Unified notification experience**
- 🔍 **Searchable history**
- 📊 **Analytics and tracking**
- 🎨 **Consistent styling**
- ♿ **Built-in accessibility**

### AlertAdapter Advantages  
- 🏗️ **Layout integration**
- 🔧 **System-level control**
- 📍 **Fixed positioning**
- 🔄 **Modal workflows**
- ⚡ **Performance optimized**

## Common Anti-Patterns

### ❌ Don't Migrate These
```jsx
// System status - keep as AlertAdapter
<AlertAdapter persistent>System offline</AlertAdapter>

// Layout banners - keep as AlertAdapter  
<AlertAdapter className="fixed top-0">Banner message</AlertAdapter>

// Modal-integrated - keep as AlertAdapter
<AlertAdapter>
  Authentication required
  <Button onClick={openModal}>Login</Button>
</AlertAdapter>
```

### ❌ Don't Keep These as AlertAdapter
```jsx
// User feedback - migrate to NotificationContext
<AlertAdapter dismissible onDismiss={remove}>
  File uploaded successfully
</AlertAdapter>

// Error messages - migrate to NotificationContext
<AlertAdapter variant="error">
  Failed to load data
</AlertAdapter>

// Temporary alerts - migrate to NotificationContext
<AlertAdapter>Operation completed</AlertAdapter>
```

## Team Guidelines

### For New Features
1. **Start with the decision tree** - classify the notification type
2. **Consider user needs** - do they need history/search?
3. **Think about UX pattern** - overlay vs layout integration
4. **Review similar existing patterns** in the codebase

### For Existing Components
1. **Don't migrate without evaluation** - some AlertAdapter usage is correct
2. **Test migration thoroughly** - preserve existing behavior
3. **Document migration decisions** - update this guide
4. **Get team review** for complex migrations

## Future Considerations

### Potential New Categories
- **Critical system alerts** - may need special handling
- **Multi-step workflows** - could benefit from persistent state
- **Real-time notifications** - might need WebSocket integration
- **Cross-component messaging** - could use event bus pattern

### Evolution Path
- Monitor usage patterns and user feedback
- Consider notification queuing for high-frequency alerts
- Evaluate notification grouping/batching features
- Assess need for notification preferences/settings

---

## Summary

The migration strategy successfully separates concerns:
- **NotificationContext**: User-facing notifications with history
- **AlertAdapter**: System-level status and layout-integrated banners

This creates a **clean, maintainable architecture** where each tool serves its purpose effectively.

**When in doubt**: User notifications → NotificationContext, System UI → AlertAdapter.