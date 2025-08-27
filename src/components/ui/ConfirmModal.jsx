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
      data-oid="v2q4cqt"
    >
      <Modal.Header data-oid="y__nt_w">
        <Modal.Title data-oid="rp8q2sv">{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body data-oid="z_7ckny">
        <p className="text-gray-700 whitespace-pre-line" data-oid="-.9bmpz">
          {message}
        </p>
      </Modal.Body>

      <Modal.Footer align="right" data-oid="gtha05n">
        <Button
          type="button"
          variant={cancelVariant}
          onClick={handleCancel}
          className="mr-3"
          data-oid="f:ulqay"
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          onClick={handleConfirm}
          data-oid="a..suhw"
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
