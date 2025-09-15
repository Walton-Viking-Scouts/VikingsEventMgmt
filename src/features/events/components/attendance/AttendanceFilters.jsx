import React from 'react';
import CompactAttendanceFilter from '../CompactAttendanceFilter.jsx';
import { SectionFilter } from '../../../../shared/components/ui';

function AttendanceFilters({
  attendanceFilters,
  onAttendanceFiltersChange,
  sectionFilters,
  onSectionFiltersChange,
  sections,
  showDataFilters = false,
  dataFilters = {},
  onDataFiltersChange,
  attendanceData = [],
}) {
  if (!attendanceData || attendanceData.length === 0) {
    return null;
  }

  const uniqueSections = sections || [];

  return (
    <div className="space-y-3 mb-6 p-3 bg-gray-50 rounded-lg">
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attendance Status:
          </label>
          <CompactAttendanceFilter
            filters={attendanceFilters}
            onFiltersChange={onAttendanceFiltersChange}
          />
        </div>

        {uniqueSections.length > 1 && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sections:
            </label>
            <SectionFilter
              sectionFilters={sectionFilters}
              onFiltersChange={onSectionFiltersChange}
              sections={uniqueSections}
            />
          </div>
        )}

        {showDataFilters && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onDataFiltersChange(prev => ({ ...prev, contacts: !prev.contacts }))}
                className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                  dataFilters.contacts
                    ? 'bg-scout-blue text-white border-scout-blue'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                type="button"
              >
                Contacts
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AttendanceFilters;