import React, { useEffect } from 'react';
import { getNotificationStyles, getNotificationIcon, getRecommendedDuration, getAccessibilityAttributes } from './NotificationStyles.jsx';

function Toast({ 
  variant = 'info', 
  message, 
  title,
  onDismiss,
  autoHide = true,
  duration,
  className = '',
  ...props 
}) {
  const styles = getNotificationStyles(variant);
  const icon = getNotificationIcon(variant);
  const accessibilityAttrs = getAccessibilityAttributes(variant);
  const defaultDuration = getRecommendedDuration(variant);
  const finalDuration = duration || defaultDuration;

  useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, finalDuration);

      return () => clearTimeout(timer);
    }
  }, [autoHide, onDismiss, finalDuration]);

  return (
    <div
      className={`
        flex items-center p-4 border rounded-lg shadow-lg
        max-w-sm transform transition-all duration-300
        ${styles}
        ${className}
      `.trim()}
      {...accessibilityAttrs}
      {...props}
    >
      <div className="flex items-center flex-1">
        <span className="text-lg mr-3" aria-hidden="true">
          {icon}
        </span>
        <div className="flex-1">
          {title && (
            <h4 className="font-medium mb-1">{title}</h4>
          )}
          <p className="text-sm">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-4 flex-shrink-0 text-lg opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default Toast;