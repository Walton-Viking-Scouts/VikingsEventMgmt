import { useNotification } from './NotificationContext';
import type { Notification } from './types';

/**
 * Hook that provides utility functions for common notification patterns.
 * Simplifies creating notifications with predefined defaults for different use cases.
 * 
 * @returns Object containing utility functions for toasts, banners, and form submissions
 */
export const useNotificationUtils = () => {
  const { notify } = useNotification();

  return {
    // Toast notifications - appear at corner of screen with auto-dismiss
    toast: {
      /**
       * Display a success toast notification
       * @param message - The message to display
       * @param options - Additional notification options to override defaults
       */
      success: (message: string, options: Partial<Notification> = {}) => {
        return notify({
          type: 'success',
          message,
          duration: 5000,
          ...options,
        });
      },

      /**
       * Display an error toast notification
       * @param message - The message to display
       * @param options - Additional notification options to override defaults
       */
      error: (message: string, options: Partial<Notification> = {}) => {
        return notify({
          type: 'error',
          message,
          duration: 8000, // Errors stay longer by default
          ...options,
        });
      },

      /**
       * Display an info toast notification
       * @param message - The message to display
       * @param options - Additional notification options to override defaults
       */
      info: (message: string, options: Partial<Notification> = {}) => {
        return notify({
          type: 'info',
          message,
          duration: 5000,
          ...options,
        });
      },

      /**
       * Display a warning toast notification
       * @param message - The message to display
       * @param options - Additional notification options to override defaults
       */
      warning: (message: string, options: Partial<Notification> = {}) => {
        return notify({
          type: 'warning',
          message,
          duration: 6000,
          ...options,
        });
      },
    },

    // Banner notifications - appear at top of content and persist until dismissed
    banner: {
      /**
       * Display a success banner notification
       * @param message - The message to display
       * @param options - Additional notification options to override defaults
       */
      success: (message: string, options: Partial<Notification> = {}) => {
        return notify({
          type: 'success',
          message,
          persistent: true,
          ...options,
        });
      },

      /**
       * Display an error banner notification
       * @param message - The message to display
       * @param options - Additional notification options to override defaults
       */
      error: (message: string, options: Partial<Notification> = {}) => {
        return notify({
          type: 'error',
          message,
          persistent: true,
          ...options,
        });
      },

      /**
       * Display an info banner notification
       * @param message - The message to display
       * @param options - Additional notification options to override defaults
       */
      info: (message: string, options: Partial<Notification> = {}) => {
        return notify({
          type: 'info',
          message,
          persistent: true,
          ...options,
        });
      },

      /**
       * Display a warning banner notification
       * @param message - The message to display
       * @param options - Additional notification options to override defaults
       */
      warning: (message: string, options: Partial<Notification> = {}) => {
        return notify({
          type: 'warning',
          message,
          persistent: true,
          ...options,
        });
      },
    },

    // Form submission helpers - simplified notification creation for common form scenarios
    formSubmission: {
      /**
       * Display a success notification for form submission
       * @param message - Optional custom success message
       */
      success: (message = 'Form submitted successfully') => {
        return notify({
          type: 'success',
          message,
          duration: 5000,
        });
      },

      /**
       * Display an error notification for form submission failures
       * @param error - Error object or string
       */
      error: (error: any) => {
        const message = error?.message || 'An error occurred while submitting the form';
        return notify({
          type: 'error',
          message,
          duration: 8000,
        });
      },
    },
  };
};