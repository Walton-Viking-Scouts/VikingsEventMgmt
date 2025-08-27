import React from "react";
import { cn } from "../../utils/cn";

/**
 * Tailwind-based Card component to replace Bootstrap cards
 */
const Card = React.forwardRef(({ children, className = "", ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-white rounded-lg border border-gray-200 shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = "Card";

const CardHeader = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg",
        className,
      )}
      {...props}
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
    >
      {children}
    </Component>
  );
};

const CardBody = ({ children, className = "", ...props }) => {
  return (
    <div className={cn("p-4", className)} {...props}>
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
