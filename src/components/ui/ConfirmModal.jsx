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
      data-oid="g4irglu"
    >
      <Modal.Header data-oid="bpg5:ua">
        <Modal.Title data-oid="2opln1i">{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body data-oid="wbf4y2r">
        <p className="text-gray-700 whitespace-pre-line" data-oid="5pv1f._">
          {message}
        </p>
      </Modal.Body>

      <Modal.Footer align="right" data-oid="p_qxsdk">
        <Button
          type="button"
          variant={cancelVariant}
          onClick={handleCancel}
          className="mr-3"
          data-oid="h5k_0b-"
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          onClick={handleConfirm}
          data-oid="6l9n4j-"
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
