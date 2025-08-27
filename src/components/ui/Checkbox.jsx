import React, { forwardRef } from "react";
import { cn } from "../../utils/cn";

/**
 * Tailwind-based Checkbox component with Scout theming
 */
const Checkbox = forwardRef(
  (
    {
      size = "md",
      variant = "scout",
      disabled = false,
      className = "",
      label,
      description,
      error = false,
      errorText,
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      "rounded border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      scout:
        "border-scout-blue text-scout-blue focus:ring-scout-blue/20 checked:bg-scout-blue checked:border-scout-blue",
      default:
        "border-gray-300 text-blue-600 focus:ring-blue-500/20 checked:bg-blue-600 checked:border-blue-600",
    };

    const sizes = {
      sm: "h-4 w-4",
      md: "h-5 w-5",
      lg: "h-6 w-6",
    };

    const checkboxClasses = cn(
      baseClasses,
      variants[variant],
      sizes[size],
      error && "border-red-500 focus:ring-red-500/20",
      className,
    );

    const CheckboxElement = (
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        className={checkboxClasses}
        {...props}
        data-oid="7o-ksrs"
      />
    );

    // If no label, return just the checkbox
    if (!label) {
      return CheckboxElement;
    }

    // Return checkbox with label
    return (
      <div data-oid="hoiumub">
        <div className="flex items-start" data-oid="tldv305">
          <div className="flex items-center h-5" data-oid="ge1n_gn">
            {CheckboxElement}
          </div>
          <div className="ml-3" data-oid="l0vr0qg">
            <label
              className={cn(
                "text-sm font-medium",
                error ? "text-red-700" : "text-gray-700",
                disabled ? "text-gray-400" : "cursor-pointer",
              )}
              data-oid="qsiomus"
            >
              {label}
            </label>
            {description && (
              <p
                className={cn(
                  "text-sm",
                  error ? "text-red-600" : "text-gray-500",
                )}
                data-oid="6a:wgf9"
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {error && errorText && (
          <p className="mt-1 text-sm text-red-600" data-oid="b-vhmcx">
            {errorText}
          </p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
