import React, { useState } from 'react';
import { Header as TailwindHeader, Button } from './ui';
import ConfirmModal from './ui/ConfirmModal';
import AuthButton from './AuthButton.jsx';
import DataFreshness from './DataFreshness.jsx';
import TokenCountdown from './TokenCountdown.jsx';
import NotificationBellButton from './NotificationBellButton.jsx';
import NotificationCenter from './notifications/NotificationCenter';

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
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  return (
    <TailwindHeader
      variant="white"
      fixed={false}
      data-testid="header"
      data-oid=":s.obcn"
    >
      <TailwindHeader.Container data-oid="67tc_zl">
        {/* Desktop: Single row layout */}
        <TailwindHeader.Content className="hidden md:flex" data-oid="kf61epf">
          <TailwindHeader.Left data-oid="lq9-bou">
            <TailwindHeader.Title
              className="text-xl font-semibold text-scout-blue"
              data-testid="app-title"
              data-oid="kq-qn:p"
            >
              Viking Scouts (1st Walton on Thames)
            </TailwindHeader.Title>
          </TailwindHeader.Left>

          <TailwindHeader.Right
            data-testid="header-controls"
            data-oid=":9pombj"
          >
            {/* Data freshness indicator */}
            <DataFreshness
              lastSync={lastSyncTime}
              authState={authState}
              className="mr-3"
              data-oid="h6e98ne"
            />

            {/* Token countdown - shows remaining login time */}
            <TokenCountdown
              authState={authState}
              className="mr-3"
              data-oid="y5p8b_s"
            />

            {/* Notification bell button */}
            <NotificationBellButton
              onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
              className="mr-3"
              size="md"
            />

            {/* Authentication button - always visible */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              className="mr-3"
              data-testid="auth-button"
              data-oid="_iin3q9"
            />

            {/* User menu (when authenticated) */}
            {user && (
              <div className="flex items-center gap-3" data-oid="e0l_46q">
                <span className="text-gray-700 text-base" data-oid=":eb0gcu">
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-sm px-3 py-2"
                  data-oid="901gk8o"
                >
                  {isOfflineMode ? 'Clear Data' : 'Logout'}
                </Button>
              </div>
            )}
          </TailwindHeader.Right>
        </TailwindHeader.Content>

        {/* Mobile: Two row layout */}
        <div className="md:hidden py-3 space-y-3" data-oid="9dtwkq-">
          {/* Row 1: Title and essential status */}
          <div className="flex items-center justify-between" data-oid="np_x:8d">
            <TailwindHeader.Title
              className="text-lg font-semibold text-scout-blue"
              data-testid="app-title"
              data-oid="u7t43om"
            >
              Viking Scouts
            </TailwindHeader.Title>

            {/* Essential status indicators and notification bell */}
            <div className="flex items-center space-x-2" data-oid="iefr:sc">
              <DataFreshness
                lastSync={lastSyncTime}
                authState={authState}
                className="text-xs"
                data-oid="vwqz:qr"
              />

              <TokenCountdown
                authState={authState}
                className="text-xs"
                data-oid="182ge3q"
              />

              <NotificationBellButton
                onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
                size="sm"
              />
            </div>
          </div>

          {/* Row 2: Authentication and user controls */}
          <div
            className="flex items-center justify-between min-w-0 overflow-hidden"
            data-oid=".ldar-j"
          >
            {/* Always show AuthButton, especially important when token expired */}
            <AuthButton
              authState={authState}
              onLogin={onLogin}
              onRefresh={onRefresh}
              data-testid="auth-button"
              size="sm"
              className="flex-shrink-0"
              data-oid="wvz7fze"
            />

            {/* User menu - show when authenticated, but ensure it doesn't hide AuthButton */}
            {user && (
              <div className="flex items-center gap-2 ml-2" data-oid="rriqims">
                <span
                  className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-gray-700 text-sm"
                  data-oid="5wp8di1"
                >
                  Hi, {user.firstname}
                </span>
                <Button
                  variant="outline-scout-red"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="text-xs px-2 py-1 flex-shrink-0"
                  data-oid=":2diur6"
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
        data-oid="oknbb-4"
      />

      {/* Notification Center Panel */}
      <NotificationCenter 
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />
    </TailwindHeader>
  );
}

export default Header;
