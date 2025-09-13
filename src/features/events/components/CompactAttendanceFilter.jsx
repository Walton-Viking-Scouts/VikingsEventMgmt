import React from 'react';

/**
 * Compact Scout attendance status filter component with interactive toggle buttons.
 * Provides Yes/No/Invited/Not Invited filtering options with Scout-themed styling
 * and comprehensive accessibility support for attendance management.
 * 
 * @param {object} root0 - Scout attendance filter configuration and interaction handlers  
 * @param {object} root0.filters - Current filter selections for Scout attendance status categories
 * @param {Function} root0.onFiltersChange - Handler for updating attendance filter selections during Scout event management
 * @returns {JSX.Element} Scout-themed compact attendance filter interface with toggle buttons
 */
function CompactAttendanceFilter({ filters, onFiltersChange }) {
  const handleFilterToggle = (status) => {
    const newFilters = {
      ...filters,
      [status]: !filters[status],
    };
    onFiltersChange(newFilters);
  };

  const statusConfig = [
    {
      key: 'yes',
      label: 'Yes',
      activeStyles: 'bg-scout-green text-white',
      inactiveStyles: 'bg-white text-scout-green border border-scout-green',
    },
    {
      key: 'no',
      label: 'No',
      activeStyles: 'bg-red-500 text-white',
      inactiveStyles: 'bg-white text-red-500 border border-red-500',
    },
    {
      key: 'invited',
      label: 'Invited',
      activeStyles: 'bg-scout-blue text-white',
      inactiveStyles: 'bg-white text-scout-blue border border-scout-blue',
    },
    {
      key: 'notInvited',
      label: 'Not Invited',
      activeStyles: 'bg-gray-500 text-white',
      inactiveStyles: 'bg-white text-gray-500 border border-gray-500',
    },
  ];

  return (
    <div
      className="flex gap-2"
      role="group"
      aria-label="Attendance status filters"
      data-oid="7m451x6"
    >
      {statusConfig.map(({ key, label, activeStyles, inactiveStyles }) => (
        <button
          key={key}
          onClick={() => handleFilterToggle(key)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300 ${filters[key] ? activeStyles : inactiveStyles}`}
          type="button"
          aria-pressed={filters[key]}
          aria-label={`Filter by ${label} attendance status`}
          data-oid="yzgje2b"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default CompactAttendanceFilter;
