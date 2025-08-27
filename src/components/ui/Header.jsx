import React from "react";
import { cn } from "../../utils/cn";

/**
 * Tailwind-based Header component with Scout theming
 * Responsive header with mobile menu support
 */
const Header = ({
  className = "",
  fixed = true,
  variant = "scout",
  children,
  ...props
}) => {
  const variants = {
    scout: "bg-scout-blue text-white shadow-lg",
    white: "bg-white text-gray-900 shadow-sm border-b border-gray-200",
    transparent: "bg-transparent text-gray-900",
  };

  return (
    <header
      className={cn(
        "w-full z-40",
        fixed && "fixed top-0 left-0 right-0",
        variants[variant],
        className,
      )}
      {...props}
      data-oid="3e-crqp"
    >
      {children}
    </header>
  );
};

const HeaderContainer = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn("max-w-7xl mx-auto px-4 md:px-6 lg:px-8", className)}
      {...props}
      data-oid="mgm_u0z"
    >
      {children}
    </div>
  );
};

const HeaderContent = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between h-14 md:h-16",
        className,
      )}
      {...props}
      data-oid="60qf7iq"
    >
      {children}
    </div>
  );
};

const HeaderLeft = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn("flex items-center space-x-2 md:space-x-4", className)}
      {...props}
      data-oid="gw6xglh"
    >
      {children}
    </div>
  );
};

const HeaderCenter = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn("flex-1 flex items-center justify-center px-4", className)}
      {...props}
      data-oid="t4mobuy"
    >
      {children}
    </div>
  );
};

const HeaderRight = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn("flex items-center space-x-2 md:space-x-4", className)}
      {...props}
      data-oid="o-ay5nc"
    >
      {children}
    </div>
  );
};

const HeaderTitle = ({
  children,
  className = "",
  as: Component = "h1",
  ...props
}) => {
  return (
    <Component
      className={cn("text-xl font-semibold", className)}
      {...props}
      data-oid="94ook-1"
    >
      {children}
    </Component>
  );
};

const HeaderLogo = ({ src, alt = "Logo", className = "", ...props }) => {
  return (
    <img
      src={src}
      alt={alt}
      className={cn("h-8 w-auto", className)}
      {...props}
      data-oid="85k7v6h"
    />
  );
};

// Export compound components
Header.Container = HeaderContainer;
Header.Content = HeaderContent;
Header.Left = HeaderLeft;
Header.Center = HeaderCenter;
Header.Right = HeaderRight;
Header.Title = HeaderTitle;
Header.Logo = HeaderLogo;

export default Header;
export {
  HeaderContainer,
  HeaderContent,
  HeaderLeft,
  HeaderCenter,
  HeaderRight,
  HeaderTitle,
  HeaderLogo,
};
