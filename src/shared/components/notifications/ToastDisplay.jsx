import React from 'react';
import Toast from './Toast.jsx';

function ToastDisplay({ toasts = [], onDismiss = () => {} }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.type}
          message={toast.message}
          title={toast.title}
          onDismiss={() => onDismiss(toast.id)}
          autoHide={!toast.persistent}
          duration={toast.duration}
        />
      ))}
    </div>
  );
}

export default ToastDisplay;