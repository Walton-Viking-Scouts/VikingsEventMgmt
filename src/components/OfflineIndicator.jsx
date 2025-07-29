import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Alert, Button, Modal } from './ui';
import syncService from '../services/sync.js';
import { isAuthenticated, getToken } from '../services/auth.js';
import { config } from '../config/env.js';

function OfflineIndicator({ hideSync = false }) {
  const [isOnline, setIsOnline] = useState(true);
  const [apiConnected, setApiConnected] = useState(true);
  const [apiTested, setApiTested] = useState(false); // Track if we've tested API yet
  const [syncStatus, setSyncStatus] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptData, setLoginPromptData] = useState(null);

  // Test actual API connectivity by making a lightweight request
  const testApiConnectivity = async () => {
    try {
      const token = getToken();
      console.log('🔍 OfflineIndicator - Testing API connectivity...', { 
        hasToken: !!token, 
        apiUrl: config.apiUrl,
        isOnline,
        apiConnected,
        apiTested
      });
      
      // Create AbortController for timeout (this is a modern browser API)
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null; // 5 second timeout
      
      const requestOptions = {
        method: 'GET',
        ...(controller && { signal: controller.signal }),
      };
      
      let endpoint;
      if (token) {
        // If we have a token, test with the validate-token endpoint
        requestOptions.headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        };
        endpoint = '/validate-token';
      } else {
        // If no token, use the health endpoint which doesn't require authentication
        endpoint = '/health';
      }
      
      console.log('🔍 OfflineIndicator - Making API request to:', `${config.apiUrl}${endpoint}`);
      
      // Make the API request
      const response = await fetch(`${config.apiUrl}${endpoint}`, requestOptions);
      
      if (timeoutId) clearTimeout(timeoutId);
      
      console.log('✅ OfflineIndicator - API connectivity test succeeded:', { 
        status: response.status, 
        ok: response.ok,
        endpoint 
      });
      
      // API is connected if we get any response (even 401 means API is reachable)
      setApiConnected(true);
      setApiTested(true);
    } catch (error) {
      // Only log non-abort errors to avoid spam
      if (error.name !== 'AbortError') {
        console.warn('❌ OfflineIndicator - API connectivity test failed:', error);
      }
      console.log('❌ OfflineIndicator - Setting API connected to false due to error:', error.message);
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

    // Test API connectivity on mount and periodically if we think we're offline
    testApiConnectivity();
    const connectivityInterval = setInterval(() => {
      if (!apiConnected || !isOnline) {
        testApiConnectivity();
      }
    }, 30000); // Test every 30 seconds if offline

    return () => {
      // Cleanup listeners
      syncService.removeLoginPromptListener(handleLoginPrompt);
      clearInterval(connectivityInterval);
      if (networkCleanup) networkCleanup();
      if (syncCleanup) syncCleanup();
    };
  }, [apiConnected, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkInitialStatus = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await Network.getStatus();
        console.log('🔍 OfflineIndicator - Capacitor network status:', status);
        setIsOnline(status.connected);
      } else {
        console.log('🔍 OfflineIndicator - Navigator online status:', navigator.onLine);
        setIsOnline(navigator.onLine);
      }
    } catch (error) {
      console.error('❌ OfflineIndicator - Error checking network status:', error);
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
      alert('Cannot sync while offline or API is unreachable');
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
        <Modal
          isOpen={showLoginPrompt}
          onClose={handleLoginCancel}
          size="md"
        >
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
                    {loginPromptData?.message || 'Authentication required to sync data.'}
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    You will be redirected to Online Scout Manager to authenticate.
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> You can continue using the app with offline data if you prefer not to sync at this time.
                </p>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline"
              onClick={handleLoginCancel}
            >
              Stay Offline
            </Button>
            <Button
              variant="scout-blue"
              onClick={handleLoginConfirm}
            >
              Login & Sync
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }

  // Debug logging for banner visibility
  const shouldShowBanner = apiTested && (!isOnline || !apiConnected);
  console.log('🔍🔍🔍 OFFLINE INDICATOR BANNER CHECK 🔍🔍🔍:', {
    apiTested,
    isOnline,
    apiConnected,
    shouldShowBanner
  });
  
  // Add render log
  console.log('🔍🔍🔍 OFFLINE INDICATOR RENDERING 🔍🔍🔍');

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {shouldShowBanner && (
        <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
          <div className="flex items-center justify-center gap-2">
            <span>📱</span>
            <span>
              {!isOnline ? 'Offline Mode - Using cached data' : 'API Unavailable - Using cached data'}
            </span>
          </div>
        </Alert>
      )}
      
      {syncStatus && (
        <Alert 
          variant={
            syncStatus.status === 'syncing' ? 'info' : 
              syncStatus.status === 'completed' ? 'success' : 
                'error'
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
    </div>
  );
}

export default OfflineIndicator;
