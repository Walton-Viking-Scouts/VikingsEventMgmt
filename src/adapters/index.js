/**
 * Alert Migration Adapters
 * 
 * This module exports all the adapter components and utilities needed to migrate
 * from the legacy Alert component to the new notification system.
 * 
 * Usage Examples:
 * 
 * Component approach:
 * import { AlertAdapter } from '@/adapters';
 * 
 * Hook approach:
 * import { useAlertAdapter } from '@/adapters';
 * const { showSuccessAlert } = useAlertAdapter();
 * 
 * Migration utilities:
 * import { migrationUtils } from '@/adapters';
 * const code = migrationUtils.generateMigrationCode(alertProps);
 */

// Main adapter components
import AlertAdapterComponent from '../components/ui/AlertAdapter';
export { default as AlertAdapter } from '../components/ui/AlertAdapter';
export { AlertTitle, AlertDescription, AlertActions } from '../components/ui/AlertAdapter';

// Adapter hook
import useAlertAdapterHook from '../hooks/useAlertAdapter.jsx';
export { default as useAlertAdapter } from '../hooks/useAlertAdapter.jsx';

// Migration utilities and helpers
import migrationUtilsDefault from '../utils/alertMigration';
export { 
  default as migrationUtils,
  createLegacyAlertWrapper,
  migrationGuide,
  validateMigration,
  migrationHelpers,
} from '../utils/alertMigration';

// Extended notification styles with scout support
export { 
  notificationStyles,
  getNotificationStyles,
  getNotificationIcon,
  getRecommendedDuration,
  getAccessibilityAttributes,
  ScoutBlueIcon,
  ScoutGreenIcon,
  ScoutRedIcon,
  ScoutOrangeIcon,
  NeutralIcon,
  DarkIcon,
} from '../components/notifications/NotificationStyles';

// Convenience re-exports from notification system
export { 
  useNotification,
  NotificationProvider, 
} from '../contexts/notifications/NotificationContext';

export { 
  default as Toast, 
} from '../components/notifications/Toast';

export { 
  default as Banner, 
} from '../components/notifications/Banner';

// Migration patterns and examples
export const MIGRATION_EXAMPLES = {
  // Basic replacement
  basicAlert: {
    before: '<Alert variant="success">Operation completed!</Alert>',
    after: {
      component: '<AlertAdapter variant="success">Operation completed!</AlertAdapter>',
      hook: `const { showSuccessAlert } = useAlertAdapter();
showSuccessAlert("Operation completed!");`,
    },
  },
  
  // Dismissible alert
  dismissibleAlert: {
    before: `<Alert variant="error" dismissible onDismiss={handleDismiss}>
  Error occurred
</Alert>`,
    after: {
      component: `<AlertAdapter variant="error" dismissible onDismiss={handleDismiss}>
  Error occurred
</AlertAdapter>`,
      hook: `const { showErrorAlert } = useAlertAdapter();
const alertId = showErrorAlert("Error occurred", { dismissible: true });`,
    },
  },
  
  // Complex alert with compound components
  complexAlert: {
    before: `<Alert variant="warning">
  <Alert.Title>Warning</Alert.Title>
  <Alert.Description>Session will expire soon</Alert.Description>
  <Alert.Actions>
    <button onClick={extendSession}>Extend</button>
    <button onClick={logout}>Logout</button>
  </Alert.Actions>
</Alert>`,
    after: {
      component: `<AlertAdapter variant="warning">
  <AlertAdapter.Title>Warning</AlertAdapter.Title>
  <AlertAdapter.Description>Session will expire soon</AlertAdapter.Description>
  <AlertAdapter.Actions>
    <button onClick={extendSession}>Extend</button>
    <button onClick={logout}>Logout</button>
  </AlertAdapter.Actions>
</AlertAdapter>`,
      hook: `const { showWarningAlert } = useAlertAdapter();
showWarningAlert("Session will expire soon", {
  title: "Warning",
  actions: [
    { label: "Extend", onClick: extendSession },
    { label: "Logout", onClick: logout }
  ]
});`,
    },
  },
  
  // Scout-themed alert
  scoutAlert: {
    before: '<Alert variant="scout-blue">Scout information</Alert>',
    after: {
      component: '<AlertAdapter variant="scout-blue">Scout information</AlertAdapter>',
      hook: `const { showScoutBlueAlert } = useAlertAdapter();
showScoutBlueAlert("Scout information");`,
    },
  },
};

// Quick migration checklist
export const MIGRATION_CHECKLIST = [
  'Replace Alert imports with AlertAdapter or useAlertAdapter',
  'Wrap your app with NotificationProvider if not already done',
  'Update Alert.Title/Description/Actions to AlertAdapter equivalents or hook options',
  'Test dismissible behavior - dismissible prop becomes persistent: false',
  'Verify scout-themed variants render correctly',
  'Update any onDismiss handlers - they work automatically with adapters',
  'Test accessibility - screen readers should announce notifications properly',
  'Consider using Toast vs Banner based on alert persistence needs',
];

// Common migration patterns helper
export const getMigrationPattern = (alertType) => {
  const patterns = {
    form_validation: {
      description: 'Form validation errors - typically temporary errors',
      recommendation: 'Use showErrorAlert with dismissible: true, or AlertAdapter with useToast: true',
      example: `// Before
{errors.email && <Alert variant="error">{errors.email}</Alert>}

// After (Hook)
if (errors.email) {
  showErrorAlert(errors.email, { dismissible: true, useToast: true });
}

// After (Component)
{errors.email && (
  <AlertAdapter variant="error" dismissible useToast>
    {errors.email}
  </AlertAdapter>
)}`,
    },
    
    system_status: {
      description: 'System-wide status messages - typically persistent',
      recommendation: 'Use Banner component via AlertAdapter or showAlert with persistent: true',
      example: `// Before
<Alert variant="warning">
  <Alert.Title>Maintenance Notice</Alert.Title>
  <Alert.Description>System maintenance tonight</Alert.Description>
</Alert>

// After (Hook)
showWarningAlert("System maintenance tonight", {
  title: "Maintenance Notice",
  persistent: true
});

// After (Component)  
<AlertAdapter variant="warning" persistent>
  <AlertAdapter.Title>Maintenance Notice</AlertAdapter.Title>
  <AlertAdapter.Description>System maintenance tonight</AlertAdapter.Description>
</AlertAdapter>`,
    },
    
    success_feedback: {
      description: 'Success confirmations - typically temporary',
      recommendation: 'Use Toast component via useToast: true or showSuccessAlert',
      example: `// Before
{isSuccess && <Alert variant="success" dismissible>Data saved!</Alert>}

// After (Hook)
if (isSuccess) {
  showSuccessAlert("Data saved!", { useToast: true, dismissible: true });
}

// After (Component)
{isSuccess && (
  <AlertAdapter variant="success" dismissible useToast>
    Data saved!
  </AlertAdapter>
)}`,
    },
    
    scout_themed: {
      description: 'Scout-branded alerts - preserve theming',
      recommendation: 'Use scout variant methods or AlertAdapter with scout-* variants',
      example: `// Before
<Alert variant="scout-green">Achievement unlocked!</Alert>

// After (Hook)  
showScoutGreenAlert("Achievement unlocked!");

// After (Component)
<AlertAdapter variant="scout-green">Achievement unlocked!</AlertAdapter>`,
    },
  };
  
  return patterns[alertType] || null;
};

export default {
  AlertAdapter: AlertAdapterComponent,
  useAlertAdapter: useAlertAdapterHook,
  migrationUtils: migrationUtilsDefault,
  MIGRATION_EXAMPLES,
  MIGRATION_CHECKLIST,
  getMigrationPattern,
};