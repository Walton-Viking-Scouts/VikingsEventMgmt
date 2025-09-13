import React from 'react';
import Modal from './Modal';

/**
 * ConfirmModal - A reusable confirmation modal component
 * Uses the existing Modal infrastructure for consistent styling
 * @param root0
 * @param root0.isOpen
 * @param root0.title
 * @param root0.message
 * @param root0.confirmText
 * @param root0.cancelText
 * @param root0.onConfirm
 * @param root0.onCancel
 * @param root0.confirmVariant
 * @param root0.cancelVariant
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
      {...props}
      data-oid="z5ogv08"
    >
      <Modal.Header data-oid="nllwui0">
        <Modal.Title data-oid="t4l9n15">{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body data-oid="st9dolf">
        <p className="text-gray-700 whitespace-pre-line" data-oid="r1mkeo8">
          {message}
        </p>
      </Modal.Body>

      <Modal.Footer align="right" data-oid=":03x86e">
        <button
          type="button"
          className={`${getVariantClasses(cancelVariant)} mr-3`}
          onClick={handleCancel}
          data-oid="67yua3-"
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={getVariantClasses(confirmVariant)}
          onClick={handleConfirm}
          data-oid="ta88f56"
        >
          {confirmText}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
