import React, { useState, useEffect, useMemo } from 'react';
import { Alert, Button, Input, Badge } from './ui';
import LoadingScreen from './LoadingScreen.jsx';
import CampGroupCard from './CampGroupCard.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import { getVikingEventDataForEvents } from '../services/flexiRecordService.js';
import { organizeMembersByCampGroups } from '../utils/flexiRecordTransforms.js';
import { fetchMostRecentTermId } from '../services/api.js';
import { getToken } from '../services/auth.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import { isMobileLayout } from '../utils/platform.js';

/**
 * CampGroupsView - Container component for displaying camp groups in a card layout
 * Shows attendees organized by their camp group assignments
 * 
 * @param {Object} props - Component props
 * @param {Array} props.events - Array of event data
 * @param {Array} props.attendees - Array of event attendees
 * @param {Array} props.members - Array of all member data (for person_type classification)
 * @param {Function} props.onError - Error callback function
 */
function CampGroupsView({ events = [], attendees = [], members = [], onError }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [_campGroupsData, setCampGroupsData] = useState(new Map());
  const [organizedGroups, setOrganizedGroups] = useState({ groups: {}, summary: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [sortBy, setSortBy] = useState('groupNumber'); // 'groupNumber', 'memberCount', 'name'

  const isMobile = isMobileLayout();

  // Load camp groups data on mount
  useEffect(() => {
    const abortController = new AbortController();
    
    const loadCampGroups = async () => {
      // Check if component is still mounted
      if (abortController.signal.aborted) return;
      
      setLoading(true);
      setError(null);

      try {
        if (!events || events.length === 0) {
          throw new Error('No events provided for camp groups view');
        }

        logger.info('Loading camp groups for events', {
          totalEvents: events.length,
          totalAttendees: attendees.length,
          totalMembers: members.length,
        }, LOG_CATEGORIES.APP);

        const token = getToken();
        
        // Check abort signal before async operations
        if (abortController.signal.aborted) return;
        
        // Get termId from events or fetch most recent for first section
        let termId = events[0]?.termid;
        if (!termId) {
          termId = await fetchMostRecentTermId(events[0]?.sectionid, token);
        }

        if (abortController.signal.aborted) return;

        if (!termId) {
          throw new Error('No term ID available - camp groups require term context');
        }

        // Load camp groups for all sections involved in events (events contain their own termIds)
        const campGroups = await getVikingEventDataForEvents(events, token);
        
        // Check abort signal before setting state
        if (abortController.signal.aborted) return;
        
        setCampGroupsData(campGroups);

        // Organize attendees by camp groups
        // For multi-section events, we need to determine which section's camp groups to use
        // Use the first section that has camp groups, or create unassigned group if none
        let primaryCampGroupData = null;
        const sectionsWithCampGroups = [];

        campGroups.forEach((data, sectionId) => {
          if (data && data.items && data.items.length > 0) {
            sectionsWithCampGroups.push({ sectionId, data });
            if (!primaryCampGroupData) {
              primaryCampGroupData = data;
            }
          }
        });

        logger.info('Camp groups data loaded', {
          totalSections: campGroups.size,
          sectionsWithCampGroups: sectionsWithCampGroups.length,
          hasPrimaryCampGroups: !!primaryCampGroupData,
        }, LOG_CATEGORIES.APP);

        // Organize members by camp groups
        const organized = organizeMembersByCampGroups(attendees, members, primaryCampGroupData);
        
        // Final check before setting state
        if (abortController.signal.aborted) return;
        
        setOrganizedGroups(organized);

        logger.info('Successfully organized members by camp groups', {
          totalGroups: organized.summary.totalGroups,
          totalMembers: organized.summary.totalMembers,
          hasUnassigned: organized.summary.hasUnassigned,
        }, LOG_CATEGORIES.APP);

      } catch (err) {
        // Don't set error state if component was unmounted
        if (abortController.signal.aborted) return;
        
        logger.error('Error loading camp groups', {
          error: err.message,
          eventsCount: events.length,
          attendeesCount: attendees.length,
          stack: err.stack,
        }, LOG_CATEGORIES.ERROR);

        setError(err.message);
        if (onError) {
          onError(err);
        }
      } finally {
        // Don't set loading state if component was unmounted
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadCampGroups();
    
    // Cleanup function to abort async operations when component unmounts
    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, attendees, members]); // Removed onError from dependencies to avoid unnecessary re-executions

  // Handle member click to show detail modal
  const handleMemberClick = (member) => {
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  // Filter and sort groups based on search and sort criteria
  const filteredAndSortedGroups = useMemo(() => {
    const groupsArray = Object.values(organizedGroups.groups || {});

    // Filter by search term (group name or member names)
    const filtered = groupsArray.filter(group => {
      if (!searchTerm) return true;

      const searchLower = searchTerm.toLowerCase();
      
      // Search in group name
      if (group.name.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in member names
      const allMembers = [...group.leaders, ...group.youngPeople];
      return allMembers.some(member => {
        const fullName = `${member.firstname || ''} ${member.lastname || ''}`.toLowerCase();
        return fullName.includes(searchLower);
      });
    });

    // Sort groups
    filtered.sort((a, b) => {
      switch (sortBy) {
      case 'memberCount':
        return b.totalMembers - a.totalMembers;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'groupNumber':
      default: {
        // Unassigned goes last, otherwise sort by number
        if (a.name === 'Group Unassigned') return 1;
        if (b.name === 'Group Unassigned') return -1;
          
        const aNum = parseInt(a.number) || 0;
        const bNum = parseInt(b.number) || 0;
        return aNum - bNum;
      }
      }
    });

    return filtered;
  }, [organizedGroups.groups, searchTerm, sortBy]);

  if (loading) {
    return <LoadingScreen message="Loading camp groups..." />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4">
        <Alert.Title>Error Loading Camp Groups</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
        <Alert.Actions>
          <Button 
            variant="scout-blue" 
            onClick={() => window.location.reload()} 
            type="button"
          >
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  const { summary } = organizedGroups;

  return (
    <div className="camp-groups-view">
      {/* Header with summary stats */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <Badge variant="scout-blue" size="sm">
            {summary.totalGroups || 0} Groups
          </Badge>
          <Badge variant="scout-green" size="sm">
            {summary.totalMembers || 0} Members
          </Badge>
          <Badge variant="scout-purple" size="sm">
            {summary.totalLeaders || 0} Leaders
          </Badge>
          <Badge variant="secondary" size="sm">
            {summary.totalYoungPeople || 0} Young People
          </Badge>
          {summary.hasUnassigned && (
            <Badge variant="warning" size="sm">
              Unassigned Members
            </Badge>
          )}
        </div>

        {!summary.campGroupDataAvailable && (
          <Alert variant="warning" className="mb-4">
            <Alert.Title>No Viking Event Management Data</Alert.Title>
            <Alert.Description>
              No &quot;Viking Event Mgmt&quot; flexirecord found for the sections involved in these events. 
              All members will be shown in the &quot;Unassigned&quot; group.
            </Alert.Description>
          </Alert>
        )}
      </div>

      {/* Search and sort controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search groups or members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={sortBy === 'groupNumber' ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => setSortBy('groupNumber')}
            type="button"
          >
            By Group #
          </Button>
          <Button
            variant={sortBy === 'memberCount' ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => setSortBy('memberCount')}
            type="button"
          >
            By Size
          </Button>
          <Button
            variant={sortBy === 'name' ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => setSortBy('name')}
            type="button"
          >
            By Name
          </Button>
        </div>
      </div>

      {/* Groups grid */}
      {filteredAndSortedGroups.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Groups Found</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Try adjusting your search terms.' : 'No camp groups available for these events.'}
          </p>
        </div>
      ) : (
        <div className={`grid gap-6 ${
          isMobile 
            ? 'grid-cols-1' 
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}>
          {filteredAndSortedGroups.map((group) => (
            <CampGroupCard
              key={group.name}
              group={group}
              onMemberClick={handleMemberClick}
              className="h-fit"
            />
          ))}
        </div>
      )}

      {/* Member Detail Modal */}
      <MemberDetailModal 
        member={selectedMember}
        isOpen={showMemberModal}
        onClose={handleModalClose}
      />
    </div>
  );
}

export default CampGroupsView;