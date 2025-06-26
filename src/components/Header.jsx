import React from 'react';

function Header({ user, onLogout }) {
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
    }
  };

  return (
    <header className="app-header" data-testid="header">
      <div className="header-content">
        <h1 className="app-title" data-testid="app-title">Vikings Event Mgmt Mobile</h1>
        {user && (
          <div className="user-info" data-testid="user-info">
            <span>Hi, {user.firstname}</span>
            <button 
              className="logout-btn"
              onClick={handleLogout}
              type="button"
              data-testid="logout-button"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;