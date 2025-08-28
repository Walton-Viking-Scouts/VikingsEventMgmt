import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotification } from '../../contexts/notifications/NotificationContext';
import { HistoryNotification } from '../../contexts/notifications/types';
import { Button } from '../ui';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const {
    history,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearHistory,
    removeFromHistory
  } = useNotification();

  const [filter, setFilter] = useState<'all' | 'unread' | 'error' | 'today'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Refs for focus management
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  // Filter and search history
  const filteredHistory = history.filter(notification => {
    // Apply filter
    if (filter === 'unread' && notification.wasRead) return false;
    if (filter === 'error' && notification.type !== 'error') return false;
    if (filter === 'today') {
      const today = new Date().toDateString();
      const notificationDate = new Date(notification.timestamp).toDateString();
      if (today !== notificationDate) return false;
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return notification.message.toLowerCase().includes(query) ||
             (notification.source && notification.source.toLowerCase().includes(query));
    }

    return true;
  });

  // Enhanced focus trap and keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap: Tab navigation
      if (event.key === 'Tab') {
        const focusableElements = panelRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
          
          if (event.shiftKey) {
            // Shift+Tab: if focused on first element, go to last
            if (document.activeElement === firstElement) {
              event.preventDefault();
              lastElement.focus();
            }
          } else {
            // Tab: if focused on last element, go to first
            if (document.activeElement === lastElement) {
              event.preventDefault();
              firstElement.focus();
            }
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      
      // Focus on close button when panel opens
      setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    
    return date.toLocaleDateString();
  };

  // Get icon for notification type
  const getTypeIcon = (type: string, priority: string) => {
    if (priority === 'critical') return '🚨';
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      default: return '📋';
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: HistoryNotification) => {
    if (!notification.wasRead) {
      markAsRead(notification.id);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black bg-opacity-25"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ 
                type: 'spring',
                damping: 25,
                stiffness: 300,
                duration: 0.3
              }}
              className="relative w-screen max-w-md"
            >
              <div 
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="notification-center-title"
                className="h-full flex flex-col bg-white dark:bg-gray-800 shadow-xl"
              >
            {/* Header */}
            <div className="px-4 py-6 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="notification-center-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                    Notifications
                  </h2>
                  {unreadCount > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {unreadCount} unread
                    </p>
                  )}
                </div>
                <button
                  ref={firstFocusableRef}
                  data-notification-center-close
                  onClick={onClose}
                  className="rounded-md p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Close notification center"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search and Filters */}
              <div className="mt-4 space-y-3">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Filter Tabs */}
                <div className="flex space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                  {[
                    { key: 'all', label: 'All', count: history.length },
                    { key: 'unread', label: 'Unread', count: unreadCount },
                    { key: 'error', label: 'Errors', count: history.filter(h => h.type === 'error').length },
                    { key: 'today', label: 'Today', count: history.filter(h => new Date(h.timestamp).toDateString() === new Date().toDateString()).length }
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key as any)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        filter === key
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {label} {count > 0 && `(${count})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              {history.length > 0 && (
                <div className="mt-3 flex space-x-2">
                  {unreadCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={markAllAsRead}
                    >
                      Mark All Read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearHistory}
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                  <svg className="h-12 w-12 mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-5 5h5m-5-5v1a3 3 0 01-3 3H9a3 3 0 01-3-3V8a3 3 0 013-3h2m1-3h4l-4 4h4m-4-4v1a3 3 0 013 3v5" />
                  </svg>
                  <p className="text-center">
                    {searchQuery ? 'No notifications match your search' : 
                     filter === 'unread' ? 'No unread notifications' :
                     filter === 'error' ? 'No error notifications' :
                     filter === 'today' ? 'No notifications today' :
                     'No notifications yet'}
                  </p>
                  {history.length > 0 && searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-blue-600 hover:text-blue-500 text-sm"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredHistory.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                        !notification.wasRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          <span className="text-lg">
                            {getTypeIcon(notification.type, notification.priority)}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${
                              !notification.wasRead 
                                ? 'text-gray-900 dark:text-white' 
                                : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {notification.message}
                            </p>
                            {!notification.wasRead && (
                              <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                            )}
                          </div>

                          <div className="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatTimestamp(notification.timestamp)}</span>
                            {notification.source && (
                              <>
                                <span className="mx-1">•</span>
                                <span className="capitalize">{notification.source.replace('-', ' ')}</span>
                              </>
                            )}
                            {notification.priority === 'critical' && (
                              <>
                                <span className="mx-1">•</span>
                                <span className="text-red-600 font-medium">Critical</span>
                              </>
                            )}
                          </div>

                          {/* Actions (if notification had actions) */}
                          {notification.actions && notification.actions.length > 0 && (
                            <div className="mt-2 flex space-x-2">
                              {notification.actions.map((action, index) => (
                                <Button
                                  key={index}
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick();
                                    markAsRead(notification.id);
                                  }}
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromHistory(notification.id);
                          }}
                          className="flex-shrink-0 ml-2 p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label="Remove notification"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {history.length > 0 && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Showing {filteredHistory.length} of {history.length} notifications
                  {history.length >= 50 && (
                    <span className="block mt-1">
                      Older notifications are automatically removed
                    </span>
                  )}
                </div>
              </div>
            )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NotificationCenter;