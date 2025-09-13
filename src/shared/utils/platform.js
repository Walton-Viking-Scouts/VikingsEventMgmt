// Platform detection utilities
import React from 'react';
import { Capacitor } from '@capacitor/core';

// Detect if running on native mobile platform
export const /**
 * Detects if the application is running on a native mobile platform.
 * Uses Capacitor to determine native app vs web browser execution.
 * @returns {boolean} True if running on native iOS or Android, false for web
 */
  isNativeMobile = () => {
    return Capacitor.isNativePlatform();
  };

// Detect if device has mobile screen size
export const /**
 * Detects if the device has mobile screen dimensions (below 768px width).
 * Used for responsive layout decisions regardless of platform type.
 * @returns {boolean} True if screen width is less than 768px, false otherwise
 */
  isMobileScreen = () => {
    return window.innerWidth < 768;
  };

// Detect if should use mobile layout (native app OR small screen)
export const /**
 * Determines if mobile layout should be used for Scout interface optimization.
 * Combines native platform detection with screen size for layout decisions.
 * @returns {boolean} True if should use mobile layout (native app OR small screen)
 */
  isMobileLayout = () => {
    return isNativeMobile() || isMobileScreen();
  };

// Detect if should use desktop layout
export const /**
 * Determines if desktop layout should be used for Scout interface optimization.
 * Inverse of mobile layout detection for component layout decisions.
 * @returns {boolean} True if should use desktop layout (large screen AND web)
 */
  isDesktopLayout = () => {
    return !isMobileLayout();
  };

// Get platform type for conditional rendering
export const /**
 * Gets the current platform type for conditional rendering and feature detection.
 * Returns specific platform identifier for Scout app behavior customization.
 * @returns {string} Platform type: 'native-mobile', 'mobile-web', or 'desktop'
 */
  getPlatform = () => {
    if (isNativeMobile()) return 'native-mobile';
    if (isMobileScreen()) return 'mobile-web';
    return 'desktop';
  };

// Check if running in browser (for web-specific features)
export const /**
 * Checks if the application is running in a web browser environment.
 * Used to enable browser-specific features and disable native-only functionality.
 * @returns {boolean} True if running in browser, false if native app
 */
  isBrowser = () => {
    return !Capacitor.isNativePlatform();
  };

// Check if print functionality should be available
export const /**
 * Determines if print functionality should be available for Scout documents.
 * Combines browser detection with desktop layout for optimal printing experience.
 * @returns {boolean} True if printing is available and recommended, false otherwise
 */
  canPrint = () => {
    return isBrowser() && isDesktopLayout();
  };

// Responsive breakpoints
export const breakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
};

// Hook for responsive behavior
export const /**
 * React hook for responsive behavior in Scout components.
 * Provides real-time screen size detection with Scout-themed breakpoints.
 * @returns {object} Responsive state with mobile, tablet, desktop flags and screen size
 */
  useResponsive = () => {
    const [screenSize, setScreenSize] = React.useState(window.innerWidth);
  
    React.useEffect(() => {
      const handleResize = () => setScreenSize(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
      isMobile: screenSize < breakpoints.mobile,
      isTablet: screenSize >= breakpoints.mobile && screenSize < breakpoints.desktop,
      isDesktop: screenSize >= breakpoints.desktop,
      screenSize,
    };
  };

export default {
  isNativeMobile,
  isMobileScreen,
  isMobileLayout,
  isDesktopLayout,
  getPlatform,
  isBrowser,
  canPrint,
  breakpoints,
  useResponsive,
};
