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

/**
 * EventCard component displays Scout event information in a card layout
 * 
 * Renders event details including name, date range, location, and attendance
 * information in a responsive card format. Automatically handles date formatting
 * for both single and multi-date events. Uses Scout theme colors and supports
 * loading states for async data operations.
 * 
 * @component
 * @param {object} props - Component props
 * @param {object} props.eventCard - Event data object containing event details
 * @param {string} props.eventCard.id - Unique event identifier
 * @param {string} props.eventCard.name - Event name/title
 * @param {Array} props.eventCard.events - Array of event date objects
 * @param {string} props.eventCard.events[].startdate - Event start date (ISO string)
 * @param {string} props.eventCard.events[].enddate - Event end date (ISO string)
 * @param {string} [props.eventCard.location] - Event location/venue
 * @param {Array} [props.eventCard.attendanceData] - Attendance records for the event
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
 *       enddate: '2024-07-20'
 *     }],
 *     location: 'Camp Wohelo',
 *     attendanceData: attendanceRecords
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
 *       { startdate: '2024-07-01', enddate: '2024-07-01' },
 *       { startdate: '2024-07-08', enddate: '2024-07-08' },
 *       { startdate: '2024-07-15', enddate: '2024-07-15' }
 *     ],
 *     location: 'Scout Hall'
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
 * const handleViewAttendees = (eventId) => {
 *   navigate(`/events/${eventId}/attendance`);
 * };
 * 
 * <EventCard 
 *   eventCard={{
 *     id: 'badge-ceremony',
 *     name: 'Badge Ceremony',
 *     events: [{ startdate: '2024-08-01', enddate: '2024-08-01' }],
 *     attendanceData: memberAttendance
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

  const buildAttendanceGrid = (events) => {
    // Initialize grid structure by section
    const grid = {};

    // Check if any event has shared event data (synthetic attendees from all sections)
    const hasSharedEventData = events.some(
      (e) =>
        Array.isArray(e.attendanceData) &&
        e.attendanceData.some((a) => a.scoutid?.startsWith('synthetic-')),
    );

    if (hasSharedEventData) {
      // For shared events, we need to merge detailed section data with shared data

      // First, get all sections from synthetic attendees across all events
      // Filter out null/undefined section names
      const allSections = [
        ...new Set(
          events
            .flatMap((e) => e.attendanceData || [])
            .filter((a) => a.scoutid?.startsWith('synthetic-'))
            .map((a) => a.sectionname)
            .filter((sectionName) => !!sectionName && sectionName !== 'null'),
        ),
      ];

      // Get sections we have direct access to (from events)
      const accessibleSections = new Set(
        events.map((event) => event.sectionname),
      );

      // Initialize grid for all sections
      allSections.forEach((sectionName) => {
        grid[sectionName] = {
          attending: 0,
          notAttending: 0,
          invited: 0,
          notInvited: 0,
        };
      });

      // Process detailed data for sections we have access to (priority over shared data)
      events.forEach((event) => {
        if (
          event.attendanceData &&
          Array.isArray(event.attendanceData) &&
          event.sectionname &&
          accessibleSections.has(event.sectionname)
        ) {
          const sectionName = event.sectionname;

          // Check if this is real attendance data (not synthetic)
          const hasRealData = event.attendanceData.some(
            (person) =>
              !person.scoutid || !person.scoutid.startsWith('synthetic-'),
          );

          if (import.meta?.env?.DEV) {
            const syntheticCount = event.attendanceData.filter((p) =>
              p.scoutid?.startsWith('synthetic-'),
            ).length;
            const realCount = event.attendanceData.length - syntheticCount;
            console.debug(`EventCard: Processing section ${sectionName}`, {
              totalAttendees: event.attendanceData.length,
              hasRealData,
              syntheticCount,
              realCount,
            });
          }

          if (hasRealData) {
            // Use detailed section-specific data
            event.attendanceData.forEach((person) => {
              // Skip synthetic attendees for sections we have real data for
              if (person.scoutid && person.scoutid.startsWith('synthetic-'))
                return;

              // Ensure grid entry exists for this person's section (safety check)
              const personSectionName = person.sectionname || sectionName;
              if (!grid[personSectionName]) {
                grid[personSectionName] = {
                  attending: 0,
                  notAttending: 0,
                  invited: 0,
                  notInvited: 0,
                };
              }

              if (person.attending === 'Yes') {
                grid[personSectionName].attending++;
              } else if (person.attending === 'No') {
                grid[personSectionName].notAttending++;
              } else if (person.attending === 'Invited') {
                grid[personSectionName].invited++;
              } else {
                grid[personSectionName].notInvited++;
              }
            });
          }
        }
      });

      // Fill in gaps with synthetic data for sections we don't have access to
      // Process synthetic data from all events
      events.forEach((event) => {
        if (Array.isArray(event.attendanceData)) {
          event.attendanceData.forEach((person) => {
            const sectionName = person.sectionname;

            // Only use synthetic data if we don't have real data for this section
            if (
              person.scoutid &&
              person.scoutid.startsWith('synthetic-') &&
              !accessibleSections.has(sectionName)
            ) {
              // Ensure grid entry exists for this section (safety check)
              if (!grid[sectionName]) {
                grid[sectionName] = {
                  attending: 0,
                  notAttending: 0,
                  invited: 0,
                  notInvited: 0,
                };
              }

              if (person.attending === 'Yes') {
                grid[sectionName].attending++;
              }
              // Note: shared data only provides "Yes" counts, no No/Invited/NotInvited for non-accessible sections
            }
          });
        }
      });

      return grid;
    }

    // Regular events: get unique sections from events
    const sections = [
      ...new Set(events.map((event) => event.sectionname).filter(Boolean)),
    ];

    // Initialize each section in grid
    sections.forEach((sectionName) => {
      grid[sectionName] = {
        attending: 0,
        notAttending: 0,
        invited: 0,
        notInvited: 0,
      };
    });

    // Process attendance data by section (regular events)
    events.forEach((event) => {
      if (
        event.attendanceData &&
        Array.isArray(event.attendanceData) &&
        event.sectionname
      ) {
        const sectionName = event.sectionname;

        event.attendanceData.forEach((person) => {
          // Ensure grid entry exists for this person's section (safety check)
          const personSectionName = person.sectionname || sectionName;
          if (!personSectionName) return; // skip unknown sections
          if (!grid[personSectionName]) {
            grid[personSectionName] = {
              attending: 0,
              notAttending: 0,
              invited: 0,
              notInvited: 0,
            };
          }

          if (person.attending === 'Yes') {
            grid[personSectionName].attending++;
          } else if (person.attending === 'No') {
            grid[personSectionName].notAttending++;
          } else if (person.attending === 'Invited') {
            grid[personSectionName].invited++;
          } else {
            // Empty string, null, or any other value means not invited
            grid[personSectionName].notInvited++;
          }
        });
      }
    });

    return grid;
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

  const attendanceGrid = buildAttendanceGrid(eventCard.events);
  const hasAttendanceData = eventCard.events.some(
    (event) => event.attendanceData && event.attendanceData.length > 0,
  );

  return (
    <div 
      className={cn('bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col break-inside-avoid')}
      role="article"
      aria-labelledby={`event-title-${slug}`}
      data-oid="3kxvx32"
    >
      <div className={cn('px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg pb-3')} data-oid="20kbjde">
        <div className="flex justify-between items-start" data-oid="oey::ov">
          <div className="flex-1" data-oid="0w-_rn.">
            <h3
              className={cn('text-lg font-semibold text-gray-900 m-0 mb-1')}
              id={`event-title-${slug}`}
              data-oid="pqa5tp."
            >
              {eventCard.name}
            </h3>
            <p 
              className="text-sm text-gray-600 mb-2" 
              id={`event-${slug}-description`}
              data-oid="4fslyto"
            >
              {formatDateRange(eventCard.events)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1" data-oid="--y.h.3">
            {aggregatedStatus === 'ongoing' ? (
              <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-scout-green text-white" data-oid="ei1z:j_">
                Ongoing
              </span>
            ) : aggregatedStatus === 'upcoming' ? (
              <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-scout-blue text-white" data-oid="v1xw_so">
                Upcoming
              </span>
            ) : aggregatedStatus === 'past' ? (
              <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-gray-50 text-gray-600 border border-gray-200" data-oid="qex6lwv">
                Past
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cn('p-4 flex-1 pt-0')} data-oid="6ll9qi7">
        {hasAttendanceData ? (
          <div className="mt-3 -mx-4">
            <AttendanceGrid data={attendanceGrid} data-oid="g_kymnd" />
          </div>
        ) : (
          <div className="text-center py-4" data-oid="_t7fg-:">
            <div className="text-gray-400 mb-2" data-oid="64422ln">
              <svg
                className="mx-auto h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                data-oid="chp6dte"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  data-oid="nm81inc"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-500" data-oid="13n62x.">
              No attendance data available
            </p>
          </div>
        )}
      </div>

      <div className={cn('px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg pt-3')} data-oid="bfx2bop">
        <button
          onClick={() => onViewAttendees(eventCard)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md font-medium px-4 py-2 text-base bg-scout-blue text-white hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light active:bg-scout-blue-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled={loading}
          aria-labelledby={`event-title-${slug} view-attendees-label-${slug}`}
          aria-describedby={`event-${slug}-description`}
          data-oid="5s0-rzy"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                data-oid="stn251d"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  data-oid="thmt3ef"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  data-oid="stejrrd"
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
                data-oid="6w_ii9m"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  data-oid="8ll3aah"
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
