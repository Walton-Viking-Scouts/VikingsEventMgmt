import React, { useState } from "react";
import { canPrint } from "../../utils/platform.js";
import { Button } from "../ui";
import ConfirmModal from "../ui/ConfirmModal";
import AuthButton from "../AuthButton.jsx";
import DataFreshness from "../DataFreshness.jsx";

function DesktopHeader({
  user,
  onLogout,
  onLogin,
  isOfflineMode,
  authState = "no_data",
  lastSyncTime = null,
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  return (
    <header
      className="bg-white shadow-sm border-b border-gray-200 px-6 py-4"
      data-oid="d2661gy"
    >
      <div
        className="flex justify-between items-center max-w-7xl mx-auto"
        data-oid="nwoo74f"
      >
        <div className="flex items-center" data-oid="9wbtzpx">
          <h1 className="text-2xl font-bold text-scout-blue" data-oid="3841s:c">
            Vikings Event Management
          </h1>
        </div>

        <div className="flex items-center space-x-4" data-oid="obdlgad">
          {/* Data freshness indicator */}
          <DataFreshness
            lastSync={lastSyncTime}
            authState={authState}
            className="mr-2"
            data-oid="s-tax.f"
          />

          {/* Authentication button - always visible */}
          <AuthButton
            authState={authState}
            onLogin={onLogin}
            className="mr-2"
            data-testid="auth-button"
            data-oid="99th8we"
          />

          {canPrint() && (
            <Button
              variant="outline-scout-blue"
              size="sm"
              onClick={handlePrint}
              type="button"
              title="Print current page"
              data-oid="h3cv8j-"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
                data-oid="n_-32yg"
              >
                <path
                  fillRule="evenodd"
                  d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
                  clipRule="evenodd"
                  data-oid="86r523x"
                />
              </svg>
              Print
            </Button>
          )}

          {user && (
            <div className="flex items-center space-x-3" data-oid="6ha4wfa">
              <span className="text-gray-700 font-medium" data-oid=".f7jrik">
                Hi, {user.firstname}
                {isOfflineMode && (
                  <span
                    className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-white"
                    data-oid="4i.8i54"
                  >
                    Offline
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2" data-oid="w.ncsus">
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  type="button"
                  data-oid="wxxx1q:"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    data-oid="79nkgp_"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 001-1h10.586l-2.293 2.293a1 1 0 001.414 1.414l4-4a1 1 0 000-1.414l-4-4a1 1 0 10-1.414 1.414L15.586 3H4z"
                      clipRule="evenodd"
                      data-oid="m4s9o.x"
                    />
                  </svg>
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
        data-oid="bq3s23v"
      />
    </header>
  );
}

export default DesktopHeader;
