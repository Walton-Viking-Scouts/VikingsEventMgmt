export { default as Toast } from './Toast';
export { default as ToastContainer } from './ToastContainer';
export { ToastProvider, useToast } from './ToastProvider';
export { default as Banner } from './Banner';
export { default as BannerContainer } from './BannerContainer';
export { BannerProvider, useBanner } from './BannerProvider';

// Notification History System (NEW)
export { default as NotificationCenter } from './NotificationCenter';
export { 
  default as NotificationButton,
  CompactNotificationButton,
  MobileNotificationButton
} from './NotificationButton';

// Notification styles and utilities
export {
  ErrorIcon,
  WarningIcon,
  InfoIcon,
  SuccessIcon,
  notificationStyles,
  animations,
  getNotificationStyles,
  getAnimationClasses,
  getNotificationClasses,
  getNotificationIcon,
  isDefaultPersistent,
  getRecommendedDuration,
  getAccessibilityAttributes,
  type NotificationType,
  type NotificationStylesInterface
} from './NotificationStyles';

// Accessibility utilities
export {
  useKeyboardNavigation,
  useFocusManagement,
  ScreenReaderText,
  useNotificationAccessibility
} from './accessibility';

// Context and utilities (NEW)
export { NotificationProvider, useNotification } from '../../contexts/notifications/NotificationContext';
export { useNotificationUtils } from '../../contexts/notifications/notificationUtils';

// Types (NEW)
export type { 
  Notification, 
  NotificationContextType,
  HistoryNotification
} from '../../contexts/notifications/types';

// History utilities (NEW)
export {
  shouldAddToHistory,
  determineCategory,
  determinePriority,
  determinePriorityWithContext,
  determineSource,
  createHistoryNotification,
  getImportanceConfigForRole,
  DEFAULT_IMPORTANCE_CONFIG,
  VIKING_IMPORTANCE_CONFIG,
  ROLE_BASED_CONFIGS,
  type ImportanceConfig
} from '../../contexts/notifications/historyUtils';