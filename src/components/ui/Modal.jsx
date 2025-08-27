import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";

/**
 * Tailwind-based Modal component with Scout theming
 * Supports different sizes and accessibility features
 */
const Modal = ({
  isOpen = false,
  onClose,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = "",
  children,
  ...props
}) => {
  const modalRef = useRef(null);

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  const sizes = {
    xs: "max-w-xs",
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    full: "max-w-full",
  };

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose?.();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-y-auto" data-oid="iansgwt">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleOverlayClick}
        data-oid="vuxsrtc"
      />

      {/* Modal */}
      <div
        className="flex items-center justify-center min-h-full p-4"
        data-oid="w5ru5dw"
      >
        <div
          ref={modalRef}
          tabIndex={-1}
          className={cn(
            "relative bg-white rounded-lg shadow-xl transform transition-all w-full",
            sizes[size],
            className,
          )}
          {...props}
          data-oid="_adx-p2"
        >
          {showCloseButton && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
              aria-label="Close modal"
              data-oid="xq_kq72"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                data-oid=":4jjypd"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                  data-oid="lnf399u"
                />
              </svg>
            </button>
          )}

          {children}
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at body level
  return createPortal(modalContent, document.body);
};

const ModalHeader = ({ children, className = "", ...props }) => {
  return (
    <div
      className={cn("px-6 py-4 border-b border-gray-200", className)}
      {...props}
      data-oid="a8w5b2w"
    >
      {children}
    </div>
  );
};

const ModalTitle = ({
  children,
  className = "",
  as: Component = "h2",
  ...props
}) => {
  return (
    <Component
      className={cn("text-xl font-semibold text-gray-900 pr-8", className)}
      {...props}
      data-oid="94ykw00"
    >
      {children}
    </Component>
  );
};

const ModalBody = ({ children, className = "", ...props }) => {
  return (
    <div className={cn("px-6 py-4", className)} {...props} data-oid=".iua6jo">
      {children}
    </div>
  );
};

const ModalFooter = ({
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
        "px-6 py-4 border-t border-gray-200 flex gap-3",
        alignClasses[align],
        className,
      )}
      {...props}
      data-oid="jh9oy_-"
    >
      {children}
    </div>
  );
};

// Export compound components
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
export { ModalHeader, ModalTitle, ModalBody, ModalFooter };
