// Platform detection utilities
import React from 'react';
import { Capacitor } from '@capacitor/core';

// Detect if running on native mobile platform
export const isNativeMobile = () => {
  return Capacitor.isNativePlatform();
};

// Detect if device has mobile screen size
export const isMobileScreen = () => {
  return window.innerWidth < 768;
};

// Detect if should use mobile layout (native app OR small screen)
export const isMobileLayout = () => {
  return isNativeMobile() || isMobileScreen();
};

// Detect if should use desktop layout
export const isDesktopLayout = () => {
  return !isMobileLayout();
};

// Get platform type for conditional rendering
export const getPlatform = () => {
  if (isNativeMobile()) return 'native-mobile';
  if (isMobileScreen()) return 'mobile-web';
  return 'desktop';
};

// Check if running in browser (for web-specific features)
export const isBrowser = () => {
  return !Capacitor.isNativePlatform();
};

// Check if print functionality should be available
export const canPrint = () => {
  return isBrowser() && isDesktopLayout();
};

// Responsive breakpoints
export const breakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200
};

// Hook for responsive behavior
export const useResponsive = () => {
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
    screenSize
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
  useResponsive
};