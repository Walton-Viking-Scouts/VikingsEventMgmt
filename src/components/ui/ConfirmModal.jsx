import React from "react";
import Modal from "./Modal";
import Button from "./Button";

/**
 * ConfirmModal - A reusable confirmation modal component
 * Uses the existing Modal infrastructure for consistent styling
 */
const ConfirmModal = ({
  isOpen = false,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  confirmVariant = "primary",
  cancelVariant = "secondary",
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
      data-oid="g-zz-cd"
    >
      <Modal.Header data-oid="grfyo-5">
        <Modal.Title data-oid="cmvc21_">{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body data-oid="0yp.m1j">
        <p className="text-gray-700 whitespace-pre-line" data-oid="1kc-9ku">
          {message}
        </p>
      </Modal.Body>

      <Modal.Footer align="right" data-oid="1zcsdv9">
        <Button
          type="button"
          variant={cancelVariant}
          onClick={handleCancel}
          className="mr-3"
          data-oid="5i8vxfk"
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          onClick={handleConfirm}
          data-oid="b0-vqz:"
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
