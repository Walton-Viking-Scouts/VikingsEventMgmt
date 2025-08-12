import React, { useState, useRef, useEffect } from "react";
import { cn } from "../../utils/cn";

/**
 * Tailwind-based Menu components (Dropdown, Navigation)
 */

const Menu = ({ children, className = "", ...props }) => {
  return (
    <div className={cn("relative", className)} {...props} data-oid="cqbc6bb">
      {children}
    </div>
  );
};

const MenuButton = ({
  children,
  onClick,
  variant = "ghost",
  className = "",
  ...props
}) => {
  const variants = {
    ghost: "text-gray-700 hover:bg-gray-100 focus:bg-gray-100",
    scout: "text-white hover:bg-scout-blue-light focus:bg-scout-blue-light",
    solid: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:bg-gray-300",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue",
        variants[variant],
        className,
      )}
      {...props}
      data-oid="k71eh6j"
    >
      {children}
    </button>
  );
};

const MenuItems = ({
  isOpen = false,
  position = "bottom-left",
  className = "",
  children,
  ...props
}) => {
  const positions = {
    "bottom-left": "top-full left-0 mt-1",
    "bottom-right": "top-full right-0 mt-1",
    "top-left": "bottom-full left-0 mb-1",
    "top-right": "bottom-full right-0 mb-1",
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute z-50 min-w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
        positions[position],
        className,
      )}
      {...props}
      data-oid="p1lio0u"
    >
      <div className="py-1" data-oid="pio-3q_">
        {children}
      </div>
    </div>
  );
};

const MenuItem = ({
  children,
  onClick,
  disabled = false,
  variant = "default",
  className = "",
  ...props
}) => {
  const variants = {
    default: "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
    scout: "text-scout-blue hover:bg-scout-blue hover:text-white",
    danger: "text-red-600 hover:bg-red-50 hover:text-red-700",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full text-left px-4 py-2 text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
      data-oid="---2u0-"
    >
      {children}
    </button>
  );
};

const MenuDivider = ({ className = "", ...props }) => {
  return (
    <div
      className={cn("border-t border-gray-100 my-1", className)}
      {...props}
      data-oid="mra62.a"
    />
  );
};

// Dropdown wrapper with state management
const Dropdown = ({
  trigger,
  children,
  position = "bottom-left",
  closeOnClick = true,
  className = "",
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleItemClick = (callback) => {
    return (...args) => {
      if (closeOnClick) {
        setIsOpen(false);
      }
      if (callback) {
        callback(...args);
      }
    };
  };

  return (
    <Menu ref={dropdownRef} className={className} {...props} data-oid="e10jy28">
      <div onClick={handleToggle} data-oid="5bdpn28">
        {trigger}
      </div>
      <MenuItems isOpen={isOpen} position={position} data-oid="skr5hde">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === MenuItem) {
            return React.cloneElement(child, {
              onClick: handleItemClick(child.props.onClick),
            });
          }
          return child;
        })}
      </MenuItems>
    </Menu>
  );
};

// Navigation components
const Nav = ({
  children,
  className = "",
  variant = "horizontal",
  ...props
}) => {
  const variants = {
    horizontal: "flex space-x-1",
    vertical: "flex flex-col space-y-1",
  };

  return (
    <nav
      className={cn(variants[variant], className)}
      {...props}
      data-oid="jec3qss"
    >
      {children}
    </nav>
  );
};

const NavItem = ({
  children,
  href,
  active = false,
  variant = "default",
  className = "",
  ...props
}) => {
  const variants = {
    default: "text-gray-700 hover:text-gray-900 hover:bg-gray-100",
    scout: "text-white hover:bg-scout-blue-light",
    pills: active
      ? "bg-scout-blue text-white"
      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100",
  };

  const Component = href ? "a" : "button";

  return (
    <Component
      href={href}
      className={cn(
        "px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200",
        variants[variant],
        active && variant !== "pills" && "bg-scout-blue text-white",
        className,
      )}
      {...props}
      data-oid="lhscr5f"
    >
      {children}
    </Component>
  );
};

// Export components
Menu.Button = MenuButton;
Menu.Items = MenuItems;
Menu.Item = MenuItem;
Menu.Divider = MenuDivider;

export default Menu;
export { MenuButton, MenuItems, MenuItem, MenuDivider, Dropdown, Nav, NavItem };
