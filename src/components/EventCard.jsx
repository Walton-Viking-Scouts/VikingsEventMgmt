import React from 'react';
import { Card, Button, Badge } from './ui';
import AttendanceGrid from './AttendanceGrid.jsx';

function EventCard({ eventCard, onViewAttendees }) {
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
    const sortedEvents = [...events].sort((a, b) => new Date(a.startdate) - new Date(b.startdate));
    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    
    return `${formatDate(firstEvent.startdate)} - ${formatDate(lastEvent.enddate)}`;
  };

  const aggregateAttendanceData = (events) => {
    const attendanceMap = new Map();
    
    // Aggregate attendance data from all events
    events.forEach(event => {
      if (event.attendanceData) {
        event.attendanceData.forEach(person => {
          const key = `${person.firstname}_${person.lastname}`;
          if (!attendanceMap.has(key)) {
            attendanceMap.set(key, {
              firstname: person.firstname,
              lastname: person.lastname,
              attending: person.attending,
              type: person.type || 'YP', // Default to YP if no type
              patrol: person.patrol,
              events: [],
            });
          }
          attendanceMap.get(key).events.push({
            eventId: event.eventid,
            attending: person.attending,
          });
        });
      }
    });
    
    return Array.from(attendanceMap.values());
  };

  const buildAttendanceGrid = (events) => {
    const aggregatedData = aggregateAttendanceData(events);
    
    // Initialize grid structure
    const grid = {
      YL: { attending: 0, notAttending: 0, unknown: 0 },
      YP: { attending: 0, notAttending: 0, unknown: 0 },
      Leader: { attending: 0, notAttending: 0, unknown: 0 },
    };
    
    aggregatedData.forEach(person => {
      // Determine person type based on available data
      let personType = 'YP'; // Default
      
      if (person.type) {
        if (person.type.toLowerCase().includes('leader') || person.type.toLowerCase().includes('adult')) {
          personType = 'Leader';
        } else if (person.type.toLowerCase().includes('yl') || person.type.toLowerCase().includes('young leader')) {
          personType = 'YL';
        }
      }
      
      // Count attendance status (use most recent/common status across events)
      const attendingStatuses = person.events.map(e => e.attending);
      const mostCommonStatus = attendingStatuses.sort((a, b) =>
        attendingStatuses.filter(v => v === a).length - attendingStatuses.filter(v => v === b).length,
      ).pop();
      
      if (mostCommonStatus === 'Yes') {
        grid[personType].attending++;
      } else if (mostCommonStatus === 'No') {
        grid[personType].notAttending++;
      } else {
        grid[personType].unknown++;
      }
    });
    
    return grid;
  };

  const getEventStatus = (event) => {
    const now = new Date();
    const eventStart = new Date(event.startdate);
    const eventEnd = new Date(event.enddate);
    
    if (now < eventStart) {
      return 'upcoming';
    } else if (now >= eventStart && now <= eventEnd) {
      return 'ongoing';
    } else {
      return 'past';
    }
  };

  const getStatusBadge = (event) => {
    const status = getEventStatus(event);
    
    switch (status) {
    case 'upcoming':
      return <Badge variant="scout-blue">Upcoming</Badge>;
    case 'ongoing':
      return <Badge variant="scout-green">Ongoing</Badge>;
    case 'past':
      return <Badge variant="secondary">Past</Badge>;
    default:
      return null;
    }
  };

  const attendanceGrid = buildAttendanceGrid(eventCard.events);
  const hasAttendanceData = eventCard.events.some(event => event.attendanceData && event.attendanceData.length > 0);

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
            {eventCard.events.map((event) => (
              <div key={event.eventid}>
                {getStatusBadge(event)}
              </div>
            ))}
          </div>
        </div>
        
        {/* Participating Sections */}
        <div className="flex flex-wrap gap-1 mt-3">
          {eventCard.sections.map((sectionName, _index) => (
            <Badge key={_index} variant="outline-scout-blue" className="text-xs">
              {sectionName}
            </Badge>
          ))}
        </div>
      </Card.Header>

      <Card.Body className="flex-1 pt-0">
        {hasAttendanceData ? (
          <>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Attendance Summary</h4>
            <AttendanceGrid data={attendanceGrid} />
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-gray-400 mb-2">
              <svg className="mx-auto h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No attendance data available</p>
          </div>
        )}
      </Card.Body>

      <Card.Footer className="pt-3">
        <Button
          variant="scout-blue"
          onClick={() => onViewAttendees(eventCard)}
          className="w-full flex items-center justify-center gap-2"
          type="button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          View Attendees
        </Button>
      </Card.Footer>
    </Card>
  );
}

export default EventCard;