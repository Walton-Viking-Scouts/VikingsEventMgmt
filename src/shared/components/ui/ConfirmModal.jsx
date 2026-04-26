import React, { useId } from 'react';
import Modal from './Modal';

/**
 * ConfirmModal - A reusable confirmation modal component
 * Uses the existing Modal infrastructure for consistent styling
 */
const ConfirmModal = ({
  isOpen = false,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  cancelVariant = 'secondary',
  ...props
}) => {
  const titleId = useId();
  // Map Button variants to Tailwind classes
  const getVariantClasses = (variant) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      primary: 'bg-scout-blue text-white hover:bg-scout-blue-dark focus:ring-scout-blue-light active:bg-scout-blue-dark',
      secondary: 'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-300 active:bg-gray-700',
      error: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-300 active:bg-red-800',
      success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-300 active:bg-green-800',
      warning: 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-300 active:bg-orange-800',
    };
    
    return `${baseClasses} ${variantClasses[variant] || variantClasses.primary}`;
  };

  const handleConfirm = () => {
    onConfirm?.();
  };

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      size="sm"
      closeOnOverlayClick={false}
      closeOnEscape={true}
      showCloseButton={false}
      ariaLabelledBy={titleId}
      {...props}
    >
      <Modal.Header>
        <Modal.Title id={titleId}>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="text-gray-700 whitespace-pre-line">
          {message}
        </p>
      </Modal.Body>

      <Modal.Footer align="right">
        <button
          type="button"
          className={`${getVariantClasses(cancelVariant)} mr-3`}
          onClick={handleCancel}
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={getVariantClasses(confirmVariant)}
          onClick={handleConfirm}
        >
          {confirmText}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
