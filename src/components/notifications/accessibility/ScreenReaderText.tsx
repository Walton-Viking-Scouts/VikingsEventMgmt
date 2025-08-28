import React from 'react';

/**
 * Component for text that is only visible to screen readers
 * Uses Tailwind's sr-only class to hide content visually while keeping it accessible
 */
interface ScreenReaderTextProps {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

export const ScreenReaderText: React.FC<ScreenReaderTextProps> = ({ 
  children, 
  as: Component = 'span',
  className = ''
}) => {
  return (
    <Component className={`sr-only ${className}`}>
      {children}
    </Component>
  );
};

/**
 * Hook to generate accessibility attributes for notifications
 * Provides consistent ARIA attributes based on notification type
 */
export const useNotificationAccessibility = (
  type: 'error' | 'warning' | 'info' | 'success' | 'custom',
  message: string,
  isVisible: boolean = true
) => {
  const isCritical = type === 'error' || type === 'warning';
  
  const attributes = {
    role: isCritical ? 'alert' as const : 'status' as const,
    'aria-live': isCritical ? 'assertive' as const : 'polite' as const,
    'aria-atomic': true,
    'aria-relevant': 'additions text' as const,
    ...(isVisible ? {} : { 'aria-hidden': true }),
  };

  const screenReaderText = `${type} notification: ${message}`;
  
  return {
    attributes,
    screenReaderText,
    isCritical,
  };
};