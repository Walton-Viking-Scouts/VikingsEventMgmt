import React from 'react';
import { Header as TailwindHeader, Button } from './ui';

function Header({ user, onLogout }) {
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
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
    </TailwindHeader>
  );
}

export default Header;
