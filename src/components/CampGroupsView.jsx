import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { assignMemberToCampGroup, extractFlexiRecordContext, validateMemberMove } from '../services/campGroupAllocationService.js';

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
  const [organizedGroups, setOrganizedGroups] = useState({ groups: {}, summary: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [sortBy, setSortBy] = useState('groupNumber'); // 'groupNumber', 'memberCount', 'name'
  
  // Drag and drop state
  const [isDragInProgress, setIsDragInProgress] = useState(false);
  const [draggingMemberId, setDraggingMemberId] = useState(null);
  const [flexiRecordContext, setFlexiRecordContext] = useState(null);
  const [pendingMoves, setPendingMoves] = useState(new Map()); // Track optimistic updates
  const [toastMessage, setToastMessage] = useState(null); // Success/error messages
  
  // Ref to track toast timeout for cleanup
  const toastTimeoutRef = useRef(null);

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
        
        // Store the primary camp group data for on-demand FlexiRecord context creation
        organized.campGroupData = primaryCampGroupData;
        
        // Final check before setting state
        if (abortController.signal.aborted) return;
        
        setOrganizedGroups(organized);

        // Extract FlexiRecord context for drag-and-drop operations
        if (primaryCampGroupData && events.length > 0) {
          // Get the correct section type from cached sections data
          const firstEvent = events[0];
          
          // We need to look up the section type from the cached sections data
          // The section type should be in the sections cache, not the event data
          let sectionType = null;
          
          // Try to get section data from localStorage cache
          let sectionsCache = [];
          try {
            sectionsCache = JSON.parse(localStorage.getItem('viking_sections_offline') || '[]');
            const sectionInfo = sectionsCache.find(s => s.sectionid === firstEvent.sectionid || s.sectionid === String(firstEvent.sectionid));
            sectionType = sectionInfo?.section || null;
            
          } catch (error) {
            console.error('ERROR: Could not load sections cache for section type lookup', error);
            sectionsCache = []; // Ensure we have a safe fallback
          }
          
          // Only create context if we have a valid section type
          let context = null;
          if (sectionType) {
            context = extractFlexiRecordContext(
              primaryCampGroupData,
              firstEvent.sectionid,
              termId,
              sectionType,
            );
          } else {
            logger.error('Cannot enable drag-and-drop: section type not found', {
              eventSectionId: firstEvent.sectionid,
              availableSections: sectionsCache.map(s => ({id: s.sectionid, section: s.section})),
            }, LOG_CATEGORIES.ERROR);
          }
          
          setFlexiRecordContext(context);
          
          logger.debug('FlexiRecord context extracted for drag-and-drop', {
            hasContext: !!context,
            flexirecordid: context?.flexirecordid,
            columnid: context?.columnid,
          }, LOG_CATEGORIES.APP);
        }

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

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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

  // Drag and drop handlers
  const handleDragStart = useCallback((dragData) => {
    setIsDragInProgress(true);
    setDraggingMemberId(dragData.memberId);
    
    logger.debug('Drag operation started', {
      memberId: dragData.memberId,
      memberName: dragData.memberName,
      fromGroup: dragData.fromGroupName,
    }, LOG_CATEGORIES.APP);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragInProgress(false);
    setDraggingMemberId(null);
    
    logger.debug('Drag operation ended', {}, LOG_CATEGORIES.APP);
  }, []);

  // Show toast message temporarily
  const showToast = useCallback((type, message) => {
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    setToastMessage({ type, message, id: Date.now() });
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Helper function to calculate total member count
  const calculateTotalMembers = useCallback((group) => {
    return (group.youngPeople?.length || 0) + (group.leaders?.length || 0);
  }, []);

  // Helper function to recalculate summary statistics from groups
  const recalculateSummary = useCallback((groups) => {
    const groupsArray = Object.values(groups);
    return {
      totalGroups: groupsArray.length,
      totalMembers: groupsArray.reduce((sum, group) => sum + ((group.youngPeople?.length || 0) + (group.leaders?.length || 0)), 0),
      totalLeaders: groupsArray.reduce((sum, group) => sum + (group.leaders?.length || 0), 0),
      totalYoungPeople: groupsArray.reduce((sum, group) => sum + (group.youngPeople?.length || 0), 0),
      hasUnassigned: !!groups['Group Unassigned'],
      vikingEventDataAvailable: organizedGroups.summary?.vikingEventDataAvailable || false,
    };
  }, [organizedGroups.summary?.vikingEventDataAvailable]);

  // Optimistically update groups in local state
  const updateGroupsOptimistically = useCallback((moveData) => {
    setOrganizedGroups(prevGroups => {
      const newGroups = { ...prevGroups };
      const groups = { ...newGroups.groups };
      
      // Remove member from source group
      const fromGroup = groups[moveData.fromGroupName];
      if (fromGroup) {
        groups[moveData.fromGroupName] = {
          ...fromGroup,
          youngPeople: fromGroup.youngPeople.filter(
            member => member.scoutid !== moveData.member.scoutid,
          ),
        };
        groups[moveData.fromGroupName].totalMembers = calculateTotalMembers(groups[moveData.fromGroupName]);
      }
      
      // Add member to target group
      const toGroup = groups[moveData.toGroupName];
      if (toGroup) {
        groups[moveData.toGroupName] = {
          ...toGroup,
          youngPeople: [...toGroup.youngPeople, moveData.member],
        };
        groups[moveData.toGroupName].totalMembers = calculateTotalMembers(groups[moveData.toGroupName]);
      }
      
      // Update groups and recalculate summary
      newGroups.groups = groups;
      newGroups.summary = recalculateSummary(groups);
      
      return newGroups;
    });
  }, [calculateTotalMembers, recalculateSummary]);

  // Revert optimistic update on error
  const revertOptimisticUpdate = useCallback((moveData) => {
    setOrganizedGroups(prevGroups => {
      const newGroups = { ...prevGroups };
      const groups = { ...newGroups.groups };
      
      // Add member back to source group
      const fromGroup = groups[moveData.fromGroupName];
      if (fromGroup) {
        groups[moveData.fromGroupName] = {
          ...fromGroup,
          youngPeople: [...fromGroup.youngPeople, moveData.member],
        };
        groups[moveData.fromGroupName].totalMembers = calculateTotalMembers(groups[moveData.fromGroupName]);
      }
      
      // Remove member from target group
      const toGroup = groups[moveData.toGroupName];
      if (toGroup) {
        groups[moveData.toGroupName] = {
          ...toGroup,
          youngPeople: toGroup.youngPeople.filter(
            member => member.scoutid !== moveData.member.scoutid,
          ),
        };
        groups[moveData.toGroupName].totalMembers = calculateTotalMembers(groups[moveData.toGroupName]);
      }
      
      // Update groups and recalculate summary
      newGroups.groups = groups;
      newGroups.summary = recalculateSummary(groups);
      
      return newGroups;
    });
  }, [calculateTotalMembers, recalculateSummary]);

  // Handle member move between groups
  const handleMemberMove = useCallback(async (moveData) => {
    if (!flexiRecordContext && !summary.vikingEventDataAvailable) {
      showToast('error', 'Cannot move members: FlexiRecord data not available');
      return;
    }

    // Validate the move
    const validation = validateMemberMove(moveData.member, moveData.toGroupNumber, organizedGroups.groups);
    if (!validation.valid) {
      showToast('error', validation.error);
      return;
    }

    const memberName = `${moveData.member.firstname} ${moveData.member.lastname}`;
    
    // Get the correct section type for THIS specific member
    let memberSectionType = null;
    const memberSectionId = moveData.member.sectionid;
    
    try {
      const sectionsCache = JSON.parse(localStorage.getItem('viking_sections_offline') || '[]');
      const memberSectionInfo = sectionsCache.find(s => 
        s.sectionid === memberSectionId || s.sectionid === String(memberSectionId),
      );
      memberSectionType = memberSectionInfo?.section || null;
    } catch (error) {
      logger.error('Could not load member section type', { error: error.message });
    }
    
    if (!memberSectionType) {
      showToast('error', `Cannot move ${memberName}: member section type not found`);
      return;
    }
    
    // Create member-specific FlexiRecord context
    let memberFlexiRecordContext = null;
    
    if (flexiRecordContext) {
      // Use existing context but update section info for this specific member
      memberFlexiRecordContext = {
        ...flexiRecordContext,
        section: memberSectionType, // Use the member's section type, not the first event's
        sectionid: memberSectionId, // Use the member's section ID
      };
    } else if (summary.vikingEventDataAvailable && organizedGroups.campGroupData) {
      // Extract context on-demand from the stored camp group data
      const vikingEventData = organizedGroups.campGroupData;
      // The termId should be available in the structure or the first item
      const termId = vikingEventData._structure?.termid || vikingEventData.items?.[0]?.termid;
      
      memberFlexiRecordContext = extractFlexiRecordContext(
        vikingEventData,
        memberSectionId,
        termId,
        memberSectionType,
      );
    }
    
    if (!memberFlexiRecordContext) {
      showToast('error', `Cannot move ${memberName}: Unable to create FlexiRecord context`);
      return;
    }
    
    logger.info('Processing member move (immediate OSM sync + cache update)', {
      memberId: moveData.member.scoutid,
      memberName,
      fromGroup: moveData.fromGroupName,
      toGroup: moveData.toGroupName,
      memberSectionId,
      memberSectionType,
    }, LOG_CATEGORIES.APP);

    // 1. Optimistic UI update
    updateGroupsOptimistically(moveData);
    
    // 2. Track pending move for API sync
    const moveId = `${moveData.member.scoutid}_${Date.now()}`;
    setPendingMoves(prev => {
      const next = new Map(prev);
      next.set(moveId, {
        ...moveData,
        memberFlexiRecordContext,
        timestamp: Date.now(),
      });
      return next;
    });

    try {
      // 3. Sync to OSM immediately (so other users see the update)
      const result = await assignMemberToCampGroup(moveData, memberFlexiRecordContext, getToken());
      
      if (result.success) {
        // 4. Update local FlexiRecord cache after successful OSM sync
        const cacheKey = `viking_flexi_data_${memberFlexiRecordContext.flexirecordid}_${memberFlexiRecordContext.sectionid}_${memberFlexiRecordContext.termid}_offline`;
        const cachedData = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        
        if (cachedData.items) {
          const memberItem = cachedData.items.find(item => item.scoutid === moveData.member.scoutid);
          if (memberItem) {
            memberItem.f_1 = moveData.toGroupNumber;
            memberItem.CampGroup = moveData.toGroupNumber;
            localStorage.setItem(cacheKey, JSON.stringify(cachedData));
            
            logger.debug('Updated local FlexiRecord cache after OSM sync', {
              memberId: moveData.member.scoutid,
              newGroup: moveData.toGroupNumber,
              cacheKey,
            }, LOG_CATEGORIES.APP);
          }
        }
        
        // 5. Update the member object in the current data
        if (moveData.member) {
          moveData.member.f_1 = moveData.toGroupNumber;
          moveData.member.CampGroup = moveData.toGroupNumber;
        }
        
        // 6. Show success message
        showToast('success', `${memberName} moved to ${moveData.toGroupName}`);
        
        // 7. Remove from pending moves and clear drag states
        setPendingMoves(prev => {
          const newMap = new Map(prev);
          newMap.delete(moveId);
          return newMap;
        });
        
        // Clear any drag-related states to ensure UI updates
        setIsDragInProgress(false);
        setDraggingMemberId(null);
        
        logger.info('Member move completed successfully - OSM updated and cache refreshed', {
          memberId: moveData.member.scoutid,
          memberName,
          fromGroup: moveData.fromGroupName,
          toGroup: moveData.toGroupName,
          duration: result.duration,
        }, LOG_CATEGORIES.APP);
        
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      // Error syncing to OSM - revert UI change and show error
      logger.error('Failed to sync member move to OSM', {
        memberId: moveData.member.scoutid,
        memberName,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      
      setPendingMoves(prev => {
        const newMap = new Map(prev);
        newMap.delete(moveId);
        return newMap;
      });
      
      // Clear drag states on error
      setIsDragInProgress(false);
      setDraggingMemberId(null);
      
      revertOptimisticUpdate(moveData);
      showToast('error', `Failed to move ${memberName}: ${error.message}`);
    }
  }, [flexiRecordContext, organizedGroups.groups, organizedGroups.campGroupData, summary.vikingEventDataAvailable, updateGroupsOptimistically, revertOptimisticUpdate, showToast]);

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

        {!summary.vikingEventDataAvailable && (
          <Alert variant="warning" className="mb-4">
            <Alert.Title>No Viking Event Management Data</Alert.Title>
            <Alert.Description>
              No &quot;Viking Event Mgmt&quot; flexirecord found for the sections involved in these events. 
              All members will be shown in the &quot;Unassigned&quot; group.
              {!flexiRecordContext && (
                <><br /><strong>Note:</strong> Drag and drop functionality is not available without FlexiRecord data.</>
              )}
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
              onMemberMove={handleMemberMove}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              isDragInProgress={isDragInProgress}
              draggingMemberId={draggingMemberId}
              dragDisabled={!summary.vikingEventDataAvailable}
              className="h-fit"
            />
          ))}
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`
          fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300
          ${toastMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
          ${toastMessage.type === 'error' ? 'border-l-4 border-red-700' : 'border-l-4 border-green-700'}
        `}>
          <div className="flex items-center">
            {toastMessage.type === 'success' ? (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-sm font-medium">{toastMessage.message}</span>
          </div>
        </div>
      )}

      {/* Pending Operations Indicator */}
      {pendingMoves.size > 0 && (
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-blue-500 text-white rounded-lg shadow-lg">
          <div className="flex items-center">
            <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-medium">
              Syncing {pendingMoves.size} member {pendingMoves.size === 1 ? 'move' : 'moves'} to OSM...
            </span>
          </div>
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