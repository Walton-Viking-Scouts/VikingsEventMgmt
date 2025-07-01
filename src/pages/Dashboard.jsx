import React, { useState, useEffect } from 'react';
import { getUserRoles } from '../services/api.js';
import { getToken } from '../services/auth.js';
import LoadingScreen from '../components/LoadingScreen.jsx';
import SectionsList from '../components/SectionsList.jsx';
import EventsList from '../components/EventsList.jsx';
import AttendanceView from '../components/AttendanceView.jsx';

function Dashboard() {
  const [currentView, setCurrentView] = useState('sections'); // sections, events, attendance
  const [sections, setSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load sections on mount
  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getToken();
      const sectionsData = await getUserRoles(token);
      
      setSections(sectionsData);
      
    } catch (err) {
      console.error('Error loading sections:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionToggle = (section) => {
    setSelectedSections(prevSelected => {
      const isAlreadySelected = prevSelected.some(s => s.sectionid === section.sectionid);
      
      if (isAlreadySelected) {
        // Remove section from selection
        return prevSelected.filter(s => s.sectionid !== section.sectionid);
      } else {
        // Add section to selection
        return [...prevSelected, section];
      }
    });
    
    // Clear selected events when sections change
    setSelectedEvents([]);
  };

  const handleContinueToEvents = () => {
    if (selectedSections.length > 0) {
      setCurrentView('events');
      setSelectedEvents([]); // Clear selected events when going to events
    }
  };

  const handleEventSelect = (events) => {
    setSelectedEvents(events);
    setCurrentView('attendance');
  };

  const handleBackToSections = () => {
    setCurrentView('sections');
    setSelectedSections([]);
    setSelectedEvents([]);
  };

  const handleBackToEvents = () => {
    setCurrentView('events');
    setSelectedEvents([]);
  };

  if (loading) {
    return <LoadingScreen message="Loading sections..." />;
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Error Loading Data</h3>
        <p>{error}</p>
        <button 
          className="btn btn-primary mt-2"
          onClick={loadSections}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-testid="dashboard">
      {/* Navigation breadcrumb */}
      <nav className="nav-tabs" data-testid="navigation-tabs">
        <button 
          className={`nav-tab ${currentView === 'sections' ? 'active' : ''}`}
          onClick={handleBackToSections}
          type="button"
          data-testid="sections-tab"
        >
          Sections
        </button>
        {selectedSections.length > 0 && (
          <button 
            className={`nav-tab ${currentView === 'events' ? 'active' : ''}`}
            onClick={handleBackToEvents}
            type="button"
          >
            Events
          </button>
        )}
        {selectedEvents.length > 0 && (
          <button 
            className={`nav-tab ${currentView === 'attendance' ? 'active' : ''}`}
            type="button"
          >
            Attendance
          </button>
        )}
      </nav>

      {/* View content */}
      {currentView === 'sections' && (
        <SectionsList 
          sections={sections}
          selectedSections={selectedSections}
          onSectionToggle={handleSectionToggle}
          onContinueToEvents={handleContinueToEvents}
        />
      )}

      {currentView === 'events' && selectedSections.length > 0 && (
        <EventsList 
          sections={selectedSections}
          onEventSelect={handleEventSelect}
          onBack={handleBackToSections}
        />
      )}

      {currentView === 'attendance' && selectedEvents.length > 0 && (
        <AttendanceView 
          sections={selectedSections}
          events={selectedEvents}
          onBack={handleBackToEvents}
        />
      )}
    </div>
  );
}

export default Dashboard;