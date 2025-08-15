import React, { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

// Memoized chevron icon to avoid recreating on every render
const chevronIcon = (
  <svg
    className="w-5 h-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

/**
 * Tailwind-based Select component with Scout theming
 */
const Select = forwardRef(
  (
    {
      size = 'md',
      variant = 'default',
      error = false,
      success = false,
      disabled = false,
      className = '',
      label,
      helperText,
      errorText,
      placeholder = 'Select an option...',
      children,
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      'w-full rounded-md border bg-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed appearance-none bg-no-repeat bg-right pr-10';

    const variants = {
      default:
        'border-gray-300 text-gray-900 focus:border-scout-blue focus:ring-scout-blue/20',
      scout:
        'border-scout-blue text-gray-900 focus:border-scout-blue-dark focus:ring-scout-blue/30',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-4 py-3 text-lg',
    };

    const states = {
      error: 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
      success:
        'border-green-500 focus:border-green-500 focus:ring-green-500/20',
    };

    // Determine state styling - error takes precedence over success
    let stateClasses = variants[variant];
    if (error) {
      stateClasses = states.error;
    } else if (success) {
      stateClasses = states.success;
    }

    const selectClasses = cn(baseClasses, stateClasses, sizes[size], className);
    
    // Accessibility: stable id for label association and hint text
    const selectId = useId();
    const finalSelectId = props.id ?? selectId;
    const describedById =
      error && errorText
        ? `${finalSelectId}-error`
        : helperText
          ? `${finalSelectId}-help`
          : undefined;


    const SelectElement = (
      <div className="relative">
        <select
          ref={ref}
          id={finalSelectId}
          disabled={disabled}
          className={selectClasses}
          aria-invalid={error || undefined}
          aria-describedby={describedById}
          {...(placeholder && props.value === null && props.defaultValue === null ? { defaultValue: '' } : {})}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {chevronIcon}
        </div>
      </div>
    );

    // If no label, return just the select
    if (!label) {
      return (
        <div>
          {SelectElement}
          {(helperText || errorText) && (
            <p
              id={error ? `${finalSelectId}-error` : `${finalSelectId}-help`}
              className={cn(
                'mt-1 text-sm',
                error ? 'text-red-600' : 'text-gray-600',
              )}
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
        <label htmlFor={finalSelectId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        {SelectElement}
        {(helperText || errorText) && (
          <p
            id={error ? `${finalSelectId}-error` : `${finalSelectId}-help`}
            className={cn(
              'mt-1 text-sm',
              error ? 'text-red-600' : 'text-gray-600',
            )}
          >
            {error ? errorText : helperText}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';

export default Select;
