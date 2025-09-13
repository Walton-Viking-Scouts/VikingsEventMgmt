/**
 * @file Scout-themed notification utilities using react-hot-toast
 * 
 * This module provides notification functions with Scout color theming and
 * consistent styling across the application. Replaces the previous complex
 * notification system as part of the codebase simplification (Tasks 31-34).
 * 
 * All notifications use Scout brand colors and are positioned top-right with
 * consistent styling, duration, and accessibility features.
 * 
 * @module notifications
 * @version 2.3.7
 * @since 2.3.7 - Created during notification system simplification
 * @author Vikings Event Management Team
 */

import { toast } from 'react-hot-toast';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

// Scout theme colors matching Tailwind CSS configuration
const SCOUT_COLORS = {
  blue: '#1e40af',      // scout-blue
  green: '#16a34a',     // scout-green  
  red: '#dc2626',       // scout-red
  amber: '#d97706',     // amber-600 for warning
  white: '#ffffff',
  gray: '#6b7280',      // gray-500
};

// Default toast options with scout theme styling
const defaultToastOptions = {
  duration: 4000,
  position: 'top-right',
  style: {
    background: SCOUT_COLORS.white,
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    fontSize: '14px',
    fontWeight: '500',
    padding: '12px 16px',
    maxWidth: '400px',
  },
  // Custom icon styles
  iconTheme: {
    primary: SCOUT_COLORS.white,
    secondary: SCOUT_COLORS.gray,
  },
};

/**
 * Displays a success notification with Scout green theme
 * 
 * Shows a success toast notification with Scout brand green color theming.
 * Automatically positioned top-right with 4-second duration. Use for positive
 * user actions like saving data, successful uploads, or completed operations.
 * 
 * @param {string} message - Success message to display to the user
 * @returns {string} Toast ID that can be used to dismiss the notification manually
 * 
 * @example
 * // Basic success notification
 * notifySuccess('Event saved successfully!');
 * 
 * @example
 * // Store toast ID for conditional dismissal
 * const toastId = notifySuccess('Upload complete');
 * // Later dismiss if needed
 * if (needToCancel) {
 *   dismissToast(toastId);
 * }
 * 
 * @example
 * // Typical usage in form submission
 * const handleSave = async () => {
 *   try {
 *     await saveEvent(eventData);
 *     notifySuccess('Scout event created successfully!');
 *     navigate('/events');
 *   } catch (error) {
 *     notifyError('Failed to save event', error);
 *   }
 * };
 * 
 * @since 2.3.7
 */
export const notifySuccess = (message) => {
  return toast.success(message, {
    ...defaultToastOptions,
    style: {
      ...defaultToastOptions.style,
      borderLeft: `4px solid ${SCOUT_COLORS.green}`,
    },
    iconTheme: {
      primary: SCOUT_COLORS.green,
      secondary: SCOUT_COLORS.white,
    },
  });
};

/**
 * Displays an error notification with Scout red theme and extended duration
 * 
 * Shows an error toast notification with Scout brand red color theming.
 * Has extended 6-second duration for better error visibility. Automatically
 * logs error details to the logger service and Sentry for debugging.
 * 
 * @param {string} message - Error message to display to the user
 * @param {Error} [error=null] - Optional Error object for detailed logging
 * @returns {string} Toast ID that can be used to dismiss the notification manually
 * 
 * @example
 * // Basic error notification
 * notifyError('Failed to load scout members');
 * 
 * @example
 * // Error with detailed logging
 * try {
 *   await loadMembers();
 * } catch (error) {
 *   notifyError('Unable to sync member data', error);
 * }
 * 
 * @example
 * // API error handling with user-friendly message
 * const handleAPIError = (apiError) => {
 *   const userMessage = apiError.status === 403 
 *     ? 'Access denied. Please check your permissions.'
 *     : 'Network error. Please try again.';
 *   notifyError(userMessage, apiError);
 * };
 * 
 * @example
 * // Offline error handling
 * const loadData = async () => {
 *   try {
 *     const data = await fetchFromAPI('events');
 *     return data;
 *   } catch (error) {
 *     if (!navigator.onLine) {
 *       notifyError('No internet connection. Showing cached data.', error);
 *     } else {
 *       notifyError('Failed to load events from server', error);
 *     }
 *     throw error;
 *   }
 * };
 * 
 * @since 2.3.7
 */
export const notifyError = (message, error = null) => {
  // Log error to logger service for debugging and Sentry
  if (error) {
    logger.error('Toast notification error', { 
      message, 
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    }, LOG_CATEGORIES.ERROR);
  } else {
    logger.error('Toast notification error', { message }, LOG_CATEGORIES.ERROR);
  }

  return toast.error(message, {
    ...defaultToastOptions,
    duration: 6000, // Extended duration for errors
    style: {
      ...defaultToastOptions.style,
      borderLeft: `4px solid ${SCOUT_COLORS.red}`,
    },
    iconTheme: {
      primary: SCOUT_COLORS.red,
      secondary: SCOUT_COLORS.white,
    },
  });
};

/**
 * Displays a warning notification with amber theme
 * 
 * Shows a warning toast notification with amber color theming and warning icon.
 * Use for situations that need user attention but aren't errors - like validation
 * warnings, permission notices, or data conflicts that need user input.
 * 
 * @param {string} message - Warning message to display to the user
 * @returns {string} Toast ID that can be used to dismiss the notification manually
 * 
 * @example
 * // Basic warning notification
 * notifyWarning('Some members have incomplete badge records');
 * 
 * @example
 * // Validation warning
 * const validateEventDate = (date) => {
 *   if (new Date(date) < new Date()) {
 *     notifyWarning('Event date is in the past. Please verify.');
 *     return false;
 *   }
 *   return true;
 * };
 * 
 * @example
 * // Permission warning
 * const checkPermissions = (userRole, action) => {
 *   if (userRole === 'viewer' && action === 'edit') {
 *     notifyWarning('You have view-only access. Contact your section leader for edit permissions.');
 *     return false;
 *   }
 *   return true;
 * };
 * 
 * @since 2.3.7
 */
export const notifyWarning = (message) => {
  return toast(message, {
    ...defaultToastOptions,
    icon: '⚠️',
    style: {
      ...defaultToastOptions.style,
      borderLeft: `4px solid ${SCOUT_COLORS.amber}`,
    },
  });
};

/**
 * Displays an informational notification with Scout blue theme
 * 
 * Shows an info toast notification with Scout brand blue color theming and info icon.
 * Use for helpful information, tips, or non-critical updates that enhance user
 * understanding without requiring immediate action.
 * 
 * @param {string} message - Informational message to display to the user
 * @returns {string} Toast ID that can be used to dismiss the notification manually
 * 
 * @example
 * // Basic info notification
 * notifyInfo('Data automatically synced from OSM');
 * 
 * @example
 * // Feature tip notification
 * const showTip = () => {
 *   notifyInfo('Tip: Use the filter to find members by section or badge progress');
 * };
 * 
 * @example
 * // Status update notification
 * const handleDataSync = () => {
 *   notifyInfo('Showing cached data while offline');
 *   // Load cached data
 * };
 * 
 * @example
 * // Help context notification
 * const showHelp = (context) => {
 *   const helpMessages = {
 *     badges: 'Badge progress is updated weekly from OSM',
 *     events: 'Events show attendance status and remaining spaces',
 *     members: 'Member data includes contact details and medical info'
 *   };
 *   notifyInfo(helpMessages[context]);
 * };
 * 
 * @since 2.3.7
 */
export const notifyInfo = (message) => {
  return toast(message, {
    ...defaultToastOptions,
    icon: 'ℹ️',
    style: {
      ...defaultToastOptions.style,
      borderLeft: `4px solid ${SCOUT_COLORS.blue}`,
    },
  });
};

/**
 * Displays a loading notification for async operations
 * 
 * Shows a loading toast notification with Scout blue theme and spinner icon.
 * Use for long-running operations to indicate progress. The notification persists
 * until manually dismissed, typically when the operation completes or fails.
 * 
 * @param {string} message - Loading message to display to the user
 * @returns {string} Toast ID that MUST be used to dismiss when operation completes
 * 
 * @example
 * // Basic loading notification
 * const loadingId = notifyLoading('Syncing member data...');
 * try {
 *   await syncMembers();
 *   dismissToast(loadingId);
 *   notifySuccess('Member data synced successfully');
 * } catch (error) {
 *   dismissToast(loadingId);
 *   notifyError('Failed to sync member data', error);
 * }
 * 
 * @example
 * // File upload with progress
 * const uploadBadgePhotos = async (files) => {
 *   const loadingId = notifyLoading(`Uploading ${files.length} badge photos...`);
 *   
 *   try {
 *     for (const file of files) {
 *       await uploadFile(file);
 *     }
 *     dismissToast(loadingId);
 *     notifySuccess('All badge photos uploaded successfully');
 *   } catch (error) {
 *     dismissToast(loadingId);
 *     notifyError('Some uploads failed', error);
 *   }
 * };
 * 
 * @example
 * // API call with timeout
 * const fetchWithLoading = async (apiCall, message) => {
 *   const loadingId = notifyLoading(message);
 *   const timeoutId = setTimeout(() => {
 *     dismissToast(loadingId);
 *     notifyWarning('Operation is taking longer than expected...');
 *   }, 10000);
 *   
 *   try {
 *     const result = await apiCall();
 *     clearTimeout(timeoutId);
 *     dismissToast(loadingId);
 *     return result;
 *   } catch (error) {
 *     clearTimeout(timeoutId);
 *     dismissToast(loadingId);
 *     throw error;
 *   }
 * };
 * 
 * @since 2.3.7
 */
export const notifyLoading = (message) => {
  return toast.loading(message, {
    ...defaultToastOptions,
    style: {
      ...defaultToastOptions.style,
      borderLeft: `4px solid ${SCOUT_COLORS.blue}`,
    },
  });
};

/**
 * Displays promise-based notifications that automatically transition states
 * 
 * Shows loading notification initially, then automatically transitions to success
 * or error notification based on promise resolution. Handles the complete lifecycle
 * of async operations with Scout-themed styling for each state.
 * 
 * @param {Promise} promise - Promise to monitor for state changes
 * @param {Object} messages - Messages for each notification state
 * @param {string} messages.loading - Message to show while promise is pending
 * @param {string} messages.success - Message to show when promise resolves
 * @param {string} messages.error - Message to show when promise rejects
 * @returns {Promise} The original promise (allows chaining)
 * 
 * @example
 * // Basic promise notification
 * const saveEvent = () => {
 *   const savePromise = api.saveEvent(eventData);
 *   
 *   return notifyPromise(savePromise, {
 *     loading: 'Saving scout event...',
 *     success: 'Event saved successfully!',
 *     error: 'Failed to save event'
 *   });
 * };
 * 
 * @example
 * // File upload with promise notification
 * const uploadBadgeImage = async (file) => {
 *   const uploadPromise = api.uploadFile(file);
 *   
 *   try {
 *     const result = await notifyPromise(uploadPromise, {
 *       loading: `Uploading ${file.name}...`,
 *       success: 'Badge image uploaded successfully',
 *       error: 'Upload failed. Please try again.'
 *     });
 *     
 *     // Promise resolves with the original result
 *     console.log('Upload completed:', result);
 *     return result;
 *   } catch (error) {
 *     // Error is still thrown for additional handling
 *     console.error('Upload failed:', error);
 *     throw error;
 *   }
 * };
 * 
 * @example
 * // Data sync with contextual messages
 * const syncMemberData = (sectionId) => {
 *   const syncPromise = api.syncMembers(sectionId);
 *   
 *   return notifyPromise(syncPromise, {
 *     loading: 'Syncing member data from OSM...',
 *     success: (data) => `Synced ${data.length} members successfully`,
 *     error: (error) => `Sync failed: ${error.message}`
 *   });
 * };
 * 
 * @example
 * // Bulk operation with promise notification
 * const processBulkAction = async (items, action) => {
 *   const bulkPromise = Promise.all(
 *     items.map(item => api.processItem(item, action))
 *   );
 *   
 *   return notifyPromise(bulkPromise, {
 *     loading: `Processing ${items.length} items...`,
 *     success: `All ${items.length} items processed successfully`,
 *     error: 'Some items failed to process'
 *   });
 * };
 * 
 * @since 2.3.7
 */
export const notifyPromise = (promise, messages) => {
  return toast.promise(promise, messages, {
    ...defaultToastOptions,
    success: {
      style: {
        ...defaultToastOptions.style,
        borderLeft: `4px solid ${SCOUT_COLORS.green}`,
      },
      iconTheme: {
        primary: SCOUT_COLORS.green,
        secondary: SCOUT_COLORS.white,
      },
    },
    error: {
      duration: 6000,
      style: {
        ...defaultToastOptions.style,
        borderLeft: `4px solid ${SCOUT_COLORS.red}`,
      },
      iconTheme: {
        primary: SCOUT_COLORS.red,
        secondary: SCOUT_COLORS.white,
      },
    },
    loading: {
      style: {
        ...defaultToastOptions.style,
        borderLeft: `4px solid ${SCOUT_COLORS.blue}`,
      },
    },
  });
};

/**
 * Dismisses a specific toast notification by ID
 * 
 * Manually dismisses a toast notification using its unique ID. Useful for
 * dismissing loading notifications when operations complete, or for programmatic
 * control over notification visibility.
 * 
 * @param {string} toastId - The unique ID of the toast to dismiss
 * 
 * @example
 * // Dismiss loading notification on completion
 * const loadingId = notifyLoading('Processing...');
 * try {
 *   await processData();
 *   dismissToast(loadingId);
 *   notifySuccess('Processing complete');
 * } catch (error) {
 *   dismissToast(loadingId);
 *   notifyError('Processing failed', error);
 * }
 * 
 * @example
 * // Conditional dismissal
 * const showTemporaryNotification = () => {
 *   const notificationId = notifyInfo('This will disappear in 2 seconds');
 *   
 *   setTimeout(() => {
 *     dismissToast(notificationId);
 *   }, 2000);
 * };
 * 
 * @example
 * // Component cleanup
 * const MyComponent = () => {
 *   const [activeToasts, setActiveToasts] = useState([]);
 *   
 *   useEffect(() => {
 *     return () => {
 *       // Cleanup: dismiss all component-specific toasts
 *       activeToasts.forEach(toastId => dismissToast(toastId));
 *     };
 *   }, [activeToasts]);
 *   
 *   const handleNotify = () => {
 *     const id = notifyInfo('Component notification');
 *     setActiveToasts(prev => [...prev, id]);
 *   };
 * };
 * 
 * @since 2.3.7
 */
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

/**
 * Dismisses all currently visible toast notifications
 * 
 * Clears all active toast notifications from the screen. Useful for cleanup
 * operations, navigation events, or when you need to clear the notification
 * area for important new messages.
 * 
 * @example
 * // Clear all notifications on page navigation
 * const navigateToPage = (page) => {
 *   dismissAllToasts();
 *   navigate(page);
 * };
 * 
 * @example
 * // Clear notifications before critical action
 * const handleCriticalAction = () => {
 *   dismissAllToasts();
 *   notifyWarning('This action cannot be undone. Continue?');
 *   // Show confirmation dialog
 * };
 * 
 * @example
 * // Component unmount cleanup
 * const AppComponent = () => {
 *   useEffect(() => {
 *     return () => {
 *       // Clear all notifications when app unmounts
 *       dismissAllToasts();
 *     };
 *   }, []);
 * };
 * 
 * @example
 * // Error boundary cleanup
 * class ErrorBoundary extends React.Component {
 *   componentDidCatch(error, errorInfo) {
 *     dismissAllToasts();
 *     notifyError('An unexpected error occurred');
 *   }
 * }
 * 
 * @since 2.3.7
 */
export const dismissAllToasts = () => {
  toast.dismiss();
};

export default {
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  notifyLoading,
  notifyPromise,
  dismissToast,
  dismissAllToasts,
};