import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function MainNavigation({ onNavigateToSectionMovements }) {
  const location = useLocation();
  
  // Determine current page from URL path
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path.startsWith('/events')) return 'events';
    if (path.startsWith('/sections')) return 'sections';
    if (path.startsWith('/movers')) return 'movers';
    return 'events'; // default
  };

  const currentPage = getCurrentPage();

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="px-6 sm:px-8">
          <div
            className="flex space-x-8 overflow-x-auto"
            role="tablist"
            aria-label="Main navigation"
          >
            {/* Events Tab */}
            <Link
              to="/events"
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                currentPage === 'events'
                  ? 'border-scout-blue text-scout-blue'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
              role="tab"
              aria-selected={currentPage === 'events'}
              aria-controls="events-panel"
              aria-label="Switch to Events view"
            >
              📅 Events
            </Link>

            {/* Sections Tab */}
            <Link
              to="/sections"
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                currentPage === 'sections'
                  ? 'border-scout-blue text-scout-blue'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
              role="tab"
              aria-selected={currentPage === 'sections'}
              aria-controls="sections-panel"
              aria-label="Switch to Sections view"
            >
              👥 Sections
            </Link>

            {/* Movers Button */}
            <button
              onClick={onNavigateToSectionMovements}
              className="py-3 px-1 border-b-2 border-transparent font-medium text-sm whitespace-nowrap text-gray-600 hover:text-gray-900 hover:border-gray-300"
              aria-label="Navigate to Section Movers"
            >
              🔄 Movers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainNavigation;