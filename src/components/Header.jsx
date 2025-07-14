import React, { useState } from 'react';
import { Header as TailwindHeader, Button } from './ui';
import ConfirmModal from './ui/ConfirmModal';

function Header({ user, onLogout }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const handleLogout = () => {
    setShowLogoutModal(true);
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
              <span className="text-white">Hi, {user.firstname}</span>
              <Button 
                variant="scout-red"
                size="sm"
                onClick={handleLogout}
                data-testid="logout-button"
              >
                Logout
              </Button>
            </TailwindHeader.Right>
          )}
        </TailwindHeader.Content>
      </TailwindHeader.Container>
      
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
    </TailwindHeader>
  );
}

export default Header;
