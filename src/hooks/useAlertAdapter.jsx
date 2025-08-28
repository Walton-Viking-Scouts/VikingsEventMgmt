import { useCallback } from 'react';
import { useNotification } from '../contexts/notifications/NotificationContext';

const useAlertAdapter = () => {
  const { notify, notifySuccess, notifyError, notifyWarning, notifyInfo, remove } = useNotification();

  // Map Alert variants to notification types and functions
  const variantToNotificationMap = {
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

  // Helper to get scout-themed icon
  const getScoutIcon = useCallback((variant) => {
    const iconClasses = 'w-5 h-5';
    
    switch (variant) {
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
    default:
      return undefined; // Use default notification icon
    }
  }, []);

  // Main adapter function to show alert as notification
  const showAlert = useCallback((options) => {
    const {
      variant = 'info',
      message,
      title,
      description,
      actions = [],
      dismissible = false,
      icon = true,
      duration,
      persistent,
      useToast = false,
    } = options;

    // Build the notification message from parts
    let notificationMessage = message;
    if (!notificationMessage) {
      const parts = [];
      if (title) parts.push(title);
      if (description) parts.push(description);
      notificationMessage = parts.join(': ') || 'Alert';
    }

    // Configuration for the notification
    const notificationConfig = {
      message: notificationMessage,
      icon: icon ? getScoutIcon(variant) : null,
      persistent: persistent !== undefined ? persistent : !dismissible,
      actions: actions.length > 0 ? actions : undefined,
      duration: duration || (dismissible ? 5000 : undefined),
    };

    // Get the notification type
    const notificationType = variantToNotificationMap[variant] || 'info';

    // Use the appropriate notification function
    switch (notificationType) {
    case 'success':
      return notifySuccess(notificationMessage, notificationConfig);
    case 'error':
      return notifyError(notificationMessage, notificationConfig);
    case 'warning':
      return notifyWarning(notificationMessage, notificationConfig);
    case 'info':
      return notifyInfo(notificationMessage, notificationConfig);
    default:
      return notify({ type: notificationType, ...notificationConfig });
    }
  }, [notify, notifySuccess, notifyError, notifyWarning, notifyInfo, getScoutIcon, variantToNotificationMap]);

  // Convenience methods for different alert types
  const showSuccessAlert = useCallback((message, options = {}) => {
    return showAlert({ variant: 'success', message, ...options });
  }, [showAlert]);

  const showErrorAlert = useCallback((message, options = {}) => {
    return showAlert({ variant: 'error', message, ...options });
  }, [showAlert]);

  const showWarningAlert = useCallback((message, options = {}) => {
    return showAlert({ variant: 'warning', message, ...options });
  }, [showAlert]);

  const showInfoAlert = useCallback((message, options = {}) => {
    return showAlert({ variant: 'info', message, ...options });
  }, [showAlert]);

  // Scout-themed convenience methods
  const showScoutBlueAlert = useCallback((message, options = {}) => {
    return showAlert({ variant: 'scout-blue', message, ...options });
  }, [showAlert]);

  const showScoutGreenAlert = useCallback((message, options = {}) => {
    return showAlert({ variant: 'scout-green', message, ...options });
  }, [showAlert]);

  const showScoutRedAlert = useCallback((message, options = {}) => {
    return showAlert({ variant: 'scout-red', message, ...options });
  }, [showAlert]);

  const showScoutOrangeAlert = useCallback((message, options = {}) => {
    return showAlert({ variant: 'scout-orange', message, ...options });
  }, [showAlert]);

  // Dismiss method
  const dismissAlert = useCallback((id) => {
    remove(id);
  }, [remove]);

  return {
    showAlert,
    showSuccessAlert,
    showErrorAlert,
    showWarningAlert,
    showInfoAlert,
    showScoutBlueAlert,
    showScoutGreenAlert,
    showScoutRedAlert,
    showScoutOrangeAlert,
    dismissAlert,
    // Legacy alias for backward compatibility
    alert: showAlert,
  };
};

export default useAlertAdapter;