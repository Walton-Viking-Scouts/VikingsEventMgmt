import React, { useState } from 'react';
import { Button } from '../ui';
import ConfirmModal from '../ui/ConfirmModal';
// Auth-related components
import AuthButton from '../AuthButton.jsx';
import DataFreshness from '../DataFreshness.jsx';
import TokenCountdown from '../TokenCountdown.jsx';
import NotificationBellButton from '../NotificationBellButton.jsx';
import NotificationCenter from '../notifications/NotificationCenter';

function DesktopHeader({
  user,
  onLogout,
  onLogin,
  onRefresh,
  isOfflineMode,
  authState = 'no_data',
  lastSyncTime = null,
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  return (
    <header
      className="bg-white shadow-sm border-b border-gray-200 px-6 py-4"
      data-oid="v-qjxzy"
    >
      <div
        className="flex justify-between items-center max-w-7xl mx-auto"
        data-oid="pua2r8c"
      >
        <div className="flex flex-col" data-oid=".fyugfv">
          <h1 className="text-2xl font-bold text-scout-blue" data-oid="dfv63mf">
            Viking Scouts (1st Walton on Thames)
          </h1>
          {user && (
            <div className="flex flex-col mt-2 text-sm text-gray-600">
              <span className="text-gray-700 font-medium">
                Hi, {user.firstname}
                {isOfflineMode && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-white">
                    Offline
                  </span>
                )}
              </span>
              <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                <DataFreshness
                  lastSync={lastSyncTime}
                  authState={authState}
                  compact={true}
                />
                <TokenCountdown
                  authState={authState}
                  compact={true}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4" data-oid="36ufks8">
          {/* Notification bell button */}
          <NotificationBellButton
            onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
            className="mr-2"
            size="md"
          />

          {/* Authentication button - always visible */}
          <AuthButton
            authState={authState}
            onLogin={onLogin}
            onRefresh={onRefresh}
            className="mr-2"
            data-testid="auth-button"
            data-oid="-wvy88p"
          />

          {user && (
            <Button
              variant="outline-scout-red"
              size="sm"
              onClick={handleLogout}
              type="button"
              data-oid="fhg::su"
            >
              {isOfflineMode ? 'Clear Data' : 'Logout'}
            </Button>
          )}
        </div>
      </div>

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
        data-oid="hx.8rc_"
      />

      {/* Notification Center Panel */}
      <NotificationCenter 
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />
    </header>
  );
}

export default DesktopHeader;
