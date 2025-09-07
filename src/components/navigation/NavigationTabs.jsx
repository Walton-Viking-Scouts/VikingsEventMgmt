import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function NavigationTabs({ className = '' }) {
  const location = useLocation();
  
  const isActive = (path) => {
    if (path === '/events') {
      return location.pathname === '/events' || location.pathname.startsWith('/events/');
    }
    return location.pathname === path;
  };
  
  const tabs = [
    { path: '/events', label: '📅 Events', ariaLabel: 'Navigate to Events' },
    { path: '/sections', label: '👥 Sections', ariaLabel: 'Navigate to Sections' },
    { path: '/movers', label: '🔄 Movers', ariaLabel: 'Navigate to Section Movers' },
  ];

  return (
    <nav
      className={`flex bg-gray-100 rounded-lg p-1 ${className}`}
      role="tablist"
      aria-label="Main navigation"
    >
      {tabs.map(({ path, label, ariaLabel }) => (
        <Link
          key={path}
          to={path}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            isActive(path)
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          role="tab"
          aria-selected={isActive(path)}
          aria-label={ariaLabel}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default NavigationTabs;