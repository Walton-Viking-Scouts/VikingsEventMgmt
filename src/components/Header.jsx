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
    <TailwindHeader variant="scout" fixed={false} data-testid="header">
      <TailwindHeader.Container>
        <TailwindHeader.Content>
          <TailwindHeader.Left>
            <TailwindHeader.Title data-testid="app-title">
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
                <span className="text-white hidden sm:inline">
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                >
                  {isOfflineMode ? 'Clear Data' : 'Logout'}
                </Button>
              </div>
            )}
          </TailwindHeader.Right>
        </TailwindHeader.Content>
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
