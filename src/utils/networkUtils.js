// Network utility functions for Vikings Event Management Mobile
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { sentryUtils } from '../services/sentry.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

/**
 * Check current network status across platforms with error handling
 * Works on both web browsers and native mobile platforms (iOS/Android)
 * 
 * @returns {Promise<boolean>} True if network is available, false if offline
 * @throws {Error} If network status cannot be determined
 * 
 * @example
 * // Check network before making API calls
 * const isOnline = await checkNetworkStatus();
 * if (isOnline) {
 *   await fetchDataFromAPI();
 * } else {
 *   loadFromCache();
 * }
 */
export async function checkNetworkStatus() {
  try {
    if (Capacitor.isNativePlatform()) {
      // Native platform - use Capacitor Network plugin
      const status = await Network.getStatus();
      
      // Only log when network status changes (not every check)
      
      return status.connected;
    } else {
      // Web browser - use navigator.onLine
      const isOnline = navigator.onLine;
      
      // Only log network changes, not routine checks
      
      return isOnline;
    }
  } catch (error) {
    // Log network check failure
    logger.error('Failed to check network status', {
      platform: Capacitor.isNativePlatform() ? 'native' : 'web',
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // Capture exception with Sentry
    sentryUtils.captureException(error, {
      tags: {
        operation: 'network_status_check',
        platform: Capacitor.isNativePlatform() ? 'native' : 'web',
      },
      contexts: {
        device: {
          platform: Capacitor.getPlatform(),
          isNative: Capacitor.isNativePlatform(),
        },
      },
    });

    // Rethrow to allow caller to handle
    throw new Error(`Network status check failed: ${error.message}`);
  }
}

/**
 * Get detailed network information with connection type and speed details
 * Provides enhanced network information for native platforms, basic info for web
 * 
 * @returns {Promise<NetworkStatus>} Network status object with detailed information
 * @throws {Error} If network information cannot be retrieved
 * 
 * @typedef {Object} NetworkStatus
 * @property {boolean} connected - Whether device is connected to network
 * @property {string} connectionType - Type of connection ('wifi', 'cellular', 'ethernet', 'unknown')
 * @property {string} [ssid] - WiFi network name (native only, if available)
 * @property {string} [bssid] - WiFi network BSSID (native only, if available)
 * 
 * @example
 * // Get detailed network info for connection quality decisions
 * const networkInfo = await getDetailedNetworkStatus();
 * if (networkInfo.connected && networkInfo.connectionType === 'wifi') {
 *   // High-quality connection - fetch full resolution images
 *   await loadHighResImages();
 * } else if (networkInfo.connected && networkInfo.connectionType === 'cellular') {
 *   // Mobile connection - optimize for data usage
 *   await loadOptimizedContent();
 * }
 */
export async function getDetailedNetworkStatus() {
  try {
    if (Capacitor.isNativePlatform()) {
      // Native platform - get detailed network information
      const status = await Network.getStatus();
      
      // Network status retrieved - routine operation
      
      return status;
    } else {
      // Web browser - limited information available
      const networkInfo = {
        connected: navigator.onLine,
        connectionType: 'unknown',
      };
      
      // Try to get connection info if available (experimental)
      if (navigator.connection) {
        networkInfo.connectionType = navigator.connection.effectiveType || 'unknown';
        networkInfo.downlink = navigator.connection.downlink;
        networkInfo.effectiveType = navigator.connection.effectiveType;
      }
      
      // Network status retrieved - routine operation
      
      return networkInfo;
    }
  } catch (error) {
    logger.error('Failed to get detailed network status', {
      platform: Capacitor.isNativePlatform() ? 'native' : 'web',
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'detailed_network_status',
        platform: Capacitor.isNativePlatform() ? 'native' : 'web',
      },
    });

    throw new Error(`Failed to get network details: ${error.message}`);
  }
}

/**
 * Add network status change listener with error handling
 * Sets up monitoring for network connectivity changes across platforms
 * 
 * @param {NetworkChangeCallback} callback - Function to call when network status changes
 * @returns {Function} Cleanup function to remove the listener
 * @throws {Error} If listener setup fails
 * 
 * @callback NetworkChangeCallback
 * @param {NetworkStatus} status - Network status object containing connection info
 * 
 * @example
 * // Monitor network changes and update UI
 * const removeListener = addNetworkListener((status) => {
 *   if (status.connected) {
 *     console.log('Back online!');
 *     syncPendingData();
 *   } else {
 *     console.log('Gone offline');
 *     showOfflineIndicator();
 *   }
 * });
 * 
 * // Later, clean up the listener
 * removeListener();
 */
export function addNetworkListener(callback) {
  if (typeof callback !== 'function') {
    const error = new Error('Network listener callback must be a function');
    
    logger.error('Invalid network listener callback', {
      providedType: typeof callback,
      isFunction: typeof callback === 'function',
    }, LOG_CATEGORIES.ERROR);
    
    sentryUtils.captureException(error, {
      tags: {
        operation: 'network_listener_setup',
        validation_error: true,
      },
    });
    
    throw error;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      // Native platform - use Capacitor Network plugin
      // Setting up native network listener
      
      const listener = Network.addListener('networkStatusChange', (status) => {
        // Network status changed - callback will handle
        
        callback(status);
      });
      
      return () => {
        // Removing network listener
        listener.remove();
      };
    } else {
      // Web browser - use native browser events
      // Setting up web network listeners
      
      const onlineHandler = () => {
        const status = { connected: true, connectionType: 'unknown' };
        
        // Network came online - callback will handle
        callback(status);
      };
      
      const offlineHandler = () => {
        const status = { connected: false, connectionType: 'unknown' };
        
        // Network went offline - callback will handle
        callback(status);
      };
      
      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);
      
      return () => {
        // Removing web network listeners
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
      };
    }
  } catch (error) {
    logger.error('Failed to setup network listener', {
      platform: Capacitor.isNativePlatform() ? 'native' : 'web',
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'network_listener_setup',
        platform: Capacitor.isNativePlatform() ? 'native' : 'web',
      },
    });

    throw new Error(`Failed to setup network listener: ${error.message}`);
  }
}