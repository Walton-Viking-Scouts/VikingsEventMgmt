import React, { useState, useEffect } from 'react';
import { getEvents, getMostRecentTermId } from '../services/api.js';
import { getToken } from '../services/auth.js';
import LoadingScreen from './LoadingScreen.jsx';
import { Card, Button, Badge, Alert } from './ui';

function EventsList({ sections, onEventSelect, onBack }) {
  const [events, setEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEvents();
  }, [sections]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      const allEvents = [];
      for (const section of sections) {
        const termId = await getMostRecentTermId(section.sectionid, token);
        if (!termId) continue;
        const sectionEvents = await getEvents(section.sectionid, termId, token);
        if (sectionEvents && sectionEvents.items) {
          allEvents.push(...sectionEvents.items.map(event => ({
            ...event,
            sectionid: section.sectionid,
            sectionname: section.sectionname,
            termid: termId,
          })));
        }
      }
      allEvents.sort((a, b) => new Date(b.startdate) - new Date(a.startdate));
      setEvents(allEvents);
    } catch (err) {
      console.error('Error loading events:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEventToggle = (event) => {
    setSelectedEvents(prev => {
      const isSelected = prev.some(e => e.eventid === event.eventid);
      if (isSelected) {
        return prev.filter(e => e.eventid !== event.eventid);
      } else {
        return [...prev, event];
      }
    });
  };

  const handleViewAttendance = () => {
    if (selectedEvents.length > 0) {
      onEventSelect(selectedEvents);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading events..." />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4">
        <Alert.Title>Error Loading Events</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
        <Alert.Actions>
          <Button 
            variant="scout-blue"
            onClick={loadEvents}
            type="button"
          >
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card className="m-4">
        <Card.Header>
          <Card.Title>No Events Found</Card.Title>
          <Button 
            variant="outline-scout-blue"
            onClick={onBack}
            type="button"
          >
            Back to Sections
          </Button>
        </Card.Header>
        <Card.Body>
          <p className="text-gray-600">
            No events found for the selected section(s).
          </p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="m-4">
      <Card.Header>
        <Card.Title>Select Events</Card.Title>
        <div className="flex gap-2 items-center">
          <Badge variant="scout-blue">
            {selectedEvents.length} selected
          </Badge>
          <Button 
            variant="outline-scout-blue"
            onClick={onBack}
            type="button"
          >
            Back
          </Button>
        </div>
      </Card.Header>

      <Card.Body>
        <div className="space-y-2">
          {events.map((event) => {
            const isSelected = selectedEvents.some(e => e.eventid === event.eventid);
            
            return (
              <div 
                key={`${event.sectionid}-${event.eventid}`}
                className={`
                  p-4 rounded-lg border cursor-pointer transition-all duration-200
                  ${isSelected 
                    ? 'bg-scout-blue-light border-scout-blue shadow-md' 
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
                onClick={() => handleEventToggle(event)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{event.name}</div>
                    <div className="text-gray-600 text-sm">
                      {formatDate(event.startdate)} • {event.sectionname}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <Badge variant="scout-green">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Selected
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedEvents.length > 0 && (
          <div className="mt-6">
            <Button 
              variant="scout-blue"
              size="lg"
              onClick={handleViewAttendance}
              type="button"
              className="w-full"
            >
              View Attendance for {selectedEvents.length} Event{selectedEvents.length !== 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default EventsList;
