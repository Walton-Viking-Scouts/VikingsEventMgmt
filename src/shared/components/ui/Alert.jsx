import React from 'react';
import { cn } from '../../utils/cn';

/**
 * Tailwind-based Alert component with Scout theming
 * Used for important messages, notifications, and feedback
 */
const Alert = ({
  children,
  variant = 'info',
  size = 'md',
  dismissible = false,
  onDismiss,
  icon = true,
  className = '',
  ...props
}) => {
  const baseClasses = 'rounded-lg border';

  const variants = {
    // Standard variants
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',

    // Scout variants
    'scout-blue': 'bg-scout-blue/10 border-scout-blue/20 text-scout-blue-dark',
    'scout-green':
      'bg-scout-green/10 border-scout-green/20 text-scout-green-dark',
    'scout-red': 'bg-scout-red/10 border-scout-red/20 text-scout-red-dark',
    'scout-orange':
      'bg-scout-orange/10 border-scout-orange/20 text-scout-orange-dark',

    // Special variants
    neutral: 'bg-gray-50 border-gray-200 text-gray-700',
    dark: 'bg-gray-800 border-gray-700 text-white',
  };

  const sizes = {
    sm: 'p-3 text-sm',
    md: 'p-4 text-base',
    lg: 'p-6 text-lg',
  };

  const icons = {
    success: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="lvxhnmb"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
          data-oid="xaa-h8i"
        />
      </svg>
    ),

    warning: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid=".9chbzc"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
          data-oid="d8j9ifr"
        />
      </svg>
    ),

    error: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="3nlj04q"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
          data-oid="6sc1ii0"
        />
      </svg>
    ),

    info: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="p.dp9y6"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
          data-oid="z54j6x6"
        />
      </svg>
    ),

    'scout-blue': (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="gapxvxh"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
          data-oid="ied9vrs"
        />
      </svg>
    ),

    'scout-green': (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="2uzm0uv"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
          data-oid="c.n.ogb"
        />
      </svg>
    ),

    'scout-red': (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="9fonk6k"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
          data-oid="v:.5h9_"
        />
      </svg>
    ),

    'scout-orange': (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="i..:8kd"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
          data-oid="tb:noim"
        />
      </svg>
    ),

    neutral: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="o43m:jl"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
          data-oid="39vpxf9"
        />
      </svg>
    ),

    dark: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="hgo-8mz"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
          data-oid="w5gh:q7"
        />
      </svg>
    ),
  };

  return (
    <div
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      role="alert"
      {...props}
      data-oid=".kboob."
    >
      <div className="flex" data-oid="e8hlro6">
        {icon && (
          <div className="flex-shrink-0" data-oid="cixgqrx">
            {icons[variant] || icons.info}
          </div>
        )}

        <div className={cn('flex-1', icon && 'ml-3')} data-oid="t9y3ta5">
          {children}
        </div>

        {dismissible && (
          <div
            className={cn('ml-auto pl-3', !icon && 'flex-shrink-0')}
            data-oid="eg91ewk"
          >
            <button
              onClick={onDismiss}
              className="inline-flex text-current hover:text-current/80 transition-colors"
              aria-label="Dismiss alert"
              data-oid="6ifq1qx"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                data-oid="fba7p9l"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                  data-oid="jc_6ypg"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AlertTitle = ({ children, className = '', ...props }) => {
  return (
    <h3
      className={cn('text-sm font-medium mb-1', className)}
      {...props}
      data-oid="i8vi:ws"
    >
      {children}
    </h3>
  );
};

const AlertDescription = ({ children, className = '', ...props }) => {
  return (
    <div className={cn('text-sm', className)} {...props} data-oid="ls1o2mn">
      {children}
    </div>
  );
};

const AlertActions = ({ children, className = '', ...props }) => {
  return (
    <div
      className={cn('mt-4 flex gap-2', className)}
      {...props}
      data-oid="9nj4b-2"
    >
      {children}
    </div>
  );
};

// Export compound components
Alert.Title = AlertTitle;
Alert.Description = AlertDescription;
Alert.Actions = AlertActions;

export default Alert;
export { AlertTitle, AlertDescription, AlertActions };
