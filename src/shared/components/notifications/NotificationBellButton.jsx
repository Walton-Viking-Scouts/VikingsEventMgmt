import React from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useNotification } from '../../contexts/notifications';

const NotificationBellButton = ({ 
  onClick, 
  className = '', 
  size = 'md',
  ...props 
}) => {
  const { unreadCount } = useNotification();

  // Size variants for responsive design
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6',
  };

  const badgeSizeClasses = {
    sm: 'w-3 h-3 text-xs min-w-[12px]',
    md: 'w-4 h-4 text-xs min-w-[16px]',
    lg: 'w-5 h-5 text-sm min-w-[20px]',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative
        inline-flex
        items-center
        justify-center
        rounded-md
        text-gray-600
        hover:text-gray-900
        hover:bg-gray-100
        focus:outline-none
        focus:ring-2
        focus:ring-scout-blue
        focus:ring-offset-2
        transition-colors
        duration-200
        ${sizeClasses[size]}
        ${className}
      `}
      aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      {...props}
    >
      <BellIcon className={iconSizeClasses[size]} />
      
      {/* Unread count badge */}
      {unreadCount > 0 && (
        <span className={`
          absolute
          -top-1
          -right-1
          ${badgeSizeClasses[size]}
          bg-red-500
          text-white
          rounded-full
          flex
          items-center
          justify-center
          font-medium
          leading-none
          transform
          scale-100
          animate-pulse
        `}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBellButton;