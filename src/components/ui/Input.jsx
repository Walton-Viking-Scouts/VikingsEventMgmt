import React, { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

/**
 * Tailwind-based Input component with Scout theming
 * Supports all standard input types and states
 */
const Input = forwardRef(
  (
    {
      type = 'text',
      size = 'md',
      variant = 'default',
      error = false,
      success = false,
      disabled = false,
      className = '',
      label,
      helperText,
      errorText,
      leftIcon,
      rightIcon,
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      'w-full rounded-md border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      default:
        'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:border-scout-blue focus:ring-scout-blue/20',
      scout:
        'border-scout-blue bg-white text-gray-900 placeholder-gray-500 focus:border-scout-blue-dark focus:ring-scout-blue/30',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-4 py-3 text-lg',
    };

    const states = {
      error:
        'border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50',
      success:
        'border-green-500 focus:border-green-500 focus:ring-green-500/20 bg-green-50',
    };

    // Determine state styling
    let stateClasses = variants[variant];
    if (error) stateClasses = states.error;
    if (success) stateClasses = states.success;

    const inputClasses = cn(
      baseClasses,
      stateClasses,
      sizes[size],
      leftIcon && 'pl-10',
      rightIcon && 'pr-10',
      className,
    );

    // Accessibility: generate stable ids and aria linkage
    const generatedId = useId();
    const inputId = props.id ?? generatedId;
    const helperId = helperText ? `${inputId}-help` : undefined;
    const errorId = errorText ? `${inputId}-error` : undefined;
    const userDescribedBy = props['aria-describedby'];
    const describedBy =
      [userDescribedBy, error && errorId, helperText && helperId]
        .filter(Boolean)
        .join(' ') || undefined;

    const InputElement = (
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500">{leftIcon}</span>
          </div>
        )}

        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={inputClasses}
          {...props}
          id={inputId}
          aria-invalid={error || undefined}
          aria-describedby={describedBy}
        />

        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500">{rightIcon}</span>
          </div>
        )}
      </div>
    );

    // If no label, return just the input
    if (!label) {
      return (
        <div>
          {InputElement}
          {(helperText || errorText) && (
            <p
              id={error ? errorId : helperId}
              className={cn(
                'mt-1 text-sm',
                error ? 'text-red-600' : 'text-gray-600',
              )}
              aria-live={error ? 'polite' : undefined}
              role={error ? 'alert' : undefined}
            >
              {error ? errorText : helperText}
            </p>
          )}
        </div>
      );
    }

    // Return full form group with label
    return (
      <div>
        <label
          className="block text-sm font-medium text-gray-700 mb-1"
          htmlFor={inputId}
        >
          {label}
        </label>
        {InputElement}
        {(helperText || errorText) && (
          <p
            id={error ? errorId : helperId}
            className={cn(
              'mt-1 text-sm',
              error ? 'text-red-600' : 'text-gray-600',
            )}
            aria-live={error ? 'polite' : undefined}
            role={error ? 'alert' : undefined}
          >
            {error ? errorText : helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
