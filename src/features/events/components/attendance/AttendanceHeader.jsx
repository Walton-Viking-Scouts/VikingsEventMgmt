import React from 'react';
import { cn } from '../../../../shared/utils/cn';

/**
 *
 * @param root0
 * @param root0.events
 * @param root0.onBack
 * @param root0.onRefresh
 * @param root0.canRefresh
 * @param root0.refreshLoading
 */
function AttendanceHeader({ 
  events, 
  onBack, 
  onRefresh, 
  canRefresh = true,
  refreshLoading = false, 
}) {
  if (!events || events.length === 0) {
    return null;
  }

  const eventName = events[0].name;
  const eventDate = events[0].startdate 
    ? new Date(events[0].startdate).toLocaleDateString()
    : 'Not specified';
  const sectionCount = events.length;

  return (
    <div className={cn('px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0')}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{eventName}</h1>
        <p className="text-gray-600 mt-1">
          {eventDate} • {sectionCount} section{sectionCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex space-x-2">
        {canRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshLoading}
            className="inline-flex items-center justify-center rounded-md font-medium px-3 py-1.5 text-sm border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            {refreshLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md font-medium px-3 py-1.5 text-sm border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          Back
        </button>
      </div>
    </div>
  );
}

export default AttendanceHeader;