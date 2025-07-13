import React, { useState } from 'react';
import { canPrint } from '../../utils/platform.js';
import { Button } from '../ui';
import ConfirmModal from '../ui/ConfirmModal';

function DesktopHeader({ user, onLogout }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
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
              </span>
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
            </div>
          )}
        </div>
      </div>
      
      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        title="Confirm Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
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
