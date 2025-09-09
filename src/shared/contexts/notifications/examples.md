# Notification Utilities Usage Examples

This document provides practical examples of how to use the notification utilities in different scenarios throughout the Viking Event Management Mobile application.

## Basic Usage

```typescript
import React from 'react';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';

const ExampleComponent: React.FC = () => {
  const { toast, banner, formSubmission } = useNotificationUtils();

  return (
    <div>
      <button onClick={() => toast.success('Operation completed!')}>
        Show Success Toast
      </button>
      
      <button onClick={() => banner.info('This is important information')}>
        Show Info Banner
      </button>
    </div>
  );
};
```

## Toast Notifications

### Success Messages
```typescript
const { toast } = useNotificationUtils();

// Simple success message
toast.success('Data saved successfully!');

// Success with custom duration
toast.success('Quick notification', { duration: 2000 });

// Success with custom icon
toast.success('Custom success', { 
  icon: <CheckIcon className="w-5 h-5" />,
  duration: 6000 
});
```

### Error Messages
```typescript
const { toast } = useNotificationUtils();

// Simple error message
toast.error('Failed to load data');

// Error with action buttons
toast.error('Connection failed', {
  actions: [
    { label: 'Retry', onClick: () => retryConnection() },
    { label: 'Go Offline', onClick: () => enableOfflineMode() }
  ]
});

// Persistent error (doesn't auto-dismiss)
toast.error('Critical error occurred', { persistent: true });
```

### Info and Warning Messages
```typescript
const { toast } = useNotificationUtils();

// Info message
toast.info('New features available in settings');

// Warning message
toast.warning('You have unsaved changes');

// Warning with longer duration
toast.warning('Session expires in 5 minutes', { duration: 10000 });
```

## Banner Notifications

### Success Banners
```typescript
const { banner } = useNotificationUtils();

// Success banner (persistent by default)
banner.success('Event registration completed successfully!');

// Temporary success banner
banner.success('Settings updated', { persistent: false, duration: 5000 });
```

### Error Banners
```typescript
const { banner } = useNotificationUtils();

// Critical error banner
banner.error('Unable to sync with server. Working in offline mode.');

// Error with retry action
banner.error('Sync failed', {
  actions: [
    { label: 'Retry Sync', onClick: () => retrySyncData() }
  ]
});
```

### Info and Warning Banners
```typescript
const { banner } = useNotificationUtils();

// Important information banner
banner.info('New attendance features are now available');

// Warning banner with action
banner.warning('Your session will expire soon', {
  actions: [
    { label: 'Extend Session', onClick: () => extendSession() }
  ]
});
```

## Form Submission Examples

### Basic Form Success/Error
```typescript
const { formSubmission } = useNotificationUtils();

const handleSubmit = async (formData: any) => {
  try {
    await submitEventForm(formData);
    formSubmission.success(); // Uses default message
  } catch (error) {
    formSubmission.error(error); // Extracts error message automatically
  }
};
```

### Custom Form Messages
```typescript
const { formSubmission } = useNotificationUtils();

const handleEventCreation = async (eventData: any) => {
  try {
    await createEvent(eventData);
    formSubmission.success('Event created successfully!');
  } catch (error) {
    formSubmission.error(error);
  }
};
```

## Real-World Scenarios

### API Call with Loading State
```typescript
import React, { useState } from 'react';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';

const AttendanceSync: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast, banner } = useNotificationUtils();

  const handleSync = async () => {
    setIsLoading(true);
    
    try {
      // Show info toast for sync start
      toast.info('Starting data sync...');
      
      await syncAttendanceData();
      
      // Show success banner for completion
      banner.success('Attendance data synchronized successfully');
      
    } catch (error) {
      // Show error with retry option
      toast.error('Sync failed', {
        actions: [
          { label: 'Retry', onClick: handleSync },
          { label: 'Go Offline', onClick: () => enableOfflineMode() }
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleSync} disabled={isLoading}>
      {isLoading ? 'Syncing...' : 'Sync Data'}
    </button>
  );
};
```

### Form Validation with Multiple Notifications
```typescript
import React from 'react';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';

const EventForm: React.FC = () => {
  const { toast, formSubmission } = useNotificationUtils();

  const validateForm = (data: any) => {
    const errors = [];
    
    if (!data.title) errors.push('Event title is required');
    if (!data.date) errors.push('Event date is required');
    if (!data.location) errors.push('Location is required');
    
    return errors;
  };

  const handleSubmit = async (data: any) => {
    // Client-side validation
    const validationErrors = validateForm(data);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => {
        toast.warning(error, { duration: 4000 });
      });
      return;
    }

    try {
      await submitEventForm(data);
      formSubmission.success('Event created and added to calendar');
    } catch (error) {
      if (error.status === 409) {
        toast.error('An event already exists at this time', {
          actions: [
            { label: 'View Conflict', onClick: () => showConflictDialog() }
          ]
        });
      } else {
        formSubmission.error(error);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

### Offline Mode Notifications
```typescript
import React, { useEffect } from 'react';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const OfflineModeHandler: React.FC = () => {
  const { banner } = useNotificationUtils();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (!isOnline) {
      banner.warning('Working in offline mode. Changes will sync when connection is restored.', {
        actions: [
          { label: 'Retry Connection', onClick: () => window.location.reload() }
        ]
      });
    }
  }, [isOnline, banner]);

  return null; // This component only handles notifications
};
```

### Session Management
```typescript
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';

export const useSessionManager = () => {
  const { toast, banner } = useNotificationUtils();

  const handleSessionExpiring = (minutesLeft: number) => {
    if (minutesLeft === 5) {
      toast.warning(`Session expires in ${minutesLeft} minutes`, {
        actions: [
          { label: 'Extend Session', onClick: extendSession }
        ]
      });
    } else if (minutesLeft === 1) {
      banner.warning('Session expires in 1 minute!', {
        actions: [
          { label: 'Extend Now', onClick: extendSession }
        ]
      });
    }
  };

  const handleSessionExpired = () => {
    banner.error('Your session has expired. Please login again.', {
      actions: [
        { label: 'Login', onClick: () => redirectToLogin() }
      ]
    });
  };

  return { handleSessionExpiring, handleSessionExpired };
};
```

## Advanced Customization

### Custom Notification Types
```typescript
const { toast } = useNotificationUtils();

// Use custom type with full control
toast.success('Sync complete', {
  type: 'custom',
  icon: <SyncIcon className="animate-spin w-5 h-5 text-green-500" />,
  duration: 3000,
  persistent: false
});
```

### Notification with Rich Content
```typescript
const { banner } = useNotificationUtils();

banner.info('Update Available', {
  icon: <UpdateIcon className="w-6 h-6" />,
  actions: [
    { 
      label: 'Update Now', 
      onClick: () => {
        toast.info('Starting update...');
        performUpdate();
      }
    },
    { label: 'Later', onClick: () => dismissUpdate() }
  ]
});
```

## Best Practices

1. **Use appropriate notification types**: 
   - Toasts for temporary feedback
   - Banners for important persistent information

2. **Keep messages concise**: Aim for under 50 characters when possible

3. **Provide actions for errors**: Always offer a way to resolve or retry

4. **Use consistent messaging**: Establish patterns for similar operations

5. **Consider user context**: 
   - Use longer durations for complex messages
   - Use persistent notifications for critical information

6. **Test with real content**: Verify notifications work well with actual application messages