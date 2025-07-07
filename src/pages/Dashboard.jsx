import React, { useState, useEffect } from 'react';
import { getUserRoles, getListOfMembers } from '../services/api.js';
import { getToken } from '../services/auth.js';
import LoadingScreen from '../components/LoadingScreen.jsx';
import SectionsList from '../components/SectionsList.jsx';
import EventsList from '../components/EventsList.jsx';
import AttendanceView from '../components/AttendanceView.jsx';
import MembersList from '../components/MembersList.jsx';
import { Button, Alert } from '../components/ui';

function Dashboard() {
  const [currentView, setCurrentView] = useState('sections'); // sections, events, attendance
  const [sections, setSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
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

  const handleContinueToEvents = async () => {
    if (selectedSections.length > 0) {
      setCurrentView('events');
      setSelectedEvents([]); // Clear selected events when going to events
      
      // Load members for selected sections
      await loadMembersForSections(selectedSections);
    }
  };
  
  const loadMembersForSections = async (sectionsToLoad) => {
    try {
      setLoadingMembers(true);
      const token = getToken();
      const membersData = await getListOfMembers(sectionsToLoad, token);
      setMembers(membersData);
      console.log(`Loaded ${membersData.length} members for ${sectionsToLoad.length} sections`);
    } catch (err) {
      console.error('Error loading members:', err);
      // Don't set error here as this is secondary data - just log it
    } finally {
      setLoadingMembers(false);
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
    setMembers([]); // Clear members data
  };

  const handleBackToEvents = () => {
    setCurrentView('events');
    setSelectedEvents([]);
  };
  
  const handleViewMembers = () => {
    setCurrentView('members');
  };

  if (loading) {
    return <LoadingScreen message="Loading sections..." />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4">
        <Alert.Title>Error Loading Data</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
        <Alert.Actions>
          <Button 
            variant="scout-blue"
            onClick={loadSections}
            type="button"
          >
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div data-testid="dashboard" className="min-h-screen bg-gray-50">
      {/* Navigation breadcrumb */}
      <nav className="bg-white shadow-sm border-b border-gray-200" data-testid="navigation-tabs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button 
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${currentView === 'sections' 
      ? 'border-scout-blue text-scout-blue' 
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }
              `}
              onClick={handleBackToSections}
              type="button"
              data-testid="sections-tab"
            >
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/>
                </svg>
                Sections
              </div>
            </button>
            {selectedSections.length > 0 && (
              <>
                <button 
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                    ${currentView === 'events' 
                ? 'border-scout-blue text-scout-blue' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
                  `}
                  onClick={handleBackToEvents}
                  type="button"
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                    </svg>
                    Events
                  </div>
                </button>
                <button 
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                    ${currentView === 'members' 
                ? 'border-scout-blue text-scout-blue' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
                  `}
                  onClick={handleViewMembers}
                  type="button"
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z"/>
                    </svg>
                    Members
                  </div>
                </button>
              </>
            )}
            {selectedEvents.length > 0 && (
              <button 
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                  ${currentView === 'attendance' 
                ? 'border-scout-blue text-scout-blue' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
                `}
                type="button"
              >
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd"/>
                    <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/>
                  </svg>
                  Attendance
                </div>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* View content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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
            members={members}
            loadingMembers={loadingMembers}
            onEventSelect={handleEventSelect}
            onBack={handleBackToSections}
          />
        )}

        {currentView === 'attendance' && selectedEvents.length > 0 && (
          <AttendanceView 
            sections={selectedSections}
            events={selectedEvents}
            members={members}
            onBack={handleBackToEvents}
          />
        )}
        
        {currentView === 'members' && selectedSections.length > 0 && (
          <MembersList 
            sections={selectedSections}
            members={members}
            onBack={handleBackToEvents}
          />
        )}
      </main>
    </div>
  );
}

export default Dashboard;
