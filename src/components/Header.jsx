import React, { useState } from 'react';
import { Header as TailwindHeader, Button } from './ui';
import ConfirmModal from './ui/ConfirmModal';

function Header({ user, onLogout, isOfflineMode, onLogin }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const handleLogout = () => {
    setShowLogoutModal(true);
  };
  
  const handleLogin = () => {
    if (onLogin) {
      onLogin();
    }
  };

  return (
    <TailwindHeader variant="scout" data-testid="header">
      <TailwindHeader.Container>
        <TailwindHeader.Content>
          <TailwindHeader.Left>
            <TailwindHeader.Title data-testid="app-title">
              Vikings Event Mgmt Mobile
            </TailwindHeader.Title>
          </TailwindHeader.Left>
          
          {user && (
            <TailwindHeader.Right data-testid="user-info">
              <span className="text-white">
                Hi, {user.firstname}
                {isOfflineMode && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-white">
                    Offline
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {isOfflineMode ? (
                  <Button 
                    variant="scout-green"
                    size="sm"
                    onClick={handleLogin}
                    data-testid="login-button"
                  >
                    Login
                  </Button>
                ) : (
                  <Button 
                    variant="scout-red"
                    size="sm"
                    onClick={handleLogout}
                    data-testid="logout-button"
                  >
                    Logout
                  </Button>
                )}
                {isOfflineMode && (
                  <Button 
                    variant="scout-red"
                    size="sm"
                    onClick={handleLogout}
                    data-testid="clear-data-button"
                    className="opacity-75"
                  >
                    Clear Data
                  </Button>
                )}
              </div>
            </TailwindHeader.Right>
          )}
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
