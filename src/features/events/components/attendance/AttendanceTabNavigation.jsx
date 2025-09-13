import React from 'react';

/**
 * AttendanceTabNavigation component provides tab navigation for attendance views
 * 
 * Renders a horizontal tab navigation interface allowing users to switch between
 * different attendance views (Overview, Register, Detailed, Camp Groups). Dynamically
 * shows additional tabs based on event configuration.
 * 
 * @component
 * @param {object} root0 - Component props
 * @param {string} root0.activeTab - Currently active tab identifier
 * @param {Function} root0.onTabChange - Callback function when tab is clicked
 * @param {boolean} [root0.hasSharedEvents=false] - Whether to show shared attendance tab
 * 
 * @returns {JSX.Element} Rendered tab navigation component
 * 
 * @example
 * // Basic tab navigation
 * <AttendanceTabNavigation 
 *   activeTab="overview"
 *   onTabChange={handleTabChange}
 * />
 * 
 * @example
 * // With shared events tab
 * <AttendanceTabNavigation 
 *   activeTab="register"
 *   onTabChange={handleTabChange}
 *   hasSharedEvents={true}
 * />
 * 
 * @since 2.3.7
 */
function AttendanceTabNavigation({ 
  activeTab, 
  onTabChange, 
  hasSharedEvents = false, 
}) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'register', label: 'Register' },
    { id: 'detailed', label: 'Detailed' },
    { id: 'campGroups', label: 'Camp Groups' },
  ];

  if (hasSharedEvents) {
    tabs.push({ id: 'sharedAttendance', label: 'Shared Attendance' });
  }

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex flex-wrap space-x-4 sm:space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-scout-blue text-scout-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => onTabChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default AttendanceTabNavigation;