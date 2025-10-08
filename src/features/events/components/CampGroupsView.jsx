import React, { useState, useMemo } from 'react';
import { Alert } from '../../../shared/components/ui';
import CampGroupCard from './CampGroupCard.jsx';
import { MemberDetailModal } from '../../../shared/components/ui';
import GroupNamesEditModal from './GroupNamesEditModal.jsx';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { isMobileLayout } from '../../../shared/utils/platform.js';
import { assignMemberToCampGroup, batchAssignMembers, extractFlexiRecordContext, bulkUpdateCampGroups } from '../services/campGroupAllocationService.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { notifyError, notifyInfo, notifySuccess } from '../../../shared/utils/notifications.js';
import databaseService from '../../../shared/services/storage/database.js';

/**
 * Organizes member summary statistics by camp groups with optimistic updates
 * Groups Young People by their assigned camp group number, applying pending moves
 * for immediate UI feedback before server confirmation
 *
 * @param {Array<Object>} summaryStats - Array of member summary data with attendance and Viking Event data
 * @param {Map} [pendingMoves=new Map()] - Map of in-flight camp group moves (scoutid -> moveData)
 * @param {Map} [recentlyCompletedMoves=new Map()] - Map of recently completed moves for optimistic UI
 * @returns {Object} Object containing organized groups (group names as keys with member arrays) and summary statistics (totalGroups, totalMembers, hasUnassigned, vikingEventDataAvailable)
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
  
  // Filter for Young People only (camp groups are only for Young People)
  const youngPeople = summaryStats.filter(member => member.person_type === 'Young People');

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

  const hasVikingEventData = youngPeople.length > 0 && youngPeople.every(member =>
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
 * @param {Map<string, Object>} props.vikingEventData - Viking event configuration data
 * @param {Function} props.onMemberClick - Member click handler
 * @param {Function} props.onDataRefresh - Function to refresh Viking Event data after operations
 */
function CampGroupsView({
  summaryStats = [],
  events = [],
  members: _members = [],
  vikingEventData,
  onMemberClick,
  onDataRefresh,
}) {
  // Simple state for modal
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  
  // State for group names edit modal
  const [showGroupNamesModal, setShowGroupNamesModal] = useState(false);
  const [groupNamesLoading, setGroupNamesLoading] = useState(false);
  
  // State for optimistic updates - track member camp group changes
  const [pendingMoves, setPendingMoves] = useState(new Map());
  const [recentlyCompletedMoves, setRecentlyCompletedMoves] = useState(new Map());

  const isMobile = isMobileLayout();

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
        notifyError('Please sign in to OSM to move members between camp groups.');
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
        const errorMsg = 'Camp groups not available for this section. Please ensure the "Viking Event Mgmt" FlexiRecord exists in OSM with a "CampGroup" field (no space).';
        notifyError(errorMsg);
        throw new Error(errorMsg);
      }

      const memberName = member.name || `${member.firstname} ${member.lastname}`;
      
      // Show loading notification
      notifyInfo(`Moving ${memberName} to ${moveData.toGroupName}...`);

      // Call the API service
      const result = await assignMemberToCampGroup(moveData, flexiRecordContext, token);

      if (result.success) {
        notifySuccess(`${memberName} successfully moved to ${moveData.toGroupName}`);
        
        // Move from pending to recently completed
        setPendingMoves(prev => {
          const newMap = new Map(prev);
          newMap.delete(moveId);
          return newMap;
        });
        
        setRecentlyCompletedMoves(prev => new Map(prev).set(moveId, moveData));
        
        // Refresh Viking Event data to get updated camp group assignments
        if (onDataRefresh) {
          try {
            await onDataRefresh();
          } catch (refreshError) {
            logger.warn('Failed to refresh Viking Event data after member move', {
              error: refreshError.message,
            }, LOG_CATEGORIES.COMPONENT);
          }
        }
        
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

      notifyError(`Failed to move member: ${error.message}`, error);
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

  // Handler to open group names edit modal
  const handleEditGroupNames = () => {
    setShowGroupNamesModal(true);
  };

  // Handler to close group names edit modal
  const handleCloseGroupNamesModal = () => {
    setShowGroupNamesModal(false);
    setGroupNamesLoading(false);
  };

  // Handler for renaming groups
  const handleRenameGroup = async (oldName, newName, membersBySection) => {
    setGroupNamesLoading(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error('Please sign in to OSM to rename groups.');
      }

      const allMembers = Object.values(membersBySection).flat();
      const memberCount = allMembers.length;
      
      logger.info('Group rename requested', {
        oldName,
        newName,
        memberCount,
        sectionCount: Object.keys(membersBySection).length,
      }, LOG_CATEGORIES.APP);

      notifyInfo(`Renaming "${oldName}" to "${newName}" (${memberCount} members)...`);

      // Extract the new group number from newName
      // Handle special case where newName could be just a number or "Group X" format
      const newGroupNumber = newName.replace(/^Group\s+/, '').trim();

      // Process each section separately
      let totalSuccessful = 0;
      let totalFailed = 0;

      for (const [sectionId, members] of Object.entries(membersBySection)) {
        if (members.length === 0) continue;

        // Get Viking Event data structure for this section
        const sectionVikingEventData = vikingEventData?.get(String(sectionId));
        
        // Get section details for termId and section name
        const event = events.find(e => String(e.sectionid) === String(sectionId));
        const termId = event?.termid || 'current';
        
        // Get real section type from section cache
        const sectionsData = await databaseService.getSections();
        const sectionData = sectionsData.find(s => String(s.sectionid) === String(sectionId));
        const realSectionType = sectionData?.sectiontype || 'Unknown Section Type';
        
        const flexiRecordContext = extractFlexiRecordContext(sectionVikingEventData, sectionId, termId, realSectionType);

        if (!flexiRecordContext) {
          logger.warn('No FlexiRecord context for section, skipping', { sectionId }, LOG_CATEGORIES.APP);
          totalFailed += members.length;
          continue;
        }

        // Extract scout IDs for bulk update
        const scoutIds = members.map(member => member.scoutid);
        
        // Determine the new group value for the API
        // Empty string or null for "Unassigned", otherwise the group number
        const newGroupValue = (newGroupNumber === 'Unassigned' || !newGroupNumber) 
          ? '' 
          : newGroupNumber.toString();

        logger.info('Processing bulk camp group rename for section', {
          sectionId,
          memberCount: scoutIds.length,
          oldName,
          newName,
          newGroupValue,
        }, LOG_CATEGORIES.APP);

        // Execute bulk update for this section using multi-update API
        const bulkResult = await bulkUpdateCampGroups(scoutIds, newGroupValue, flexiRecordContext, token);

        if (bulkResult.success) {
          totalSuccessful += scoutIds.length;
          logger.info('Bulk camp group rename succeeded for section', {
            sectionId,
            updatedCount: scoutIds.length,
          }, LOG_CATEGORIES.APP);
        } else {
          totalFailed += scoutIds.length;
          logger.warn('Bulk camp group rename failed for section', {
            sectionId,
            error: bulkResult.error,
            failedCount: scoutIds.length,
          }, LOG_CATEGORIES.APP);
        }
      }

      if (totalFailed === 0) {
        notifySuccess(`Group "${oldName}" successfully renamed to "${newName}" (${totalSuccessful} members updated)`);
        
        // Refresh Viking Event data to get updated camp group assignments
        if (onDataRefresh) {
          try {
            await onDataRefresh();
          } catch (refreshError) {
            logger.warn('Failed to refresh Viking Event data after group rename', {
              error: refreshError.message,
            }, LOG_CATEGORIES.COMPONENT);
          }
        }
      } else if (totalSuccessful > 0) {
        notifyInfo(`Group "${oldName}" partially renamed: ${totalSuccessful} successful, ${totalFailed} failed`);
        
        // Refresh Viking Event data even for partial success to get updated assignments
        if (onDataRefresh) {
          try {
            await onDataRefresh();
          } catch (refreshError) {
            logger.warn('Failed to refresh Viking Event data after partial group rename', {
              error: refreshError.message,
            }, LOG_CATEGORIES.COMPONENT);
          }
        }
      } else {
        throw new Error(`Failed to rename group: no members were updated (${totalFailed} failures)`);
      }

    } catch (error) {
      logger.error('Failed to rename group', {
        oldName,
        newName,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      notifyError(`Failed to rename group: ${error.message}`);
    } finally {
      setGroupNamesLoading(false);
    }
  };

  // Handler for deleting groups
  const handleDeleteGroup = async (groupName, membersBySection) => {
    setGroupNamesLoading(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error('Please sign in to OSM to delete groups.');
      }

      const allMembers = Object.values(membersBySection).flat();
      const memberCount = allMembers.length;
      
      logger.info('Group delete requested', {
        groupName,
        memberCount,
        sectionCount: Object.keys(membersBySection).length,
      }, LOG_CATEGORIES.APP);

      notifyInfo(`Deleting "${groupName}" and moving ${memberCount} members to Unassigned...`);

      // Process each section separately
      let totalSuccessful = 0;
      let totalFailed = 0;

      for (const [sectionId, members] of Object.entries(membersBySection)) {
        if (members.length === 0) continue;

        // Get Viking Event data structure for this section
        const sectionVikingEventData = vikingEventData?.get(String(sectionId));
        
        // Get section details for termId and section name
        const event = events.find(e => String(e.sectionid) === String(sectionId));
        const termId = event?.termid || 'current';
        
        // Get real section type from section cache
        const sectionsData = await databaseService.getSections();
        const sectionData = sectionsData.find(s => String(s.sectionid) === String(sectionId));
        const realSectionType = sectionData?.sectiontype || 'Unknown Section Type';
        
        const flexiRecordContext = extractFlexiRecordContext(sectionVikingEventData, sectionId, termId, realSectionType);

        if (!flexiRecordContext) {
          logger.warn('No FlexiRecord context for section, skipping', { sectionId }, LOG_CATEGORIES.APP);
          totalFailed += members.length;
          continue;
        }

        // Create move operations to move all members to "Unassigned"
        const moves = members.map(member => ({
          member: member,
          fromGroupNumber: member.vikingEventData?.CampGroup || 'Unassigned',
          fromGroupName: groupName,
          toGroupNumber: 'Unassigned',
          toGroupName: 'Group Unassigned',
        }));

        // Execute batch assignment for this section
        const batchResult = await batchAssignMembers(moves, flexiRecordContext, token);

        if (batchResult.summary) {
          totalSuccessful += batchResult.summary.successful;
          totalFailed += batchResult.summary.failed;
        } else {
          // Handle individual results
          const successful = batchResult.results.filter(r => r.success).length;
          const failed = batchResult.results.filter(r => !r.success).length;
          totalSuccessful += successful;
          totalFailed += failed;
        }
      }

      if (totalFailed === 0) {
        notifySuccess(`Group "${groupName}" successfully deleted (${totalSuccessful} members moved to Unassigned)`);
        
        // Refresh Viking Event data to get updated camp group assignments
        if (onDataRefresh) {
          try {
            await onDataRefresh();
          } catch (refreshError) {
            logger.warn('Failed to refresh Viking Event data after group delete', {
              error: refreshError.message,
            }, LOG_CATEGORIES.COMPONENT);
          }
        }
      } else if (totalSuccessful > 0) {
        notifyInfo(`Group "${groupName}" partially deleted: ${totalSuccessful} successful, ${totalFailed} failed`);
        
        // Refresh Viking Event data even for partial success to get updated assignments
        if (onDataRefresh) {
          try {
            await onDataRefresh();
          } catch (refreshError) {
            logger.warn('Failed to refresh Viking Event data after partial group delete', {
              error: refreshError.message,
            }, LOG_CATEGORIES.COMPONENT);
          }
        }
      } else {
        throw new Error(`Failed to delete group: no members were moved (${totalFailed} failures)`);
      }

    } catch (error) {
      logger.error('Failed to delete group', {
        groupName,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      notifyError(`Failed to delete group: ${error.message}`);
    } finally {
      setGroupNamesLoading(false);
    }
  };

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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap gap-4">
            <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-scout-blue text-white">
              {summary.totalGroups || 0} Groups
            </span>
            <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-scout-green text-white">
              {summary.totalMembers || 0} Members
            </span>
          </div>
          
          {/* Edit Names Button */}
          {summary.totalGroups > 0 && (
            <button
              onClick={handleEditGroupNames}
              disabled={groupNamesLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit Names
            </button>
          )}
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

      {/* Group Names Edit Modal */}
      <GroupNamesEditModal
        isOpen={showGroupNamesModal}
        onClose={handleCloseGroupNamesModal}
        groups={groups}
        onRename={handleRenameGroup}
        onDelete={handleDeleteGroup}
        loading={groupNamesLoading}
      />
    </div>
  );
}

export default CampGroupsView;
