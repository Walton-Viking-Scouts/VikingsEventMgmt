import React from 'react';
import { canPrint } from '../../utils/platform.js';

function DesktopHeader({ user, onLogout, onToggleSidebar }) {
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
        <button 
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          type="button"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <h1 className="desktop-title">Vikings Event Management</h1>
      </div>
      
      <div className="desktop-header-center">
        <nav className="desktop-nav">
          <a href="/" className="nav-link">Dashboard</a>
          <a href="/events" className="nav-link">Events</a>
          <a href="/reports" className="nav-link">Reports</a>
        </nav>
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