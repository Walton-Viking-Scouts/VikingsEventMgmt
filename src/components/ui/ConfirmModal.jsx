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
      data-oid="obdq_i0"
    >
      <Modal.Header data-oid="_69_vix">
        <Modal.Title data-oid="cnvuh_d">{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body data-oid="x5guis_">
        <p className="text-gray-700 whitespace-pre-line" data-oid="pi0_fuj">
          {message}
        </p>
      </Modal.Body>

      <Modal.Footer align="right" data-oid="sn3:rqx">
        <Button
          variant={cancelVariant}
          onClick={handleCancel}
          className="mr-3"
          data-oid="pg:pi8m"
        >
          {cancelText}
        </Button>
        <Button
          variant={confirmVariant}
          onClick={handleConfirm}
          data-oid="fs0i8js"
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
