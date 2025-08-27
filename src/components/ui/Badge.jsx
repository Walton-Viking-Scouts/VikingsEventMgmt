import React from "react";
import { cn } from "../../utils/cn";

/**
 * Tailwind-based Badge component with Scout theming
 * Used for status indicators, counts, and labels
 */
const Badge = ({
  children,
  variant = "default",
  size = "md",
  className = "",
  ...props
}) => {
  const baseClasses = "inline-flex items-center font-medium rounded-full";

  const variants = {
    default: "bg-gray-100 text-gray-800",

    // Scout variants
    "scout-blue": "bg-scout-blue text-white",
    "scout-green": "bg-scout-green text-white",
    "scout-red": "bg-scout-red text-white",
    "scout-orange": "bg-scout-orange text-white",
    "scout-yellow": "bg-scout-yellow text-gray-900",
    "scout-pink": "bg-scout-pink text-gray-900",
    "scout-forest-green": "bg-scout-forest-green text-white",
    "scout-purple": "bg-scout-purple text-white",
    "scout-teal": "bg-scout-teal text-white",
    "scout-navy": "bg-scout-navy text-white",

    // Outline Scout variants
    "outline-scout-blue": "border border-scout-blue text-scout-blue bg-white",
    "outline-scout-green":
      "border border-scout-green text-scout-green bg-white",
    "outline-scout-red": "border border-scout-red text-scout-red bg-white",
    "outline-scout-forest-green":
      "border border-scout-forest-green text-scout-forest-green bg-white",
    "outline-scout-purple":
      "border border-scout-purple text-scout-purple bg-white",
    "outline-scout-teal": "border border-scout-teal text-scout-teal bg-white",
    "outline-scout-navy": "border border-scout-navy text-scout-navy bg-white",

    // Status variants
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",

    // Outline status variants
    "outline-success": "border border-green-500 text-green-700 bg-white",
    "outline-warning": "border border-yellow-500 text-yellow-700 bg-white",
    "outline-error": "border border-red-500 text-red-700 bg-white",
    "outline-info": "border border-blue-500 text-blue-700 bg-white",

    // Special variants
    dark: "bg-gray-800 text-white",
    light: "bg-gray-50 text-gray-600 border border-gray-200",
  };

  const sizes = {
    xs: "px-2 py-0.5 text-xs",
    sm: "px-2.5 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-3 py-1 text-base",
  };

  return (
    <span
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      {...props}
      data-oid="zz0g8nw"
    >
      {children}
    </span>
  );
};

/**
 * Dot Badge - Small circular indicator
 */
const DotBadge = ({
  variant = "default",
  size = "md",
  className = "",
  ...props
}) => {
  const variants = {
    default: "bg-gray-400",
    "scout-blue": "bg-scout-blue",
    "scout-green": "bg-scout-green",
    "scout-red": "bg-scout-red",
    "scout-orange": "bg-scout-orange",
    "scout-forest-green": "bg-scout-forest-green",
    "scout-purple": "bg-scout-purple",
    "scout-teal": "bg-scout-teal",
    "scout-navy": "bg-scout-navy",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };

  const sizes = {
    xs: "w-1.5 h-1.5",
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  return (
    <span
      className={cn(
        "inline-block rounded-full",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
      data-oid="ozrqxs_"
    />
  );
};

/**
 * Number Badge - For counts and notifications
 */
const NumberBadge = ({
  count,
  max = 99,
  variant = "scout-red",
  size = "md",
  showZero = false,
  className = "",
  ...props
}) => {
  if (!showZero && (!count || count === 0)) return null;

  const displayCount = count > max ? `${max}+` : count;

  const sizes = {
    sm: "min-w-[18px] h-[18px] text-xs",
    md: "min-w-[20px] h-[20px] text-xs",
    lg: "min-w-[24px] h-[24px] text-sm",
  };

  return (
    <Badge
      variant={variant}
      className={cn("justify-center leading-none", sizes[size], className)}
      {...props}
      data-oid="nugrdv6"
    >
      {displayCount}
    </Badge>
  );
};

// Export all badge types
Badge.Dot = DotBadge;
Badge.Number = NumberBadge;

export default Badge;
export { DotBadge, NumberBadge };
