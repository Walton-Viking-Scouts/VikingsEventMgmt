import React from 'react';
import { useLocation } from 'react-router-dom';

function DesktopSidebar({ isOpen, onClose }) {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/sections', label: 'Sections', icon: '👥' },
    { path: '/events', label: 'Events', icon: '📅' },
    { path: '/attendance', label: 'Attendance', icon: '✅' },
    { path: '/reports', label: 'Reports', icon: '📈' },
    { path: '/camp-prep', label: 'Camp Preparation', icon: '🏕️' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <>
      {/* Sidebar overlay for mobile */}
      {isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={onClose}
        />
      )}
      
      <aside className={`desktop-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>Navigation</h2>
          <button 
            className="sidebar-close"
            onClick={onClose}
            type="button"
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <a
                key={item.path}
                href={item.path}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </a>
            );
          })}
        </nav>
        
        <div className="sidebar-footer">
          <div className="version-info">
            <small>Version 1.0.0</small>
          </div>
        </div>
      </aside>
    </>
  );
}

export default DesktopSidebar;