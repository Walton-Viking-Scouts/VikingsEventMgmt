import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Alert, Button, Modal } from './ui';
import syncService from '../services/sync.js';
import { isAuthenticated } from '../services/auth.js';

function OfflineIndicator({ hideSync = false }) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptData, setLoginPromptData] = useState(null);

  useEffect(() => {
    checkInitialStatus();
    setupNetworkListeners();
    setupSyncListeners();

    // Setup login prompt listener
    const handleLoginPrompt = (promptData) => {
      setLoginPromptData(promptData);
      setShowLoginPrompt(true);
    };

    syncService.addLoginPromptListener(handleLoginPrompt);

    return () => {
      // Cleanup listeners
      syncService.removeLoginPromptListener(handleLoginPrompt);
    };
  }, []);

  const checkInitialStatus = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
      } else {
        setIsOnline(navigator.onLine);
      }
    } catch (error) {
      console.error('Error checking network status:', error);
    }
  };

  const setupNetworkListeners = () => {
    if (Capacitor.isNativePlatform()) {
      Network.addListener('networkStatusChange', (status) => {
        setIsOnline(status.connected);
      });
    } else {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      
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
    if (!isOnline) {
      alert('Cannot sync while offline');
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

  // Don't show anything if online and no sync status
  if (isOnline && !syncStatus) {
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

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {!isOnline && (
        <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
          <div className="flex items-center justify-center gap-2">
            <span>📱</span>
            <span>Offline Mode - Using cached data</span>
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
