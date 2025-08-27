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
      data-oid="f:2kdo6"
    >
      <div
        className="flex justify-between items-center max-w-7xl mx-auto"
        data-oid="c4jx2a4"
      >
        <div className="flex items-center" data-oid="aiv:d-5">
          <h1 className="text-2xl font-bold text-scout-blue" data-oid="2nj:u.x">
            Viking Scouts (1st Walton on Thames)
          </h1>
        </div>

        <div className="flex items-center space-x-4" data-oid="qur93:5">
          {/* Data freshness indicator */}
          <DataFreshness
            lastSync={lastSyncTime}
            authState={authState}
            className="mr-2"
            data-oid="5g:67cy"
          />

          {/* Token countdown - shows remaining login time */}
          <TokenCountdown
            authState={authState}
            className="mr-2"
            data-oid="37.1j.z"
          />

          {/* Authentication button - always visible */}
          <AuthButton
            authState={authState}
            onLogin={onLogin}
            onRefresh={onRefresh}
            className="mr-2"
            data-testid="auth-button"
            data-oid="rvnmcqw"
          />

          {user && (
            <div className="flex items-center space-x-3" data-oid="stj900l">
              <span className="text-gray-700 font-medium" data-oid="05x34_w">
                Hi, {user.firstname}
                {isOfflineMode && (
                  <span
                    className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-white"
                    data-oid="m-1xa4u"
                  >
                    Offline
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2" data-oid="a:y6fcl">
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  type="button"
                  data-oid="nmsh3jf"
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
        data-oid="33pbtu:"
      />
    </header>
  );
}

export default DesktopHeader;
