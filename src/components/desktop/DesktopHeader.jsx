import React from 'react';
import { canPrint } from '../../utils/platform.js';

function DesktopHeader({ user, onLogout }) {
  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
    }
  };

  return (
    <header className="desktop-header">
      <div className="desktop-header-left">
        <h1 className="desktop-title">Vikings Event Management</h1>
      </div>
      
      <div className="desktop-header-right">
        {canPrint() && (
          <button 
            className="print-btn"
            onClick={handlePrint}
            type="button"
            title="Print current page"
          >
            🖨️ Print
          </button>
        )}
        
        {user && (
          <div className="user-menu">
            <span className="user-greeting">Hi, {user.firstname}</span>
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

export default DesktopHeader;