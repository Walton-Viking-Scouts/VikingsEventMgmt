import React from 'react';
import { Notification } from '../../contexts/notifications/types';
import Toast from './Toast';

interface ToastContainerProps {
  toasts: Notification[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed z-50 p-4 flex flex-col gap-3 pointer-events-none
                 md:max-w-sm w-full 
                 md:top-4 md:right-4 
                 bottom-0 left-0 
                 md:bottom-auto md:left-auto
                 md:items-end"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full">
          <Toast
            notification={toast}
            onDismiss={() => onDismiss(toast.id)}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;