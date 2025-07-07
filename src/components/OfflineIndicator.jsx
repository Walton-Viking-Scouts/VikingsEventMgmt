import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Alert, Button } from './ui';
import syncService from '../services/sync.js';

function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    checkInitialStatus();
    setupNetworkListeners();
    setupSyncListeners();

    return () => {
      // Cleanup listeners would go here if needed
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

  // Don't show anything if online and no sync status
  if (isOnline && !syncStatus) {
    return (
      <div className="fixed top-20 right-4 z-40">
        <Button
          variant="scout-blue"
          size="sm"
          onClick={handleSyncClick}
          className="shadow-lg"
          title="Sync data"
        >
          🔄 Sync
        </Button>
      </div>
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
