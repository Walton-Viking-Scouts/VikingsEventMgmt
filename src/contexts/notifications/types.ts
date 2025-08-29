import React from 'react';

export interface Notification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success' | 'custom';
  message: string;
  icon?: React.ReactNode;
  duration?: number;
  actions?: Array<{ label: string, onClick: () => void }>;
  persistent?: boolean;
  timestamp: number;
}

export interface HistoryNotification extends Notification {
  wasRead: boolean;
  source?: string;
  category: 'error' | 'success' | 'warning' | 'info' | 'system' | 'user-action';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface NotificationPreferences {
  enabled: boolean;
  sound: boolean;
  persistent: boolean;
  duration: number;
  types: {
    success: boolean;
    error: boolean;
    warning: boolean;
    info: boolean;
  };
  saveHistory: boolean;
  maxHistoryEntries: number;
}

export interface NotificationContextType {
  notifications: Notification[];
  notify: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  notifyError: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  notifyWarning: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  notifyInfo: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  notifySuccess: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  remove: (id: string) => void;
  removeAll: () => void;
  
  // History functionality
  history: HistoryNotification[];
  unreadCount: number;
  addToHistory: (notification: Notification, options?: { 
    source?: string; 
    priority?: HistoryNotification['priority'];
    context?: {
      component?: string;
      action?: string;
      page?: string;
      isUserAction?: boolean;
      affectsWorkflow?: boolean;
    };
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  
  // Preferences functionality
  preferences: NotificationPreferences;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => void;
}