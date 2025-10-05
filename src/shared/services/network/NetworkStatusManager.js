import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

export const NetworkStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown',
};

export const ConnectionType = {
  WIFI: 'wifi',
  CELLULAR: 'cellular',
  NONE: 'none',
  UNKNOWN: 'unknown',
};

export class NetworkStatusManager {
  constructor(options = {}) {
    this.isNative = Capacitor.isNativePlatform();
    this.currentStatus = NetworkStatus.UNKNOWN;
    this.currentConnectionType = ConnectionType.UNKNOWN;
    this.listeners = [];
    this.networkListener = null;
    this.statusHistory = [];
    this.maxHistorySize = options.maxHistorySize || 100;
    this.offlineThreshold = options.offlineThreshold || 5000; // 5 seconds
    this.lastOnlineTime = null;
    this.lastOfflineTime = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.checkInitialStatus();
      await this.setupNetworkListener();
      this.initialized = true;


      logger.info('NetworkStatusManager initialized', {
        status: this.currentStatus,
        connectionType: this.currentConnectionType,
        isNative: this.isNative,
      }, LOG_CATEGORIES.SYNC);
    } catch (error) {
      logger.error('Failed to initialize NetworkStatusManager', {
        error: error.message,
      }, LOG_CATEGORIES.SYNC);

      this.currentStatus = NetworkStatus.UNKNOWN;
      this.currentConnectionType = ConnectionType.UNKNOWN;
      this.initialized = true;
    }
  }

  async checkInitialStatus() {
    if (this.isNative) {
      try {
        const status = await Network.getStatus();
        this.updateStatus(status.connected ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE);
        this.updateConnectionType(this.mapConnectionType(status.connectionType));

        logger.debug('Initial network status (native)', {
          connected: status.connected,
          connectionType: status.connectionType,
          mappedType: this.currentConnectionType,
        }, LOG_CATEGORIES.SYNC);
      } catch (error) {
        logger.warn('Failed to get native network status', {
          error: error.message,
        }, LOG_CATEGORIES.SYNC);
        await this.fallbackToWebStatus();
      }
    } else {
      await this.fallbackToWebStatus();
    }
  }

  async fallbackToWebStatus() {
    if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
      this.updateStatus(navigator.onLine ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE);
      this.updateConnectionType(this.detectWebConnectionType());

      logger.debug('Initial network status (web)', {
        onLine: navigator.onLine,
        connectionType: this.currentConnectionType,
      }, LOG_CATEGORIES.SYNC);
    } else {
      this.updateStatus(NetworkStatus.UNKNOWN);
      this.updateConnectionType(ConnectionType.UNKNOWN);
    }
  }

  async setupNetworkListener() {
    if (this.isNative) {
      try {
        this.networkListener = await Network.addListener('networkStatusChange', (status) => {
          this.handleNetworkChange(status);
        });

        logger.debug('Native network listener established', {}, LOG_CATEGORIES.SYNC);
      } catch (error) {
        logger.warn('Failed to setup native network listener', {
          error: error.message,
        }, LOG_CATEGORIES.SYNC);
        this.setupWebListener();
      }
    } else {
      this.setupWebListener();
    }
  }

  setupWebListener() {
    if (typeof window !== 'undefined') {
      const handleOnline = () => {
        this.handleNetworkChange({ connected: true, connectionType: 'unknown' });
      };

      const handleOffline = () => {
        this.handleNetworkChange({ connected: false, connectionType: 'none' });
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      this.networkListener = {
        remove: () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        },
      };

      logger.debug('Web network listener established', {}, LOG_CATEGORIES.SYNC);
    }
  }

  handleNetworkChange(status) {
    const wasOnline = this.currentStatus === NetworkStatus.ONLINE;
    const isNowOnline = status.connected;

    this.updateStatus(isNowOnline ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE);
    this.updateConnectionType(this.mapConnectionType(status.connectionType));

    const statusEvent = {
      previousStatus: wasOnline ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE,
      currentStatus: this.currentStatus,
      connectionType: this.currentConnectionType,
      timestamp: Date.now(),
    };

    this.addToHistory(statusEvent);

    if (!wasOnline && isNowOnline) {
      this.handleConnectionRestored();
    } else if (wasOnline && !isNowOnline) {
      this.handleConnectionLost();
    }

    this.notifyListeners('network_change', statusEvent);

    logger.info('Network status changed', {
      wasOnline,
      isNowOnline,
      connectionType: this.currentConnectionType,
      duration: this.getConnectionDuration(),
    }, LOG_CATEGORIES.SYNC);
  }

  handleConnectionRestored() {
    this.lastOnlineTime = Date.now();


    this.notifyListeners('connection_restored', {
      status: this.currentStatus,
      connectionType: this.currentConnectionType,
      offlineDuration: this.lastOfflineTime ? Date.now() - this.lastOfflineTime : null,
    });
  }

  handleConnectionLost() {
    this.lastOfflineTime = Date.now();


    this.notifyListeners('connection_lost', {
      status: this.currentStatus,
      connectionType: this.currentConnectionType,
      onlineDuration: this.lastOnlineTime ? Date.now() - this.lastOnlineTime : null,
    });
  }

  updateStatus(newStatus) {
    if (this.currentStatus !== newStatus) {
      this.currentStatus = newStatus;
    }
  }

  updateConnectionType(newType) {
    if (this.currentConnectionType !== newType) {
      this.currentConnectionType = newType;
    }
  }

  mapConnectionType(nativeType) {
    if (!nativeType) return ConnectionType.UNKNOWN;

    const type = nativeType.toLowerCase();
    if (type === 'wifi') return ConnectionType.WIFI;
    if (type === 'cellular' || type === 'mobile' || type.includes('4g') || type.includes('5g') || type.includes('3g')) {
      return ConnectionType.CELLULAR;
    }
    if (type === 'none') return ConnectionType.NONE;
    return ConnectionType.UNKNOWN;
  }

  detectWebConnectionType() {
    if (typeof navigator !== 'undefined' && navigator.connection) {
      const connection = navigator.connection;
      const type = connection.effectiveType || connection.type;

      if (type) {
        if (type.includes('wifi')) return ConnectionType.WIFI;
        if (type.includes('cellular') || type.includes('4g') || type.includes('3g')) {
          return ConnectionType.CELLULAR;
        }
      }
    }

    return ConnectionType.UNKNOWN;
  }

  addToHistory(event) {
    this.statusHistory.push(event);

    if (this.statusHistory.length > this.maxHistorySize) {
      this.statusHistory.shift();
    }
  }

  isOnline() {
    return this.currentStatus === NetworkStatus.ONLINE;
  }

  isOffline() {
    return this.currentStatus === NetworkStatus.OFFLINE;
  }

  getStatus() {
    return this.currentStatus;
  }

  getConnectionType() {
    return this.currentConnectionType;
  }


  getStatusHistory(limit = null) {
    const history = limit ? this.statusHistory.slice(-limit) : this.statusHistory;
    return [...history];
  }

  getConnectionDuration() {
    const now = Date.now();
    if (this.currentStatus === NetworkStatus.ONLINE && this.lastOnlineTime) {
      return now - this.lastOnlineTime;
    } else if (this.currentStatus === NetworkStatus.OFFLINE && this.lastOfflineTime) {
      return now - this.lastOfflineTime;
    }
    return null;
  }

  getDetailedStatus() {
    return {
      status: this.currentStatus,
      connectionType: this.currentConnectionType,
      isNative: this.isNative,
      lastOnlineTime: this.lastOnlineTime,
      lastOfflineTime: this.lastOfflineTime,
      connectionDuration: this.getConnectionDuration(),
      historySize: this.statusHistory.length,
    };
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  notifyListeners(eventType, data) {
    this.listeners.forEach(callback => {
      try {
        callback(eventType, data);
      } catch (error) {
        logger.error('Error in network status listener', {
          error: error.message,
          eventType,
        }, LOG_CATEGORIES.SYNC);
      }
    });
  }

  async waitForConnection(timeout = 30000) {
    if (this.isOnline()) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout'));
      }, timeout);

      const cleanup = this.addListener((eventType, _data) => {
        if (eventType === 'connection_restored') {
          clearTimeout(timeoutId);
          cleanup();
          resolve(true);
        }
      });
    });
  }

  async destroy() {
    if (this.networkListener) {
      try {
        await this.networkListener.remove();
      } catch (error) {
        logger.warn('Error removing network listener', {
          error: error.message,
        }, LOG_CATEGORIES.SYNC);
      }
    }

    this.listeners = [];
    this.statusHistory = [];
    this.initialized = false;

    logger.info('NetworkStatusManager destroyed', {}, LOG_CATEGORIES.SYNC);
  }
}

export default NetworkStatusManager;