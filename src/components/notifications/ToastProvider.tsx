import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Notification } from '../../contexts/notifications/types';
import ToastContainer from './ToastContainer';

interface ToastContextType {
  toasts: Notification[];
  addToast: (toast: Omit<Notification, 'id' | 'timestamp'>) => string;
  updateToast: (id: string, toast: Partial<Notification>) => void;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
  // Shorthand methods
  success: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  error: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  warning: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  info: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Notification[]>([]);

  const addToast = useCallback((toast: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = uuidv4();
    const newToast = {
      ...toast,
      id,
      timestamp: Date.now()
    };
    
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const updateToast = useCallback((id: string, toast: Partial<Notification>) => {
    setToasts(prev =>
      prev.map(t => t.id === id ? { ...t, ...toast } : t)
    );
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Shorthand methods with default configurations
  const success = useCallback((message: string, options = {}) => {
    return addToast({
      type: 'success',
      message,
      duration: 4000,
      persistent: false,
      ...options
    });
  }, [addToast]);

  const error = useCallback((message: string, options = {}) => {
    return addToast({
      type: 'error',
      message,
      duration: 8000,
      persistent: false,
      ...options
    });
  }, [addToast]);

  const warning = useCallback((message: string, options = {}) => {
    return addToast({
      type: 'warning',
      message,
      duration: 6000,
      persistent: false,
      ...options
    });
  }, [addToast]);

  const info = useCallback((message: string, options = {}) => {
    return addToast({
      type: 'info',
      message,
      duration: 5000,
      persistent: false,
      ...options
    });
  }, [addToast]);

  const value = {
    toasts,
    addToast,
    updateToast,
    removeToast,
    removeAllToasts,
    success,
    error,
    warning,
    info
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};