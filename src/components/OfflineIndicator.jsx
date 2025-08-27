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
    <Modal
      isOpen={showLoginPrompt}
      onClose={handleLoginCancel}
      size="md"
      data-oid="w4fgj_w"
    >
      <Modal.Header data-oid="jzysdfa">
        <Modal.Title data-oid="o:p:vto">Authentication Required</Modal.Title>
      </Modal.Header>
      <Modal.Body data-oid="4..-3ul">
        <div className="space-y-4" data-oid="5o4:fe6">
          <div className="flex items-center gap-3" data-oid="g.t-.1x">
            <div className="flex-shrink-0" data-oid="bhryokx">
              <div
                className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center"
                data-oid="k4ih5u1"
              >
                <span className="text-amber-600 text-xl" data-oid="jklrzcz">
                  🔐
                </span>
              </div>
            </div>
            <div data-oid="smhyto5">
              <p className="text-gray-900 font-medium" data-oid="pk-_ba1">
                {loginPromptData?.message ||
                  "Authentication required to sync data."}
              </p>
              <p className="text-gray-600 text-sm mt-1" data-oid="3v3vfmc">
                You will be redirected to Online Scout Manager to authenticate.
              </p>
            </div>
          </div>

          <div
            className="bg-blue-50 border border-blue-200 rounded-lg p-3"
            data-oid="2a:6e:5"
          >
            <p className="text-blue-800 text-sm" data-oid="u4iv42e">
              <strong data-oid="y75tyd7">Note:</strong> You can continue using
              the app with offline data if you prefer not to sync at this time.
            </p>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer data-oid=":opa54r">
        <Button
          variant="outline"
          onClick={handleLoginCancel}
          data-oid="83g_u:."
        >
          Stay Offline
        </Button>
        <Button
          variant="scout-blue"
          onClick={handleLoginConfirm}
          data-oid="z5kd54a"
        >
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
    <div className="fixed top-0 left-0 right-0 z-50" data-oid="53hfg9s">
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
          data-oid="w37nvcc"
        >
          <div
            className="flex items-center justify-center gap-2"
            data-oid="ha89izo"
          >
            {syncStatus.status === "syncing" && (
              <>
                <span className="animate-spin" data-oid="pxaz5cw">
                  ⏳
                </span>
                <span data-oid="i5yb.i3">{syncStatus.message}</span>
              </>
            )}
            {syncStatus.status === "completed" && (
              <>
                <span data-oid="oxnhfh4">✅</span>
                <span data-oid="ybfuolc">Sync completed</span>
              </>
            )}
            {syncStatus.status === "error" && (
              <>
                <span data-oid="zlt1w0d">⚠️</span>
                <span data-oid="418g.zp">
                  Sync failed: {syncStatus.message}
                </span>
              </>
            )}
          </div>
        </Alert>
      )}
    </div>
  );
}

export default OfflineIndicator;
