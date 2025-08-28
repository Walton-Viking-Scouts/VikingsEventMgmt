/**
 * NotificationStyles.tsx
 * 
 * This file exports standardized icons, styles, and animations for the notification system.
 * All styles are designed to meet WCAG AA accessibility standards for color contrast.
 */

import React from 'react';
import { 
  ExclamationCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon, 
  CheckCircleIcon 
} from '@heroicons/react/24/solid';

/**
 * Type definition for notification types
 * Extended to support scout-themed variants for migration compatibility
 */
export type NotificationType = 'error' | 'warning' | 'info' | 'success' | 'custom' | 
  'scout-blue' | 'scout-green' | 'scout-red' | 'scout-orange' | 'neutral' | 'dark';

/**
 * Interface for notification styling configuration
 */
export interface NotificationStylesInterface {
  background: string;
  text: string;
  border: string;
  icon: React.ReactNode;
}

/**
 * Icon components for each notification type
 */
export const ErrorIcon: React.FC = () => (
  <ExclamationCircleIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
);

export const WarningIcon: React.FC = () => (
  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
);

export const InfoIcon: React.FC = () => (
  <InformationCircleIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
);

export const SuccessIcon: React.FC = () => (
  <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
);

/**
 * Scout-themed icon components for backward compatibility with legacy Alert component
 */
export const ScoutBlueIcon: React.FC = () => (
  <InformationCircleIcon className="h-5 w-5 text-scout-blue dark:text-scout-blue-light" />
);

export const ScoutGreenIcon: React.FC = () => (
  <CheckCircleIcon className="h-5 w-5 text-scout-green dark:text-scout-green-light" />
);

export const ScoutRedIcon: React.FC = () => (
  <ExclamationTriangleIcon className="h-5 w-5 text-scout-red dark:text-scout-red-light" />
);

export const ScoutOrangeIcon: React.FC = () => (
  <ExclamationTriangleIcon className="h-5 w-5 text-scout-orange dark:text-scout-orange-light" />
);

export const NeutralIcon: React.FC = () => (
  <InformationCircleIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
);

export const DarkIcon: React.FC = () => (
  <InformationCircleIcon className="h-5 w-5 text-white" />
);

/**
 * TailwindCSS style objects for each notification type
 * Color combinations meet WCAG AA contrast standards
 */
export const notificationStyles: Record<NotificationType, NotificationStylesInterface> = {
  error: {
    background: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-800 dark:text-red-100',
    border: 'border-red-400 dark:border-red-700',
    icon: <ErrorIcon />
  },
  warning: {
    background: 'bg-yellow-100 dark:bg-yellow-900',
    text: 'text-yellow-800 dark:text-yellow-100',
    border: 'border-yellow-400 dark:border-yellow-700',
    icon: <WarningIcon />
  },
  info: {
    background: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-800 dark:text-blue-100',
    border: 'border-blue-400 dark:border-blue-700',
    icon: <InfoIcon />
  },
  success: {
    background: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-800 dark:text-green-100',
    border: 'border-green-400 dark:border-green-700',
    icon: <SuccessIcon />
  },
  custom: {
    background: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-800 dark:text-gray-100',
    border: 'border-gray-400 dark:border-gray-700',
    icon: null
  },
  // Scout-themed variants for legacy Alert component compatibility
  'scout-blue': {
    background: 'bg-scout-blue/10 dark:bg-scout-blue/20',
    text: 'text-scout-blue-dark dark:text-scout-blue-light',
    border: 'border-scout-blue/20 dark:border-scout-blue/40',
    icon: <ScoutBlueIcon />
  },
  'scout-green': {
    background: 'bg-scout-green/10 dark:bg-scout-green/20',
    text: 'text-scout-green-dark dark:text-scout-green-light',
    border: 'border-scout-green/20 dark:border-scout-green/40',
    icon: <ScoutGreenIcon />
  },
  'scout-red': {
    background: 'bg-scout-red/10 dark:bg-scout-red/20',
    text: 'text-scout-red-dark dark:text-scout-red-light',
    border: 'border-scout-red/20 dark:border-scout-red/40',
    icon: <ScoutRedIcon />
  },
  'scout-orange': {
    background: 'bg-scout-orange/10 dark:bg-scout-orange/20',
    text: 'text-scout-orange-dark dark:text-scout-orange-light',
    border: 'border-scout-orange/20 dark:border-scout-orange/40',
    icon: <ScoutOrangeIcon />
  },
  // Additional legacy variants
  neutral: {
    background: 'bg-gray-50 dark:bg-gray-900',
    text: 'text-gray-700 dark:text-gray-200',
    border: 'border-gray-200 dark:border-gray-700',
    icon: <NeutralIcon />
  },
  dark: {
    background: 'bg-gray-800 dark:bg-gray-900',
    text: 'text-white dark:text-gray-100',
    border: 'border-gray-700 dark:border-gray-600',
    icon: <DarkIcon />
  }
};

/**
 * Animation classes for entry/exit transitions
 */
export const animations = {
  toast: {
    enter: 'transform transition ease-out duration-300 translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2',
    enterActive: 'transform transition ease-out duration-300 translate-y-0 opacity-100 sm:translate-x-0',
    exit: 'transition ease-in duration-200 opacity-100',
    exitActive: 'transition ease-in duration-200 opacity-0'
  },
  banner: {
    enter: 'transition ease-out duration-300 transform -translate-y-2 opacity-0',
    enterActive: 'transition ease-out duration-300 transform translate-y-0 opacity-100',
    exit: 'transition ease-in duration-200 opacity-100',
    exitActive: 'transition ease-in duration-200 opacity-0'
  }
};

/**
 * Helper function to get styles for a specific notification type
 * @param type - The notification type
 * @returns The styles object for the specified type
 */
export function getNotificationStyles(type: NotificationType = 'info'): NotificationStylesInterface {
  return notificationStyles[type] || notificationStyles.info;
}

/**
 * Helper function to combine animation classes based on animation state
 * @param componentType - The component type (toast or banner)
 * @param state - The animation state
 * @returns The animation class string
 */
export function getAnimationClasses(
  componentType: 'toast' | 'banner', 
  state: 'enter' | 'enterActive' | 'exit' | 'exitActive'
): string {
  return animations[componentType][state];
}

/**
 * Helper to combine all classes for a notification
 * @param type - The notification type
 * @param componentType - The component type (toast or banner)
 * @returns Combined styles object with container, text, icon, and animations
 */
export function getNotificationClasses(
  type: NotificationType = 'info', 
  componentType: 'toast' | 'banner'
) {
  const styles = getNotificationStyles(type);
  return {
    container: `${styles.background} ${styles.border} rounded-md p-4 shadow-lg`,
    text: styles.text,
    icon: styles.icon,
    animations: animations[componentType]
  };
}

/**
 * Utility function to get icon component by notification type
 * @param type - The notification type
 * @returns The icon component for the specified type
 */
export function getNotificationIcon(type: NotificationType): React.ReactNode {
  const iconComponents = {
    error: <ErrorIcon />,
    warning: <WarningIcon />,
    info: <InfoIcon />,
    success: <SuccessIcon />,
    custom: null,
    // Scout-themed icons for legacy compatibility
    'scout-blue': <ScoutBlueIcon />,
    'scout-green': <ScoutGreenIcon />,
    'scout-red': <ScoutRedIcon />,
    'scout-orange': <ScoutOrangeIcon />,
    neutral: <NeutralIcon />,
    dark: <DarkIcon />
  };
  
  // For custom type, return null explicitly. For invalid types, fallback to info
  if (type === 'custom') {
    return null;
  }
  
  return iconComponents[type] || iconComponents.info;
}

/**
 * Utility function to determine if a notification type should use persistent display by default
 * @param type - The notification type
 * @returns Boolean indicating if the type should be persistent
 */
export function isDefaultPersistent(type: NotificationType): boolean {
  // Error notifications are typically persistent to ensure user sees them
  return type === 'error';
}

/**
 * Get recommended duration for each notification type
 * @param type - The notification type
 * @returns Duration in milliseconds
 */
export function getRecommendedDuration(type: NotificationType): number {
  const durations = {
    error: 8000,    // Errors need more time to read
    warning: 6000,  // Warnings need moderate time
    info: 5000,     // Info is standard
    success: 5000,  // Success is standard
    custom: 5000,   // Custom uses standard
    // Scout-themed durations (mapped to similar base types)
    'scout-blue': 5000,    // Info-like
    'scout-green': 5000,   // Success-like
    'scout-red': 8000,     // Error-like
    'scout-orange': 6000,  // Warning-like
    neutral: 5000,         // Standard
    dark: 5000            // Standard
  };
  
  return durations[type] || durations.info;
}

/**
 * Utility to build accessible attributes for notifications
 * @param type - The notification type
 * @param message - The notification message
 * @returns Object with accessibility attributes
 */
export function getAccessibilityAttributes(type: NotificationType, message: string) {
  const roleMap = {
    error: 'alert',
    warning: 'alert',
    info: 'status',
    success: 'status',
    custom: 'status',
    // Scout-themed accessibility roles (mapped to base types)
    'scout-blue': 'status',     // Info-like
    'scout-green': 'status',    // Success-like
    'scout-red': 'alert',       // Error-like
    'scout-orange': 'alert',    // Warning-like
    neutral: 'status',          // Standard
    dark: 'status'             // Standard
  };
  
  const ariaLiveMap = {
    error: 'assertive',
    warning: 'assertive',
    info: 'polite',
    success: 'polite',
    custom: 'polite',
    // Scout-themed aria-live attributes
    'scout-blue': 'polite',     // Info-like
    'scout-green': 'polite',    // Success-like
    'scout-red': 'assertive',   // Error-like
    'scout-orange': 'assertive', // Warning-like
    neutral: 'polite',          // Standard
    dark: 'polite'             // Standard
  };
  
  return {
    role: roleMap[type] || roleMap.info,
    'aria-live': ariaLiveMap[type] || ariaLiveMap.info,
    'aria-atomic': true,
    'aria-label': `${type} notification: ${message}`
  };
}