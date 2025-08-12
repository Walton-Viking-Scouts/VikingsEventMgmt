import React, { useState } from "react";
import { Header as TailwindHeader, Button } from "./ui";
import ConfirmModal from "./ui/ConfirmModal";
import AuthButton from "./AuthButton.jsx";
import DataFreshness from "./DataFreshness.jsx";

function Header({
  user,
  onLogout,
  isOfflineMode,
  onLogin,
  authState = "no_data",
  lastSyncTime = null,
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  return (
    <TailwindHeader variant="scout" data-testid="header" data-oid="a7nwlw6">
      <TailwindHeader.Container data-oid="c2e0kne">
        <TailwindHeader.Content data-oid="8q91w00">
          <TailwindHeader.Left data-oid="v.w.ap3">
            <TailwindHeader.Title data-testid="app-title" data-oid="vgj5fs4">
              Vikings Event Mgmt
            </TailwindHeader.Title>
          </TailwindHeader.Left>

          <TailwindHeader.Right
            data-testid="header-controls"
            data-oid="j:8qihv"
          >
            {/* Data freshness indicator */}
            <DataFreshness
              lastSync={lastSyncTime}
              authState={authState}
              className="mr-3"
              data-oid="q_-nvk2"
            />

            {/* Authentication button - always visible */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              className="mr-3"
              data-testid="auth-button"
              data-oid="o89kw5z"
            />

            {/* User menu (when authenticated) */}
            {user && (
              <div className="flex items-center gap-3" data-oid="-sr.q1o">
                <span
                  className="text-white hidden sm:inline"
                  data-oid="sye-lx6"
                >
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  data-oid="hk0bk.c"
                >
                  {isOfflineMode ? "Clear Data" : "Logout"}
                </Button>
              </div>
            )}
          </TailwindHeader.Right>
        </TailwindHeader.Content>
      </TailwindHeader.Container>

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
        data-oid="pa:0t1v"
      />
    </TailwindHeader>
  );
}

export default Header;
