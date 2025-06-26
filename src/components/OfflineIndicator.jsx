import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
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
    return null;
  }

  return (
    <div className="offline-indicator">
      {!isOnline && (
        <div className="offline-banner">
          <span className="offline-icon">📱</span>
          <span>Offline Mode - Using cached data</span>
        </div>
      )}
      
      {syncStatus && (
        <div className={`sync-status ${syncStatus.status}`}>
          {syncStatus.status === 'syncing' && (
            <>
              <span className="sync-spinner">⏳</span>
              <span>{syncStatus.message}</span>
            </>
          )}
          {syncStatus.status === 'completed' && (
            <>
              <span className="sync-success">✅</span>
              <span>Sync completed</span>
            </>
          )}
          {syncStatus.status === 'error' && (
            <>
              <span className="sync-error">⚠️</span>
              <span>Sync failed: {syncStatus.message}</span>
            </>
          )}
        </div>
      )}
      
      {isOnline && !syncStatus && (
        <button 
          className="sync-button"
          onClick={handleSyncClick}
          type="button"
          title="Sync data"
        >
          🔄 Sync
        </button>
      )}
    </div>
  );
}

export default OfflineIndicator;