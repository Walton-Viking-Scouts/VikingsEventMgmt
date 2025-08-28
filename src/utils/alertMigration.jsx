import React from 'react';
import AlertAdapter from '../components/ui/AlertAdapter';

export const createLegacyAlertWrapper = (NotificationProvider) => {
  return function LegacyAlertComponent({
    children,
    variant = 'info',
    size = 'md',
    dismissible = false,
    onDismiss,
    icon = true,
    className = '',
    ...props
  }) {
    // If NotificationProvider is not wrapping the app, show a warning
    const WrappedAlert = () => (
      <NotificationProvider>
        <AlertAdapter
          variant={variant}
          size={size}
          dismissible={dismissible}
          onDismiss={onDismiss}
          icon={icon}
          className={className}
          {...props}
        >
          {children}
        </AlertAdapter>
      </NotificationProvider>
    );

    return <WrappedAlert />;
  };
};

// Migration instructions and utilities
export const migrationGuide = {
  // Quick migration patterns
  patterns: {
    // Simple alert replacement
    basic: {
      from: '<Alert variant="success">Operation completed!</Alert>',
      to: `const { showSuccessAlert } = useAlertAdapter();
showSuccessAlert("Operation completed!");`,
    },
    
    // Dismissible alert replacement  
    dismissible: {
      from: `<Alert variant="error" dismissible onDismiss={handleDismiss}>
  Error occurred
</Alert>`,
      to: `const { showErrorAlert } = useAlertAdapter();
const alertId = showErrorAlert("Error occurred", { dismissible: true });
// handleDismiss functionality handled automatically`,
    },

    // Complex alert with actions
    withActions: {
      from: `<Alert variant="warning">
  <Alert.Title>Warning</Alert.Title>
  <Alert.Description>Session will expire soon</Alert.Description>
  <Alert.Actions>
    <button onClick={extendSession}>Extend</button>
    <button onClick={logout}>Logout</button>
  </Alert.Actions>
</Alert>`,
      to: `const { showWarningAlert } = useAlertAdapter();
showWarningAlert("Session will expire soon", {
  title: "Warning",
  actions: [
    { label: "Extend", onClick: extendSession },
    { label: "Logout", onClick: logout }
  ]
});`,
    },

    // Scout-themed alert
    scoutThemed: {
      from: '<Alert variant="scout-blue">Scout information</Alert>',
      to: `const { showScoutBlueAlert } = useAlertAdapter();
showScoutBlueAlert("Scout information");`,
    },
  },

  // Common migration scenarios
  scenarios: [
    {
      name: 'Form validation errors',
      description: 'Replace form Alert components with notification calls',
      example: {
        before: `{errors.email && (
  <Alert variant="error" className="mt-2">
    {errors.email}
  </Alert>
)}`,
        after: `// On form validation
if (errors.email) {
  const { showErrorAlert } = useAlertAdapter();
  showErrorAlert(errors.email);
}`,
      },
    },
    {
      name: 'Success confirmations',
      description: 'Replace success Alert components with toast notifications',
      example: {
        before: `{isSuccess && (
  <Alert variant="success" dismissible>
    Data saved successfully!
  </Alert>
)}`,
        after: `// On successful operation
if (isSuccess) {
  const { showSuccessAlert } = useAlertAdapter();
  showSuccessAlert("Data saved successfully!", { dismissible: true, useToast: true });
}`,
      },
    },
    {
      name: 'Warning banners',
      description: 'Replace persistent warning Alerts with Banner notifications',
      example: {
        before: `<Alert variant="warning" className="mb-4">
  <Alert.Title>Maintenance Notice</Alert.Title>
  <Alert.Description>
    System maintenance scheduled for tonight.
  </Alert.Description>
</Alert>`,
        after: `// On component mount or in useEffect
const { showWarningAlert } = useAlertAdapter();
showWarningAlert("System maintenance scheduled for tonight.", {
  title: "Maintenance Notice",
  persistent: true
});`,
      },
    },
  ],

  // API mapping reference
  apiMapping: {
    props: {
      variant: 'Maps to notification type (success, error, warning, info) or scout variants',
      dismissible: 'Controls persistent flag and auto-dismissal behavior', 
      onDismiss: 'Handled automatically by notification system',
      icon: 'Controls whether to show notification icon',
      size: 'Not directly supported - notification components have fixed sizing',
      className: 'Can be applied to notification components',
    },
    compoundComponents: {
      'Alert.Title': 'Becomes title property in notification options',
      'Alert.Description': 'Becomes description property or part of message',
      'Alert.Actions': 'Becomes actions array in notification options',
    },
  },
};

// Validation helpers for migration
export const validateMigration = {
  checkRequiredProvider: (componentName) => {
    try {
      // This would be called in development to warn about missing NotificationProvider
      const warningMessage = `${componentName} requires NotificationProvider to be wrapped around your app. Add <NotificationProvider> to your root component.`;
      console.warn(warningMessage);
      return false;
    } catch (e) {
      return false;
    }
  },

  validateVariant: (variant) => {
    const validVariants = [
      'success', 'warning', 'error', 'info', 
      'scout-blue', 'scout-green', 'scout-red', 'scout-orange',
      'neutral', 'dark',
    ];
    return validVariants.includes(variant);
  },

  validateActionStructure: (actions) => {
    if (!Array.isArray(actions)) return false;
    return actions.every(action => 
      action && 
      typeof action.label === 'string' && 
      typeof action.onClick === 'function',
    );
  },
};

// Development helpers
export const migrationHelpers = {
  // Convert Alert props to notification options
  convertAlertPropsToNotificationOptions: (alertProps) => {
    const {
      variant = 'info',
      dismissible = false,
      icon = true,
      size: _size,
      className: _className,
      children,
      onDismiss: _onDismiss,
      ...otherProps
    } = alertProps;

    // Extract compound children if they exist
    let title = '';
    let description = '';
    const actions = [];
    let content = '';

    if (React.isValidElement(children)) {
      // Handle compound components
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type?.name === 'AlertTitle') {
            title = child.props.children;
          } else if (child.type?.name === 'AlertDescription') {
            description = child.props.children;
          } else if (child.type?.name === 'AlertActions') {
            // Convert button children to action objects
            React.Children.forEach(child.props.children, (actionChild) => {
              if (React.isValidElement(actionChild) && actionChild.type === 'button') {
                actions.push({
                  label: actionChild.props.children,
                  onClick: actionChild.props.onClick || (() => {}),
                });
              }
            });
          }
        }
      });
    } else if (typeof children === 'string') {
      content = children;
    }

    // Build message from parts
    const messageParts = [];
    if (title) messageParts.push(title);
    if (description) messageParts.push(description);
    if (content) messageParts.push(content);
    const message = messageParts.join(': ');

    return {
      variant,
      message,
      title: title || undefined,
      description: description || undefined,
      actions: actions.length > 0 ? actions : undefined,
      dismissible,
      icon,
      persistent: !dismissible,
      duration: dismissible ? 5000 : undefined,
      ...otherProps,
    };
  },

  // Generate migration code snippet
  generateMigrationCode: (alertProps) => {
    const options = migrationHelpers.convertAlertPropsToNotificationOptions(alertProps);
    const { variant, message, ...restOptions } = options;
    
    const optionsStr = Object.keys(restOptions).length > 0 
      ? `, ${JSON.stringify(restOptions, null, 2)}`
      : '';

    const variantMap = {
      success: 'showSuccessAlert',
      error: 'showErrorAlert', 
      warning: 'showWarningAlert',
      info: 'showInfoAlert',
      'scout-blue': 'showScoutBlueAlert',
      'scout-green': 'showScoutGreenAlert',
      'scout-red': 'showScoutRedAlert',
      'scout-orange': 'showScoutOrangeAlert',
    };

    const method = variantMap[variant] || 'showAlert';
    
    return `const { ${method} } = useAlertAdapter();
${method}("${message}"${optionsStr});`;
  },
};

export default {
  createLegacyAlertWrapper,
  migrationGuide,
  validateMigration,
  migrationHelpers,
};