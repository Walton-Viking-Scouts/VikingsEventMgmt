import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tailwind-based Modal component with Scout theming.
 * Renders an accessible dialog with focus trap, return-focus on close,
 * body scroll lock, and Escape-to-close.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is rendered.
 * @param {() => void} props.onClose - Called on overlay click, Escape, or close button.
 * @param {('xs'|'sm'|'md'|'lg'|'xl'|'2xl'|'3xl'|'4xl'|'5xl'|'6xl'|'7xl'|'full')} [props.size]
 * @param {boolean} [props.showCloseButton]
 * @param {boolean} [props.closeOnOverlayClick]
 * @param {boolean} [props.closeOnEscape]
 * @param {string} [props.ariaLabelledBy] - ID of the element labelling the dialog (preferred).
 * @param {string} [props.ariaLabel] - Fallback accessible name when no labelledby is provided.
 * @param {string} [props.ariaDescribedBy] - ID of the element describing the dialog.
 * @param {string} [props.className] - Additional classes applied to the dialog container.
 * @param {React.ReactNode} props.children - Modal content.
 */
const Modal = ({
  isOpen = false,
  onClose,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = '',
  ariaLabelledBy,
  ariaLabel,
  ariaDescribedBy,
  children,
  ...props
}) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousActive = document.activeElement;

    const getFocusable = () => {
      if (!modalRef.current) return [];
      return Array.from(
        modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('aria-hidden'));
    };

    const focusable = getFocusable();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      modalRef.current?.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        modalRef.current?.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const insideModal = modalRef.current?.contains(active);

      if (e.shiftKey) {
        if (!insideModal || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!insideModal || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus();
      }
    };
  }, [isOpen]);

  const sizes = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose?.();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleOverlayClick}
      />

      {/* Modal */}
      <div
        className="flex items-center justify-center min-h-full p-4"
      >
        <div
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          aria-label={ariaLabelledBy ? undefined : (ariaLabel || 'Dialog')}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'relative bg-white rounded-lg shadow-xl transform transition-all w-full',
            sizes[size],
            className,
          )}
          {...props}
        >
          {showCloseButton && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
              aria-label="Close modal"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
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

const ModalHeader = ({ children, className = '', ...props }) => {
  return (
    <div
      className={cn('px-6 py-4 border-b border-gray-200', className)}
      {...props}
    >
      {children}
    </div>
  );
};

const ModalTitle = ({
  children,
  className = '',
  as: Component = 'h2',
  ...props
}) => {
  return (
    <Component
      className={cn('text-xl font-semibold text-gray-900 pr-8', className)}
      {...props}
    >
      {children}
    </Component>
  );
};

const ModalBody = ({ children, className = '', ...props }) => {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
};

const ModalFooter = ({
  children,
  align = 'right',
  className = '',
  ...props
}) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={cn(
        'px-6 py-4 border-t border-gray-200 flex gap-3',
        alignClasses[align],
        className,
      )}
      {...props}
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
