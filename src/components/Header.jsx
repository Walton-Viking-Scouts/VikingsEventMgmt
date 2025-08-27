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
      data-oid="rzj40mt"
    >
      <TailwindHeader.Container data-oid="d_4g5b0">
        {/* Desktop: Single row layout */}
        <TailwindHeader.Content className="hidden md:flex" data-oid="5-k:g.6">
          <TailwindHeader.Left data-oid="or9bmbp">
            <TailwindHeader.Title
              className="text-xl font-semibold text-scout-blue"
              data-testid="app-title"
              data-oid="7:j1:xz"
            >
              Viking Scouts (1st Walton on Thames)
            </TailwindHeader.Title>
          </TailwindHeader.Left>

          <TailwindHeader.Right
            data-testid="header-controls"
            data-oid="5hkkovu"
          >
            {/* Data freshness indicator */}
            <DataFreshness
              lastSync={lastSyncTime}
              authState={authState}
              className="mr-3"
              data-oid="bag1-c3"
            />

            {/* Token countdown - shows remaining login time */}
            <TokenCountdown
              authState={authState}
              className="mr-3"
              data-oid="f5w2vku"
            />

            {/* Authentication button - always visible */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              className="mr-3"
              data-testid="auth-button"
              data-oid="t3emshn"
            />

            {/* User menu (when authenticated) */}
            {user && (
              <div className="flex items-center gap-3" data-oid="dy2cq:_">
                <span className="text-gray-700 text-base" data-oid="whl1-qb">
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-sm px-3 py-2"
                  data-oid="d6jmz53"
                >
                  {isOfflineMode ? "Clear Data" : "Logout"}
                </Button>
              </div>
            )}
          </TailwindHeader.Right>
        </TailwindHeader.Content>

        {/* Mobile: Two row layout */}
        <div className="md:hidden py-3 space-y-3" data-oid="5qow_e9">
          {/* Row 1: Title and essential status */}
          <div className="flex items-center justify-between" data-oid="ttj6ak-">
            <TailwindHeader.Title
              className="text-lg font-semibold text-scout-blue"
              data-testid="app-title"
              data-oid="pl-oyx."
            >
              Viking Scouts
            </TailwindHeader.Title>

            {/* Essential status indicators */}
            <div className="flex items-center space-x-2" data-oid="nr5jvra">
              <DataFreshness
                lastSync={lastSyncTime}
                authState={authState}
                className="text-xs"
                data-oid="a570gyx"
              />

              <TokenCountdown
                authState={authState}
                className="text-xs"
                data-oid="4own9gh"
              />
            </div>
          </div>

          {/* Row 2: Authentication and user controls */}
          <div
            className="flex items-center justify-between min-w-0 overflow-hidden"
            data-oid="utw0:wv"
          >
            {/* Always show AuthButton, especially important when token expired */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              data-testid="auth-button"
              size="sm"
              className="flex-shrink-0"
              data-oid="tvyt9qu"
            />

            {/* User menu - show when authenticated, but ensure it doesn't hide AuthButton */}
            {user && (
              <div className="flex items-center gap-2 ml-2" data-oid="nsyt-zz">
                <span
                  className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-gray-700 text-sm"
                  data-oid="j09ctd9"
                >
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-xs px-2 py-1 flex-shrink-0"
                  data-oid="r8bsuhr"
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
        data-oid="c8xcmbd"
      />
    </TailwindHeader>
  );
}

export default Header;
