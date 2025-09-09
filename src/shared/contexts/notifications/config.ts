import { Notification } from './types';

type NotificationDefaults = Omit<Notification, 'id' | 'message' | 'timestamp'>;

export const NOTIFICATION_DEFAULTS: Record<Notification['type'], NotificationDefaults> = {
  error: {
    type: 'error',
    duration: 8000,
    persistent: false,
  },
  warning: {
    type: 'warning',
    duration: 6000,
    persistent: false,
  },
  info: {
    type: 'info',
    duration: 5000,
    persistent: false,
  },
  success: {
    type: 'success',
    duration: 2000,
    persistent: false,
  },
  custom: {
    type: 'custom',
    duration: 5000,
    persistent: false,
  }
};

export const createNotificationConfig = (
  type: Notification['type'],
  message: string,
  customOptions: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>> = {}
): Omit<Notification, 'id' | 'timestamp'> => {
  return {
    ...NOTIFICATION_DEFAULTS[type],
    message,
    ...customOptions
  };
};