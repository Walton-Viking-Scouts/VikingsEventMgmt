// Network utility functions
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

/**
 * Check current network status across platforms
 * @returns {Promise<boolean>} True if online, false if offline
 */
export async function checkNetworkStatus() {
  if (Capacitor.isNativePlatform()) {
    const status = await Network.getStatus();
    return status.connected;
  } else {
    return navigator.onLine;
  }
}

/**
 * Get detailed network information (native platforms only)
 * @returns {Promise<object>} Network status object
 */
export async function getDetailedNetworkStatus() {
  if (Capacitor.isNativePlatform()) {
    return await Network.getStatus();
  } else {
    return {
      connected: navigator.onLine,
      connectionType: 'unknown',
    };
  }
}

/**
 * Add network status change listener
 * @param {Function} callback - Function to call when network status changes
 * @returns {Function} Cleanup function to remove the listener
 */
export function addNetworkListener(callback) {
  if (Capacitor.isNativePlatform()) {
    const listener = Network.addListener('networkStatusChange', callback);
    return () => listener.remove();
  } else {
    const onlineHandler = () => callback({ connected: true });
    const offlineHandler = () => callback({ connected: false });
    
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }
}