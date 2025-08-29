import React, { useMemo, useRef, useEffect } from 'react';
import { useNotification } from '../../contexts/notifications/NotificationContext';
import Banner from '../notifications/Banner';
import Toast from '../notifications/Toast';
import Button from './Button';

// Module-level constants
const VARIANT_MAPPING = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
  'scout-blue': 'info',
  'scout-green': 'success',
  'scout-red': 'error',
  'scout-orange': 'warning',
  neutral: 'info',
  dark: 'custom',
};

// Helper function to extract text from React nodes
const extractText = (node) => {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) return extractText(node.props?.children);
  return '';
};

// Pure function for scout icons
const getScoutIcon = (alertVariant) => {
  const iconClasses = 'w-5 h-5';
  
  switch (alertVariant) {
  case 'scout-blue':
    return (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    );
  case 'scout-green':
    return (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  case 'scout-red':
  case 'scout-orange':
    return (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  case 'dark':
  case 'neutral':
    return (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    );
  default:
    return undefined; // Let the notification component use its default icon
  }
};

// Duration policy based on variant
const defaultDurationFor = (type, dismissible) => {
  if (type === 'success') return 2000;
  if (type === 'warning' || type === 'info') return dismissible ? 4000 : 3000;
  if (type === 'error') return undefined; // persistent
  return dismissible ? 4000 : undefined;
};

const AlertAdapter = ({
  children,
  variant = 'info',
  size: _size = 'md',
  dismissible = false,
  onDismiss,
  icon = true,
  className = '',
  useToast = false,
  ..._props
}) => {
  const { notify: _notify, remove: _remove } = useNotification();

  // Stable ID and timestamp refs for notification identity
  const notificationIdRef = useRef(null);
  const timestampRef = useRef(null);

  // Extract compound component children
  const { title, description, actions, content } = useMemo(() => {
    let extractedTitle = '';
    let extractedDescription = '';
    const extractedActions = [];
    let remainingContent = '';

    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        if (
          child.type === AlertTitle ||
          child.type?.displayName === 'AlertTitle'
        ) {
          extractedTitle = extractText(child.props.children);
        } else if (
          child.type === AlertDescription ||
          child.type?.displayName === 'AlertDescription'
        ) {
          extractedDescription = extractText(child.props.children);
        } else if (
          child.type === AlertActions ||
          child.type?.displayName === 'AlertActions'
        ) {
          // Convert button children to action objects
          React.Children.forEach(child.props.children, (actionChild) => {
            if (React.isValidElement(actionChild) && 
                (actionChild.type === 'button' || actionChild.type === Button)) {
              extractedActions.push({
                label: extractText(actionChild.props.children) || 'Action',
                onClick: actionChild.props.onClick || (() => {}),
              });
            }
          });
        } else {
          // Other content
          remainingContent += extractText(child);
        }
      } else if (typeof child === 'string') {
        remainingContent += child;
      }
    });

    return {
      title: extractedTitle,
      description: extractedDescription,
      actions: extractedActions,
      content: remainingContent,
    };
  }, [children]);

  // Build the notification message
  const message = useMemo(() => {
    const parts = [];
    if (title) parts.push(title);
    if (description) parts.push(description);
    if (content.trim()) parts.push(content.trim());
    return parts.join(': ');
  }, [title, description, content]);

  // Create notification configuration
  const notificationConfig = useMemo(() => {
    const notificationType = VARIANT_MAPPING[variant] || 'info';
    return {
      type: notificationType,
      message: message || 'Alert',
      icon: icon ? getScoutIcon(variant) : null,
      persistent: !dismissible,
      actions: actions.length > 0 ? actions : undefined,
      duration: defaultDurationFor(notificationType, dismissible),
    };
  }, [variant, message, icon, dismissible, actions]);

  // Create stable notification identity key for memoization
  const notificationKey = useMemo(() => 
    JSON.stringify({
      message: message || 'Alert',
      type: VARIANT_MAPPING[variant] || 'info',
      actions: actions.map(a => a.label).join(','),
      variant,
      dismissible
    }), 
    [message, variant, actions, dismissible]
  );

  // Stable ID and timestamp - persist across renders for the same logical notification
  useEffect(() => {
    if (notificationIdRef.current === null || timestampRef.current === null) {
      notificationIdRef.current = 'alert-adapter-' + Date.now() + Math.random().toString(36).substr(2, 9);
      timestampRef.current = Date.now();
    }
  }, [notificationKey]);

  // Handle dismiss callback integration
  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  // Render the notification using either Banner or Toast
  const notification = {
    ...notificationConfig,
    id: notificationIdRef.current || 'alert-adapter-fallback',
    timestamp: timestampRef.current || Date.now(),
  };

  if (useToast) {
    return (
      <Toast
        notification={notification}
        onDismiss={handleDismiss}
        className={getScoutStyling(variant, className)}
      />
    );
  }

  return (
    <Banner
      notification={notification}
      onDismiss={handleDismiss}
      className={getScoutStyling(variant, className)}
    />
  );
};

// Helper function to add scout-specific styling
const getScoutStyling = (variant, className) => {
  const scoutStyles = {
    'scout-blue': 'bg-scout-blue/10 border-scout-blue/20 text-scout-blue-dark',
    'scout-green': 'bg-scout-green/10 border-scout-green/20 text-scout-green-dark',
    'scout-red': 'bg-scout-red/10 border-scout-red/20 text-scout-red-dark',
    'scout-orange': 'bg-scout-orange/10 border-scout-orange/20 text-scout-orange-dark',
    dark: 'bg-gray-800/50 border-gray-700 text-white',
    neutral: 'bg-gray-50 border-gray-400 text-gray-800',
  };

  return scoutStyles[variant] ? `${scoutStyles[variant]} ${className}` : className;
};

// Simple implementations of the compound components for the adapter
const AlertTitle = ({ children: _children, className: _className = '', ..._props }) => {
  // This component is used for type checking in the adapter logic
  // The actual rendering is handled by the notification components
  return null;
};
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = ({ children: _children, className: _className = '', ..._props }) => {
  // This component is used for type checking in the adapter logic
  // The actual rendering is handled by the notification components
  return null;
};
AlertDescription.displayName = 'AlertDescription';

const AlertActions = ({ children: _children, className: _className = '', ..._props }) => {
  // This component is used for type checking in the adapter logic
  // The actual rendering is handled by the notification components
  return null;
};
AlertActions.displayName = 'AlertActions';

// Attach compound components to maintain API compatibility
AlertAdapter.Title = AlertTitle;
AlertAdapter.Description = AlertDescription;
AlertAdapter.Actions = AlertActions;

export default AlertAdapter;
export { AlertTitle, AlertDescription, AlertActions };