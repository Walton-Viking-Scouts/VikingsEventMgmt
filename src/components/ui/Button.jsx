import React from "react";
import { cn } from "../../utils/cn";

/**
 * Tailwind-based Button component with Scout theme variants
 * Can be used alongside existing Bootstrap buttons during migration
 */
const Button = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  disabled = false,
  loading = false,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    // Scout-themed variants
    "scout-blue":
      "bg-scout-blue text-white hover:bg-scout-blue-dark focus:ring-scout-blue-light active:bg-scout-blue-dark",
    "scout-blue-dark":
      "bg-scout-blue-dark text-white hover:bg-scout-blue-dark-dark focus:ring-scout-blue-light active:bg-scout-blue-dark-dark",
    "scout-green":
      "bg-scout-green text-white hover:bg-scout-green-dark focus:ring-scout-green-light active:bg-scout-green-dark",
    "scout-red":
      "bg-scout-red text-white hover:bg-scout-red-dark focus:ring-scout-red-light active:bg-scout-red-dark",
    "scout-orange":
      "bg-scout-orange text-white hover:bg-scout-orange-dark focus:ring-scout-orange-light active:bg-scout-orange-dark",
    "scout-yellow":
      "bg-scout-yellow text-gray-900 hover:bg-scout-yellow-dark focus:ring-scout-yellow-light active:bg-scout-yellow-dark",
    "scout-pink":
      "bg-scout-pink text-gray-900 hover:bg-scout-pink-dark focus:ring-scout-pink-light active:bg-scout-pink-dark",
    "scout-forest-green":
      "bg-scout-forest-green text-white hover:bg-scout-forest-green-dark focus:ring-scout-forest-green-light active:bg-scout-forest-green-dark",
    "scout-purple":
      "bg-scout-purple text-white hover:bg-scout-purple-dark focus:ring-scout-purple-light active:bg-scout-purple-dark",
    "scout-teal":
      "bg-scout-teal text-white hover:bg-scout-teal-dark focus:ring-scout-teal-light active:bg-scout-teal-dark",
    "scout-navy":
      "bg-scout-navy text-white hover:bg-scout-navy-dark focus:ring-scout-navy-light active:bg-scout-navy-dark",

    // Outline variants
    "outline-scout-blue":
      "bg-white border-2 border-scout-blue text-scout-blue hover:bg-scout-blue hover:text-white focus:ring-scout-blue-light",
    "outline-scout-blue-dark":
      "bg-white border-2 border-scout-blue-dark text-scout-blue-dark hover:bg-scout-blue-dark hover:text-white focus:ring-scout-blue-light",
    "outline-scout-green":
      "bg-white border-2 border-scout-green text-scout-green hover:bg-scout-green hover:text-white focus:ring-scout-green-light",
    "outline-scout-red":
      "bg-white border-2 border-scout-red text-scout-red hover:bg-scout-red hover:text-white focus:ring-scout-red-light",
    "outline-scout-forest-green":
      "bg-white border-2 border-scout-forest-green text-scout-forest-green hover:bg-scout-forest-green hover:text-white focus:ring-scout-forest-green-light",
    "outline-scout-purple":
      "bg-white border-2 border-scout-purple text-scout-purple hover:bg-scout-purple hover:text-white focus:ring-scout-purple-light",
    "outline-scout-teal":
      "bg-white border-2 border-scout-teal text-scout-teal hover:bg-scout-teal hover:text-white focus:ring-scout-teal-light",
    "outline-scout-navy":
      "bg-white border-2 border-scout-navy text-scout-navy hover:bg-scout-navy hover:text-white focus:ring-scout-navy-light",

    // Standard variants
    primary:
      "bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-300 active:bg-primary-700",
    secondary:
      "bg-secondary-500 text-white hover:bg-secondary-600 focus:ring-secondary-300 active:bg-secondary-700",
    success:
      "bg-success text-white hover:bg-green-600 focus:ring-green-300 active:bg-green-700",
    warning:
      "bg-warning text-white hover:bg-orange-600 focus:ring-orange-300 active:bg-orange-700",
    error:
      "bg-error text-white hover:bg-red-600 focus:ring-red-300 active:bg-red-700",

    // Utility variants
    ghost: "hover:bg-gray-100 text-gray-700 focus:ring-gray-300",
    outline:
      "border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
    xl: "px-8 py-4 text-xl",
  };

  return (
    <button
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        loading && "cursor-wait",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />

          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
