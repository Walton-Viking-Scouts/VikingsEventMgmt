import { useEffect, RefObject } from 'react';

/**
 * Custom hook for handling keyboard navigation within notifications
 * Provides common keyboard interactions like Escape to dismiss
 * 
 * @param onDismiss - Function to call when notification should be dismissed
 * @param containerRef - Optional ref to the notification container for focus management
 * @param canDismiss - Whether the notification can be dismissed (defaults to true)
 */
export const useKeyboardNavigation = (
  onDismiss: () => void,
  containerRef?: RefObject<HTMLElement>,
  canDismiss: boolean = true
) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key to dismiss notification
      if (event.key === 'Escape' && canDismiss) {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        return;
      }

      // Handle Enter and Space for activation when focused on container
      if (containerRef?.current && document.activeElement === containerRef.current) {
        if (event.key === 'Enter' || event.key === ' ') {
          // Find the first focusable element within the notification
          const focusableElements = containerRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          if (focusableElements.length > 0) {
            event.preventDefault();
            (focusableElements[0] as HTMLElement).focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss, containerRef, canDismiss]);

  /**
   * Focus the notification container (useful for critical notifications)
   */
  const focusContainer = () => {
    if (containerRef?.current) {
      containerRef.current.focus();
    }
  };

  return {
    focusContainer,
  };
};