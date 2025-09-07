import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button, Alert } from '../../../shared/components/ui';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import useSectionMovements from '../hooks/useSectionMovements.js';
import { calculateSectionMovements } from '../services/movementCalculator.js';
import TermMovementCard from './TermMovementCard.jsx';
import { getFutureTerms } from '../../../shared/utils/sectionMovements/termCalculations.js';
import { useNotification } from '../../../shared/contexts/notifications/NotificationContext';
import { safeGetItem } from '../../../shared/utils/storageUtils.js';


function SectionMovementTracker({ onBack }) {
  const [numberOfTerms, setNumberOfTerms] = useState(2);
  const { members, sections, loading, error, refetch, flexiRecordState } = useSectionMovements();
  const { notifyError } = useNotification();
  const hasCheckedFlexiRecords = useRef(false);
  
  const futureTerms = getFutureTerms(numberOfTerms);

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
        
        // Calculate projected count: current - outgoing + incoming
        const projectedCount = Math.max(0, cumulativeCurrentCount - summary.outgoingMovers.length + summary.incomingMovers.length);
        
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
      
      return {
        term,
        sectionSummaries: updatedSectionSummaries,
        unassignedMovers: calculations.movers,
        movers: calculations.movers,
      };
    });
  }, [members, sections, futureTerms]);

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
        <Button onClick={refetch} variant="outline">
          Retry
        </Button>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <Button 
              onClick={onBack}
              variant="ghost"
              className="mr-3"
              aria-label="Go back"
            >
              ← Back
            </Button>
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
            <Button onClick={refetch} variant="outline">
              Refresh Data
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {termCalculations.map(termData => (
              <TermMovementCard
                key={`${termData.term.type}-${termData.term.year}`}
                term={termData.term}
                sectionSummaries={termData.sectionSummaries}
                sectionsData={sections}
                unassignedMovers={termData.unassignedMovers}
                movers={termData.movers}
                onDataRefresh={refetch}
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