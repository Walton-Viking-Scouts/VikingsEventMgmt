import React, { useMemo } from "react";
import { Card, Button, Badge } from "./ui";
import AttendanceGrid from "./AttendanceGrid.jsx";

function EventCard({ eventCard, onViewAttendees, loading = false }) {
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
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
        e.attendanceData.some((a) => a.scoutid?.startsWith("synthetic-")),
    );

    if (hasSharedEventData) {
      // For shared events, we need to merge detailed section data with shared data

      // First, get all sections from synthetic attendees across all events
      // Filter out null/undefined section names
      const allSections = [
        ...new Set(
          events
            .flatMap((e) => e.attendanceData || [])
            .filter((a) => a.scoutid?.startsWith("synthetic-"))
            .map((a) => a.sectionname)
            .filter((sectionName) => !!sectionName && sectionName !== "null"),
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
              !person.scoutid || !person.scoutid.startsWith("synthetic-"),
          );

          if (import.meta?.env?.DEV) {
            const syntheticCount = event.attendanceData.filter((p) =>
              p.scoutid?.startsWith("synthetic-"),
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
              if (person.scoutid && person.scoutid.startsWith("synthetic-"))
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

              if (person.attending === "Yes") {
                grid[personSectionName].attending++;
              } else if (person.attending === "No") {
                grid[personSectionName].notAttending++;
              } else if (person.attending === "Invited") {
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
              person.scoutid.startsWith("synthetic-") &&
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

              if (person.attending === "Yes") {
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

          if (person.attending === "Yes") {
            grid[personSectionName].attending++;
          } else if (person.attending === "No") {
            grid[personSectionName].notAttending++;
          } else if (person.attending === "Invited") {
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
      return "upcoming";
    } else if (now >= eventStart && now < dayAfterEventEnd) {
      return "ongoing";
    } else {
      return "past";
    }
  };

  // Compute aggregated status once to avoid inline IIFE
  const aggregatedStatus = useMemo(() => {
    const statuses = new Set(eventCard.events.map((e) => getEventStatus(e)));
    if (statuses.has("ongoing")) return "ongoing";
    if (statuses.has("upcoming")) return "upcoming";
    if (statuses.has("past")) return "past";
    return null;
  }, [eventCard.events]);

  const attendanceGrid = buildAttendanceGrid(eventCard.events);
  const hasAttendanceData = eventCard.events.some(
    (event) => event.attendanceData && event.attendanceData.length > 0,
  );

  return (
    <Card className="h-full flex flex-col">
      <Card.Header className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <Card.Title className="text-lg font-semibold text-gray-900 mb-1">
              {eventCard.name}
            </Card.Title>
            <p className="text-sm text-gray-600 mb-2">
              {formatDateRange(eventCard.events)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {aggregatedStatus === "ongoing" ? (
              <Badge variant="scout-green">Ongoing</Badge>
            ) : aggregatedStatus === "upcoming" ? (
              <Badge variant="scout-blue">Upcoming</Badge>
            ) : aggregatedStatus === "past" ? (
              <Badge variant="light">Past</Badge>
            ) : null}
          </div>
        </div>
      </Card.Header>

      <Card.Body className="flex-1 pt-0">
        {hasAttendanceData ? (
          <>
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Attendance Summary
            </h4>
            <AttendanceGrid data={attendanceGrid} />
          </>
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
      </Card.Body>

      <Card.Footer className="pt-3">
        <Button
          variant="scout-blue"
          onClick={() => onViewAttendees(eventCard)}
          className="w-full flex items-center justify-center gap-2"
          type="button"
          disabled={loading}
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
              View Attendees
            </>
          )}
        </Button>
      </Card.Footer>
    </Card>
  );
}

export default EventCard;
