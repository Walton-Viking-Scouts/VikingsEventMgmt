import React from 'react';
import Modal from './Modal';
import Button from './Button';

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
        <Button
          type="button"
          variant={cancelVariant}
          onClick={handleCancel}
          className="mr-3"
          data-oid="67yua3-"
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          onClick={handleConfirm}
          data-oid="ta88f56"
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
