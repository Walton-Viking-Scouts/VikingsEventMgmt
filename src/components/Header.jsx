import React, { useState } from 'react';
import { Header as TailwindHeader, Button } from './ui';
import ConfirmModal from './ui/ConfirmModal';
import AuthButton from './AuthButton.jsx';
import DataFreshness from './DataFreshness.jsx';
import TokenCountdown from './TokenCountdown.jsx';

function Header({
  user,
  onLogout,
  isOfflineMode,
  onLogin,
  onRefresh,
  authState = 'no_data',
  lastSyncTime = null,
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  return (
    <TailwindHeader variant="white" fixed={false} data-testid="header">
      <TailwindHeader.Container>
        {/* Desktop: Single row layout */}
        <TailwindHeader.Content className="hidden md:flex">
          <TailwindHeader.Left>
            <TailwindHeader.Title 
              className="text-xl font-semibold text-scout-blue"
              data-testid="app-title"
            >
              Viking Scouts (1st Walton on Thames)
            </TailwindHeader.Title>
          </TailwindHeader.Left>

          <TailwindHeader.Right data-testid="header-controls">
            {/* Data freshness indicator */}
            <DataFreshness
              lastSync={lastSyncTime}
              authState={authState}
              className="mr-3"
            />

            {/* Token countdown - shows remaining login time */}
            <TokenCountdown
              authState={authState}
              className="mr-3"
            />

            {/* Authentication button - always visible */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              className="mr-3"
              data-testid="auth-button"
            />

            {/* User menu (when authenticated) */}
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-gray-700 text-base">
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-sm px-3 py-2"
                >
                  {isOfflineMode ? 'Clear Data' : 'Logout'}
                </Button>
              </div>
            )}
          </TailwindHeader.Right>
        </TailwindHeader.Content>

        {/* Mobile: Two row layout */}
        <div className="md:hidden py-3 space-y-3">
          {/* Row 1: Title and essential status */}
          <div className="flex items-center justify-between">
            <TailwindHeader.Title 
              className="text-lg font-semibold text-scout-blue"
              data-testid="app-title"
            >
              Viking Scouts
            </TailwindHeader.Title>
            
            {/* Essential status indicators */}
            <div className="flex items-center space-x-2">
              <DataFreshness
                lastSync={lastSyncTime}
                authState={authState}
                className="text-xs"
              />
              <TokenCountdown
                authState={authState}
                className="text-xs"
              />
            </div>
          </div>

          {/* Row 2: Authentication and user controls */}
          <div className="flex items-center justify-between">
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              data-testid="auth-button"
              size="sm"
            />

            {/* User menu - always visible when authenticated */}
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-gray-700 text-sm">
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-xs px-2 py-1"
                >
                  {isOfflineMode ? 'Clear' : 'Logout'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </TailwindHeader.Container>

      {/* Logout/Clear Data Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        title={isOfflineMode ? 'Clear Cached Data' : 'Confirm Logout'}
        message={
          isOfflineMode
            ? 'Are you sure you want to clear all cached data? This will remove all offline access to your events and member data.'
            : 'Are you sure you want to logout?'
        }
        confirmText={isOfflineMode ? 'Clear Data' : 'Logout'}
        cancelText="Cancel"
        onConfirm={() => {
          setShowLogoutModal(false);
          onLogout();
        }}
        onCancel={() => setShowLogoutModal(false)}
        confirmVariant="error"
      />
    </TailwindHeader>
  );
}

export default Header;
