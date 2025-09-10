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

// Success notification with scout-green theme
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

// Error notification with scout-red theme and extended duration
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

// Warning notification with amber theme
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

// Info notification with scout-blue theme
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

// Loading notification for async operations
export const notifyLoading = (message) => {
  return toast.loading(message, {
    ...defaultToastOptions,
    style: {
      ...defaultToastOptions.style,
      borderLeft: `4px solid ${SCOUT_COLORS.blue}`,
    },
  });
};

// Promise-based notification for async operations
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

// Dismiss specific toast
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

// Dismiss all toasts
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