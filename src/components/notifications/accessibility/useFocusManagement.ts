import { useEffect, useRef, RefObject } from 'react';

/**
 * Custom hook for managing focus when notifications appear and are dismissed
 * Ensures proper focus management for accessibility
 * 
 * @param isCritical - Whether this is a critical notification that should receive focus
 * @param notificationRef - Ref to the notification element
 * @param isVisible - Whether the notification is currently visible
 */
export const useFocusManagement = (
  isCritical: boolean,
  notificationRef: RefObject<HTMLElement>,
  isVisible: boolean = true
) => {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    // Store the previously focused element when notification appears
    if (isVisible && !hasFocusedRef.current) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // For critical notifications, move focus to the notification
      if (isCritical && notificationRef.current) {
        // Small delay to ensure the element is rendered and focusable
        const timer = setTimeout(() => {
          if (notificationRef.current && isVisible) {
            // Make the container focusable temporarily
            notificationRef.current.setAttribute('tabindex', '-1');
            notificationRef.current.focus();
            hasFocusedRef.current = true;
          }
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }

    // Return focus to previous element when notification is dismissed
    return () => {
      if (!isVisible && previousFocusRef.current && hasFocusedRef.current) {
        // Small delay to ensure the notification is fully removed
        const timer = setTimeout(() => {
          if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
            previousFocusRef.current.focus();
          }
        }, 50);
        
        return () => clearTimeout(timer);
      }
    };
  }, [isCritical, notificationRef, isVisible]);

  /**
   * Manually return focus to the previously focused element
   */
  const returnFocus = () => {
    if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
      previousFocusRef.current.focus();
      hasFocusedRef.current = false;
    }
  };

  /**
   * Check if focus should be moved to this notification
   */
  const shouldReceiveFocus = () => {
    return isCritical && isVisible && !hasFocusedRef.current;
  };

  return {
    returnFocus,
    shouldReceiveFocus,
    previousFocus: previousFocusRef.current,
  };
};