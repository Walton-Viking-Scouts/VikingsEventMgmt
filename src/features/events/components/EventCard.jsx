/**
 * @file EventCard component for displaying Scout event information
 * 
 * Responsive card component that displays event details including name, dates,
 * location, and attendance information. Features Scout-themed styling with
 * Tailwind classes and supports both single and multi-date events.
 * 
 * @module EventCard
 * @version 2.3.7
 * @since 2.3.7 - Created as part of Tailwind-first component redesign
 * @author Vikings Event Management Team
 */

import React, { useMemo } from 'react';
import { cn } from '../../../shared/utils/cn';
import AttendanceGrid from './AttendanceGrid.jsx';
import { buildAttendanceGridImpl } from '../utils/attendanceGridBuilder.js';

/**
 * EventCard component displays Scout event information in a card layout
 * 
 * Renders event details including name, date range, location, and attendance
 * information in a responsive card format. Automatically handles date formatting
 * for both single and multi-date events. Uses Scout theme colors and supports
 * loading states for async data operations.
 * 
 * @component
 * @param {Object} props - Component props (destructured in function signature)
 * @param {Object} props.eventCard - Event data object containing event details
 * @param {Function} [props.onViewAttendees] - Callback when "View Attendees" is clicked  
 * @param {boolean} [props.loading=false] - Loading state indicator
 * 
 * @returns {JSX.Element} Rendered event card component
 * 
 * @example
 * // Basic event card
 * <EventCard 
 *   eventCard={{
 *     id: 'summer-camp-2024',
 *     name: 'Summer Camp 2024',
 *     events: [{
 *       startdate: '2024-07-15',
 *       enddate: '2024-07-20',
 *       sectionname: 'Beavers',
 *       attendanceData: attendanceRecords
 *     }]
 *   }}
 *   onViewAttendees={handleViewAttendees}
 * />
 * 
 * @example
 * // Multi-date event card
 * <EventCard 
 *   eventCard={{
 *     id: 'weekly-meetings',
 *     name: 'Scout Meetings',
 *     events: [
 *       { startdate: '2024-07-01', enddate: '2024-07-01', sectionname: 'Scouts' },
 *       { startdate: '2024-07-08', enddate: '2024-07-08', sectionname: 'Scouts' },
 *       { startdate: '2024-07-15', enddate: '2024-07-15', sectionname: 'Scouts' }
 *     ]
 *   }}
 * />
 * 
 * @example
 * // Loading state
 * <EventCard 
 *   eventCard={eventData}
 *   loading={true}
 *   onViewAttendees={handleViewAttendees}
 * />
 * 
 * @example
 * // Event card with attendance grid
 * const handleViewAttendees = (eventData) => {
 *   navigate(`/events/${eventData.id}/attendance`);
 * };
 * 
 * <EventCard 
 *   eventCard={{
 *     id: 'badge-ceremony',
 *     name: 'Badge Ceremony',
 *     events: [{ 
 *       startdate: '2024-08-01', 
 *       enddate: '2024-08-01',
 *       sectionname: 'Cubs',
 *       attendanceData: memberAttendance 
 *     }]
 *   }}
 *   onViewAttendees={handleViewAttendees}
 * />
 * 
 * @since 2.3.7
 */
function EventCard({ eventCard, onViewAttendees, loading = false }) {
  const slug = useMemo(() => {
    const base = (eventCard?.name ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 64) || 'event';
    return eventCard?.id ? `${base}-${eventCard.id}` : base;
  }, [eventCard?.name, eventCard?.id]);

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateRange = (events) => {
    if (events.length === 1) {
      const event = events[0];
      if (event.startdate === event.enddate) {
        return formatDate(event.startdate);
      }
      return `${formatDate(event.startdate)} - ${formatDate(event.enddate)}`;
    }

    // Multiple events - show range from earliest to latest
    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.startdate) - new Date(b.startdate),
    );
    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];

    return `${formatDate(firstEvent.startdate)} - ${formatDate(lastEvent.enddate)}`;
  };


  const getEventStatus = (event) => {
    const now = new Date();
    const eventStart = new Date(event.startdate);
    const eventEnd = new Date(event.enddate);

    // Create a date for the day after the event ends
    const dayAfterEventEnd = new Date(eventEnd);
    dayAfterEventEnd.setDate(dayAfterEventEnd.getDate() + 1);

    if (now < eventStart) {
      return 'upcoming';
    } else if (now >= eventStart && now < dayAfterEventEnd) {
      return 'ongoing';
    } else {
      return 'past';
    }
  };

  // Compute aggregated status once to avoid inline IIFE
  const aggregatedStatus = useMemo(() => {
    const statuses = new Set(eventCard.events.map((e) => getEventStatus(e)));
    if (statuses.has('ongoing')) return 'ongoing';
    if (statuses.has('upcoming')) return 'upcoming';
    if (statuses.has('past')) return 'past';
    return null;
  }, [eventCard.events]);

  const attendanceGrid = buildAttendanceGridImpl(eventCard.events);
  const hasAttendanceData = eventCard.events.some(
    (event) => event.attendanceData && event.attendanceData.length > 0,
  );

  return (
    <div 
      className={cn('bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col break-inside-avoid')}
      role="article"
      aria-labelledby={`event-title-${slug}`}
    >
      <div className={cn('px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg pb-3')}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3
              className={cn('text-lg font-semibold text-gray-900 m-0 mb-1')}
              id={`event-title-${slug}`}
            >
              {eventCard.name}
            </h3>
            <p 
              className="text-sm text-gray-600 mb-2" 
              id={`event-${slug}-description`}
            >
              {formatDateRange(eventCard.events)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {aggregatedStatus === 'ongoing' ? (
              <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-scout-green text-white">
                Ongoing
              </span>
            ) : aggregatedStatus === 'upcoming' ? (
              <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-scout-blue text-white">
                Upcoming
              </span>
            ) : aggregatedStatus === 'past' ? (
              <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-gray-50 text-gray-600 border border-gray-200">
                Past
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cn('p-4 flex-1 pt-0')}>
        {hasAttendanceData ? (
          <div className="mt-3 -mx-4">
            <AttendanceGrid data={attendanceGrid} />
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-gray-400 mb-2">
              <svg
                className="mx-auto h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-500">
              No attendance data available
            </p>
          </div>
        )}
      </div>

      <div className={cn('px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg pt-3')}>
        <button
          onClick={() => onViewAttendees(eventCard)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md font-medium px-4 py-2 text-base bg-scout-blue text-white hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light active:bg-scout-blue-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled={loading}
          aria-labelledby={`event-title-${slug} view-attendees-label-${slug}`}
          aria-describedby={`event-${slug}-description`}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
              <span id={`view-attendees-label-${slug}`} className="sr-only">View Attendees</span>
              Loading Members...
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span id={`view-attendees-label-${slug}`}>View Attendees</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default EventCard;
