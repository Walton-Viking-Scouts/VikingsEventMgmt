import React from "react";
import { cn } from "../../utils/cn";

/**
 * Tailwind-based Alert component with Scout theming
 * Used for important messages, notifications, and feedback
 */
const Alert = ({
  children,
  variant = "info",
  size = "md",
  dismissible = false,
  onDismiss,
  icon = true,
  className = "",
  ...props
}) => {
  const baseClasses = "rounded-lg border";

  const variants = {
    // Standard variants
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",

    // Scout variants
    "scout-blue": "bg-scout-blue/10 border-scout-blue/20 text-scout-blue-dark",
    "scout-green":
      "bg-scout-green/10 border-scout-green/20 text-scout-green-dark",
    "scout-red": "bg-scout-red/10 border-scout-red/20 text-scout-red-dark",
    "scout-orange":
      "bg-scout-orange/10 border-scout-orange/20 text-scout-orange-dark",

    // Special variants
    neutral: "bg-gray-50 border-gray-200 text-gray-700",
    dark: "bg-gray-800 border-gray-700 text-white",
  };

  const sizes = {
    sm: "p-3 text-sm",
    md: "p-4 text-base",
    lg: "p-6 text-lg",
  };

  const icons = {
    success: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="-.az6af"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
          data-oid="5.v6m64"
        />
      </svg>
    ),

    warning: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="j5teeid"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
          data-oid="-w7fhrp"
        />
      </svg>
    ),

    error: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="v:g79u7"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
          data-oid="6pamp9b"
        />
      </svg>
    ),

    info: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="bizvf8t"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
          data-oid="8-opw15"
        />
      </svg>
    ),

    "scout-blue": (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="wb:-hp8"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
          data-oid="xh50c1i"
        />
      </svg>
    ),

    "scout-green": (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid=":v024d4"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
          data-oid="r9udmqx"
        />
      </svg>
    ),

    "scout-red": (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="afxmcfz"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
          data-oid="7:rum70"
        />
      </svg>
    ),

    "scout-orange": (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="2u1uh9z"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
          data-oid="vf:eh8z"
        />
      </svg>
    ),

    neutral: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="g1y3d_h"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
          data-oid="lcy2w8u"
        />
      </svg>
    ),

    dark: (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        data-oid="d-9q3-z"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
          data-oid="4:7tb0u"
        />
      </svg>
    ),
  };

  return (
    <div
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      role="alert"
      {...props}
      data-oid="1asfhn7"
    >
      <div className="flex" data-oid="prm7pjz">
        {icon && (
          <div className="flex-shrink-0" data-oid="bv0roh8">
            {icons[variant] || icons.info}
          </div>
        )}

        <div className={cn("flex-1", icon && "ml-3")} data-oid="9fvldjg">
          {children}
        </div>

        {dismissible && (
          <div
            className={cn("ml-auto pl-3", !icon && "flex-shrink-0")}
            data-oid="m34n9ut"
          >
            <button
              onClick={onDismiss}
              className="inline-flex text-current hover:text-current/80 transition-colors"
              aria-label="Dismiss alert"
              data-oid="u_h2rv7"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                data-oid="-k71rh-"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                  data-oid="wwcekv4"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AlertTitle = ({ children, className = "", ...props }) => {
  return (
    <h3
      className={cn("text-sm font-medium mb-1", className)}
      {...props}
      data-oid="odvpgdy"
    >
      {children}
    </h3>
  );
};

const AlertDescription = ({ children, className = "", ...props }) => {
  return (
    <div className={cn("text-sm", className)} {...props} data-oid="g6mp.ut">
      {children}
    </div>
  );
};

const AlertActions = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn("mt-4 flex gap-2", className)}
      {...props}
      data-oid="d69g5m1"
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
