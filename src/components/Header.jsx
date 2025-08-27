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
      data-oid="zscmku7"
    >
      <TailwindHeader.Container data-oid=":6vl.5i">
        {/* Desktop: Single row layout */}
        <TailwindHeader.Content className="hidden md:flex" data-oid=".kzz8ns">
          <TailwindHeader.Left data-oid="xik7o1v">
            <TailwindHeader.Title
              className="text-xl font-semibold text-scout-blue"
              data-testid="app-title"
              data-oid="8puk.br"
            >
              Viking Scouts (1st Walton on Thames)
            </TailwindHeader.Title>
          </TailwindHeader.Left>

          <TailwindHeader.Right
            data-testid="header-controls"
            data-oid="h.c9rpd"
          >
            {/* Data freshness indicator */}
            <DataFreshness
              lastSync={lastSyncTime}
              authState={authState}
              className="mr-3"
              data-oid="yyc6vx-"
            />

            {/* Token countdown - shows remaining login time */}
            <TokenCountdown
              authState={authState}
              className="mr-3"
              data-oid="qwokkhe"
            />

            {/* Authentication button - always visible */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              className="mr-3"
              data-testid="auth-button"
              data-oid="psx4roz"
            />

            {/* User menu (when authenticated) */}
            {user && (
              <div className="flex items-center gap-3" data-oid="omnezb2">
                <span className="text-gray-700 text-base" data-oid="sjd9ajp">
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-sm px-3 py-2"
                  data-oid="58c:0md"
                >
                  {isOfflineMode ? "Clear Data" : "Logout"}
                </Button>
              </div>
            )}
          </TailwindHeader.Right>
        </TailwindHeader.Content>

        {/* Mobile: Two row layout */}
        <div className="md:hidden py-3 space-y-3" data-oid="-lnwztg">
          {/* Row 1: Title and essential status */}
          <div className="flex items-center justify-between" data-oid="-ukr4lv">
            <TailwindHeader.Title
              className="text-lg font-semibold text-scout-blue"
              data-testid="app-title"
              data-oid="dmicb-y"
            >
              Viking Scouts
            </TailwindHeader.Title>

            {/* Essential status indicators */}
            <div className="flex items-center space-x-2" data-oid="04.htk_">
              <DataFreshness
                lastSync={lastSyncTime}
                authState={authState}
                className="text-xs"
                data-oid="b760wt5"
              />

              <TokenCountdown
                authState={authState}
                className="text-xs"
                data-oid="adoe4nc"
              />
            </div>
          </div>

          {/* Row 2: Authentication and user controls */}
          <div
            className="flex items-center justify-between min-w-0 overflow-hidden"
            data-oid="j9xq5a1"
          >
            {/* Always show AuthButton, especially important when token expired */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              data-testid="auth-button"
              size="sm"
              className="flex-shrink-0"
              data-oid="w2::6m5"
            />

            {/* User menu - show when authenticated, but ensure it doesn't hide AuthButton */}
            {user && (
              <div className="flex items-center gap-2 ml-2" data-oid="h-2sa:8">
                <span
                  className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-gray-700 text-sm"
                  data-oid="u7w1ez8"
                >
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-xs px-2 py-1 flex-shrink-0"
                  data-oid="ho3l-.h"
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
        data-oid="xkuswk:"
      />
    </TailwindHeader>
  );
}

export default Header;
