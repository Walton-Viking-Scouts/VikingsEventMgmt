import { Notification, HistoryNotification } from './types';

/**
 * Notification History Utilities
 * Provides functions for determining which notifications should be added to history
 * and how they should be categorized and prioritized.
 */

export interface ImportanceConfig {
  includeErrors: boolean;
  includePersistent: boolean;
  includeWithActions: boolean;
  includeWarnings: boolean;
  includeSuccessWithActions: boolean;
  includeSystemNotifications: boolean;
  minimumPriority: HistoryNotification['priority'];
}

// Default configuration for which notifications get added to history
export const DEFAULT_IMPORTANCE_CONFIG: ImportanceConfig = {
  includeErrors: true,           // Always include error notifications
  includePersistent: true,       // Include persistent notifications (banners)
  includeWithActions: true,      // Include notifications with action buttons
  includeWarnings: true,         // Include warning notifications
  includeSuccessWithActions: true, // Include success notifications that have actions
  includeSystemNotifications: false, // Don't include general system info by default
  minimumPriority: 'low'         // Include all priorities by default
};

/**
 * Determines if a notification should be added to the history based on importance
 */
export const shouldAddToHistory = (
  notification: Notification, 
  config: ImportanceConfig = DEFAULT_IMPORTANCE_CONFIG
): boolean => {
  // Check priority first - if notification priority would be below minimum, exclude it
  const notificationPriority = determinePriority(notification);
  const priorityLevels: HistoryNotification['priority'][] = ['low', 'medium', 'high', 'critical'];
  const notificationPriorityIndex = priorityLevels.indexOf(notificationPriority);
  const minimumPriorityIndex = priorityLevels.indexOf(config.minimumPriority);
  
  if (notificationPriorityIndex < minimumPriorityIndex) {
    return false;
  }

  // Apply specific inclusion rules
  if (notification.type === 'error' && config.includeErrors) {
    return true;
  }

  if (notification.persistent && config.includePersistent) {
    return true;
  }

  if (notification.actions && notification.actions.length > 0) {
    if (config.includeWithActions) {
      return true;
    }
    // Special case for success notifications with actions
    if (notification.type === 'success' && config.includeSuccessWithActions) {
      return true;
    }
  }

  if (notification.type === 'warning' && config.includeWarnings) {
    return true;
  }

  // Check for system notifications (custom type often indicates system messages)
  if (notification.type === 'custom' && config.includeSystemNotifications) {
    return true;
  }

  return false;
};

/**
 * Determines the category for a history notification
 */
export const determineCategory = (notification: Notification): HistoryNotification['category'] => {
  switch (notification.type) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    case 'info':
      return 'info';
    case 'custom':
      // Analyze message content to determine if it's system-related
      const message = notification.message.toLowerCase();
      if (message.includes('sync') || message.includes('backup') || message.includes('system')) {
        return 'system';
      }
      return 'user-action';
    default:
      return 'info';
  }
};

/**
 * Determines the priority level for a notification
 */
export const determinePriority = (notification: Notification): HistoryNotification['priority'] => {
  // Check for explicit critical indicators
  if (notification.message.toLowerCase().includes('critical') || 
      notification.message.toLowerCase().includes('urgent')) {
    return 'critical';
  }

  // Error notifications are generally high priority
  if (notification.type === 'error') {
    return 'high';
  }

  // Persistent notifications are important
  if (notification.persistent) {
    return 'medium';
  }

  // Notifications with actions require user attention
  if (notification.actions && notification.actions.length > 0) {
    return 'medium';
  }

  // Warning notifications are medium priority
  if (notification.type === 'warning') {
    return 'medium';
  }

  // Default to low priority
  return 'low';
};

/**
 * Enhanced priority determination with context awareness
 */
export const determinePriorityWithContext = (
  notification: Notification, 
  context?: { source?: string; isUserAction?: boolean; affectsWorkflow?: boolean }
): HistoryNotification['priority'] => {
  const basePriority = determinePriority(notification);

  // Upgrade priority based on context
  if (context?.affectsWorkflow) {
    if (basePriority === 'low') return 'medium';
    if (basePriority === 'medium') return 'high';
  }

  if (context?.isUserAction && notification.type === 'error') {
    return 'high'; // User-triggered errors should be high priority
  }

  // Downgrade some system notifications
  if (context?.source === 'background-sync' && notification.type === 'info') {
    return 'low';
  }

  return basePriority;
};

/**
 * Determines the appropriate source string for a notification
 */
export const determineSource = (
  notification: Notification,
  context?: { component?: string; action?: string; page?: string }
): string => {
  if (context?.component && context?.action) {
    return `${context.component}-${context.action}`;
  }

  if (context?.page) {
    return context.page;
  }

  // Try to infer from notification content
  const message = notification.message.toLowerCase();
  
  if (message.includes('sync')) return 'data-sync';
  if (message.includes('save') || message.includes('update')) return 'user-action';
  if (message.includes('login') || message.includes('auth')) return 'authentication';
  if (message.includes('network') || message.includes('connection')) return 'network';
  if (message.includes('validation') || message.includes('error')) return 'form-validation';

  return 'unknown';
};

/**
 * Creates a complete history notification with smart categorization
 */
export const createHistoryNotification = (
  notification: Notification,
  options?: {
    source?: string;
    priority?: HistoryNotification['priority'];
    category?: HistoryNotification['category'];
    context?: {
      component?: string;
      action?: string;
      page?: string;
      isUserAction?: boolean;
      affectsWorkflow?: boolean;
    };
  }
): HistoryNotification => {
  return {
    ...notification,
    wasRead: false,
    source: options?.source || determineSource(notification, options?.context),
    category: options?.category || determineCategory(notification),
    priority: options?.priority || determinePriorityWithContext(notification, options?.context)
  };
};

/**
 * Viking Event Management specific notification rules
 */
export const VIKING_IMPORTANCE_CONFIG: ImportanceConfig = {
  includeErrors: true,                    // Always track errors for debugging
  includePersistent: true,                // Important announcements and alerts
  includeWithActions: true,               // User needs to be able to retry/resolve
  includeWarnings: true,                  // Safety and compliance warnings
  includeSuccessWithActions: true,        // Confirmations with follow-up actions
  includeSystemNotifications: true,       // System status for Scout leaders
  minimumPriority: 'low'                 // Keep everything for audit trail
};

/**
 * Filters for different user roles in Viking Event Management
 */
export const ROLE_BASED_CONFIGS = {
  'scout-leader': VIKING_IMPORTANCE_CONFIG,
  'parent': {
    ...DEFAULT_IMPORTANCE_CONFIG,
    includeSystemNotifications: false,    // Parents don't need system notifications
    minimumPriority: 'medium' as const   // Only show important stuff to parents
  },
  'admin': {
    ...VIKING_IMPORTANCE_CONFIG,
    includeSystemNotifications: true,     // Admins need all system info
    minimumPriority: 'low' as const       // Admins see everything
  }
};

/**
 * Get configuration based on user role
 */
export const getImportanceConfigForRole = (role?: string): ImportanceConfig => {
  if (role && role in ROLE_BASED_CONFIGS) {
    return ROLE_BASED_CONFIGS[role as keyof typeof ROLE_BASED_CONFIGS];
  }
  return DEFAULT_IMPORTANCE_CONFIG;
};