import React, { useState, useEffect, useRef } from 'react';
import { Notification } from '../../contexts/notifications/types';
import { cn } from '../../utils/cn';
import { useKeyboardNavigation, useFocusManagement, ScreenReaderText, useNotificationAccessibility } from './accessibility';

interface ToastProps {
  notification: Notification;
  onDismiss: () => void;
  className?: string;
  autoDismissTimeout?: number;
}

const typeStyles = {
  error: 'bg-red-100 text-red-800 border-red-400 dark:bg-red-900 dark:text-red-100 dark:border-red-700',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-400 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-700',
  info: 'bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700',
  success: 'bg-green-100 text-green-800 border-green-400 dark:bg-green-900 dark:text-green-100 dark:border-green-700',
  custom: 'bg-gray-100 text-gray-800 border-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600'
};

const getTypeIcon = (type: Notification['type']) => {
  switch (type) {
    case 'error':
      return (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'info':
      return (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'success':
      return (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
};

const Toast: React.FC<ToastProps> = ({ 
  notification, 
  onDismiss, 
  className = '',
  autoDismissTimeout 
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const { type, message, icon, actions, duration, persistent } = notification;
  
  // Use notification's duration or prop, with fallback
  const timeoutDuration = autoDismissTimeout ?? duration ?? 0;
  
  // Refs for accessibility
  const toastRef = useRef<HTMLDivElement>(null);

  const handleDismiss = () => {
    setIsExiting(true);
    setIsVisible(false);
    // Actual onDismiss will be called after animation completes
  };
  
  // Accessibility hooks
  const { attributes, screenReaderText, isCritical } = useNotificationAccessibility(type, message, isVisible);
  const { returnFocus } = useFocusManagement(isCritical, toastRef, isVisible);
  const { focusContainer } = useKeyboardNavigation(handleDismiss, toastRef, !persistent);
  
  // Focus container for critical notifications on mount
  useEffect(() => {
    if (isCritical && toastRef.current) {
      const timer = setTimeout(() => {
        focusContainer();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isCritical, focusContainer]);

  // Auto-dismissal logic
  useEffect(() => {
    if (!persistent && timeoutDuration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, timeoutDuration);
      
      return () => clearTimeout(timer);
    }
  }, [persistent, timeoutDuration]);

  // Handle animation end
  const handleAnimationEnd = () => {
    if (isExiting) {
      // Return focus before dismissing for critical notifications
      if (isCritical) {
        returnFocus();
      }
      onDismiss();
    }
  };
  
  return (
    <div
      ref={toastRef}
      className={cn(
        'rounded-md p-4 shadow-lg border flex items-start max-w-md transition-all duration-300',
        typeStyles[type],
        isExiting 
          ? 'opacity-0 transform translate-y-2 scale-95' 
          : 'opacity-100 transform translate-y-0 scale-100',
        // Add focus styles for accessibility
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
        className
      )}
      {...attributes}
      onTransitionEnd={handleAnimationEnd}
      tabIndex={isCritical ? -1 : undefined}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mr-3">
        {icon || getTypeIcon(type)}
      </div>

      {/* Content */}
      <div className="flex-1">
        <ScreenReaderText>{screenReaderText}</ScreenReaderText>
        <p className="text-sm font-medium" aria-hidden="true">{message}</p>
        
        {/* Action buttons */}
        {actions && actions.length > 0 && (
          <div className="mt-2 flex space-x-2" role="group" aria-label="Notification actions">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className="text-xs font-medium px-2 py-1 rounded border border-current hover:bg-current hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current transition-colors"
                type="button"
                aria-describedby={`toast-${notification.id}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 ml-4 text-current hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current transition-opacity"
        aria-label={`Dismiss ${type} notification`}
        type="button"
        title={`Dismiss ${type} notification`}
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
};

export default Toast;