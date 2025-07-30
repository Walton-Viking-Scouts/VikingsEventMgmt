import React, { useState } from 'react';
import { canPrint } from '../../utils/platform.js';
import { Button } from '../ui';
import ConfirmModal from '../ui/ConfirmModal';

function DesktopHeader({ user, onLogout, onLogin, isOfflineMode }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };
  
  const handleLogin = () => {
    if (onLogin) {
      onLogin();
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-scout-blue">Vikings Event Management</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {canPrint() && (
            <Button
              variant="outline-scout-blue"
              size="sm"
              onClick={handlePrint}
              type="button"
              title="Print current page"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
              </svg>
              Print
            </Button>
          )}
          
          {user && (
            <div className="flex items-center space-x-3">
              <span className="text-gray-700 font-medium">
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
                    variant="outline-scout-green"
                    size="sm"
                    onClick={handleLogin}
                    type="button"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" clipRule="evenodd" />
                    </svg>
                    Login
                  </Button>
                ) : (
                  <Button
                    variant="outline-scout-red"
                    size="sm"
                    onClick={handleLogout}
                    type="button"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 001-1h10.586l-2.293 2.293a1 1 0 001.414 1.414l4-4a1 1 0 000-1.414l-4-4a1 1 0 10-1.414 1.414L15.586 3H4z" clipRule="evenodd" />
                    </svg>
                    Logout
                  </Button>
                )}
                {isOfflineMode && (
                  <Button
                    variant="outline-scout-red"
                    size="sm"
                    onClick={handleLogout}
                    type="button"
                    className="opacity-75"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M10 15a4 4 0 01-4-4V5a4 4 0 118 0v6a4 4 0 01-4 4z" clipRule="evenodd" />
                    </svg>
                    Clear Data
                  </Button>
                )}
              </div>
            </div>
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
      />
    </header>
  );
}

export default DesktopHeader;
