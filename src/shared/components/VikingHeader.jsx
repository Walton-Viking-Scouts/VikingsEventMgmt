import React, { useState } from 'react';
import ConfirmModal from './ui/ConfirmModal';
// Auth-related components
import AuthButton from './AuthButton.jsx';
import DataFreshness from './DataFreshness.jsx';
import TokenCountdown from './TokenCountdown.jsx';

/**
 *
 * @param root0
 * @param root0.user
 * @param root0.onLogout
 * @param root0.onLogin
 * @param root0.onRefresh
 * @param root0.isOfflineMode
 * @param root0.authState
 * @param root0.lastSyncTime
 */
function VikingHeader({
  user,
  onLogout,
  onLogin: _onLogin,
  onRefresh: _onRefresh,
  isOfflineMode,
  authState = 'no_data',
  lastSyncTime = null,
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
          <AuthButton
            authState={authState}
            onLogin={_onLogin}
            onRefresh={_onRefresh}
            isOfflineMode={isOfflineMode}
            className="mr-2"
            size="sm"
            data-testid="auth-button"
            data-oid="-wvy88p"
          />

          {user && (
            <button
              className="inline-flex items-center justify-center rounded-md font-medium px-3 py-1.5 text-sm bg-white border-2 border-scout-red text-scout-red hover:bg-scout-red hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-red-light transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleLogout}
              type="button"
              aria-label={isOfflineMode ? 'Clear cached data and logout' : 'Logout from application'}
              data-oid="fhg::su"
            >
              {isOfflineMode ? 'Clear Data' : 'Logout'}
            </button>
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

    </header>
  );
}

export default VikingHeader;