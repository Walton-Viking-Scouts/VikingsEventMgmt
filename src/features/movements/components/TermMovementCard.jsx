import React, { useState, useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import SectionTypeGroup from './SectionTypeGroup.jsx';
import { groupSectionsByType, mapSectionType } from '../../../shared/utils/sectionMovements/sectionGrouping.js';
import { multiUpdateFlexiRecord } from '../../../shared/services/api/api.js';
import { discoverVikingSectionMoversFlexiRecords, extractVikingSectionMoversContext } from '../../events/services/flexiRecordService.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { notifyError, notifySuccess } from '../../../shared/utils/notifications.js';

function TermMovementCard({ term, sectionSummaries, sectionsData, movers, sectionTypeTotals, onDataRefresh, allTerms }) {
  
  const [sectionState, setSectionState] = useState({
    assignments: new Map(),
    optimisticCounts: new Map(),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  
  // Notification system
  
  const showToast = useCallback((type, message) => {
    if (type === 'error') {
      logger.error('Toast Error Message', {
        message,
        type,
        timestamp: new Date().toISOString(),
      }, LOG_CATEGORIES.COMPONENT);
    }
    
    if (type === 'success') {
      notifySuccess(message);
    } else if (type === 'error') {
      notifyError(message);
    }
  }, []);

  // Helper function to extract FlexiRecord assignments
  const getFlexiRecordAssignments = useCallback(() => {
    const flexiRecordAssignments = new Map();
    const flexiRecordCounts = new Map();
    
    movers.forEach(mover => {
      if (mover.flexiRecordSection && mover.flexiRecordSection !== 'Not Known') {
        const assignedSection = sectionsData.find(section => 
          section.sectionname === mover.flexiRecordSection ||
          section.name === mover.flexiRecordSection,
        );
        
        if (assignedSection) {
          const assignment = {
            memberId: mover.memberId,
            currentSectionId: mover.currentSectionId,
            sectionId: assignedSection.sectionid || assignedSection.sectionId,
            sectionName: assignedSection.sectionname || assignedSection.name,
            term: mover.flexiRecordTerm || `${term.type}-${term.year}`,
          };
          
          flexiRecordAssignments.set(mover.memberId, assignment);
          
          const sectionIdStr = String(assignment.sectionId);
          const currentCount = flexiRecordCounts.get(sectionIdStr) || 0;
          flexiRecordCounts.set(sectionIdStr, currentCount + 1);
        }
      }
    });

    return { flexiRecordAssignments, flexiRecordCounts };
  }, [movers, sectionsData, term.type, term.year]);

  // Load saved assignments from FlexiRecord data when movers change
  useEffect(() => {
    if (!movers || movers.length === 0) return;

    const { flexiRecordAssignments, flexiRecordCounts } = getFlexiRecordAssignments();

    // Only update state if there are saved assignments to avoid unnecessary re-renders
    if (flexiRecordAssignments.size > 0) {
      setSectionState(_prev => ({
        assignments: flexiRecordAssignments,
        optimisticCounts: flexiRecordCounts,
      }));
    }
  }, [movers, getFlexiRecordAssignments]);

  const groupedSections = groupSectionsByType(sectionSummaries, sectionsData);
  
  
  // Ensure all section types with incoming movers are included
  const allSectionTypes = ['Squirrels', 'Beavers', 'Cubs', 'Scouts', 'Explorers'];
  allSectionTypes.forEach(sectionType => {
    const hasIncomingMovers = movers.some(mover => {
      const targetSectionType = mapSectionType(mover.targetSection?.toLowerCase());
      return targetSectionType === sectionType;
    });
    
    if (hasIncomingMovers && !groupedSections.has(sectionType)) {
      groupedSections.set(sectionType, {
        type: sectionType,
        sections: [],
        totalIncoming: 0,
        totalOutgoing: 0,
        totalCurrent: 0,
        totalRemaining: 0,
      });
    }
  });
  
  const sectionTypeGroups = Array.from(groupedSections.entries()).sort(([a], [b]) => {
    const order = ['Squirrels', 'Beavers', 'Cubs', 'Scouts', 'Explorers'];
    return order.indexOf(a) - order.indexOf(b);
  });

  const availableSections = useMemo(() => {
    const sections = Array.from(sectionSummaries.values()).map(summary => {
      const sectionData = sectionsData.find(s => s.sectionId === summary.sectionId);
      // Ensure consistent string comparison for optimistic counts
      const sectionIdStr = String(summary.sectionId);
      const optimisticIncoming = sectionState.optimisticCounts.get(sectionIdStr) || 0;
      return {
        sectionId: summary.sectionId,
        sectionName: summary.sectionName,
        sectionType: sectionData?.sectionType || '',
        currentCount: summary.cumulativeCurrentCount || summary.currentMembers.length,
        incomingCount: optimisticIncoming,
        totalProjectedCount: (summary.cumulativeCurrentCount || summary.currentMembers.length) + optimisticIncoming,
        maxCapacity: null,
      };
    });
    
    return sections;
  }, [sectionSummaries, sectionsData, sectionState.optimisticCounts]);

  const availableTerms = useMemo(() => {
    // Use all terms displayed on the page instead of hardcoded list
    return allTerms || [
      { type: 'Spring', year: term.year },
      { type: 'Summer', year: term.year },
      { type: 'Autumn', year: term.year },
      { type: 'Spring', year: term.year + 1 },
    ];
  }, [allTerms, term.year]);

  const handleAssignmentChange = useCallback((memberId, assignment) => {
    setSectionState(prev => {
      const previousAssignment = prev.assignments.get(memberId);
      
      // Check if this is actually a change to prevent duplicate updates
      const isSameAssignment = previousAssignment?.sectionId === assignment.sectionId;
      if (isSameAssignment) {
        return prev;
      }
      
      // Create new state with both assignments and optimistic counts updated atomically
      const updatedAssignments = new Map(prev.assignments);
      const updatedCounts = new Map(prev.optimisticCounts);
      
      // Remove previous assignment count
      if (previousAssignment?.sectionId) {
        const prevSectionIdStr = String(previousAssignment.sectionId);
        const prevCount = updatedCounts.get(prevSectionIdStr) || 0;
        updatedCounts.set(prevSectionIdStr, Math.max(0, prevCount - 1));
      }
      
      // Add new assignment count and update assignments
      if (assignment.sectionId) {
        const sectionIdStr = String(assignment.sectionId);
        const newCount = updatedCounts.get(sectionIdStr) || 0;
        updatedCounts.set(sectionIdStr, newCount + 1);
        updatedAssignments.set(memberId, assignment);
      } else {
        updatedAssignments.delete(memberId);
      }
      
      return {
        assignments: updatedAssignments,
        optimisticCounts: updatedCounts,
      };
    });
  }, []);

  const handleTermOverrideChange = (memberId, termOverride) => {
    setSectionState(prev => {
      const updatedAssignments = new Map(prev.assignments);
      const existing = updatedAssignments.get(memberId);
      
      if (existing) {
        // Update existing assignment with term override
        updatedAssignments.set(memberId, { ...existing, term: termOverride });
      } else if (termOverride) {
        // Find the member's current section
        const member = movers.find(m => m.memberId === memberId);
        const currentSectionId = member?.currentSectionId;
        
        // Create new assignment with just term override (no section yet)
        updatedAssignments.set(memberId, { 
          memberId,
          currentSectionId,
          sectionId: null,
          sectionName: null,
          term: termOverride,
        });
      }
      
      return {
        assignments: updatedAssignments,
        optimisticCounts: prev.optimisticCounts,
      };
    });
  };

  const handleSaveAssignments = async () => {
    // Get current assignments and original FlexiRecord assignments
    const currentAssignments = sectionState.assignments;
    const { flexiRecordAssignments } = getFlexiRecordAssignments();
    
    // Find only the assignments that have actually changed
    const changedAssignments = [];
    
    for (const [memberId, currentAssignment] of currentAssignments) {
      const originalAssignment = flexiRecordAssignments.get(memberId);
      
      // Check if this is a new assignment or if values have changed
      const isChanged = !originalAssignment || 
        originalAssignment.sectionId !== currentAssignment.sectionId ||
        originalAssignment.sectionName !== currentAssignment.sectionName ||
        originalAssignment.term !== currentAssignment.term;
      
      if (isChanged) {
        changedAssignments.push(currentAssignment);
      }
    }
    
    if (changedAssignments.length === 0) {
      logger.info('No changed assignments to save', {}, LOG_CATEGORIES.USER_ACTION);
      showToast('error', 'No changes to save. Please modify member assignments first.');
      return;
    }
    
    logger.info('Saving only changed assignments', {
      totalAssignments: currentAssignments.size,
      changedAssignments: changedAssignments.length,
    }, LOG_CATEGORIES.USER_ACTION);

    setIsSaving(true);
    setSaveError(null);

    try {
      const token = getToken();
      if (!token) {
        showToast('error', 'Authentication required. Please sign in to save assignments.');
        throw new Error('Authentication required to save assignments');
      }

      // Discover Viking Section Movers FlexiRecords to get the correct FlexiRecord ID
      const discoveredRecords = await discoverVikingSectionMoversFlexiRecords(token);
      if (!discoveredRecords || discoveredRecords.length === 0) {
        showToast('error', 'No Viking Section Movers configuration found. Please contact an administrator.');
        throw new Error('No Viking Section Movers FlexiRecords found');
      }

      // Use the first discovered FlexiRecord
      const firstRecord = discoveredRecords[0];
      
      // Get preloaded structure from cache and process fieldMapping
      const { safeGetItem } = await import('../../../shared/utils/storageUtils.js');
      const cacheKey = `viking_flexi_structure_${firstRecord.flexiRecordId}_offline`;
      const structureData = safeGetItem(cacheKey, null);
      
      if (!structureData) {
        const errorMsg = 'FlexiRecord structure not found in cache. Please refresh the app.';
        showToast('error', errorMsg);
        throw new Error('FlexiRecord structure not found in cache');
      }

      // Process the raw structure to create fieldMapping like in getConsolidatedFlexiRecord
      const { parseFlexiStructure } = await import('../../../shared/utils/flexiRecordTransforms.js');
      const fieldMapping = parseFlexiStructure(structureData);
      
      // Convert fieldMapping Map to object for easier access
      const fieldMappingObj = {};
      fieldMapping.forEach((fieldInfo, fieldId) => {
        fieldMappingObj[fieldId] = {
          columnId: fieldId,
          ...fieldInfo,
        };
      });

      // Create structure with fieldMapping for extraction
      const processedStructure = {
        ...structureData,
        fieldMapping: fieldMappingObj,
      };

      // Extract context using the processed structure
      const context = extractVikingSectionMoversContext(
        { _structure: processedStructure },
        firstRecord.sectionId,
        null, // termId not needed for field mapping
        null,  // sectionName not needed for field mapping
      );

      if (!context) {
        const errorMsg = 'Unable to extract FlexiRecord field mappings. Check that AssignedSection and AssignedTerm fields exist.';
        showToast('error', errorMsg);
        throw new Error('Could not extract FlexiRecord context for assignments');
      }


      // Group assignments by current section AND value (each section has different flexirecordid)
      
      // Group by term values per section
      if (context.assignedTerm) {
        const termGroups = new Map(); // Key: "sectionId|termValue"
        
        for (const assignment of changedAssignments) {
          const termValue = assignment.term || '';
          const memberId = assignment.memberId || assignment.scoutId;
          const currentSectionId = assignment.currentSectionId;
          const groupKey = `${currentSectionId}|${termValue}`;
          
          if (!termGroups.has(groupKey)) {
            termGroups.set(groupKey, {
              sectionId: currentSectionId,
              termValue,
              memberIds: [],
            });
          }
          termGroups.get(groupKey).memberIds.push(memberId);
        }


        // Make one API call per unique (section, term value) combination
        for (const group of termGroups.values()) {
          if (group.memberIds.length > 0) {
            // Get the correct FlexiRecord ID for this specific section
            const sectionRecord = discoveredRecords.find(r => r.sectionId === group.sectionId);
            const sectionFlexiRecordId = sectionRecord?.flexiRecordId;
            
            if (sectionFlexiRecordId) {
              await multiUpdateFlexiRecord(
                group.sectionId,
                group.memberIds,
                [group.termValue], // Single value for all members in this section
                context.assignedTerm,
                sectionFlexiRecordId,
                token,
              );
            }
          }
        }
      }
      
      // Group by section values per current section
      if (context.assignedSection) {
        const sectionGroups = new Map(); // Key: "currentSectionId|targetSectionValue"
        
        for (const assignment of changedAssignments) {
          const sectionValue = assignment.sectionId === 'Not Known' || !assignment.sectionId 
            ? 'Not Known' 
            : assignment.sectionName || 'Not Known';
          const memberId = assignment.memberId || assignment.scoutId;
          const currentSectionId = assignment.currentSectionId;
          const groupKey = `${currentSectionId}|${sectionValue}`;
          
          if (!sectionGroups.has(groupKey)) {
            sectionGroups.set(groupKey, {
              sectionId: currentSectionId,
              sectionValue,
              memberIds: [],
            });
          }
          sectionGroups.get(groupKey).memberIds.push(memberId);
        }

        // Make one API call per unique (current section, target section value) combination
        for (const group of sectionGroups.values()) {
          if (group.memberIds.length > 0) {
            // Get the correct FlexiRecord ID for this specific section
            const sectionRecord = discoveredRecords.find(r => r.sectionId === group.sectionId);
            const sectionFlexiRecordId = sectionRecord?.flexiRecordId;
            
            if (sectionFlexiRecordId) {
              await multiUpdateFlexiRecord(
                group.sectionId,
                group.memberIds,
                [group.sectionValue], // Single value for all members in this section
                context.assignedSection,
                sectionFlexiRecordId,
                token,
              );
            }
          }
        }
      }

      logger.info('Section mover assignments saved successfully', {
        assignmentCount: changedAssignments.length,
      }, LOG_CATEGORIES.USER_ACTION);

      // Show success toast
      showToast('success', `Successfully saved ${changedAssignments.length} assignment${changedAssignments.length > 1 ? 's' : ''}`);

      // Reset only manually made assignments, keep FlexiRecord assignments
      const { flexiRecordAssignments, flexiRecordCounts } = getFlexiRecordAssignments();
      setSectionState({
        assignments: flexiRecordAssignments,
        optimisticCounts: flexiRecordCounts,
      });

      // Force refresh of FlexiRecord data in the background to re-render with new assignments
      if (onDataRefresh) {
        setTimeout(() => {
          onDataRefresh().catch(err => {
            logger.warn('Background FlexiRecord refresh failed after save', {
              error: err.message,
            }, LOG_CATEGORIES.APP);
          });
        }, 500); // Small delay to allow API to process
      }

    } catch (error) {
      logger.error('Failed to save section mover assignments', {
        error: error.message,
        assignmentCount: changedAssignments.length,
      }, LOG_CATEGORIES.API);
      
      setSaveError(error.message);
      showToast('error', `Failed to save assignments: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAssignments = () => {
    // Reset only manually made assignments, keep FlexiRecord assignments
    const { flexiRecordAssignments, flexiRecordCounts } = getFlexiRecordAssignments();
    setSectionState({
      assignments: flexiRecordAssignments,
      optimisticCounts: flexiRecordCounts,
    });
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="bg-gray-100 p-3 rounded-t-lg border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          {term.displayName}
        </h2>
        <div className="text-sm text-gray-500">
          Term starts: {new Date(term.startDate).toLocaleDateString()}
        </div>
      </div>
      
      <div className="p-4">
        {saveError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-sm text-red-800">
            Error saving assignments: {saveError}
            </div>
          </div>
        )}
      
        {sectionTypeGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
          No sections with members found for this term
          </div>
        ) : (
          <div className="space-y-6">
            {sectionTypeGroups.map(([sectionType, group]) => {
              const { flexiRecordAssignments } = getFlexiRecordAssignments();
              return (
                <SectionTypeGroup
                  key={sectionType}
                  sectionType={sectionType}
                  group={group}
                  movers={movers}
                  showAssignmentInterface={true}
                  allSections={availableSections}
                  availableTerms={availableTerms}
                  assignments={sectionState.assignments}
                  originalAssignments={flexiRecordAssignments}
                  currentTerm={term}
                  sectionTypeTotals={sectionTypeTotals}
                  onAssignmentChange={handleAssignmentChange}
                  onTermOverrideChange={handleTermOverrideChange}
                  onSaveAssignments={handleSaveAssignments}
                  onResetAssignments={handleResetAssignments}
                  isSaving={isSaving}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

TermMovementCard.propTypes = {
  term: PropTypes.shape({
    type: PropTypes.string.isRequired,
    year: PropTypes.number.isRequired,
    displayName: PropTypes.string,
  }).isRequired,
  sectionSummaries: PropTypes.arrayOf(PropTypes.object).isRequired,
  sectionsData: PropTypes.arrayOf(PropTypes.object).isRequired,
  movers: PropTypes.arrayOf(PropTypes.object).isRequired,
  sectionTypeTotals: PropTypes.instanceOf(Map),
  onDataRefresh: PropTypes.func.isRequired,
  allTerms: PropTypes.arrayOf(PropTypes.shape({
    type: PropTypes.string.isRequired,
    year: PropTypes.number.isRequired,
  })),
};

export default TermMovementCard;