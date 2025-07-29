import React from 'react';
import { Card } from './ui';

function AttendanceStatusFilter({ filters, onFiltersChange }) {
  const handleFilterChange = (status, checked) => {
    const newFilters = {
      ...filters,
      [status]: checked,
    };
    onFiltersChange(newFilters);
  };

  const statusConfig = [
    {
      key: 'yes',
      label: 'Yes',
      color: 'bg-green-500',
      textColor: 'text-green-800',
      bgColor: 'bg-green-100',
    },
    {
      key: 'no',
      label: 'No',
      color: 'bg-red-500',
      textColor: 'text-red-800',
      bgColor: 'bg-red-100',
    },
    {
      key: 'invited',
      label: 'Invited',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-800',
      bgColor: 'bg-yellow-100',
    },
    {
      key: 'notInvited',
      label: 'Not Invited',
      color: 'bg-gray-500',
      textColor: 'text-gray-800',
      bgColor: 'bg-gray-100',
    },
  ];

  return (
    <Card className="mb-6">
      <Card.Header>
        <Card.Title className="text-lg font-semibold text-gray-900">
          Filter by Attendance Status
        </Card.Title>
      </Card.Header>
      <Card.Body>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statusConfig.map(({ key, label, color, textColor, bgColor }) => (
            <label
              key={key}
              className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                filters[key]
                  ? `${bgColor} border-gray-300 shadow-sm`
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={(e) => handleFilterChange(key, e.target.checked)}
                className="sr-only"
              />
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 ${color} rounded-full flex-shrink-0`}></div>
                <span className={`text-sm font-medium ${filters[key] ? textColor : 'text-gray-700'}`}>
                  {label}
                </span>
                <div className={`ml-auto w-5 h-5 rounded border-2 flex items-center justify-center ${
                  filters[key] 
                    ? 'bg-blue-600 border-blue-600' 
                    : 'border-gray-300'
                }`}>
                  {filters[key] && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>
        
        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onFiltersChange({
                yes: true,
                no: true,
                invited: true,
                notInvited: false,
              })}
              className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
            >
              Show Invited Only
            </button>
            <button
              type="button"
              onClick={() => onFiltersChange({
                yes: true,
                no: true,
                invited: true,
                notInvited: true,
              })}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              Show All
            </button>
            <button
              type="button"
              onClick={() => onFiltersChange({
                yes: false,
                no: false,
                invited: false,
                notInvited: false,
              })}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

export default AttendanceStatusFilter;