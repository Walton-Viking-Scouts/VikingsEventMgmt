import React from "react";

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
      key: "yes",
      label: "Yes",
      activeStyles: "bg-green-500 text-white",
      inactiveStyles: "bg-white text-green-500 border border-green-500",
    },
    {
      key: "no",
      label: "No",
      activeStyles: "bg-red-500 text-white",
      inactiveStyles: "bg-white text-red-500 border border-red-500",
    },
    {
      key: "invited",
      label: "Invited",
      activeStyles: "bg-yellow-500 text-white",
      inactiveStyles: "bg-white text-yellow-600 border border-yellow-500",
    },
    {
      key: "notInvited",
      label: "Not Invited",
      activeStyles: "bg-gray-500 text-white",
      inactiveStyles: "bg-white text-gray-500 border border-gray-500",
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
