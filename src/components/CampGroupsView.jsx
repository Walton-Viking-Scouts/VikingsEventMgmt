import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { Alert, Button, Input, Badge } from './ui';
import LoadingScreen from './LoadingScreen.jsx';
import CampGroupCard from './CampGroupCard.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import { getVikingEventDataForEvents } from '../services/flexiRecordService.js';
// import { organizeMembersByCampGroups } from '../utils/flexiRecordTransforms.js';
import { fetchMostRecentTermId } from '../services/api.js';
import { getToken } from '../services/auth.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import { isMobileLayout } from '../utils/platform.js';
import {
  assignMemberToCampGroup,
  extractFlexiRecordContext,
  validateMemberMove,
} from '../services/campGroupAllocationService.js';
import { checkNetworkStatus } from '../utils/networkUtils.js';
import { findMemberSectionType } from '../utils/sectionHelpers.js';

/**
 * Simple organization function that works with getSummaryStats() data structure
 * getSummaryStats() returns: { name, scoutid, person_type, vikingEventData: { CampGroup } }
 */
function organizeAttendeesSimple(attendees) {
  const groups = {};
  let totalMembers = 0;
  
  attendees.forEach((member) => {
    // Skip if no member data
    if (!member) return;
    
    // Filter out Leaders and Young Leaders
    if (member.person_type === 'Leaders' || member.person_type === 'Young Leaders') {
      return;
    }
    
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
      vikingEventDataAvailable: true,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [sortBy, setSortBy] = useState('groupNumber'); // 'groupNumber', 'memberCount', 'name'
  const [termId, setTermId] = useState(null);

  // Drag and drop state
  const [isDragInProgress, setIsDragInProgress] = useState(false);
  const [draggingMemberId, setDraggingMemberId] = useState(null);

  const [pendingMoves, setPendingMoves] = useState(new Map()); // Track optimistic updates
  
  const [toastMessage, setToastMessage] = useState(null); // Success/error messages

  // Ref to track toast timeout for cleanup
  const toastTimeoutRef = useRef(null);

  // Ref to track component mount status for async operations
  const isMountedRef = useRef(true);

  const isMobile = isMobileLayout();

  // Cache parsed sections data to avoid JSON.parse on every drag operation
  const sectionsCache = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem('viking_sections_offline') || '[]',
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

        // Store the FlexiRecord context for drag operations
        organized.campGroupData = primaryCampGroupData;

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
  }, [events, attendees, members]); // Removed onError from dependencies to avoid unnecessary re-executions

  // Cleanup toast timeout and mark component as unmounted
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
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
        sections: [member.sectionname || 'Unknown'],
      };
    } else {
      // Fallback to the simplified member data if no cached member found
      enrichedMember = member;
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

  // Show toast message temporarily
  const showToast = useCallback((type, message) => {
    // Log error toast messages for debugging
    if (type === 'error') {
      logger.error('Toast Error Message', {
        message,
        type,
        timestamp: new Date().toISOString(),
      }, LOG_CATEGORIES.COMPONENT);
    }
    
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

        // Add member to target group
        const toGroup = groups[moveData.toGroupName];
        if (toGroup) {
          groups[moveData.toGroupName] = {
            ...toGroup,
            youngPeople: [...toGroup.youngPeople, moveData.member],
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

        // Add member back to source group
        const fromGroup = groups[moveData.fromGroupName];
        if (fromGroup) {
          groups[moveData.fromGroupName] = {
            ...fromGroup,
            youngPeople: [...fromGroup.youngPeople, moveData.member],
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

  // Handle member move between groups
  const handleMemberMove = useCallback(
    async (moveData) => {
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
          
          // Remove from pending moves (CRITICAL: This re-enables drag functionality)
          setPendingMoves((prev) => {
            const newMap = new Map(prev);
            newMap.delete(moveId);
            return newMap;
          });
          
          // Show success toast
          showToast('success', `${memberName} moved to ${moveData.toGroupName}`);
          
          // Only do heavy cache updates if component is still mounted
          if (!isMountedRef.current) {
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
          
          // Remove from pending moves (CRITICAL: This re-enables drag functionality)
          setPendingMoves((prev) => {
            const newMap = new Map(prev);
            newMap.delete(moveId);
            return newMap;
          });

          revertOptimisticUpdate(moveData);
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

  // Filter and sort groups based on search and sort criteria
  const filteredAndSortedGroups = useMemo(() => {
    const groupsArray = Object.values(organizedGroups.groups || {});

    // Filter by search term (group name or member names)
    const filtered = groupsArray.filter((group) => {
      if (!searchTerm) return true;

      const searchLower = searchTerm.toLowerCase();

      // Search in group name
      if (group.name.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in member names
      const allMembers = [
        ...(Array.isArray(group.leaders) ? group.leaders : []),
        ...(Array.isArray(group.youngPeople) ? group.youngPeople : []),
      ];
      return allMembers.some((member) => {
        const fullName =
          `${member.firstname || ''} ${member.lastname || ''}`.toLowerCase();
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
            {searchTerm
              ? 'Try adjusting your search terms.'
              : 'No camp groups available for these events.'}
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            isMobile
              ? 'grid-cols-1'
              : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
          }`}
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
                  console.error('Network status check failed in onOfflineError:', networkError);
                  showToast('error', `Cannot move ${memberName}: Unable to verify network status.`);
                }
              }}
              className="h-fit"
            />
          ))}
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`
          fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300
          ${toastMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
          ${toastMessage.type === 'error' ? 'border-l-4 border-red-700' : 'border-l-4 border-green-700'}
        `}
        >
          <div className="flex items-center">
            {toastMessage.type === 'success' ? (
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
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
            <svg
              className="animate-spin w-4 h-4 mr-2"
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
              />

              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm font-medium">
              Syncing {pendingMoves.size} member{' '}
              {pendingMoves.size === 1 ? 'move' : 'moves'} to OSM...
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
