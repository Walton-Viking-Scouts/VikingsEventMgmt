import React from "react";
import { cn } from "../../utils/cn";

/**
 * Tailwind-based Card component to replace Bootstrap cards
 */
const Card = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-gray-200 shadow-sm",
        className,
      )}
      {...props}
      data-oid="h17s4y4"
    >
      {children}
    </div>
  );
};

const CardHeader = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg",
        className,
      )}
      {...props}
      data-oid="-dj:l.5"
    >
      {children}
    </div>
  );
};

const CardTitle = ({
  children,
  className = "",
  as: Component = "h3",
  ...props
}) => {
  return (
    <Component
      className={cn("text-lg font-semibold text-gray-900 m-0", className)}
      {...props}
      data-oid="j3o:tfr"
    >
      {children}
    </Component>
  );
};

const CardBody = ({ children, className = "", ...props }) => {
  return (
    <div className={cn("p-4", className)} {...props} data-oid="m6.-9fx">
      {children}
    </div>
  );
};

const CardFooter = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn(
        "px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg",
        className,
      )}
      {...props}
      data-oid="rl9g1xx"
    >
      {children}
    </div>
  );
};

// Export individual components
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
export { CardHeader, CardTitle, CardBody, CardFooter };
