import React, { useState, useMemo } from 'react';
import { Badge } from '../../../shared/components/ui';
import { Alert } from '../../../shared/components/ui';
import CampGroupCard from './CampGroupCard.jsx';
import { MemberDetailModal } from '../../../shared/components/ui';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { isMobileLayout } from '../../../shared/utils/platform.js';
import { assignMemberToCampGroup, extractFlexiRecordContext } from '../services/campGroupAllocationService.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { useNotificationUtils } from '../../../shared/contexts/notifications';
import databaseService from '../../../shared/services/storage/database.js';

/**
 * Simple function to organize summaryStats by camp groups
 * Similar to RegisterTab's approach - just group the pre-processed data
 */
function organizeByCampGroups(summaryStats, pendingMoves = new Map(), recentlyCompletedMoves = new Map()) {
  if (!summaryStats || summaryStats.length === 0) {
    return {
      groups: {},
      summary: {
        totalGroups: 0,
        totalMembers: 0,
        hasUnassigned: false,
        vikingEventDataAvailable: false,
      },
    };
  }

  const groups = {};
  let totalMembers = 0;
  
  // Filter to only young people (exclude leaders like RegisterTab does)
  const youngPeople = summaryStats.filter(member => 
    member.person_type !== 'Leaders' && member.person_type !== 'Young Leaders',
  );

  // Apply optimistic updates to the data
  const allMoves = new Map([...pendingMoves, ...recentlyCompletedMoves]);
  
  youngPeople.forEach((member) => {
    let campGroup = member.vikingEventData?.CampGroup;
    
    // Check if this member has a pending or completed move
    for (const [, moveData] of allMoves.entries()) {
      if (moveData && moveData.member && moveData.member.scoutid === member.scoutid) {
        // Apply the optimistic update
        campGroup = moveData.toGroupNumber === 'Unassigned' ? '' : moveData.toGroupNumber;
        break;
      }
    }
    
    const groupName = campGroup ? `Group ${campGroup}` : 'Group Unassigned';
    
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        number: campGroup || 'Unassigned',
        youngPeople: [],
        totalMembers: 0,
      };
    }
    
    // Create updated member with optimistic camp group data
    const memberWithOptimisticUpdate = {
      ...member,
      vikingEventData: {
        ...member.vikingEventData,
        CampGroup: campGroup,
      },
    };
    
    groups[groupName].youngPeople.push(memberWithOptimisticUpdate);
    groups[groupName].totalMembers++;
    totalMembers++;
  });
  
  // Sort groups by number (Unassigned goes last)
  const sortedGroups = {};
  Object.keys(groups)
    .sort((a, b) => {
      if (a === 'Group Unassigned') return 1;
      if (b === 'Group Unassigned') return -1;
      const aNum = parseInt(a.replace('Group ', '')) || 0;
      const bNum = parseInt(b.replace('Group ', '')) || 0;
      return aNum - bNum;
    })
    .forEach(groupName => {
      const group = groups[groupName];
      // Sort members within each group by name
      group.youngPeople.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      sortedGroups[groupName] = group;
    });

  const hasVikingEventData = summaryStats.some(member => 
    member.vikingEventData?.CampGroup !== undefined,
  );

  return {
    groups: sortedGroups,
    summary: {
      totalGroups: Object.keys(sortedGroups).length,
      totalMembers,
      hasUnassigned: !!sortedGroups['Group Unassigned'],
      vikingEventDataAvailable: hasVikingEventData,
    },
  };
}


/**
 * CampGroupsView - Simple component for displaying camp groups
 * Uses pre-processed summaryStats like RegisterTab - no complex state management
 *
 * @param {Object} props - Component props
 * @param {Array} props.summaryStats - Pre-processed member data with Viking Event data
 * @param {Array} props.events - Array of event data (for context)  
 * @param {Array} props.members - Array of all member data (for member details)
 * @param {Function} props.onMemberClick - Member click handler
 */
function CampGroupsView({
  summaryStats = [],
  events = [],
  members: _members = [],
  vikingEventData,
  onMemberClick,
}) {
  // Simple state for modal
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  
  // State for optimistic updates - track member camp group changes
  const [pendingMoves, setPendingMoves] = useState(new Map());
  const [recentlyCompletedMoves, setRecentlyCompletedMoves] = useState(new Map());

  const isMobile = isMobileLayout();
  const { toast } = useNotificationUtils();

  // Simple data organization like RegisterTab - just group the pre-processed summaryStats
  // Include optimistic updates for immediate UI feedback
  const { groups, summary } = useMemo(() => 
    organizeByCampGroups(summaryStats, pendingMoves, recentlyCompletedMoves), 
  [summaryStats, pendingMoves, recentlyCompletedMoves],
  );

  // Handle member click - simple version like RegisterTab
  const handleMemberClick = (member) => {
    if (onMemberClick) {
      onMemberClick(member);
    } else {
      // Fallback - show basic member modal
      setSelectedMember(member);
      setShowMemberModal(true);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  // Simple drag handlers - placeholder implementation for basic functionality
  const handleDragStart = () => {
    // Basic drag start - could add more functionality later
  };

  const handleDragEnd = () => {
    // Basic drag end - could add more functionality later
  };

  const handleMemberMove = async (moveData) => {
    const moveId = `${moveData.member.scoutid}_${Date.now()}`;
    try {
      const token = getToken();
      if (!token) {
        toast.error('Please sign in to OSM to move members between camp groups.');
        return;
      }

      // Add optimistic update immediately for instant UI feedback
      setPendingMoves(prev => new Map(prev).set(moveId, moveData));

      // Extract FlexiRecord context from the member's Viking Event data
      const member = moveData.member;
      const sectionId = member.sectionid;
      const event = events.find(e => e.sectionid === sectionId);
      const termId = event?.termid || 'current';
      
      // Try to get the real section type from section cache (e.g., 'beavers', 'cubs', 'scouts')
      // The OSM API expects section type, not section name
      const sectionsData = await databaseService.getSections();
      const sectionData = sectionsData.find(s => String(s.sectionid) === String(sectionId));
      const realSectionType = sectionData?.sectiontype || 'Unknown Section Type';
      
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
        logger.debug('Section type resolution', {
          eventSectionName: event?.sectionname,
          finalSectionType: realSectionType,
          sectionId,
          totalSections: sectionsData.length,
        }, LOG_CATEGORIES.COMPONENT);
        
        logger.debug('Member move operation', {
          memberId: member.scoutid,
          sectionId,
          termId,
          realSectionType,
          fromGroup: moveData.fromGroupNumber,
          toGroup: moveData.toGroupNumber,
        }, LOG_CATEGORIES.COMPONENT);
        
        logger.debug('Viking event data map state', {
          hasMap: !!vikingEventData,
          mapSize: vikingEventData?.size || 0,
          lookupKey: String(sectionId),
          hasDataForSection: vikingEventData?.has(String(sectionId)) || false,
        }, LOG_CATEGORIES.COMPONENT);
      }

      // Get Viking Event data structure for this section from the Map
      logger.info('DEBUG: vikingEventData Map inspection', {
        hasVikingEventData: !!vikingEventData,
        mapSize: vikingEventData?.size || 0,
        mapKeys: vikingEventData ? Array.from(vikingEventData.keys()) : [],
        requestedSectionId: sectionId,
        requestedSectionIdString: String(sectionId),
      }, LOG_CATEGORIES.APP);
      
      let sectionVikingEventData = vikingEventData?.get(String(sectionId));
      
      // Fallback: if Map is empty, try to load directly from localStorage
      if (!sectionVikingEventData && (!vikingEventData || vikingEventData.size === 0)) {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
          logger.debug('Loading Viking Event data from localStorage fallback', { sectionId }, LOG_CATEGORIES.COMPONENT);
        }
        try {
          // Look for Viking Event structure data in localStorage
          const structureKeys = Object.keys(localStorage).filter(key => 
            key.includes('viking_flexi_structure_') && key.includes('offline'),
          );
          if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
            logger.debug('Found Viking Event structure keys', { count: structureKeys.length }, LOG_CATEGORIES.COMPONENT);
          }
          
          // Look for Viking Event data for this specific section
          const dataKeys = Object.keys(localStorage).filter(key => 
            key.includes('viking_flexi_data_') && key.includes(`_${sectionId}_`) && key.includes('offline'),
          );
          if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
            logger.debug('Found Viking Event data keys for section', { sectionId, count: dataKeys.length }, LOG_CATEGORIES.COMPONENT);
          }
          
          if (structureKeys.length > 0 && dataKeys.length > 0) {
            // Try to find a structure that has a CampGroup field
            let foundStructure = null;
            for (const structureKey of structureKeys) {
              try {
                const structureData = JSON.parse(localStorage.getItem(structureKey));
                
                // Check if this structure has a CampGroup field in its fieldMapping
                const fieldMapping = structureData?.fieldMapping || {};
                
                // Look for CampGroup field (try different variations)
                const hasCampGroupField = Object.values(fieldMapping).some(field => {
                  const name = field.name?.toLowerCase();
                  return name === 'campgroup' || name === 'camp group' || name === 'camp_group' || 
                         name?.includes('camp') || name?.includes('group');
                });
                
                if (hasCampGroupField) {
                  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
                    logger.debug('Found structure with CampGroup field', { structureKey }, LOG_CATEGORIES.COMPONENT);
                  }
                  foundStructure = structureData;
                  break;
                }
              } catch (error) {
                console.warn('🐛 Failed to parse structure:', structureKey, error);
              }
            }
            
            if (foundStructure) {
              if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
                logger.debug('Using structure with CampGroup field', { hasStructure: !!foundStructure }, LOG_CATEGORIES.COMPONENT);
              }
              sectionVikingEventData = { structure: foundStructure };
            } else {
              if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
                logger.debug('No structure found with CampGroup field, creating fallback structure', {}, LOG_CATEGORIES.COMPONENT);
              }
              
              // Check if any member in summaryStats has CampGroup data
              const memberWithCampGroup = summaryStats.find(m => m.vikingEventData?.CampGroup !== undefined);
              if (memberWithCampGroup && dataKeys.length > 0) {
                if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
                  logger.debug('Found member with CampGroup data', { 
                    memberId: memberWithCampGroup.scoutid,
                    hasCampGroup: !!memberWithCampGroup.vikingEventData?.CampGroup, 
                  }, LOG_CATEGORIES.COMPONENT);
                }
                
                // Extract the real flexirecordid from the data key
                // Format: viking_flexi_data_FLEXIID_SECTIONID_TERMID_offline
                const dataKey = dataKeys[0];
                const keyParts = dataKey.replace('viking_flexi_data_', '').replace('_offline', '').split('_');
                const realFlexiRecordId = keyParts[0];
                const realTermId = keyParts[2];
                
                if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
                  logger.debug('Extracted flexi record metadata', { realFlexiRecordId, realTermId }, LOG_CATEGORIES.COMPONENT);
                }
                
                // Create a structure with the real flexi record ID in the correct format
                sectionVikingEventData = {
                  _structure: {
                    flexirecordid: realFlexiRecordId,
                    config: JSON.stringify([{
                      id: 'f_1',
                      name: 'CampGroup',
                      width: '150',
                    }]),
                    fieldMapping: {
                      f_1: {
                        name: 'CampGroup',
                        columnId: 'f_1',
                      },
                    },
                  },
                };
                if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
                  logger.debug('Created fallback structure', { realFlexiRecordId }, LOG_CATEGORIES.COMPONENT);
                }
              }
            }
          }
        } catch (error) {
          console.error('🐛 Fallback localStorage load failed:', error);
        }
      }
      
      logger.info('DEBUG: sectionVikingEventData for section', {
        sectionId,
        hasSectionData: !!sectionVikingEventData,
        sectionDataKeys: sectionVikingEventData ? Object.keys(sectionVikingEventData) : null,
      }, LOG_CATEGORIES.APP);
      
      const flexiRecordContext = extractFlexiRecordContext(sectionVikingEventData, sectionId, termId, realSectionType);

      if (!flexiRecordContext) {
        toast.error('No Viking Event Management flexi record found for this section.');
        return;
      }

      const memberName = member.name || `${member.firstname} ${member.lastname}`;
      
      // Show loading notification
      toast.info(`Moving ${memberName} to ${moveData.toGroupName}...`);

      // Call the API service
      const result = await assignMemberToCampGroup(moveData, flexiRecordContext, token);

      if (result.success) {
        toast.success(`${memberName} successfully moved to ${moveData.toGroupName}`);
        
        // Move from pending to recently completed
        setPendingMoves(prev => {
          const newMap = new Map(prev);
          newMap.delete(moveId);
          return newMap;
        });
        
        setRecentlyCompletedMoves(prev => new Map(prev).set(moveId, moveData));
        
        // Clear from recently completed after a delay to allow data refresh
        setTimeout(() => {
          setRecentlyCompletedMoves(prev => {
            const newMap = new Map(prev);
            newMap.delete(moveId);
            return newMap;
          });
        }, 5000); // Keep for 5 seconds to allow data refresh
        
      } else {
        throw new Error(result.error || 'Move failed');
      }

    } catch (error) {
      logger.error('Failed to move member between camp groups', {
        error: error.message,
        moveData,
      }, LOG_CATEGORIES.COMPONENT);

      // Remove from pending moves on error to revert optimistic update
      setPendingMoves(prev => {
        const newMap = new Map(prev);
        newMap.delete(moveId);
        return newMap;
      });

      toast.error(`Failed to move member: ${error.message}`);
    }
  };

  // Simple sorted groups list like RegisterTab uses sorted data
  const sortedGroups = useMemo(() => {
    if (!groups || Object.keys(groups).length === 0) {
      return [];
    }

    return Object.values(groups).sort((a, b) => {
      if (a.name === 'Group Unassigned') return 1;
      if (b.name === 'Group Unassigned') return -1;
      const aNum = parseInt(a.number) || 0;
      const bNum = parseInt(b.number) || 0;
      return aNum - bNum;
    });
  }, [groups]);

  if (!summaryStats || summaryStats.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Members Found</h3>
        <p className="text-gray-600">No members found for camp groups.</p>
      </div>
    );
  }

  if (!sortedGroups || sortedGroups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Camp Groups Found</h3>
        <p className="text-gray-600">No camp group assignments found for this event.</p>
      </div>
    );
  }

  return (
    <div className="camp-groups-view">
      {/* Header with summary stats */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <Badge variant="scout-blue" size="md">
            {summary.totalGroups || 0} Groups
          </Badge>
          <Badge variant="scout-green" size="md">
            {summary.totalMembers || 0} Members
          </Badge>
        </div>

        {!summary.vikingEventDataAvailable && (
          <Alert variant="warning" className="mb-4">
            <Alert.Title>No Viking Event Management Data</Alert.Title>
            <Alert.Description>
              No &quot;Viking Event Mgmt&quot; flexirecord found for the sections involved in these events. 
              All members will be shown in the &quot;Unassigned&quot; group.
            </Alert.Description>
          </Alert>
        )}
      </div>

      {/* Simple groups grid - similar to RegisterTab's table */}
      <div className={`grid gap-4 ${isMobile ? 'gap-2' : ''}`} 
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {sortedGroups.map((group) => (
          <CampGroupCard
            key={group.name}
            group={group}
            onMemberClick={handleMemberClick}
            onMemberMove={handleMemberMove}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            // Enable drag and drop functionality
            dragDisabled={false}
            className="h-fit"
          />
        ))}
      </div>

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
