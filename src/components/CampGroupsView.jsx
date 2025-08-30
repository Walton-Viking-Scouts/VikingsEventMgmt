import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { Button, Badge } from './ui';
import { AlertAdapter } from '../adapters';
import { useNotification } from '../contexts/notifications/NotificationContext';
import LoadingScreen from './LoadingScreen.jsx';
import CampGroupCard from './CampGroupCard.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import GroupNamesEditModal from './GroupNamesEditModal.jsx';
import { getVikingEventDataForEvents } from '../services/flexiRecordService.js';
// import { organizeMembersByCampGroups } from '../utils/flexiRecordTransforms.js';
import { fetchMostRecentTermId, multiUpdateFlexiRecord } from '../services/api.js';
import { getToken } from '../services/auth.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import { isMobileLayout } from '../utils/platform.js';
import {
  assignMemberToCampGroup,
  extractFlexiRecordContext,
  validateMemberMove,
} from '../services/campGroupAllocationService.js';
import { checkNetworkStatus } from '../utils/networkUtils.js';
import { findMemberSectionType, findMemberSectionName } from '../utils/sectionHelpers.js';
import { isDemoMode } from '../config/demoMode.js';
import { safeGetItem, safeSetItem } from '../utils/storageUtils.js';

/**
 * Simple organization function that works with getSummaryStats() data structure
 * getSummaryStats() returns: { name, scoutid, person_type, vikingEventData: { CampGroup } }
 */
function organizeAttendeesSimple(attendees) {
  const groups = {};
  let totalMembers = 0;
  const seenMembers = new Set(); // Track duplicates
  
  attendees.forEach((member) => {
    // Skip if no member data
    if (!member) return;
    
    // Filter out Leaders, Young Leaders, and other special roles (patrol_id: -2, -3, -99)
    if (member.person_type === 'Leaders' || member.person_type === 'Young Leaders') {
      return;
    }
    
    // Additional filter for special negative patrol IDs that might not have been converted to person_type
    const patrolId = Number(member.patrol_id ?? member.patrolid ?? 0);
    if (patrolId === -2 || patrolId === -3 || patrolId === -99) {
      return;
    }
    
    // Check for duplicates - same member in multiple events
    const memberId = member.scoutid;
    if (seenMembers.has(memberId)) {
      logger.warn('Duplicate member detected - skipping second occurrence', {
        name: member.name,
        scoutid: memberId,
      }, LOG_CATEGORIES.APP);
      return;
    }
    seenMembers.add(memberId);
    
    // Get camp group from Viking Event data
    const campGroup = member.vikingEventData?.CampGroup;
    const groupName = campGroup ? `Group ${campGroup}` : 'Group Unassigned';
    
    // Initialize group if it doesn't exist
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        number: campGroup || 'Unassigned',
        leaders: [], 
        youngPeople: [],
        totalMembers: 0,
      };
    }
    
    // Add member with name split for drag functionality
    const memberWithNames = {
      ...member,
      firstname: member.name?.split(' ')[0] || 'Unknown',
      lastname: member.name?.split(' ').slice(1).join(' ') || '',
    };
    
    groups[groupName].youngPeople.push(memberWithNames);
    groups[groupName].totalMembers++;
    totalMembers++;
  });
  
  // Sort groups by number (Unassigned goes last)
  const sortedGroupNames = Object.keys(groups).sort((a, b) => {
    if (a === 'Group Unassigned') return 1;
    if (b === 'Group Unassigned') return -1;
    
    const aNum = parseInt(a.replace('Group ', '')) || 0;
    const bNum = parseInt(b.replace('Group ', '')) || 0;
    return aNum - bNum;
  });
  
  // Create sorted groups object
  const sortedGroups = {};
  sortedGroupNames.forEach(groupName => {
    const group = groups[groupName];
    
    // Sort members within each group by name
    group.youngPeople.sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '');
    });
    
    sortedGroups[groupName] = group;
  });
  
  return {
    groups: sortedGroups,
    summary: {
      totalGroups: Object.keys(sortedGroups).length,
      totalMembers,
      totalLeaders: 0,
      totalYoungPeople: totalMembers,
      hasUnassigned: !!sortedGroups['Group Unassigned'],
      vikingEventDataAvailable: false, // Will be updated based on actual data presence
    },
  };
}

/**
 * Custom hook to extract FlexiRecord context for drag-and-drop operations
 * @param {Object|null} primaryCampGroupData - Camp group data from FlexiRecord service
 * @param {Array} events - Array of event data
 * @param {Array} sectionsCache - Cached sections data
 * @param {string|number} termId - Current term ID
 * @returns {Object|null} FlexiRecord context for drag operations or null if not available
 */
function useFlexiRecordContext(
  primaryCampGroupData,
  events,
  sectionsCache,
  termId,
) {
  return useMemo(() => {
    // Early returns for missing data - guard against falsy termId
    if (
      !primaryCampGroupData ||
      !events.length ||
      !sectionsCache.length ||
      !termId
    ) {
      return null;
    }

    // Get the correct section type from cached sections data
    const firstEvent = events[0];

    // Find section info using normalized string comparison
    const sectionInfo = sectionsCache.find(
      (s) => String(s.sectionid) === String(firstEvent.sectionid),
    );

    // Log error if section not found
    if (!sectionInfo?.section) {
      logger.error(
        'Cannot enable drag-and-drop: section type not found',
        {
          eventSectionId: firstEvent.sectionid,
          availableSections: sectionsCache.map((s) => ({
            id: s.sectionid,
            section: s.section,
          })),
        },
        LOG_CATEGORIES.ERROR,
      );
      return null;
    }

    // Extract FlexiRecord context when sectionInfo.section exists
    let context = null;
    try {
      context = extractFlexiRecordContext(
        primaryCampGroupData,
        firstEvent.sectionid,
        termId,
        sectionInfo.section,
      );
    } catch (err) {
      logger.error(
        'Failed to extract FlexiRecord context',
        { error: err.message },
        LOG_CATEGORIES.ERROR,
      );
      return null;
    }

    logger.debug(
      'FlexiRecord context extracted for drag-and-drop',
      {
        hasContext: !!context,
        flexirecordid: context?.flexirecordid,
        columnid: context?.columnid,
      },
      LOG_CATEGORIES.APP,
    );

    return context;
  }, [primaryCampGroupData, events, sectionsCache, termId]);
}

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
function CampGroupsView({
  events = [],
  attendees = [],
  members = [],
  onError,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [organizedGroups, setOrganizedGroups] = useState({
    groups: {},
    summary: {},
  });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [termId, setTermId] = useState(null);

  // Drag and drop state
  const [isDragInProgress, setIsDragInProgress] = useState(false);
  const [draggingMemberId, setDraggingMemberId] = useState(null);

  const [pendingMoves, setPendingMoves] = useState(new Map()); // Track optimistic updates
  
  // Notification system
  const { notifySuccess, notifyError } = useNotification();

  // Group names editing state
  const [showGroupNamesModal, setShowGroupNamesModal] = useState(false);
  const [groupRenameLoading, setGroupRenameLoading] = useState(false);

  // Ref to track component mount status for async operations
  const isMountedRef = useRef(true);

  const isMobile = isMobileLayout();

  // Cache parsed sections data to avoid JSON.parse on every drag operation
  const sectionsCache = useMemo(() => {
    try {
      const demoMode = isDemoMode();
      const cacheKey = demoMode ? 'demo_viking_sections_offline' : 'viking_sections_offline';
      return JSON.parse(
        localStorage.getItem(cacheKey) || '[]',
      );
    } catch (error) {
      logger.error(
        'Could not parse sections cache',
        { error: error.message },
        LOG_CATEGORIES.ERROR,
      );
      return [];
    }
  }, []); // Parse once per component mount

  // Use custom hook to extract FlexiRecord context for drag-and-drop operations
  const flexiRecordContext = useFlexiRecordContext(
    organizedGroups.campGroupData,
    events,
    sectionsCache,
    termId,
  );

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

        logger.info(
          'Loading camp groups for events',
          {
            totalEvents: events.length,
            totalAttendees: attendees.length,
            totalMembers: members.length,
          },
          LOG_CATEGORIES.APP,
        );

        const token = getToken();

        // Check abort signal before async operations
        if (abortController.signal.aborted) return;

        // Get termId from events or fetch most recent for first section
        let currentTermId = events[0]?.termid;
        if (!currentTermId) {
          currentTermId = await fetchMostRecentTermId(
            events[0]?.sectionid,
            token,
          );
        }

        if (abortController.signal.aborted) return;

        if (!currentTermId) {
          throw new Error(
            'No term ID available - camp groups require term context',
          );
        }

        // Set termId in state for the hook to use
        setTermId(currentTermId);

        // Load camp groups for FlexiRecord context (needed for drag functionality)
        const campGroups = await getVikingEventDataForEvents(events, token);

        // Check abort signal before setting state
        if (abortController.signal.aborted) return;

        // Use the enriched attendees data from AttendanceView (has firstname/lastname/person_type)
        // But we still need FlexiRecord context for drag operations
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

        logger.info(
          'Camp groups data loaded',
          {
            totalSections: campGroups.size,
            sectionsWithCampGroups: sectionsWithCampGroups.length,
            hasPrimaryCampGroups: !!primaryCampGroupData,
          },
          LOG_CATEGORIES.APP,
        );

        // Simple organization function that works with getSummaryStats() data
        const organized = organizeAttendeesSimple(attendees);
        
        // If we have pending moves, preserve optimistic updates
        if (pendingMoves.size > 0) {
          logger.debug('Preserving optimistic updates during reload', {
            pendingMovesCount: pendingMoves.size,
            pendingMoves: Array.from(pendingMoves.entries()).map(([id, move]) => ({
              id,
              memberId: move.member?.scoutid,
              fromGroup: move.fromGroupName,
              toGroup: move.toGroupName,
            })),
          }, LOG_CATEGORIES.APP);
          
          // Apply pending moves to the freshly organized data
          for (const [moveId, moveData] of pendingMoves.entries()) {
            if (moveData && moveData.member) {
              // Find member in current organized groups
              let memberFound = false;
              for (const [groupName, group] of Object.entries(organized.groups)) {
                const memberIndex = group.youngPeople?.findIndex(m => 
                  m.scoutid === moveData.member.scoutid
                );
                if (memberIndex !== -1) {
                  // Remove from current group
                  const memberToMove = {
                    ...group.youngPeople[memberIndex],
                    vikingEventData: {
                      ...group.youngPeople[memberIndex].vikingEventData,
                      CampGroup: moveData.toGroupNumber === 'Unassigned' ? '' : moveData.toGroupNumber
                    }
                  };
                  organized.groups[groupName].youngPeople.splice(memberIndex, 1);
                  organized.groups[groupName].totalMembers--;
                  
                  // Add to target group
                  if (!organized.groups[moveData.toGroupName]) {
                    organized.groups[moveData.toGroupName] = {
                      name: moveData.toGroupName,
                      number: moveData.toGroupNumber,
                      leaders: [],
                      youngPeople: [],
                      totalMembers: 0,
                    };
                  }
                  organized.groups[moveData.toGroupName].youngPeople.push(memberToMove);
                  organized.groups[moveData.toGroupName].totalMembers++;
                  memberFound = true;
                  break;
                }
              }
              if (!memberFound) {
                logger.warn('Could not find member for optimistic update preservation', {
                  memberId: moveData.member.scoutid,
                  moveId,
                }, LOG_CATEGORIES.APP);
              }
            }
          }
          
          // Recalculate summary after optimistic updates
          organized.summary = {
            totalGroups: Object.keys(organized.groups).length,
            totalMembers: Object.values(organized.groups).reduce(
              (sum, group) => sum + (group.youngPeople?.length || 0) + (group.leaders?.length || 0), 0
            ),
            totalLeaders: Object.values(organized.groups).reduce(
              (sum, group) => sum + (group.leaders?.length || 0), 0
            ),
            totalYoungPeople: Object.values(organized.groups).reduce(
              (sum, group) => sum + (group.youngPeople?.length || 0), 0
            ),
            hasUnassigned: !!organized.groups['Group Unassigned'] && organized.groups['Group Unassigned'].totalMembers > 0,
            vikingEventDataAvailable: organized.summary?.vikingEventDataAvailable || false,
          };
        }

        // Store the FlexiRecord context for drag operations
        organized.campGroupData = primaryCampGroupData;

        // Update viking event data availability based on actual data presence
        organized.summary.vikingEventDataAvailable = Boolean(primaryCampGroupData && Object.keys(primaryCampGroupData).length);

        // Final check before setting state
        if (abortController.signal.aborted) return;

        setOrganizedGroups(organized);

        // FlexiRecord context is now handled by the useFlexiRecordContext hook

        logger.info(
          'Successfully organized members by camp groups',
          {
            totalGroups: organized.summary.totalGroups,
            totalMembers: organized.summary.totalMembers,
            hasUnassigned: organized.summary.hasUnassigned,
          },
          LOG_CATEGORIES.APP,
        );
      } catch (err) {
        // Don't set error state if component was unmounted
        if (abortController.signal.aborted) return;

        logger.error(
          'Error loading camp groups',
          {
            error: err.message,
            eventsCount: events.length,
            attendeesCount: attendees.length,
            stack: err.stack,
          },
          LOG_CATEGORIES.ERROR,
        );

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
  }, [events, attendees, members, pendingMoves]); // Include pendingMoves to preserve optimistic updates

  // Mark component as unmounted for async operations
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle member click to show detail modal
  const handleMemberClick = (member) => {
    // Find the full member data from the members prop (like Register tab does)
    // Convert scoutid to number for comparison (members array has numeric scoutids)
    const scoutidAsNumber = parseInt(member.scoutid, 10);
    const cachedMember = members?.find(
      (m) => m.scoutid === scoutidAsNumber,
    );
    
    let enrichedMember;
    if (cachedMember) {
      // Use the same transformMemberForModal that Register uses
      // This gives us all 51 fields including medical and contact info
      enrichedMember = {
        // Start with all cached member data (54 fields)
        ...cachedMember,
        // Keep the attendance/camp group specific data from the simplified member
        vikingEventData: member.vikingEventData,
        events: member.events,
        yes: member.yes,
        no: member.no,
        invited: member.invited,
        notInvited: member.notInvited,
        total: member.total,
        // Ensure scoutid is consistent
        scoutid: cachedMember.scoutid || cachedMember.member_id,
        // Use firstname/lastname from cached member for consistency
        firstname: cachedMember.firstname || cachedMember.first_name,
        lastname: cachedMember.lastname || cachedMember.last_name,
        sectionid: cachedMember.sectionid || cachedMember.section_id,
        person_type: member.person_type || cachedMember.person_type,
        has_photo: cachedMember.has_photo,
        sections: [findMemberSectionName(cachedMember.sectionid || cachedMember.section_id, sectionsCache) || member.sectionname || 'Unknown'],
        sectionname: findMemberSectionName(cachedMember.sectionid || cachedMember.section_id, sectionsCache) || member.sectionname, // Also set sectionname for consistency
      };
    } else {
      // Fallback to the simplified member data if no cached member found
      // Try to resolve section for simplified member too
      const memberSectionName = findMemberSectionName(member.sectionid, sectionsCache);
      enrichedMember = {
        ...member,
        sections: [memberSectionName || member.sectionname || 'Unknown'],
        sectionname: memberSectionName || member.sectionname,
      };
    }
    
    setSelectedMember(enrichedMember);
    setShowMemberModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((dragData) => {
    // Prevent overlapping drag operations
    if (pendingMoves.size > 0) {
      return;
    }

    setIsDragInProgress(true);
    setDraggingMemberId(dragData.memberId);

    logger.debug(
      'Drag operation started',
      {
        memberId: dragData.memberId,
        memberName: dragData.memberName,
        fromGroup: dragData.fromGroupName,
      },
      LOG_CATEGORIES.APP,
    );
  }, [pendingMoves.size]);

  const handleDragEnd = useCallback(() => {
    // Only clear the drag-in-progress state, but keep draggingMemberId
    // The draggingMemberId will be cleared by the move handler after OSM responds
    setIsDragInProgress(false);

    // Safety timeout: Clear drag state if no move operation occurs within 3 seconds
    // This handles cases like dropping on the same group or invalid drops
    setTimeout(() => {
      setDraggingMemberId((currentId) => {
        if (currentId !== null) {
          logger.debug('Drag state cleared by safety timeout - no move operation occurred', {}, LOG_CATEGORIES.APP);
          return null;
        }
        return currentId;
      });
    }, 3000); // Increased to 3 seconds to allow for slower API responses
  }, []);

  // Show toast message using NotificationContext
  const showToast = useCallback((type, message) => {
    // Log error toast messages for debugging
    if (type === 'error') {
      logger.error('Toast Error Message', {
        message,
        type,
        timestamp: new Date().toISOString(),
      }, LOG_CATEGORIES.COMPONENT);
    }
    
    // Use NotificationContext instead of custom toast
    if (type === 'success') {
      notifySuccess(message);
    } else if (type === 'error') {
      notifyError(message);
    }
  }, [notifySuccess, notifyError]);

  // Helper function to calculate total member count
  const calculateTotalMembers = useCallback((group) => {
    return (group.youngPeople?.length || 0) + (group.leaders?.length || 0);
  }, []);

  // Helper function to recalculate summary statistics from groups
  const recalculateSummary = useCallback(
    (groups) => {
      const groupsArray = Object.values(groups);
      return {
        totalGroups: groupsArray.length,
        totalMembers: groupsArray.reduce(
          (sum, group) =>
            sum +
            ((group.youngPeople?.length || 0) + (group.leaders?.length || 0)),
          0,
        ),
        totalLeaders: groupsArray.reduce(
          (sum, group) => sum + (group.leaders?.length || 0),
          0,
        ),
        totalYoungPeople: groupsArray.reduce(
          (sum, group) => sum + (group.youngPeople?.length || 0),
          0,
        ),
        hasUnassigned: (groups['Group Unassigned']?.totalMembers || 0) > 0,
        vikingEventDataAvailable:
          organizedGroups.summary?.vikingEventDataAvailable || false,
      };
    },
    [organizedGroups.summary?.vikingEventDataAvailable],
  );

  // Optimistically update groups in local state
  const updateGroupsOptimistically = useCallback(
    (moveData) => {
      setOrganizedGroups((prevGroups) => {
        const newGroups = { ...prevGroups };
        const groups = { ...newGroups.groups };

        // Check if member already exists in target group
        const targetGroup = groups[moveData.toGroupName];
        if (!targetGroup) {
          logger.warn('Target group not found, skipping optimistic update', {
            toGroupName: moveData.toGroupName,
          }, LOG_CATEGORIES.APP);
          return prevGroups;
        }
        
        const targetYoungPeople = Array.isArray(targetGroup.youngPeople) ? targetGroup.youngPeople : [];
        if (targetYoungPeople.some(m => m.scoutid === moveData.member.scoutid)) {
          logger.warn('Member already in target group, skipping optimistic update', {
            memberId: moveData.member.scoutid,
            targetGroup: moveData.toGroupName,
          }, LOG_CATEGORIES.APP);
          return prevGroups;
        }

        // Remove member from source group
        const fromGroup = groups[moveData.fromGroupName];
        if (fromGroup) {
          groups[moveData.fromGroupName] = {
            ...fromGroup,
            youngPeople: fromGroup.youngPeople.filter(
              (member) => member.scoutid !== moveData.member.scoutid,
            ),
          };
          groups[moveData.fromGroupName].totalMembers = calculateTotalMembers(
            groups[moveData.fromGroupName],
          );
        }

        // Add member to target group with updated CampGroup
        const toGroup = groups[moveData.toGroupName];
        if (toGroup) {
          // Create updated member object with new CampGroup value
          const updatedMember = {
            ...moveData.member,
            vikingEventData: {
              ...moveData.member.vikingEventData,
              CampGroup: moveData.toGroupNumber === 'Unassigned' ? '' : moveData.toGroupNumber
            }
          };
          
          groups[moveData.toGroupName] = {
            ...toGroup,
            youngPeople: [...toGroup.youngPeople, updatedMember],
          };
          groups[moveData.toGroupName].totalMembers = calculateTotalMembers(
            groups[moveData.toGroupName],
          );
        }

        // Update groups and recalculate summary
        newGroups.groups = groups;
        newGroups.summary = recalculateSummary(groups);

        return newGroups;
      });
    },
    [calculateTotalMembers, recalculateSummary],
  );

  // Revert optimistic update on error
  const revertOptimisticUpdate = useCallback(
    (moveData) => {
      setOrganizedGroups((prevGroups) => {
        const newGroups = { ...prevGroups };
        const groups = { ...newGroups.groups };

        // Add member back to source group with original CampGroup value
        const fromGroup = groups[moveData.fromGroupName];
        if (fromGroup) {
          // Restore original CampGroup value
          const restoredMember = {
            ...moveData.member,
            vikingEventData: {
              ...moveData.member.vikingEventData,
              CampGroup: moveData.fromGroupNumber === 'Unassigned' ? '' : moveData.fromGroupNumber
            }
          };
          
          groups[moveData.fromGroupName] = {
            ...fromGroup,
            youngPeople: [...fromGroup.youngPeople, restoredMember],
          };
          groups[moveData.fromGroupName].totalMembers = calculateTotalMembers(
            groups[moveData.fromGroupName],
          );
        }

        // Remove member from target group
        const toGroup = groups[moveData.toGroupName];
        if (toGroup) {
          groups[moveData.toGroupName] = {
            ...toGroup,
            youngPeople: toGroup.youngPeople.filter(
              (member) => member.scoutid !== moveData.member.scoutid,
            ),
          };
          groups[moveData.toGroupName].totalMembers = calculateTotalMembers(
            groups[moveData.toGroupName],
          );
        }

        // Update groups and recalculate summary
        newGroups.groups = groups;
        newGroups.summary = recalculateSummary(groups);

        return newGroups;
      });
    },
    [calculateTotalMembers, recalculateSummary],
  );

  /**
   * Update camp group assignment in demo mode cache
   * In demo mode, we standardize on f_1 for CampGroup field
   */
  const updateDemoCampGroupAssignment = useCallback((member, newGroupNumber, memberSectionId) => {
    // In demo mode, we use standardized flexi record ID and term
    const flexirecordid = 'flexi_viking_event';
    const termid = '12345';
    const cacheKey = `viking_flexi_data_${flexirecordid}_${memberSectionId}_${termid}_offline`;
    
    const cached = safeGetItem(cacheKey, { items: [] });
    
    // Convert scoutid to match the type in cache (both to numbers for comparison)
    const memberScoutId = Number(member.scoutid);
    const memberIndex = cached.items.findIndex(m => Number(m.scoutid) === memberScoutId);
    
    if (memberIndex >= 0) {
      // Update the CampGroup field (f_1 in demo mode)
      cached.items[memberIndex].f_1 = newGroupNumber === 'Unassigned' ? '' : newGroupNumber.toString();
      // Also update the CampGroup field for consistency
      cached.items[memberIndex].CampGroup = newGroupNumber === 'Unassigned' ? '' : newGroupNumber.toString();
      safeSetItem(cacheKey, cached);
      
      logger.info('Demo mode: Updated camp group in cache', {
        memberId: member.scoutid,
        memberName: member.name,
        newGroup: newGroupNumber,
        cacheKey,
      }, LOG_CATEGORIES.APP);
    } else {
      logger.warn('Demo mode: Member not found in cache', {
        memberId: member.scoutid,
        memberScoutId,
        cacheKey,
        cachedScoutIds: cached.items.map(m => m.scoutid).slice(0, 5), // Show first 5 for debugging
      }, LOG_CATEGORIES.APP);
    }
  }, []);

  // Handle member move between groups
  const handleMemberMove = useCallback(
    async (moveData) => {
      // Check if we're in demo mode first
      if (isDemoMode()) {
        const memberName = moveData.member.name || `${moveData.member.firstname || ''} ${moveData.member.lastname || ''}`.trim() || 'Unknown Member';
        
        // Validate the move
        const validation = validateMemberMove(
          moveData.member,
          moveData.toGroupNumber,
          organizedGroups.groups,
        );
        if (!validation.valid) {
          showToast('error', validation.error);
          return;
        }
        
        logger.info('Demo mode: Processing member move (cache-only)', {
          memberId: moveData.member.scoutid,
          memberName,
          fromGroup: moveData.fromGroupName,
          toGroup: moveData.toGroupName,
        }, LOG_CATEGORIES.APP);
        
        // 1. Optimistic UI update
        updateGroupsOptimistically(moveData);
        
        // 2. Update cache in demo mode
        // In demo mode, use the first available section since all sections share the same event
        const memberSectionId = moveData.member.sectionid || 11107; // Default to Adults section
        updateDemoCampGroupAssignment(moveData.member, moveData.toGroupNumber, memberSectionId);
        
        // 3. Show success message
        showToast('success', `${memberName} moved to ${moveData.toGroupName}`);
        
        // The optimistic update already handles the UI update
        // The cache has been updated so next reload will show correct data
        
        return; // Exit early for demo mode
      }
      
      // Production mode - existing logic
      if (
        !flexiRecordContext &&
        !organizedGroups.summary?.vikingEventDataAvailable
      ) {
        showToast(
          'error',
          'Cannot move members: FlexiRecord data not available',
        );
        return;
      }

      // Validate the move
      const validation = validateMemberMove(
        moveData.member,
        moveData.toGroupNumber,
        organizedGroups.groups,
      );
      if (!validation.valid) {
        showToast('error', validation.error);
        return;
      }

      const memberName = moveData.member.name || `${moveData.member.firstname || ''} ${moveData.member.lastname || ''}`.trim() || 'Unknown Member';

      // Get the correct section type for THIS specific member
      const memberSectionId = moveData.member.sectionid;
      const memberSectionType = findMemberSectionType(memberSectionId, sectionsCache);

      if (!memberSectionType) {
        showToast(
          'error',
          `Cannot move ${memberName}: member section type not found`,
        );
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
      } else if (
        organizedGroups.summary?.vikingEventDataAvailable &&
        organizedGroups.campGroupData
      ) {
        // Extract context on-demand from the stored camp group data
        const vikingEventData = organizedGroups.campGroupData;
        // The termId should be available in the structure or the first item
        const termId =
          vikingEventData._structure?.termid ||
          vikingEventData.items?.[0]?.termid;

        memberFlexiRecordContext = extractFlexiRecordContext(
          vikingEventData,
          memberSectionId,
          termId,
          memberSectionType,
        );
      }

      if (!memberFlexiRecordContext) {
        showToast(
          'error',
          `Cannot move ${memberName}: Unable to create FlexiRecord context`,
        );
        return;
      }

      logger.info(
        'Processing member move (immediate OSM sync + cache update)',
        {
          memberId: moveData.member.scoutid,
          memberName,
          fromGroup: moveData.fromGroupName,
          toGroup: moveData.toGroupName,
          memberSectionId,
          memberSectionType,
        },
        LOG_CATEGORIES.APP,
      );

      // 1. Optimistic UI update
      updateGroupsOptimistically(moveData);

      // 2. Track pending move for API sync
      const moveId = `${moveData.member.scoutid}_${Date.now()}`;
      setPendingMoves((prev) => {
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
        const result = await assignMemberToCampGroup(
          moveData,
          memberFlexiRecordContext,
          getToken(),
        );

        if (result && result.success === true) {
          // Always clear drag states on success, even if component is unmounting
          // This prevents stuck drag states when component remounts
          setDraggingMemberId(null);
          setIsDragInProgress(false);
          
          // CRITICAL: Delay removing from pending moves to survive component reloads
          // The preservation logic needs this to maintain visual state during reloads
          setTimeout(() => {
            setPendingMoves((prev) => {
              const newMap = new Map(prev);
              newMap.delete(moveId);
              return newMap;
            });
          }, 500); // Wait 500ms for component reloads to settle
          
          
          // Only do heavy cache updates if component is still mounted
          if (!isMountedRef.current) {
            // Component is unmounting, show notification immediately before we lose context
            showToast('success', `${memberName} moved to ${moveData.toGroupName}`);
            return;
          }
          
          // 4. Update local FlexiRecord cache after successful OSM sync
          const cacheKey = `viking_flexi_data_${memberFlexiRecordContext.flexirecordid}_${memberFlexiRecordContext.sectionid}_${memberFlexiRecordContext.termid}_offline`;
          let cachedData = {};
          try {
            cachedData = JSON.parse(localStorage.getItem(cacheKey) || '{}');
          } catch (error) {
            logger.warn(
              'Failed to parse cached FlexiRecord data, using empty object',
              {
                cacheKey,
                error: error.message,
              },
              LOG_CATEGORIES.ERROR,
            );
            cachedData = {};
          }

          if (cachedData.items) {
            const memberItemIndex = cachedData.items.findIndex(
              (item) => item.scoutid === moveData.member.scoutid,
            );
            if (memberItemIndex !== -1) {
              // Create new member item with updated values (immutable update)
              const updatedMemberItem = {
                ...cachedData.items[memberItemIndex],
                [memberFlexiRecordContext.columnid]: moveData.toGroupNumber,
                CampGroup: moveData.toGroupNumber,
              };

              // Create new items array with updated member item
              const updatedItems = [...cachedData.items];
              updatedItems[memberItemIndex] = updatedMemberItem;

              // Create new cache data object
              const updatedCacheData = {
                ...cachedData,
                items: updatedItems,
              };

              localStorage.setItem(cacheKey, JSON.stringify(updatedCacheData));

              logger.debug(
                'Updated local FlexiRecord cache after OSM sync',
                {
                  memberId: moveData.member.scoutid,
                  newGroup: moveData.toGroupNumber,
                  cacheKey,
                },
                LOG_CATEGORIES.APP,
              );
            }
          }

          // Cache updates completed successfully

          logger.info(
            'Member move completed successfully - OSM updated and cache refreshed',
            {
              memberId: moveData.member.scoutid,
              memberName,
              fromGroup: moveData.fromGroupName,
              toGroup: moveData.toGroupName,
              duration: result.duration,
            },
            LOG_CATEGORIES.APP,
          );

          // Show success notification immediately
          showToast('success', `${memberName} moved to ${moveData.toGroupName}`);
        } else {
          throw new Error(result?.error || result?.message || 'API call failed');
        }
      } catch (error) {
        // Error syncing to OSM - revert UI change and show error
        logger.error(
          'Failed to sync member move to OSM',
          {
            memberId: moveData.member.scoutid,
            memberName,
            error: error.message,
          },
          LOG_CATEGORIES.ERROR,
        );

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          // Clear ALL drag states and pending moves on error
          setIsDragInProgress(false);
          setDraggingMemberId(null);
          
          // Remove from pending moves immediately on error (no delay needed for failures)
          setPendingMoves((prev) => {
            const newMap = new Map(prev);
            newMap.delete(moveId);
            return newMap;
          });

          revertOptimisticUpdate(moveData);
          
          // Show error notification immediately
          showToast('error', `Failed to move ${memberName}: ${error.message}`);
        }
      }
    },
    [
      flexiRecordContext,
      organizedGroups.groups,
      organizedGroups.campGroupData,
      organizedGroups.summary?.vikingEventDataAvailable,
      updateGroupsOptimistically,
      revertOptimisticUpdate,
      showToast,
      sectionsCache,
    ],
  );

  // Handle group rename operations
  const handleGroupRename = useCallback(async (oldGroupName, newGroupName, membersBySection) => {
    if (!flexiRecordContext) {
      showToast('error', 'Cannot rename groups: FlexiRecord data not available');
      return;
    }

    setGroupRenameLoading(true);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      logger.info('Starting group rename operation', {
        oldGroupName,
        newGroupName,
        sectionsCount: Object.keys(membersBySection).length,
        totalMembers: Object.values(membersBySection).reduce((sum, members) => sum + members.length, 0),
      }, LOG_CATEGORIES.APP);

      let successfulUpdates = 0;
      let failedUpdates = 0;
      const errors = [];

      // Process each section separately
      for (const [sectionId, members] of Object.entries(membersBySection)) {
        if (members.length === 0) continue;

        try {
          const scoutIds = Array.from(new Set(members.map(member => String(member.scoutid))));
          if (!/^f_\d+$/.test(String(flexiRecordContext.columnid))) {
            throw new Error(`Invalid FlexiRecord field ID '${flexiRecordContext.columnid}'`);
          }
          
          logger.debug('Updating group name for section', {
            sectionId,
            memberCount: scoutIds.length,
            oldGroupName,
            newGroupName,
            columnId: flexiRecordContext.columnid,
            flexirecordid: flexiRecordContext.flexirecordid,
          }, LOG_CATEGORIES.APP);

          // For unassigned members, we're setting their first group name
          // For existing groups, we're renaming them
          const result = await multiUpdateFlexiRecord(
            sectionId,
            scoutIds,
            newGroupName,
            flexiRecordContext.columnid,
            flexiRecordContext.flexirecordid,
            token,
          );

          // Check for success - handle multiple response formats:
          // Expected: { status: true, data: { success: true, updated_count: X } }
          // Actual: { error: false, _rateLimitInfo: {...} }
          const isSuccess = result?.status === true || 
                           result?.data?.success === true || 
                           (result?.error === false && result?._rateLimitInfo);
          
          if (isSuccess) {
            successfulUpdates++;
            logger.info('Group rename successful for section', {
              sectionId,
              updatedCount: result.data?.updated_count || 'unknown',
              newGroupName,
              apiResponse: result,
            }, LOG_CATEGORIES.APP);
          } else {
            throw new Error(result?.data?.message || result?.message || 'API call returned unsuccessful status');
          }

        } catch (sectionError) {
          failedUpdates++;
          const errorMsg = `Section ${sectionId}: ${sectionError.message}`;
          errors.push(errorMsg);
          
          logger.error('Group rename failed for section', {
            sectionId,
            oldGroupName,
            newGroupName,
            error: sectionError.message,
            memberCount: members.length,
          }, LOG_CATEGORIES.ERROR);
        }
      }

      // Show results
      if (successfulUpdates > 0 && failedUpdates === 0) {
        showToast('success', `Successfully renamed "${oldGroupName}" to "${newGroupName}"`);
        
        // Optimistically update the UI immediately
        setOrganizedGroups(prevGroups => {
          const newGroups = { ...prevGroups };
          const groups = { ...newGroups.groups };
          
          // Rename the group key and update the group object
          if (groups[oldGroupName]) {
            const updatedGroup = {
              ...groups[oldGroupName],
              name: `Group ${newGroupName}`,
              number: newGroupName,
            };
            
            groups[`Group ${newGroupName}`] = updatedGroup;
            delete groups[oldGroupName];

            // If we renamed "Group Unassigned", create a new empty unassigned group
            if (oldGroupName === 'Group Unassigned') {
              groups['Group Unassigned'] = {
                name: 'Group Unassigned',
                number: 'Unassigned',
                leaders: [],
                youngPeople: [],
                totalMembers: 0,
              };
            }
          }
          
          newGroups.groups = groups;
          return newGroups;
        });

        // Force refresh of FlexiRecord data in the background
        // This will ensure subsequent operations have the latest data
        setTimeout(() => {
          if (events.length > 0) {
            getVikingEventDataForEvents(events, token, true).catch(err => {
              logger.warn('Background FlexiRecord refresh failed', {
                error: err.message,
              }, LOG_CATEGORIES.APP);
            });
          }
        }, 1000);

      } else if (successfulUpdates > 0 && failedUpdates > 0) {
        showToast('error', `Partial success: ${successfulUpdates} sections updated, ${failedUpdates} failed. ${errors.join(', ')}`);
      } else {
        showToast('error', `Failed to rename group: ${errors.join(', ')}`);
      }

    } catch (error) {
      logger.error('Group rename operation failed', {
        oldGroupName,
        newGroupName,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      
      showToast('error', `Failed to rename group: ${error.message}`);
    } finally {
      setGroupRenameLoading(false);
    }
  }, [
    flexiRecordContext,
    showToast,
    events,
    setOrganizedGroups,
  ]);

  // Handle group delete operations (move members to unassigned)
  const handleGroupDelete = useCallback(async (groupName, membersBySection) => {
    if (!flexiRecordContext) {
      showToast('error', 'Cannot delete groups: FlexiRecord data not available');
      return;
    }

    setGroupRenameLoading(true);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      logger.info('Starting group delete operation', {
        groupName,
        sectionsCount: Object.keys(membersBySection).length,
        totalMembers: Object.values(membersBySection).reduce((sum, members) => sum + members.length, 0),
        membersBySection: Object.fromEntries(
          Object.entries(membersBySection).map(([sectionId, members]) => [
            sectionId, 
            members.map(m => ({ scoutid: m.scoutid, name: m.name || `${m.firstname} ${m.lastname}` })),
          ]),
        ),
      }, LOG_CATEGORIES.APP);

      let successfulUpdates = 0;
      let failedUpdates = 0;
      const errors = [];

      // Process each section separately - set camp group to empty/null
      for (const [sectionId, members] of Object.entries(membersBySection)) {
        if (members.length === 0) continue;

        try {
          logger.debug('Deleting group for section (setting to unassigned)', {
            sectionId,
            memberCount: members.length,
            groupName,
            columnId: flexiRecordContext.columnid,
            flexirecordid: flexiRecordContext.flexirecordid,
          }, LOG_CATEGORIES.APP);

          // Use individual updates since multiUpdate doesn't accept null/empty values
          // Process each member individually to set their camp group to unassigned
          let sectionSuccessCount = 0;
          let sectionFailureCount = 0;

          for (const member of members) {
            try {
              // Create move data for assigning to "Unassigned" group
              const moveData = {
                member: member,
                fromGroupNumber: groupName.replace('Group ', ''),
                fromGroupName: groupName,
                toGroupNumber: 'Unassigned',
                toGroupName: 'Group Unassigned',
              };

              // Get the correct section type for THIS specific member (same as drag-and-drop)
              const memberSectionId = member.sectionid;
              const memberSectionType = findMemberSectionType(memberSectionId, sectionsCache);

              if (!memberSectionType) {
                throw new Error(`Cannot find section type for member ${member.scoutid} in section ${memberSectionId}`);
              }

              // Extract FlexiRecord context for this section (same approach as drag-and-drop)
              const sectionContext = {
                ...flexiRecordContext,
                section: memberSectionType, // Use the member's section type, not generic name
                sectionid: memberSectionId, // Use the member's section ID
              };

              // Use the camp group allocation service for individual updates
              const result = await assignMemberToCampGroup(moveData, sectionContext, token);

              if (result.success) {
                sectionSuccessCount++;
                logger.debug('Successfully moved member to unassigned', {
                  memberId: member.scoutid,
                  memberName: member.name || `${member.firstname} ${member.lastname}`,
                  groupName,
                }, LOG_CATEGORIES.APP);
              } else {
                sectionFailureCount++;
                logger.warn('Failed to move member to unassigned', {
                  memberId: member.scoutid,
                  memberName: member.name || `${member.firstname} ${member.lastname}`,
                  error: result.error,
                  groupName,
                }, LOG_CATEGORIES.APP);
              }

              // Small delay between API calls for rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));

            } catch (memberError) {
              sectionFailureCount++;
              logger.error('Error moving individual member to unassigned', {
                memberId: member.scoutid,
                memberName: member.name || `${member.firstname} ${member.lastname}`,
                error: memberError.message,
                groupName,
              }, LOG_CATEGORIES.ERROR);
            }
          }

          // Check section-level success
          if (sectionSuccessCount === members.length) {
            successfulUpdates++;
            logger.info('Group delete successful for section', {
              sectionId,
              updatedCount: sectionSuccessCount,
              groupName,
              method: 'individual_updates',
            }, LOG_CATEGORIES.APP);
          } else if (sectionSuccessCount > 0) {
            // Partial success - treat as failure for simplicity
            throw new Error(`Partial success: ${sectionSuccessCount}/${members.length} members moved to unassigned`);
          } else {
            throw new Error(`No members successfully moved to unassigned (${sectionFailureCount} failures)`);
          }

        } catch (sectionError) {
          failedUpdates++;
          const errorMsg = `Section ${sectionId}: ${sectionError.message}`;
          errors.push(errorMsg);
          
          logger.error('Group delete failed for section', {
            sectionId,
            groupName,
            error: sectionError.message,
            memberCount: members.length,
          }, LOG_CATEGORIES.ERROR);
        }
      }

      // Show results
      if (successfulUpdates > 0 && failedUpdates === 0) {
        // Optimistically update the UI immediately
        setOrganizedGroups(prevGroups => {
          const newGroups = { ...prevGroups };
          const groups = { ...newGroups.groups };
          
          // Move members from deleted group to Unassigned
          const deletedGroup = groups[groupName];
          if (deletedGroup) {
            // Ensure Unassigned group exists
            if (!groups['Group Unassigned']) {
              groups['Group Unassigned'] = {
                name: 'Group Unassigned',
                number: 'Unassigned',
                leaders: [],
                youngPeople: [],
                totalMembers: 0,
              };
            }

            // Move all members to Unassigned (avoid duplicates)
            const allMembers = [...(deletedGroup.leaders || []), ...(deletedGroup.youngPeople || [])];
            const existingUnassignedIds = new Set(
              (groups['Group Unassigned'].youngPeople || []).map(m => m.scoutid),
            );
            
            // Only add members that aren't already in Unassigned
            const newMembers = allMembers.filter(member => !existingUnassignedIds.has(member.scoutid));
            groups['Group Unassigned'].youngPeople.push(...newMembers);
            groups['Group Unassigned'].totalMembers += newMembers.length;

            // Remove the deleted group
            delete groups[groupName];
          }
          
          newGroups.groups = groups;
          newGroups.summary = recalculateSummary(groups);
          return newGroups;
        });

        // Show success message immediately
        showToast('success', `Successfully deleted "${groupName}" - members moved to Unassigned`);

        // Force refresh of FlexiRecord data in the background
        setTimeout(() => {
          if (events.length > 0) {
            getVikingEventDataForEvents(events, token, true).catch(err => {
              logger.warn('Background FlexiRecord refresh failed after delete', {
                error: err.message,
              }, LOG_CATEGORIES.APP);
            });
          }
        }, 1000);

      } else if (successfulUpdates > 0 && failedUpdates > 0) {
        showToast('error', `Partial success: ${successfulUpdates} sections updated, ${failedUpdates} failed. ${errors.join(', ')}`);
      } else {
        showToast('error', `Failed to delete group: ${errors.join(', ')}`);
      }

    } catch (error) {
      logger.error('Group delete operation failed', {
        groupName,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      
      showToast('error', `Failed to delete group: ${error.message}`);
    } finally {
      setGroupRenameLoading(false);
    }
  }, [
    flexiRecordContext,
    showToast,
    events,
    setOrganizedGroups,
    recalculateSummary,
    sectionsCache,
  ]);

  // Sort groups by group number (no search or sort filtering)
  const filteredAndSortedGroups = useMemo(() => {
    const groupsArray = Object.values(organizedGroups.groups || {});

    // Sort groups by group number (Unassigned goes last)
    groupsArray.sort((a, b) => {
      // Unassigned goes last, otherwise sort by number
      if (a.name === 'Group Unassigned') return 1;
      if (b.name === 'Group Unassigned') return -1;

      const aNum = parseInt(a.number) || 0;
      const bNum = parseInt(b.number) || 0;
      return aNum - bNum;
    });

    return groupsArray;
  }, [organizedGroups.groups]);

  if (loading) {
    return <LoadingScreen message="Loading camp groups..." />;
  }

  if (error) {
    return (
      <AlertAdapter variant="error" className="m-4">
        <AlertAdapter.Title>Error Loading Camp Groups</AlertAdapter.Title>
        <AlertAdapter.Description>{error}</AlertAdapter.Description>
        <AlertAdapter.Actions>
          <Button
            variant="scout-blue"
            onClick={() => window.location.reload()}
            type="button"
          >
            Retry
          </Button>
        </AlertAdapter.Actions>
      </AlertAdapter>
    );
  }

  const { summary } = organizedGroups;

  return (
    <div className="camp-groups-view">
      {/* Header with summary stats */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-4 mb-4 items-center justify-between">
          <div className="flex flex-wrap gap-4">
            <Badge variant="scout-blue" size="md">
              {summary.totalGroups || 0} Groups
            </Badge>
            <Badge variant="scout-green" size="md">
              {summary.totalMembers || 0} Members
            </Badge>
          </div>
          
          {/* Edit Group Names Button */}
          <Button
            variant="scout-green"
            size="sm"
            onClick={() => setShowGroupNamesModal(true)}
            disabled={
              !summary.vikingEventDataAvailable || 
              !flexiRecordContext || 
              Object.keys(organizedGroups.groups || {}).length === 0 ||
              groupRenameLoading
            }
            type="button"
          >
            {groupRenameLoading ? 'Saving...' : 'Edit Names'}
          </Button>
        </div>

        {!summary.vikingEventDataAvailable && (
          <AlertAdapter variant="warning" className="mb-4">
            <AlertAdapter.Title>No Viking Event Management Data</AlertAdapter.Title>
            <AlertAdapter.Description>
              No &quot;Viking Event Mgmt&quot; flexirecord found for the
              sections involved in these events. All members will be shown in
              the &quot;Unassigned&quot; group.
              {!flexiRecordContext && (
                <>
                  <br />
                  <strong>Note:</strong> Drag and drop functionality is not
                  available without FlexiRecord data.
                </>
              )}
            </AlertAdapter.Description>
          </AlertAdapter>
        )}
      </div>


      {/* Groups grid */}
      {filteredAndSortedGroups.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Groups Found
          </h3>
          <p className="text-gray-600">
            No camp groups available for these events.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            isMobile
              ? 'gap-2'
              : ''
          }`}
          style={{
            gridTemplateColumns: (() => {
              const groupCount = filteredAndSortedGroups.length;
              if (groupCount === 0) return '1fr';
              
              // Calculate optimal minimum width based on group count for even distribution
              let minWidth;
              if (groupCount <= 2) minWidth = isMobile ? '280px' : '400px';
              else if (groupCount <= 4) minWidth = isMobile ? '250px' : '350px'; // 2 cols
              else if (groupCount <= 6) minWidth = isMobile ? '200px' : '280px'; // 3 cols  
              else if (groupCount <= 8) minWidth = isMobile ? '180px' : '240px'; // 4 cols
              else minWidth = isMobile ? '160px' : '200px'; // 5+ cols
              
              return `repeat(auto-fit, minmax(${minWidth}, 1fr))`;
            })(),
          }}
        >
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
              dragDisabled={
                !summary.vikingEventDataAvailable || !flexiRecordContext || pendingMoves.size > 0
              }
              onOfflineError={async (memberName) => {
                try {
                  const isOnline = await checkNetworkStatus();
                  const errorMessage = !isOnline 
                    ? `Cannot move ${memberName}: You are currently offline. Member moves require an internet connection to sync with OSM.`
                    : `Cannot move ${memberName}: Authentication expired. Please sign in to OSM to move members.`;
                  showToast('error', errorMessage);
                } catch (networkError) {
                  logger.error('Network status check failed in onOfflineError', { 
                    error: networkError?.message,
                    memberName, 
                  }, LOG_CATEGORIES.COMPONENT);
                  showToast('error', `Cannot move ${memberName}: Unable to verify network status.`);
                }
              }}
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

      {/* Group Names Edit Modal */}
      <GroupNamesEditModal
        isOpen={showGroupNamesModal}
        onClose={() => setShowGroupNamesModal(false)}
        groups={organizedGroups.groups}
        onRename={handleGroupRename}
        onDelete={handleGroupDelete}
        loading={groupRenameLoading}
      />
    </div>
  );
}

export default CampGroupsView;
