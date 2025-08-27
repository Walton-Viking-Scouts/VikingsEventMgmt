import React, { useState } from "react";
import { Header as TailwindHeader, Button } from "./ui";
import ConfirmModal from "./ui/ConfirmModal";
import AuthButton from "./AuthButton.jsx";
import DataFreshness from "./DataFreshness.jsx";
import TokenCountdown from "./TokenCountdown.jsx";

function Header({
  user,
  onLogout,
  isOfflineMode,
  onLogin,
  onRefresh,
  authState = "no_data",
  lastSyncTime = null,
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  return (
    <TailwindHeader
      variant="white"
      fixed={false}
      data-testid="header"
      data-oid="aa:5eo1"
    >
      <TailwindHeader.Container data-oid=".1b0:r8">
        {/* Desktop: Single row layout */}
        <TailwindHeader.Content className="hidden md:flex" data-oid="1e2upiw">
          <TailwindHeader.Left data-oid="ry46o6v">
            <TailwindHeader.Title
              className="text-xl font-semibold text-scout-blue"
              data-testid="app-title"
              data-oid="_p6itzq"
            >
              Viking Scouts (1st Walton on Thames)
            </TailwindHeader.Title>
          </TailwindHeader.Left>

          <TailwindHeader.Right
            data-testid="header-controls"
            data-oid="rtk-t9c"
          >
            {/* Data freshness indicator */}
            <DataFreshness
              lastSync={lastSyncTime}
              authState={authState}
              className="mr-3"
              data-oid="a1jm9z:"
            />

            {/* Token countdown - shows remaining login time */}
            <TokenCountdown
              authState={authState}
              className="mr-3"
              data-oid="o:02r7_"
            />

            {/* Authentication button - always visible */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              className="mr-3"
              data-testid="auth-button"
              data-oid="x3aom2r"
            />

            {/* User menu (when authenticated) */}
            {user && (
              <div className="flex items-center gap-3" data-oid="lbr0.c2">
                <span className="text-gray-700 text-base" data-oid="a3znzwm">
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-sm px-3 py-2"
                  data-oid="dwuoyu3"
                >
                  {isOfflineMode ? "Clear Data" : "Logout"}
                </Button>
              </div>
            )}
          </TailwindHeader.Right>
        </TailwindHeader.Content>

        {/* Mobile: Two row layout */}
        <div className="md:hidden py-3 space-y-3" data-oid="r3fjy4o">
          {/* Row 1: Title and essential status */}
          <div className="flex items-center justify-between" data-oid="_d_lq-5">
            <TailwindHeader.Title
              className="text-lg font-semibold text-scout-blue"
              data-testid="app-title"
              data-oid=".lzi-98"
            >
              Viking Scouts
            </TailwindHeader.Title>

            {/* Essential status indicators */}
            <div className="flex items-center space-x-2" data-oid="g:0kkqk">
              <DataFreshness
                lastSync={lastSyncTime}
                authState={authState}
                className="text-xs"
                data-oid="74ows.n"
              />

              <TokenCountdown
                authState={authState}
                className="text-xs"
                data-oid="0mic55b"
              />
            </div>
          </div>

          {/* Row 2: Authentication and user controls */}
          <div
            className="flex items-center justify-between min-w-0 overflow-hidden"
            data-oid="rnmd9q4"
          >
            {/* Always show AuthButton, especially important when token expired */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              data-testid="auth-button"
              size="sm"
              className="flex-shrink-0"
              data-oid="2dxl:q-"
            />

            {/* User menu - show when authenticated, but ensure it doesn't hide AuthButton */}
            {user && (
              <div className="flex items-center gap-2 ml-2" data-oid="v888bxy">
                <span
                  className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-gray-700 text-sm"
                  data-oid="hwi.gg:"
                >
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-xs px-2 py-1 flex-shrink-0"
                  data-oid="r-lmhwz"
                >
                  {isOfflineMode ? "Clear" : "Logout"}
                </Button>
              </div>
            )}
          </div>
        </div>
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
        data-oid="4kqqy_g"
      />
    </TailwindHeader>
  );
}

export default Header;
