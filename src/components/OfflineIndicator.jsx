import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Alert, Button, Modal } from './ui';
import syncService from '../services/sync.js';
import { isAuthenticated, getToken } from '../services/auth.js';
import { config } from '../config/env.js';
import { testBackendConnection } from '../services/api.js';

function OfflineIndicator({ hideSync = false, hideBanner = false }) {
  const [isOnline, setIsOnline] = useState(true);
  const [apiConnected, setApiConnected] = useState(true);
  const [apiTested, setApiTested] = useState(false); // Track if we've tested API yet
  const [syncStatus, setSyncStatus] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptData, setLoginPromptData] = useState(null);
  const [showSyncError, setShowSyncError] = useState(false);

  // Test actual API connectivity using the rate-limited API service
  const testApiConnectivity = async () => {
    try {
      const token = getToken();
      if (import.meta.env.NODE_ENV === 'development') {
        console.log('🔍 OfflineIndicator - Testing API connectivity...', {
          hasToken: !!token,
          apiUrl: config.apiUrl,
          isOnline,
          apiConnected,
          apiTested,
        });
      }

      // Use the rate-limited testBackendConnection function from API service
      // This ensures all health checks go through the queue system
      const result = await testBackendConnection();

      if (result && (result.status === 'ok' || result.status === 'healthy')) {
        // API is connected and responding correctly
        setApiConnected(true);
        setApiTested(true);

        if (import.meta.env.NODE_ENV === 'development') {
          console.log(
            '✅ OfflineIndicator - API connectivity confirmed via queue',
          );
        }
      } else {
        throw new Error('API health check failed');
      }
    } catch (error) {
      // Handle rate limiting gracefully - don't mark as disconnected if it's just queued
      if (
        error.message?.includes('Rate limited') ||
        error.status === 429 ||
        error.message?.includes('429') ||
        error.message?.includes('Too Many Requests')
      ) {
        if (import.meta.env.NODE_ENV === 'development') {
          console.log(
            '⏳ OfflineIndicator - Health check queued due to rate limiting, will retry automatically',
          );
        }
        // Keep current connection status - don't mark as failed due to rate limiting
        // The queue will retry automatically with backoff
        setApiTested(true);
        return;
      }

      // Handle SSL/TLS and network errors more gracefully in development
      if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('SSL') ||
        error.message?.includes('certificate') ||
        error.message?.includes('net::ERR_') ||
        error.name === 'TypeError'
      ) {
        if (import.meta.env.NODE_ENV === 'development') {
          console.log(
            '🔒 OfflineIndicator - Network/SSL connectivity issue detected:',
            error.message,
            '\nThis is normal in development with self-signed certificates',
          );
        }
        setApiConnected(false);
        setApiTested(true);
        return;
      }

      // Only log other errors as warnings
      console.warn(
        '❌ OfflineIndicator - API connectivity test failed:',
        error,
      );
      setApiConnected(false);
      setApiTested(true);
    }
  };

  useEffect(() => {
    checkInitialStatus();
    const networkCleanup = setupNetworkListeners();
    const syncCleanup = setupSyncListeners();

    // Setup login prompt listener
    const handleLoginPrompt = (promptData) => {
      setLoginPromptData(promptData);
      setShowLoginPrompt(true);
    };

    syncService.addLoginPromptListener(handleLoginPrompt);

    // Test API connectivity on mount and with exponential backoff when offline
    testApiConnectivity();

    let backoffDelay = 30000; // Start with 30 seconds
    const maxDelay = 300000; // Max 5 minutes
    let connectivityTimeoutId;

    const scheduleNextCheck = () => {
      connectivityTimeoutId = setTimeout(() => {
        if (!apiConnected || !isOnline) {
          testApiConnectivity()
            .then(() => {
              if (!apiConnected || !isOnline) {
                // Still offline, increase backoff delay
                backoffDelay = Math.min(backoffDelay * 1.5, maxDelay);
              } else {
                // Back online, reset backoff delay
                backoffDelay = 30000;
              }
              scheduleNextCheck();
            })
            .catch(() => {
              // Error in connectivity test, continue with backoff
              backoffDelay = Math.min(backoffDelay * 1.5, maxDelay);
              scheduleNextCheck();
            });
        } else {
          // Online, continue checking at base interval
          backoffDelay = 30000;
          scheduleNextCheck();
        }
      }, backoffDelay);
    };

    scheduleNextCheck();

    return () => {
      // Cleanup listeners
      syncService.removeLoginPromptListener(handleLoginPrompt);
      if (connectivityTimeoutId) clearTimeout(connectivityTimeoutId);
      if (networkCleanup) networkCleanup();
      if (syncCleanup) syncCleanup();
    };
  }, [apiConnected, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkInitialStatus = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await Network.getStatus();
        if (import.meta.env.NODE_ENV === 'development') {
          console.log(
            '🔍 OfflineIndicator - Capacitor network status:',
            status,
          );
        }
        setIsOnline(status.connected);
      } else {
        if (import.meta.env.NODE_ENV === 'development') {
          console.log(
            '🔍 OfflineIndicator - Navigator online status:',
            navigator.onLine,
          );
        }
        setIsOnline(navigator.onLine);
      }
    } catch (error) {
      console.error(
        '❌ OfflineIndicator - Error checking network status:',
        error,
      );
    }
  };

  const setupNetworkListeners = () => {
    if (Capacitor.isNativePlatform()) {
      Network.addListener('networkStatusChange', (status) => {
        setIsOnline(status.connected);
        // Test API connectivity when network status changes
        if (status.connected) {
          testApiConnectivity();
        } else {
          setApiConnected(false);
        }
      });
    } else {
      const handleOnline = () => {
        setIsOnline(true);
        // Test API connectivity when browser thinks we're back online
        testApiConnectivity();
      };
      const handleOffline = () => {
        setIsOnline(false);
        setApiConnected(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Return cleanup function
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  };

  const setupSyncListeners = () => {
    const handleSyncStatus = (status) => {
      setSyncStatus(status);

      // Clear status after a delay if completed or error
      if (status.status === 'completed' || status.status === 'error') {
        setTimeout(() => {
          setSyncStatus(null);
        }, 3000);
      }
    };

    syncService.addSyncListener(handleSyncStatus);

    // Return cleanup function
    return () => {
      syncService.removeSyncListener(handleSyncStatus);
    };
  };

  const handleLoginConfirm = () => {
    setShowLoginPrompt(false);
    if (loginPromptData?.onConfirm) {
      loginPromptData.onConfirm();
    }
  };

  const handleLoginCancel = () => {
    setShowLoginPrompt(false);
    if (loginPromptData?.onCancel) {
      loginPromptData.onCancel();
    }
  };

  const handleSyncClick = async () => {
    if (!isOnline || !apiConnected) {
      setShowSyncError(true);
      return;
    }

    try {
      await syncService.syncAll();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  const getSyncButtonText = () => {
    if (!isAuthenticated()) {
      return '🔐 Login & Sync';
    }
    return '🔄 Sync';
  };

  const getSyncButtonTitle = () => {
    if (!isAuthenticated()) {
      return 'Login to OSM and sync data';
    }
    return 'Sync data';
  };

  // Don't show anything if both network and API are connected and no sync status
  if (isOnline && apiConnected && !syncStatus) {
    return (
      <>
        {/* Only show sync button if not hidden */}
        {!hideSync && (
          <div className="fixed top-20 right-4 z-40">
            <Button
              variant="scout-blue"
              size="sm"
              onClick={handleSyncClick}
              className="shadow-lg"
              title={getSyncButtonTitle()}
            >
              {getSyncButtonText()}
            </Button>
          </div>
        )}

        {/* Login Prompt Modal */}
        <Modal isOpen={showLoginPrompt} onClose={handleLoginCancel} size="md">
          <Modal.Header>
            <Modal.Title>Authentication Required</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <span className="text-amber-600 text-xl">🔐</span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">
                    {loginPromptData?.message ||
                      'Authentication required to sync data.'}
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    You will be redirected to Online Scout Manager to
                    authenticate.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> You can continue using the app with
                  offline data if you prefer not to sync at this time.
                </p>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" onClick={handleLoginCancel}>
              Stay Offline
            </Button>
            <Button variant="scout-blue" onClick={handleLoginConfirm}>
              Login & Sync
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }

  const shouldShowBanner = apiTested && (!isOnline || !apiConnected);

  if (import.meta.env.NODE_ENV === 'development') {
    console.log('🔍 Offline Indicator - Banner visibility:', {
      apiTested,
      isOnline,
      apiConnected,
      shouldShowBanner,
    });
  }

  // If hideBanner is true, only return sync button and modals, no banner
  if (hideBanner) {
    return (
      <>
        {/* Only show sync button if not hidden */}
        {!hideSync && (
          <div className="fixed top-20 right-4 z-40">
            <Button
              variant="scout-blue"
              size="sm"
              onClick={handleSyncClick}
              className="shadow-lg"
              title={getSyncButtonTitle()}
            >
              {getSyncButtonText()}
            </Button>
          </div>
        )}

        {/* Login Prompt Modal */}
        <Modal isOpen={showLoginPrompt} onClose={handleLoginCancel} size="md">
          <Modal.Header>
            <Modal.Title>Authentication Required</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <span className="text-amber-600 text-xl">🔐</span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">
                    {loginPromptData?.message ||
                      'Authentication required to sync data.'}
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    You will be redirected to Online Scout Manager to
                    authenticate.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> You can continue using the app with
                  offline data if you prefer not to sync at this time.
                </p>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" onClick={handleLoginCancel}>
              Stay Offline
            </Button>
            <Button variant="scout-blue" onClick={handleLoginConfirm}>
              Login & Sync
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {shouldShowBanner && (
        <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
          <div className="flex items-center justify-center gap-2">
            <span>📱</span>
            <span>
              {!isOnline
                ? 'Offline Mode - Using cached data'
                : 'API Unavailable - Using cached data'}
            </span>
          </div>
        </Alert>
      )}

      {syncStatus && (
        <Alert
          variant={
            syncStatus.status === 'syncing'
              ? 'info'
              : syncStatus.status === 'completed'
                ? 'success'
                : 'error'
          }
          className="rounded-none border-x-0 border-t-0"
        >
          <div className="flex items-center justify-center gap-2">
            {syncStatus.status === 'syncing' && (
              <>
                <span className="animate-spin">⏳</span>
                <span>{syncStatus.message}</span>
              </>
            )}
            {syncStatus.status === 'completed' && (
              <>
                <span>✅</span>
                <span>Sync completed</span>
              </>
            )}
            {syncStatus.status === 'error' && (
              <>
                <span>⚠️</span>
                <span>Sync failed: {syncStatus.message}</span>
              </>
            )}
          </div>
        </Alert>
      )}

      {showSyncError && (
        <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>Cannot sync while offline or API is unreachable</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSyncError(false)}
              className="ml-4"
            >
              Dismiss
            </Button>
          </div>
        </Alert>
      )}
    </div>
  );
}

export default OfflineIndicator;
