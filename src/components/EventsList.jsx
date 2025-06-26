import React, { useState, useEffect } from 'react';
import { getEvents, getMostRecentTermId } from '../services/api.js';
import { getToken } from '../services/auth.js';
import LoadingScreen from './LoadingScreen.jsx';

function EventsList({ sections, onEventSelect, onBack }) {
  const [events, setEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEvents();
  }, [sections]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getToken();
      const allEvents = [];
      
      // Load events for each selected section
      for (const section of sections) {
        const termId = await getMostRecentTermId(section.sectionid, token);
        if (termId) {
          const sectionEvents = await getEvents(section.sectionid, termId, token);
          if (sectionEvents && sectionEvents.items) {
            // Add section info to each event
            const eventsWithSection = sectionEvents.items.map(event => ({
              ...event,
              sectionid: section.sectionid,
              sectionname: section.sectionname,
              termid: termId
            }));
            allEvents.push(...eventsWithSection);
          }
        }
      }
      
      // Sort events by date (most recent first)
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
      <div className="error-container">
        <h3>Error Loading Events</h3>
        <p>{error}</p>
        <button 
          className="btn btn-primary mt-2"
          onClick={loadEvents}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">No Events Found</h2>
          <button 
            className="btn btn-secondary"
            onClick={onBack}
            type="button"
          >
            Back to Sections
          </button>
        </div>
        <p className="text-muted">
          No events found for the selected section(s).
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Select Events</h2>
        <div className="d-flex gap-2">
          <div className="badge badge-primary">
            {selectedEvents.length} selected
          </div>
          <button 
            className="btn btn-secondary"
            onClick={onBack}
            type="button"
          >
            Back
          </button>
        </div>
      </div>

      <div className="list-group">
        {events.map((event) => {
          const isSelected = selectedEvents.some(e => e.eventid === event.eventid);
          
          return (
            <div 
              key={`${event.sectionid}-${event.eventid}`}
              className={`list-item ${isSelected ? 'bg-light' : ''}`}
              onClick={() => handleEventToggle(event)}
            >
              <div>
                <div className="fw-bold">{event.name}</div>
                <div className="text-muted">
                  {formatDate(event.startdate)} • {event.sectionname}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                {isSelected && <span className="badge badge-success">✓</span>}
              </div>
            </div>
          );
        })}
      </div>

      {selectedEvents.length > 0 && (
        <div className="mt-3">
          <button 
            className="btn btn-primary w-100"
            onClick={handleViewAttendance}
            type="button"
          >
            View Attendance for {selectedEvents.length} Event{selectedEvents.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

export default EventsList;