import React from 'react';

function AttendanceTabNavigation({
  activeTab,
  onTabChange,
}) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'register', label: 'Register' },
    { id: 'detailed', label: 'Detailed' },
    { id: 'campGroups', label: 'Camp Groups' },
  ];

  return (
    <div className="border-b border-gray-200 mb-6">
      {/* Horizontal scroll instead of wrapping: five tabs wrapped into two
          cramped rows on small phones. min-h keeps targets ~44px. */}
      <nav className="-mb-px flex overflow-x-auto space-x-4 sm:space-x-8" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`py-3 px-2 min-h-[44px] border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
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