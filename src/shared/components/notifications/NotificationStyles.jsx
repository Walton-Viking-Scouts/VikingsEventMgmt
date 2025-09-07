import React from 'react';

// Notification styles and utilities
export const notificationStyles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  'scout-blue': 'bg-blue-100 border-blue-300 text-blue-900',
  'scout-green': 'bg-green-100 border-green-300 text-green-900',
  'scout-red': 'bg-red-100 border-red-300 text-red-900',
  'scout-orange': 'bg-orange-100 border-orange-300 text-orange-900',
  neutral: 'bg-gray-50 border-gray-200 text-gray-800',
  dark: 'bg-gray-800 border-gray-600 text-gray-100',
};

export const getNotificationStyles = (variant) => {
  return notificationStyles[variant] || notificationStyles.info;
};

export const getNotificationIcon = (variant) => {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
    'scout-blue': '🔵',
    'scout-green': '🟢',
    'scout-red': '🔴',
    'scout-orange': '🟠',
    neutral: '●',
    dark: '●',
  };
  return icons[variant] || icons.info;
};

export const getRecommendedDuration = (variant) => {
  const durations = {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000,
    'scout-blue': 3000,
    'scout-green': 3000,
    'scout-red': 5000,
    'scout-orange': 4000,
    neutral: 3000,
    dark: 3000,
  };
  return durations[variant] || 3000;
};

export const getAccessibilityAttributes = (variant) => {
  const roles = {
    success: { role: 'status', 'aria-live': 'polite' },
    error: { role: 'alert', 'aria-live': 'assertive' },
    warning: { role: 'alert', 'aria-live': 'assertive' },
    info: { role: 'status', 'aria-live': 'polite' },
    'scout-blue': { role: 'status', 'aria-live': 'polite' },
    'scout-green': { role: 'status', 'aria-live': 'polite' },
    'scout-red': { role: 'alert', 'aria-live': 'assertive' },
    'scout-orange': { role: 'alert', 'aria-live': 'assertive' },
    neutral: { role: 'status', 'aria-live': 'polite' },
    dark: { role: 'status', 'aria-live': 'polite' },
  };
  return roles[variant] || roles.info;
};

// Icon components (minimal implementations)
export const ScoutBlueIcon = ({ className = '' }) => (
  <span className={`inline-block text-blue-600 ${className}`}>🔵</span>
);

export const ScoutGreenIcon = ({ className = '' }) => (
  <span className={`inline-block text-green-600 ${className}`}>🟢</span>
);

export const ScoutRedIcon = ({ className = '' }) => (
  <span className={`inline-block text-red-600 ${className}`}>🔴</span>
);

export const ScoutOrangeIcon = ({ className = '' }) => (
  <span className={`inline-block text-orange-600 ${className}`}>🟠</span>
);

export const NeutralIcon = ({ className = '' }) => (
  <span className={`inline-block text-gray-600 ${className}`}>●</span>
);

export const DarkIcon = ({ className = '' }) => (
  <span className={`inline-block text-gray-800 ${className}`}>●</span>
);