import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Alert } from '../../../shared/components/ui';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import useSectionMovements from '../hooks/useSectionMovements.js';
import { calculateSectionMovements } from '../services/movementCalculator.js';
import TermMovementCard from './TermMovementCard.jsx';
import MovementSummaryTable from './MovementSummaryTable.jsx';
import { getFutureTerms } from '../../../shared/utils/sectionMovements/termCalculations.js';
import { groupSectionsByType } from '../../../shared/utils/sectionMovements/sectionGrouping.js';
import { useNotification } from '../../../shared/contexts/notifications';
import { safeGetItem } from '../../../shared/utils/storageUtils.js';

// User preferences utilities
const USER_PREFERENCES_KEY = 'viking_user_preferences';

const getUserPreferences = () => {
  try {
    const stored = localStorage.getItem(USER_PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load user preferences:', error);
    return {};
  }
};

const saveUserPreference = (key, value) => {
  try {
    const preferences = getUserPreferences();
    preferences[key] = value;
    localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save user preference:', error);
  }
};


function SectionMovementTracker({ onBack }) {
  // Load numberOfTerms from user preferences, default to 2
  const [numberOfTerms, setNumberOfTerms] = useState(() => {
    const preferences = getUserPreferences();
    return preferences.numberOfTerms || 2;
  });
  const [_allAssignments, _setAllAssignments] = useState(new Map());
  const { members, sections, loading, error, refetch, flexiRecordState } = useSectionMovements();
  const { notifyError } = useNotification();
  const hasCheckedFlexiRecords = useRef(false);
  
  const futureTerms = getFutureTerms(numberOfTerms);

  // Save numberOfTerms preference whenever it changes
  useEffect(() => {
    saveUserPreference('numberOfTerms', numberOfTerms);
  }, [numberOfTerms]);

  // Check for missing Viking Section Movers FlexiRecords
  const checkForMissingFlexiRecords = useCallback((sectionsData) => {
    if (!sectionsData || sectionsData.length === 0) return;

    const missingSections = [];

    sectionsData.forEach(section => {
      const sectionId = section.sectionid;
      const sectionName = section.sectionname || section.name || 'Unknown Section';
      
      // Filter out adults and waitinglist sections
      const normalizedName = sectionName.toLowerCase();
      if (normalizedName.includes('adults') || 
          normalizedName.includes('waiting') || 
          normalizedName.includes('waitinglist')) {
        return; // Skip these sections
      }

      // Check if this section is already loaded (has FlexiRecord data)
      if (flexiRecordState.loadedSections && flexiRecordState.loadedSections.has(sectionId)) {
        return; // Section has FlexiRecord loaded, treat as present
      }

      // Fallback: Check if FlexiRecord list exists in cache for this section
      const cacheKey = `viking_flexi_lists_${sectionId}_offline`;
      const flexiRecordsList = safeGetItem(cacheKey, null);
      
      if (!flexiRecordsList || !flexiRecordsList.items) {
        missingSections.push(sectionName);
        return;
      }

      // Check if Viking Section Movers FlexiRecord exists in the list
      const hasVikingSectionMovers = flexiRecordsList.items.some(record => 
        record.name === 'Viking Section Movers',
      );

      if (!hasVikingSectionMovers) {
        missingSections.push(sectionName);
      }
    });

    // Show notification if there are missing FlexiRecords
    if (missingSections.length > 0) {
      const sectionList = missingSections.join(', ');
      const requiredFields = ['AssignedSection', 'AssignedTerm'];
      const optionalFields = ['AssignmentDate', 'AssignedBy'];
      
      const message = `Missing "Viking Section Movers" FlexiRecord for: ${sectionList}. ` +
        `Contact your administrator to create this FlexiRecord with required fields: ${requiredFields.join(', ')} ` +
        `and optional fields: ${optionalFields.join(', ')}.`;
      notifyError(message);
    }
  }, [notifyError, flexiRecordState.loadedSections]);

  // Check for missing FlexiRecords when sections load and FlexiRecord discovery completes (only once per session)
  useEffect(() => {
    if (sections && sections.length > 0 && !hasCheckedFlexiRecords.current && flexiRecordState.loading === false) {
      checkForMissingFlexiRecords(sections);
      hasCheckedFlexiRecords.current = true;
    }
  }, [sections, checkForMissingFlexiRecords, flexiRecordState.loading]);

  // Reset the check flag when component unmounts
  useEffect(() => {
    return () => {
      hasCheckedFlexiRecords.current = false;
    };
  }, []);
  
  const termCalculations = useMemo(() => {
    if (!members || !sections) return [];
    
    let availableMembers = [...members];
    const alreadyMoved = new Set();
    const cumulativeSectionCounts = new Map(); // Track cumulative counts across terms
    const cumulativeSectionTypeCounts = new Map(); // Track section type totals across terms
    
    return futureTerms.map((term, termIndex) => {
      const calculations = calculateSectionMovements(availableMembers, term.startDate, sections, term);
      
      
      // Update cumulative counts for each section
      const updatedSectionSummaries = new Map();
      
      calculations.sectionSummaries.forEach((summary, sectionId) => {
        // For first term, use actual current members count
        // For subsequent terms, use previous term's projected count
        let cumulativeCurrentCount;
        if (termIndex === 0) {
          // For first term, count actual members from FlexiRecord for this section
          const sectionMembers = members.filter(member => {
            const memberSectionId = member.section_id || member.sectionid;
            return memberSectionId === sectionId;
          });
          cumulativeCurrentCount = sectionMembers.length;
          cumulativeSectionCounts.set(sectionId, cumulativeCurrentCount);
        } else {
          cumulativeCurrentCount = cumulativeSectionCounts.get(sectionId) || 0;
        }
        
        // Get manual assignments for this section from FlexiRecord data
        const manualAssignments = calculations.movers.filter(mover => {
          if (!mover.flexiRecordSection || mover.flexiRecordSection === 'Not Known') return false;
          const assignedSection = sections?.find(section => 
            section.sectionname === mover.flexiRecordSection ||
            section.name === mover.flexiRecordSection,
          );
          return assignedSection && String(assignedSection.sectionid || assignedSection.sectionId) === String(sectionId);
        }).length;
        
        // Calculate projected count: current - outgoing + incoming + manual assignments
        const projectedCount = Math.max(0, cumulativeCurrentCount - summary.outgoingMovers.length + summary.incomingMovers.length + manualAssignments);
        
        // Store projected count for next term
        cumulativeSectionCounts.set(sectionId, projectedCount);
        
        // Create updated summary with cumulative counts
        updatedSectionSummaries.set(sectionId, {
          ...summary,
          cumulativeCurrentCount,
          projectedCount,
          remainingCount: Math.max(0, cumulativeCurrentCount - summary.outgoingMovers.length),
        });
      });
      
      calculations.movers.forEach(mover => {
        alreadyMoved.add(mover.memberId);
      });
      
      availableMembers = availableMembers.filter(member => {
        const memberId = member.member_id || member.scoutid;
        return !alreadyMoved.has(memberId);
      });
      
      // Calculate section type totals for this term
      const groupedSections = groupSectionsByType(updatedSectionSummaries, sections);
      const sectionTypeTotals = new Map();
      
      const allSectionTypes = ['Squirrels', 'Beavers', 'Cubs', 'Scouts', 'Explorers'];
      allSectionTypes.forEach(sectionType => {
        const group = groupedSections.get(sectionType);
        if (!group) return;
        
        let startingCount;
        if (termIndex === 0) {
          // First term: sum of actual current members for this section type
          startingCount = group.sections.reduce((total, section) => {
            return total + (section.cumulativeCurrentCount || section.currentMembers.length);
          }, 0);
        } else {
          // Subsequent terms: use planned count from previous term
          const prevTermKey = `${sectionType}-${termIndex - 1}`;
          startingCount = cumulativeSectionTypeCounts.get(prevTermKey) || 0;
        }
        
        const incomingCount = calculations.movers.filter(mover => {
          const targetSectionType = mover.targetSection?.toLowerCase();
          return targetSectionType === sectionType.toLowerCase();
        }).length;
        
        const outgoingCount = group.totalOutgoing;
        const plannedCount = startingCount + incomingCount - outgoingCount;
        
        // Store for next term
        const termKey = `${sectionType}-${termIndex}`;
        cumulativeSectionTypeCounts.set(termKey, plannedCount);
        
        sectionTypeTotals.set(sectionType, {
          startingCount,
          incomingCount,
          outgoingCount,
          plannedCount,
        });
      });
      
      return {
        term,
        sectionSummaries: updatedSectionSummaries,
        unassignedMovers: calculations.movers,
        movers: calculations.movers,
        sectionTypeTotals,
      };
    });
  }, [members, sections, futureTerms]);

  // Collect all FlexiRecord assignments from all terms for the summary table
  const allFlexiRecordAssignments = useMemo(() => {
    const assignments = new Map();
    
    termCalculations.forEach(termData => {
      termData.movers.forEach(mover => {
        if (mover.flexiRecordSection && mover.flexiRecordSection !== 'Not Known') {
          // Find the section that matches the assigned section name
          const assignedSection = sections?.find(section => 
            section.sectionname === mover.flexiRecordSection ||
            section.name === mover.flexiRecordSection,
          );
          
          if (assignedSection) {
            console.log('DEBUG: Found assignment:', mover.name, 'to', mover.flexiRecordSection, 'section ID:', assignedSection.sectionid);
            const assignment = {
              memberId: mover.memberId,
              currentSectionId: mover.currentSectionId,
              sectionId: assignedSection.sectionid || assignedSection.sectionId,
              sectionName: assignedSection.sectionname || assignedSection.name,
              term: mover.flexiRecordTerm || `${termData.term.type}-${termData.term.year}`,
            };
            
            assignments.set(mover.memberId, assignment);
          }
        }
      });
    });
    
    console.log('DEBUG: FlexiRecord assignments collected:', assignments.size, assignments);
    return assignments;
  }, [termCalculations, sections]);

  if (loading) {
    return (
      <LoadingScreen message="Loading members and sections..." />
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
        <button 
          onClick={refetch}
          className="inline-flex items-center justify-center rounded-md font-medium px-4 py-2 text-base bg-white border-2 border-scout-blue text-scout-blue hover:bg-scout-blue hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Retry
        </button>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <button 
              onClick={onBack}
              className="mr-3 inline-flex items-center justify-center rounded-md font-medium px-4 py-2 text-base bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 active:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Go back"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              Section Movers
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex flex-col">
              <label htmlFor="number-of-terms" className="text-xs text-gray-600 mb-1">
                Future Terms to Show
              </label>
              <input
                id="number-of-terms"
                type="number"
                min="1"
                max="6"
                value={numberOfTerms}
                onChange={(e) => setNumberOfTerms(parseInt(e.target.value) || 2)}
                className="text-sm border rounded px-2 py-1 w-20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {termCalculations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">
              No future terms to display
            </p>
            <button 
              onClick={refetch}
              className="inline-flex items-center justify-center rounded-md font-medium px-4 py-2 text-base bg-white border-2 border-scout-blue text-scout-blue hover:bg-scout-blue hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Refresh Data
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Movement Summary Table */}
            <MovementSummaryTable 
              termCalculations={termCalculations}
              assignments={allFlexiRecordAssignments}
              sectionsData={sections}
            />
            
            {termCalculations.map(termData => (
              <TermMovementCard
                key={`${termData.term.type}-${termData.term.year}`}
                term={termData.term}
                sectionSummaries={termData.sectionSummaries}
                sectionsData={sections}
                unassignedMovers={termData.unassignedMovers}
                movers={termData.movers}
                sectionTypeTotals={termData.sectionTypeTotals}
                onDataRefresh={refetch}
                allTerms={futureTerms}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

SectionMovementTracker.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default SectionMovementTracker;