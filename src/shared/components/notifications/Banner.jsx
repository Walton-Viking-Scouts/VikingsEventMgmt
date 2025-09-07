import React from 'react';
import { getNotificationStyles, getNotificationIcon, getAccessibilityAttributes } from './NotificationStyles.jsx';

function Banner({ 
  variant = 'info', 
  message, 
  title,
  onDismiss,
  dismissible = false,
  className = '',
  ...props 
}) {
  const styles = getNotificationStyles(variant);
  const icon = getNotificationIcon(variant);
  const accessibilityAttrs = getAccessibilityAttributes(variant);

  return (
    <div
      className={`
        flex items-center p-4 border rounded-lg
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
      {dismissible && onDismiss && (
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

export default Banner;