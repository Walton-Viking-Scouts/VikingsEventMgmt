import React from "react";
import { cn } from "../../utils/cn";

/**
 * Form layout and grouping components for consistent form structure
 */

const FormGroup = ({ children, className = "", ...props }) => {
  return (
    <div className={cn("space-y-1", className)} {...props} data-oid="4r:8q:a">
      {children}
    </div>
  );
};

const FormRow = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}
      {...props}
      data-oid=":a4qy23"
    >
      {children}
    </div>
  );
};

const FormSection = ({
  title,
  subtitle,
  children,
  className = "",
  ...props
}) => {
  return (
    <div className={cn("space-y-4", className)} {...props} data-oid="gb.lj_z">
      {title && (
        <div data-oid=".b0gqq-">
          <h3 className="text-lg font-medium text-gray-900" data-oid="jr6tu16">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1" data-oid="4pgn6_d">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="space-y-4" data-oid="f3sqrrk">
        {children}
      </div>
    </div>
  );
};

const FormActions = ({
  children,
  align = "right",
  className = "",
  ...props
}) => {
  const alignClasses = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
    between: "justify-between",
  };

  return (
    <div
      className={cn(
        "flex gap-3 pt-4 border-t border-gray-200",
        alignClasses[align],
        className,
      )}
      {...props}
      data-oid="f_wx4m4"
    >
      {children}
    </div>
  );
};

const Label = ({
  children,
  required = false,
  className = "",
  htmlFor,
  ...props
}) => {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-sm font-medium text-gray-700", className)}
      {...props}
      data-oid="mjbu2ng"
    >
      {children}
      {required && (
        <span className="text-red-500 ml-1" data-oid="dqp.b33">
          *
        </span>
      )}
    </label>
  );
};

const HelperText = ({ children, error = false, className = "", ...props }) => {
  return (
    <p
      className={cn(
        "text-sm",
        error ? "text-red-600" : "text-gray-600",
        className,
      )}
      {...props}
      data-oid="k7r2bmb"
    >
      {children}
    </p>
  );
};

const ErrorText = ({ children, className = "", ...props }) => {
  if (!children) return null;

  return (
    <p
      className={cn("text-sm text-red-600", className)}
      {...props}
      data-oid="vrn_.:h"
    >
      {children}
    </p>
  );
};

// Export all components
export {
  FormGroup,
  FormRow,
  FormSection,
  FormActions,
  Label,
  HelperText,
  ErrorText,
};

export default FormGroup;
