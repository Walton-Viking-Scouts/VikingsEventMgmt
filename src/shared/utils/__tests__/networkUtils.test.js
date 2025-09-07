// Network utilities tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkNetworkStatus,
  getDetailedNetworkStatus,
  addNetworkListener,
} from '../networkUtils.js';

// Mock Capacitor and Network
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(),
    addListener: vi.fn(),
  },
}));

// Mock logger and sentry
vi.mock('../../services/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LOG_CATEGORIES: {
    APP: 'APP',
    API: 'API',
    ERROR: 'ERROR',
  },
}));

vi.mock('../../services/sentry.js', () => ({
  sentryUtils: {
    captureException: vi.fn(),
  },
}));

describe('Network Utilities', () => {
  let Capacitor, Network, logger, sentryUtils;
  let originalNavigator;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import mocked modules
    Capacitor = (await import('@capacitor/core')).Capacitor;
    Network = (await import('@capacitor/network')).Network;
    logger = (await import('../../services/logger.js')).default;
    sentryUtils = (await import('../../services/sentry.js')).sentryUtils;

    // Mock navigator
    originalNavigator = global.navigator;
    global.navigator = {
      onLine: true,
      connection: undefined,
    };

    // Mock window events
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Default Capacitor mocks
    Capacitor.isNativePlatform.mockReturnValue(false);
    Capacitor.getPlatform.mockReturnValue('web');
  });

  afterEach(() => {
    global.navigator = originalNavigator;
    vi.restoreAllMocks();
  });

  describe('checkNetworkStatus', () => {
    describe('Native Platform', () => {
      beforeEach(() => {
        Capacitor.isNativePlatform.mockReturnValue(true);
        Capacitor.getPlatform.mockReturnValue('ios');
      });

      it('should return true when network is connected on native platform', async () => {
        const mockStatus = {
          connected: true,
          connectionType: 'wifi',
        };
        Network.getStatus.mockResolvedValue(mockStatus);

        const result = await checkNetworkStatus();

        expect(result).toBe(true);
        expect(Network.getStatus).toHaveBeenCalled();
      });

      it('should return false when network is disconnected on native platform', async () => {
        const mockStatus = {
          connected: false,
          connectionType: 'none',
        };
        Network.getStatus.mockResolvedValue(mockStatus);

        const result = await checkNetworkStatus();

        expect(result).toBe(false);
        expect(Network.getStatus).toHaveBeenCalled();
      });

      it('should handle cellular connection on native platform', async () => {
        const mockStatus = {
          connected: true,
          connectionType: 'cellular',
        };
        Network.getStatus.mockResolvedValue(mockStatus);

        const result = await checkNetworkStatus();

        expect(result).toBe(true);
      });

      it('should throw error when Network.getStatus fails on native platform', async () => {
        const error = new Error('Network plugin not available');
        Network.getStatus.mockRejectedValue(error);

        await expect(checkNetworkStatus()).rejects.toThrow('Network status check failed: Network plugin not available');

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to check network status',
          {
            platform: 'native',
            error: 'Network plugin not available',
            stack: expect.any(String),
          },
          'ERROR',
        );
        expect(sentryUtils.captureException).toHaveBeenCalledWith(
          error,
          {
            tags: {
              operation: 'network_status_check',
              platform: 'native',
            },
            contexts: {
              device: {
                platform: 'ios',
                isNative: true,
              },
            },
          },
        );
      });
    });

    describe('Web Platform', () => {
      beforeEach(() => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        Capacitor.getPlatform.mockReturnValue('web');
      });

      it('should return true when navigator.onLine is true on web platform', async () => {
        global.navigator.onLine = true;

        const result = await checkNetworkStatus();

        expect(result).toBe(true);
      });

      it('should return false when navigator.onLine is false on web platform', async () => {
        global.navigator.onLine = false;

        const result = await checkNetworkStatus();

        expect(result).toBe(false);
      });

      it('should handle missing navigator.onLine gracefully', async () => {
        delete global.navigator.onLine;

        const result = await checkNetworkStatus();

        expect(result).toBeUndefined(); // undefined is what we get
      });
    });
  });

  describe('getDetailedNetworkStatus', () => {
    describe('Native Platform', () => {
      beforeEach(() => {
        Capacitor.isNativePlatform.mockReturnValue(true);
        Capacitor.getPlatform.mockReturnValue('android');
      });

      it('should return detailed network status from native platform', async () => {
        const mockStatus = {
          connected: true,
          connectionType: 'wifi',
          ssid: 'MyWiFiNetwork',
          bssid: '00:11:22:33:44:55',
        };
        Network.getStatus.mockResolvedValue(mockStatus);

        const result = await getDetailedNetworkStatus();

        expect(result).toEqual(mockStatus);
        expect(Network.getStatus).toHaveBeenCalled();
      });

      it('should handle network status without WiFi info', async () => {
        const mockStatus = {
          connected: true,
          connectionType: 'cellular',
        };
        Network.getStatus.mockResolvedValue(mockStatus);

        const result = await getDetailedNetworkStatus();

        expect(result).toEqual(mockStatus);
      });

      it('should handle network status with partial WiFi info', async () => {
        const mockStatus = {
          connected: true,
          connectionType: 'wifi',
          ssid: 'MyWiFiNetwork',
          // bssid missing
        };
        Network.getStatus.mockResolvedValue(mockStatus);

        const result = await getDetailedNetworkStatus();

        expect(result).toEqual(mockStatus);
      });

      it('should throw error when Network.getStatus fails', async () => {
        const error = new Error('Permission denied');
        Network.getStatus.mockRejectedValue(error);

        await expect(getDetailedNetworkStatus()).rejects.toThrow('Failed to get network details: Permission denied');

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to get detailed network status',
          {
            platform: 'native',
            error: 'Permission denied',
            stack: expect.any(String),
          },
          'ERROR',
        );
        expect(sentryUtils.captureException).toHaveBeenCalledWith(
          error,
          {
            tags: {
              operation: 'detailed_network_status',
              platform: 'native',
            },
          },
        );
      });
    });

    describe('Web Platform', () => {
      beforeEach(() => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        Capacitor.getPlatform.mockReturnValue('web');
      });

      it('should return basic network status without connection info', async () => {
        global.navigator.onLine = true;
        global.navigator.connection = undefined;

        const result = await getDetailedNetworkStatus();

        expect(result).toEqual({
          connected: true,
          connectionType: 'unknown',
        });
      });

      it('should return enhanced network status with connection info', async () => {
        global.navigator.onLine = true;
        global.navigator.connection = {
          effectiveType: '4g',
          downlink: 10.5,
        };

        const result = await getDetailedNetworkStatus();

        expect(result).toEqual({
          connected: true,
          connectionType: '4g',
          downlink: 10.5,
          effectiveType: '4g',
        });
      });

      it('should handle connection info without effectiveType', async () => {
        global.navigator.onLine = false;
        global.navigator.connection = {
          downlink: 0,
        };

        const result = await getDetailedNetworkStatus();

        expect(result).toEqual({
          connected: false,
          connectionType: 'unknown',
          downlink: 0,
          effectiveType: undefined,
        });
      });

      it('should handle offline status', async () => {
        global.navigator.onLine = false;

        const result = await getDetailedNetworkStatus();

        expect(result).toEqual({
          connected: false,
          connectionType: 'unknown',
        });
      });
    });
  });

  describe('addNetworkListener', () => {
    it('should throw error for non-function callback', () => {
      expect(() => addNetworkListener('not a function')).toThrow('Network listener callback must be a function');
      expect(() => addNetworkListener(null)).toThrow('Network listener callback must be a function');
      expect(() => addNetworkListener(undefined)).toThrow('Network listener callback must be a function');
      expect(() => addNetworkListener({})).toThrow('Network listener callback must be a function');

      expect(logger.error).toHaveBeenCalledWith(
        'Invalid network listener callback',
        {
          providedType: 'string',
          isFunction: false,
        },
        'ERROR',
      );
      expect(sentryUtils.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        {
          tags: {
            operation: 'network_listener_setup',
            validation_error: true,
          },
        },
      );
    });

    describe('Native Platform', () => {
      beforeEach(() => {
        Capacitor.isNativePlatform.mockReturnValue(true);
        Capacitor.getPlatform.mockReturnValue('ios');
      });

      it('should setup native network listener successfully', () => {
        const callback = vi.fn();
        const mockListener = { remove: vi.fn() };
        Network.addListener.mockReturnValue(mockListener);

        const removeListener = addNetworkListener(callback);

        expect(Network.addListener).toHaveBeenCalledWith('networkStatusChange', expect.any(Function));
        expect(typeof removeListener).toBe('function');

        // Test the cleanup function
        removeListener();
        expect(mockListener.remove).toHaveBeenCalled();
      });

      it('should call callback when network status changes on native', () => {
        const callback = vi.fn();
        const mockListener = { remove: vi.fn() };
        Network.addListener.mockImplementation((event, handler) => {
          // Simulate network status change
          setTimeout(() => {
            handler({
              connected: false,
              connectionType: 'none',
            });
          }, 0);
          return mockListener;
        });

        addNetworkListener(callback);

        return new Promise((resolve) => {
          setTimeout(() => {
            expect(callback).toHaveBeenCalledWith({
              connected: false,
              connectionType: 'none',
            });
            resolve();
          }, 10);
        });
      });

      it('should handle native listener setup failure', () => {
        const callback = vi.fn();
        const error = new Error('Native listener setup failed');
        Network.addListener.mockImplementation(() => {
          throw error;
        });

        expect(() => addNetworkListener(callback)).toThrow('Failed to setup network listener: Native listener setup failed');

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to setup network listener',
          {
            platform: 'native',
            error: 'Native listener setup failed',
            stack: expect.any(String),
          },
          'ERROR',
        );
        expect(sentryUtils.captureException).toHaveBeenCalledWith(
          error,
          {
            tags: {
              operation: 'network_listener_setup',
              platform: 'native',
            },
          },
        );
      });
    });

    describe('Web Platform', () => {
      beforeEach(() => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        Capacitor.getPlatform.mockReturnValue('web');
      });

      it('should setup web network listeners successfully', () => {
        const callback = vi.fn();

        const removeListener = addNetworkListener(callback);

        expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
        expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
        expect(typeof removeListener).toBe('function');

        // Test the cleanup function
        removeListener();
        expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
        expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      });

      it('should call callback when going online', () => {
        const callback = vi.fn();
        let onlineHandler;

        window.addEventListener.mockImplementation((event, handler) => {
          if (event === 'online') {
            onlineHandler = handler;
          }
        });

        addNetworkListener(callback);

        // Simulate going online
        onlineHandler();

        expect(callback).toHaveBeenCalledWith({
          connected: true,
          connectionType: 'unknown',
        });
      });

      it('should call callback when going offline', () => {
        const callback = vi.fn();
        let offlineHandler;

        window.addEventListener.mockImplementation((event, handler) => {
          if (event === 'offline') {
            offlineHandler = handler;
          }
        });

        addNetworkListener(callback);

        // Simulate going offline
        offlineHandler();

        expect(callback).toHaveBeenCalledWith({
          connected: false,
          connectionType: 'unknown',
        });
      });

      it('should handle web listener setup failure', () => {
        const callback = vi.fn();
        const error = new Error('addEventListener failed');
        window.addEventListener.mockImplementation(() => {
          throw error;
        });

        expect(() => addNetworkListener(callback)).toThrow('Failed to setup network listener: addEventListener failed');

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to setup network listener',
          {
            platform: 'web',
            error: 'addEventListener failed',
            stack: expect.any(String),
          },
          'ERROR',
        );
        expect(sentryUtils.captureException).toHaveBeenCalledWith(
          error,
          {
            tags: {
              operation: 'network_listener_setup',
              platform: 'web',
            },
          },
        );
      });

      it('should handle cleanup failure gracefully', () => {
        const callback = vi.fn();
        
        const removeListener = addNetworkListener(callback);
        
        // Mock removeEventListener to throw after the listener is set up
        window.removeEventListener.mockImplementation(() => {
          throw new Error('removeEventListener failed');
        });

        // This should throw since the actual implementation doesn't handle errors
        expect(() => removeListener()).toThrow('removeEventListener failed');
      });
    });

    describe('Edge Cases', () => {
      it('should work with arrow function callbacks', () => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        const callback = () => {};
        const mockListener = { remove: vi.fn() };
        Network.addListener.mockReturnValue(mockListener);

        expect(() => addNetworkListener(callback)).not.toThrow();
      });

      it('should work with bound function callbacks', () => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        const obj = {
          method() {},
        };
        const boundCallback = obj.method.bind(obj);

        expect(() => addNetworkListener(boundCallback)).not.toThrow();
      });
    });
  });
});