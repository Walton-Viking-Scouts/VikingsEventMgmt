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
      data-oid="3tc8n24"
    >
      <Modal.Header data-oid="9dd65zb">
        <Modal.Title data-oid="uv7lytw">{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body data-oid="chct:9.">
        <p className="text-gray-700 whitespace-pre-line" data-oid="vx7lloe">
          {message}
        </p>
      </Modal.Body>

      <Modal.Footer align="right" data-oid="lumv:iq">
        <Button
          type="button"
          variant={cancelVariant}
          onClick={handleCancel}
          className="mr-3"
          data-oid="zf-tmwj"
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          onClick={handleConfirm}
          data-oid="6cq6cii"
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
