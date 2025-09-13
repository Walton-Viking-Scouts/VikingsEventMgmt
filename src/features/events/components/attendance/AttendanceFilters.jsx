import React from 'react';
import CompactAttendanceFilter from '../CompactAttendanceFilter.jsx';
import { SectionFilter } from '../../../../shared/components/ui';

/**
 * Attendance filtering component providing comprehensive patrol management controls.
 * Features Scout-themed attendance status filters, section filtering for multi-troop events,
 * and optional data display controls for enhanced troop oversight.
 * 
 * @param {object} root0 - Scout patrol attendance filter configuration
 * @param {object} root0.attendanceFilters - Current attendance status filter selections for patrol tracking
 * @param {Function} root0.onAttendanceFiltersChange - Handler for updating attendance filter selections during patrol management
 * @param {object} root0.sectionFilters - Active section filter selections for multi-troop event organization
 * @param {Function} root0.onSectionFiltersChange - Handler for updating section filter selections in troop organization
 * @param {Array} root0.sections - Available sections for filtering patrol assignments across multiple troops
 * @param {boolean} root0.showDataFilters - Flag to display additional data filter controls for advanced patrol oversight
 * @param {object} root0.dataFilters - Current data display filter selections for enhanced troop visibility
 * @param {Function} root0.onDataFiltersChange - Handler for updating data display filter selections during patrol oversight
 * @param {Array} root0.attendanceData - Current attendance records for patrol members and troop organization
 * @returns {JSX.Element|null} Scout-themed attendance filter interface or null if no attendance data available
 */
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
      <div className="flex flex-col sm:flex-row gap-3">
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