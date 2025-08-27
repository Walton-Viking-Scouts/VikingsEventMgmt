import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { Alert, Button, Modal } from "./ui";
import syncService from "../services/sync.js";
import { testBackendConnection } from "../services/api.js";
import { isDemoMode } from "../config/demoMode.js";

function OfflineIndicator({ hideBanner = false }) {
  const [isOnline, setIsOnline] = useState(true);
  const [apiConnected, setApiConnected] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptData, setLoginPromptData] = useState(null);

  // Test actual API connectivity using the rate-limited API service
  const testApiConnectivity = async () => {
    // Skip API connectivity tests in demo mode
    if (isDemoMode()) {
      setApiConnected(true);
      return true;
    }

    try {
      // Use the rate-limited testBackendConnection function from API service
      // This ensures all health checks go through the queue system
      const result = await testBackendConnection();

      if (result && (result.status === "ok" || result.status === "healthy")) {
        // API is connected and responding correctly
        setApiConnected(true);
        return true;
      }
      // Check for rate-limiting specifically
      if (result && result.httpStatus === 429) {
        // Don't change connectivity status for rate-limited requests
        return null;
      }
      // API health check failed
      setApiConnected(false);
      return false;
    } catch (error) {
      // Handle rate limiting gracefully - don't mark as disconnected if it's just queued
      if (
        error.message?.includes("Rate limited") ||
        error.status === 429 ||
        error.message?.includes("429") ||
        error.message?.includes("Too Many Requests")
      ) {
        // Keep current connection status - don't mark as failed due to rate limiting
        // The queue will retry automatically with backoff
        return null;
      }

      // Handle SSL/TLS and network errors more gracefully in development
      if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("SSL") ||
        error.message?.includes("certificate") ||
        error.message?.includes("net::ERR_") ||
        error.name === "TypeError"
      ) {
        setApiConnected(false);
        return false;
      }

      // Log API connectivity failures as warnings
      console.warn("API connectivity test failed:", error.message);
      setApiConnected(false);
      return false;
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
        testApiConnectivity()
          .then((status) => {
            if (status === true && isOnline) {
              // Connected, reset backoff
              backoffDelay = 30000;
            } else if (status === false) {
              // Hard failure, increase backoff
              backoffDelay = Math.min(backoffDelay * 1.5, maxDelay);
            }
            // status === null means rate-limited, keep current backoff
            scheduleNextCheck();
          })
          .catch(() => {
            // Error in connectivity test, continue with backoff
            backoffDelay = Math.min(backoffDelay * 1.5, maxDelay);
            scheduleNextCheck();
          });
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
        setIsOnline(status.connected);
      } else {
        setIsOnline(navigator.onLine);
      }
    } catch (error) {
      console.error("Network status check failed:", error);
    }
  };

  const setupNetworkListeners = () => {
    if (Capacitor.isNativePlatform()) {
      Network.addListener("networkStatusChange", (status) => {
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

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Return cleanup function
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  };

  const setupSyncListeners = () => {
    const handleSyncStatus = (status) => {
      setSyncStatus(status);

      // Clear status after a delay if completed or error
      if (status.status === "completed" || status.status === "error") {
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

  // Helper function for rendering the Login Prompt Modal (reused in multiple places)
  const renderLoginPromptModal = () => (
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
                  "Authentication required to sync data."}
              </p>
              <p className="text-gray-600 text-sm mt-1">
                You will be redirected to Online Scout Manager to authenticate.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> You can continue using the app with offline
              data if you prefer not to sync at this time.
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
  );

  // Don't show anything if both network and API are connected and no sync status
  if (isOnline && apiConnected && !syncStatus) {
    return (
      <>
        {/* Login Prompt Modal */}
        {renderLoginPromptModal()}
      </>
    );
  }

  // If hideBanner is true, only return modals, no banner
  if (hideBanner) {
    return (
      <>
        {/* Login Prompt Modal */}
        {renderLoginPromptModal()}
      </>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {syncStatus && (
        <Alert
          variant={
            syncStatus.status === "syncing"
              ? "info"
              : syncStatus.status === "completed"
                ? "success"
                : "error"
          }
          className="rounded-none border-x-0 border-t-0"
        >
          <div className="flex items-center justify-center gap-2">
            {syncStatus.status === "syncing" && (
              <>
                <span className="animate-spin">⏳</span>
                <span>{syncStatus.message}</span>
              </>
            )}
            {syncStatus.status === "completed" && (
              <>
                <span>✅</span>
                <span>Sync completed</span>
              </>
            )}
            {syncStatus.status === "error" && (
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
