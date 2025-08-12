import React from "react";
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

    // Get unique sections from events
    const sections = [...new Set(events.map((event) => event.sectionname))];

    // Initialize each section in grid
    sections.forEach((sectionName) => {
      grid[sectionName] = {
        attending: 0,
        notAttending: 0,
        invited: 0,
        notInvited: 0,
      };
    });

    // Process attendance data by section
    events.forEach((event) => {
      if (event.attendanceData && event.sectionname) {
        const sectionName = event.sectionname;

        event.attendanceData.forEach((person) => {
          if (person.attending === "Yes") {
            grid[sectionName].attending++;
          } else if (person.attending === "No") {
            grid[sectionName].notAttending++;
          } else if (person.attending === "Invited") {
            grid[sectionName].invited++;
          } else {
            // Empty string, null, or any other value means not invited
            grid[sectionName].notInvited++;
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

  const getStatusBadge = (event) => {
    const status = getEventStatus(event);

    switch (status) {
      case "upcoming":
        return (
          <Badge variant="scout-blue" data-oid="ik2i4fb">
            Upcoming
          </Badge>
        );

      case "ongoing":
        return (
          <Badge variant="scout-green" data-oid="z2nnnox">
            Ongoing
          </Badge>
        );

      case "past":
        return (
          <Badge variant="secondary" data-oid="g5nkmbf">
            Past
          </Badge>
        );

      default:
        return null;
    }
  };

  const attendanceGrid = buildAttendanceGrid(eventCard.events);
  const hasAttendanceData = eventCard.events.some(
    (event) => event.attendanceData && event.attendanceData.length > 0,
  );

  return (
    <Card className="h-full flex flex-col" data-oid="1rzagr4">
      <Card.Header className="pb-3" data-oid="n0vg-hh">
        <div className="flex justify-between items-start" data-oid="ez-oe0p">
          <div className="flex-1" data-oid="hsgg31s">
            <Card.Title
              className="text-lg font-semibold text-gray-900 mb-1"
              data-oid="wprsp03"
            >
              {eventCard.name}
            </Card.Title>
            <p className="text-sm text-gray-600 mb-2" data-oid="6njkvfd">
              {formatDateRange(eventCard.events)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1" data-oid="xctzwm5">
            {eventCard.events.map((event) => (
              <div key={event.eventid} data-oid="4hgvm_4">
                {getStatusBadge(event)}
              </div>
            ))}
          </div>
        </div>

        {/* Participating Sections */}
        <div className="flex flex-wrap gap-1 mt-3" data-oid="jf.u474">
          {eventCard.sections.map((sectionName, _index) => (
            <Badge
              key={_index}
              variant="outline-scout-blue"
              className="text-xs"
              data-oid="r18rap2"
            >
              {sectionName}
            </Badge>
          ))}
        </div>
      </Card.Header>

      <Card.Body className="flex-1 pt-0" data-oid="26hv8p7">
        {hasAttendanceData ? (
          <>
            <h4
              className="text-sm font-medium text-gray-900 mb-3"
              data-oid="95p1ulv"
            >
              Attendance Summary
            </h4>
            <AttendanceGrid data={attendanceGrid} data-oid="o.h4k3d" />
          </>
        ) : (
          <div className="text-center py-4" data-oid="5wzijw7">
            <div className="text-gray-400 mb-2" data-oid="0tm_.k4">
              <svg
                className="mx-auto h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                data-oid="0i34k69"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  data-oid="cyjhur1"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-500" data-oid="fc3gn43">
              No attendance data available
            </p>
          </div>
        )}
      </Card.Body>

      <Card.Footer className="pt-3" data-oid="019jjes">
        <Button
          variant="scout-blue"
          onClick={() => onViewAttendees(eventCard)}
          className="w-full flex items-center justify-center gap-2"
          type="button"
          disabled={loading}
          data-oid="vs.secf"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                data-oid="6rx9d7s"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  data-oid="rsxay:y"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  data-oid="r35z0c7"
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
                data-oid="fas4ovi"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  data-oid="d4_7wfc"
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
