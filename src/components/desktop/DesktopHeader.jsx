import React, { useState } from "react";
import { Button } from "../ui";
import ConfirmModal from "../ui/ConfirmModal";
// Auth-related components
import AuthButton from "../AuthButton.jsx";
import DataFreshness from "../DataFreshness.jsx";
import TokenCountdown from "../TokenCountdown.jsx";

function DesktopHeader({
  user,
  onLogout,
  onLogin,
  onRefresh,
  isOfflineMode,
  authState = "no_data",
  lastSyncTime = null,
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  return (
    <header
      className="bg-white shadow-sm border-b border-gray-200 px-6 py-4"
      data-oid="b:7-m93"
    >
      <div
        className="flex justify-between items-center max-w-7xl mx-auto"
        data-oid="wmax-8z"
      >
        <div className="flex items-center" data-oid="ht-h4gu">
          <h1 className="text-2xl font-bold text-scout-blue" data-oid="ir_u91k">
            Viking Scouts (1st Walton on Thames)
          </h1>
        </div>

        <div className="flex items-center space-x-4" data-oid="hafa.ap">
          {/* Data freshness indicator */}
          <DataFreshness
            lastSync={lastSyncTime}
            authState={authState}
            className="mr-2"
            data-oid="lvd5nkh"
          />

          {/* Token countdown - shows remaining login time */}
          <TokenCountdown
            authState={authState}
            className="mr-2"
            data-oid="bd61bl6"
          />

          {/* Authentication button - always visible */}
          <AuthButton
            authState={authState}
            onLogin={onLogin}
            onRefresh={onRefresh}
            className="mr-2"
            data-testid="auth-button"
            data-oid="myq_w5k"
          />

          {user && (
            <div className="flex items-center space-x-3" data-oid="145g5d_">
              <span className="text-gray-700 font-medium" data-oid="xez4czb">
                Hi, {user.firstname}
                {isOfflineMode && (
                  <span
                    className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-white"
                    data-oid="u9d.5p_"
                  >
                    Offline
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2" data-oid="_apddp0">
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  type="button"
                  data-oid="8i6ilwk"
                >
                  {isOfflineMode ? "Clear Data" : "Logout"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout/Clear Data Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        title={isOfflineMode ? "Clear Cached Data" : "Confirm Logout"}
        message={
          isOfflineMode
            ? "Are you sure you want to clear all cached data? This will remove all offline access to your events and member data."
            : "Are you sure you want to logout?"
        }
        confirmText={isOfflineMode ? "Clear Data" : "Logout"}
        cancelText="Cancel"
        onConfirm={() => {
          setShowLogoutModal(false);
          onLogout();
        }}
        onCancel={() => setShowLogoutModal(false)}
        confirmVariant="error"
        data-oid="pcaqxg1"
      />
    </header>
  );
}

export default DesktopHeader;
