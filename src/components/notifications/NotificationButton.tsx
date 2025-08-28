import React, { useState } from 'react';
import { useNotification } from '../../contexts/notifications/NotificationContext';
import NotificationCenter from './NotificationCenter';

interface NotificationButtonProps {
  className?: string;
  showCount?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const NotificationButton: React.FC<NotificationButtonProps> = ({ 
  className = '',
  showCount = true,
  position = 'top-right'
}) => {
  const { unreadCount } = useNotification();
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Notification Bell Button */}
      <button
        onClick={handleToggle}
        className={`relative p-2 rounded-full text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors ${className}`}
        aria-label={`Open notification center${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {/* Bell Icon */}
        <svg 
          className="h-6 w-6" 
          fill="none" 
          viewBox="0 0 24 24" 
          strokeWidth={1.5} 
          stroke="currentColor"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" 
          />
        </svg>

        {/* Unread Count Badge */}
        {showCount && unreadCount > 0 && (
          <>
            {/* Badge Background Circle */}
            <span 
              className={`absolute ${
                position.includes('right') ? '-top-1 -right-1' : '-top-1 -left-1'
              } inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full min-w-[1.25rem] h-5`}
              aria-hidden="true"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
            
            {/* Screen Reader Text */}
            <span className="sr-only">
              {unreadCount} unread notifications
            </span>
          </>
        )}

        {/* Pulse Animation for New Notifications */}
        {unreadCount > 0 && (
          <span 
            className={`absolute ${
              position.includes('right') ? 'top-0 right-0' : 'top-0 left-0'
            } block h-3 w-3 rounded-full bg-red-400 animate-pulse`}
            aria-hidden="true"
          />
        )}
      </button>

      {/* Notification Center Panel */}
      <NotificationCenter 
        isOpen={isOpen} 
        onClose={handleClose} 
      />
    </>
  );
};

// Alternative compact notification button for tight spaces
export const CompactNotificationButton: React.FC<Pick<NotificationButtonProps, 'className'>> = ({ 
  className = '' 
}) => {
  const { unreadCount } = useNotification();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 ${className}`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
};

// Icon-only notification button for mobile
export const MobileNotificationButton: React.FC<Pick<NotificationButtonProps, 'className'>> = ({ 
  className = '' 
}) => {
  const { unreadCount } = useNotification();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-3 rounded-full text-gray-600 hover:text-gray-800 bg-white shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all touch-manipulation ${className}`}
        aria-label={`Open notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        style={{ minHeight: '48px', minWidth: '48px' }} // Touch-friendly size
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[1.25rem]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
};

export default NotificationButton;