import { Capacitor } from '@capacitor/core';

export const isMobileLayout = () => {
  return Capacitor.isNativePlatform() || window.innerWidth < 768;
};
