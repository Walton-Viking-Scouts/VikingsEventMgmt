import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationContextType, HistoryNotification, NotificationPreferences } from './types';
import { createNotificationConfig } from './config';
import { 
  shouldAddToHistory, 
  createHistoryNotification, 
  DEFAULT_IMPORTANCE_CONFIG,
  getImportanceConfigForRole,
  type ImportanceConfig 
} from './historyUtils';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Helper functions for history management
const HISTORY_STORAGE_KEY = 'notification_history';
const PREFERENCES_STORAGE_KEY = 'notification_preferences';
const ACTIVE_NOTIFICATIONS_STORAGE_KEY = 'active_notifications';
const MAX_HISTORY_ITEMS = 50;
const HISTORY_RETENTION_DAYS = 30;

// Default preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  sound: false,
  persistent: false,
  duration: 5000,
  types: {
    success: true,
    error: true,
    warning: true,
    info: true,
  },
  saveHistory: true,
  maxHistoryEntries: 100,
};

// Fallback storage for when localStorage fails
let memoryFallbackHistory: HistoryNotification[] = [];
let usingFallbackStorage = false;

// Configuration for notification importance - can be customized per user role
const getHistoryConfig = (): ImportanceConfig => {
  // In a real app, this would come from user context/settings
  // For now, use default or role-based config
  const userRole = 'scout-leader'; // This would come from auth context
  return getImportanceConfigForRole(userRole);
};

const loadHistoryFromStorage = (): HistoryNotification[] => {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      const history: HistoryNotification[] = JSON.parse(stored);
      // Filter out old items
      const cutoffTime = Date.now() - (HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const filtered = history.filter(item => item.timestamp > cutoffTime);
      
      // If we were using fallback storage, sync it back to localStorage
      if (usingFallbackStorage && filtered.length > 0) {
        usingFallbackStorage = false;
        memoryFallbackHistory = [];
      }
      
      return filtered;
    }
  } catch (error) {
    console.warn('Failed to load notification history from localStorage, using fallback storage:', error);
    usingFallbackStorage = true;
    
    // Filter old items from fallback storage too
    const cutoffTime = Date.now() - (HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    memoryFallbackHistory = memoryFallbackHistory.filter(item => item.timestamp > cutoffTime);
    
    return memoryFallbackHistory;
  }
  return [];
};

const saveHistoryToStorage = (history: HistoryNotification[]): void => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    
    // If save is successful and we were using fallback storage, we can clear it
    if (usingFallbackStorage) {
      usingFallbackStorage = false;
      memoryFallbackHistory = [];
    }
  } catch (error) {
    console.warn('Failed to save notification history to localStorage, using fallback storage:', error);
    
    // Fall back to in-memory storage
    usingFallbackStorage = true;
    memoryFallbackHistory = [...history];
    
    // Try to clean up old items in fallback storage
    const cutoffTime = Date.now() - (HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    memoryFallbackHistory = memoryFallbackHistory
      .filter(item => item.timestamp > cutoffTime)
      .slice(0, MAX_HISTORY_ITEMS);
  }
};

const loadPreferencesFromStorage = (): NotificationPreferences => {
  try {
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (stored) {
      const preferences = JSON.parse(stored);
      // Merge with defaults to handle new preferences
      return { ...DEFAULT_PREFERENCES, ...preferences };
    }
  } catch (error) {
    console.warn('Failed to load notification preferences from localStorage:', error);
  }
  return DEFAULT_PREFERENCES;
};

const savePreferencesToStorage = (preferences: NotificationPreferences) => {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save notification preferences to localStorage:', error);
  }
};

// Active notifications persistence
const loadActiveNotificationsFromStorage = (): Notification[] => {
  try {
    const stored = sessionStorage.getItem(ACTIVE_NOTIFICATIONS_STORAGE_KEY);
    if (stored) {
      const notifications: Notification[] = JSON.parse(stored);
      const now = Date.now();
      // Filter out expired notifications
      return notifications.filter(notification => {
        if (notification.persistent) return true;
        if (!notification.duration) return true;
        const timeElapsed = now - notification.timestamp;
        return timeElapsed < notification.duration;
      });
    }
  } catch (error) {
    console.warn('Failed to load active notifications from sessionStorage:', error);
  }
  return [];
};

const saveActiveNotificationsToStorage = (notifications: Notification[]) => {
  try {
    sessionStorage.setItem(ACTIVE_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.warn('Failed to save active notifications to sessionStorage:', error);
  }
};

export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<HistoryNotification[]>(() => loadHistoryFromStorage());
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => loadPreferencesFromStorage());

  // History management functions
  const addToHistory = useCallback((notification: Notification, options?: { 
    source?: string; 
    priority?: HistoryNotification['priority'];
    context?: {
      component?: string;
      action?: string;
      page?: string;
      isUserAction?: boolean;
      affectsWorkflow?: boolean;
    };
  }) => {
    const historyItem = createHistoryNotification(notification, {
      source: options?.source,
      priority: options?.priority,
      context: options?.context
    });

    setHistory(prev => {
      // Remove duplicates and add new item
      const filtered = prev.filter(item => item.id !== notification.id);
      const updated = [historyItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveHistoryToStorage(updated);
      return updated;
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, wasRead: true } : item
      );
      saveHistoryToStorage(updated);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setHistory(prev => {
      const updated = prev.map(item => ({ ...item, wasRead: true }));
      saveHistoryToStorage(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistoryToStorage([]);
  }, []);

  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      saveHistoryToStorage(updated);
      return updated;
    });
  }, []);

  // Auto-dismissal logic - set timeouts only when notifications are added
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Create timeout when notification is added (not in useEffect)
  const scheduleRemoval = useCallback((notification: Notification) => {
    if (!notification.persistent && notification.duration && !timeoutsRef.current.has(notification.id)) {
      const timeout = setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
        timeoutsRef.current.delete(notification.id);
      }, notification.duration);
      
      timeoutsRef.current.set(notification.id, timeout);
    }
  }, []);

  const notify = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    // Check if notifications are enabled and type is allowed
    if (!preferences.enabled || !preferences.types[notification.type as keyof typeof preferences.types]) {
      return '';
    }

    const id = uuidv4();
    const newNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
      // Apply preferences to notification properties
      duration: notification.duration ?? (preferences.persistent ? undefined : preferences.duration),
      persistent: notification.persistent ?? preferences.persistent
    };
    
    
    setNotifications(prev => [...prev, newNotification]);
    
    // Schedule auto-dismissal if needed
    scheduleRemoval(newNotification);
    
    // Auto-add to history if preferences allow and it meets the importance criteria
    if (preferences.saveHistory) {
      const historyConfig = getHistoryConfig();
      if (shouldAddToHistory(newNotification, historyConfig)) {
        addToHistory(newNotification, { 
          source: 'notification-system',
          context: {
            isUserAction: false,
            affectsWorkflow: newNotification.type === 'error' || newNotification.persistent
          }
        });
      }
    }
    
    return id;
  }, [addToHistory, preferences, scheduleRemoval]);

  const remove = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const removeAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const notifyWithType = useCallback((type: Notification['type'], message: string, options = {}) => {
    const notificationConfig = createNotificationConfig(type, message, options);
    return notify(notificationConfig);
  }, [notify]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  // Calculate unread count
  const unreadCount = history.filter(item => !item.wasRead).length;

  // Preferences management
  const updatePreferences = useCallback((newPreferences: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPreferences };
      savePreferencesToStorage(updated);
      return updated;
    });
  }, []);

  const value = {
    notifications,
    notify,
    notifyError: (message: string, options = {}) => notifyWithType('error', message, options),
    notifyWarning: (message: string, options = {}) => notifyWithType('warning', message, options),
    notifyInfo: (message: string, options = {}) => notifyWithType('info', message, options),
    notifySuccess: (message: string, options = {}) => notifyWithType('success', message, options),
    remove,
    removeAll,
    
    // History functionality
    history,
    unreadCount,
    addToHistory,
    markAsRead,
    markAllAsRead,
    clearHistory,
    removeFromHistory,
    
    // Preferences functionality
    preferences,
    updatePreferences
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};