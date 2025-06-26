import React from 'react';

function Header({ user, onLogout }) {
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
    }
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <h1 className="app-title">Vikings Event Mgmt Mobile</h1>
        {user && (
          <div className="user-info">
            <span>Hi, {user.firstname}</span>
            <button 
              className="logout-btn"
              onClick={handleLogout}
              type="button"
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