import React, { useState, useMemo } from 'react';
import SectionTypeGroup from './SectionTypeGroup.jsx';
import MoversByTargetSection from './MoversByTargetSection.jsx';
import { groupSectionsByType, mapSectionType } from '../../utils/sectionMovements/sectionGrouping.js';
import { useVikingSectionMovers } from '../../hooks/useVikingSectionMovers.js';
import { Button } from '../ui';

function TermMovementCard({ term, sectionSummaries, sectionsData, unassignedMovers, movers }) {
  const [assignments, setAssignments] = useState(new Map());
  const [optimisticCounts, setOptimisticCounts] = useState(new Map());

  const sectionsWithMovers = useMemo(() => {
    const sectionIds = [...new Set(movers.map(mover => mover.currentSectionId))];
    return sectionIds.filter(id => id);
  }, [movers]);

  const firstSectionId = sectionsWithMovers[0];
  const { validationStatus, fieldMapping, isValid } = useVikingSectionMovers(
    firstSectionId, 
    `${term.type.toLowerCase()}_${term.year}`
  );
  
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
      const optimisticIncoming = optimisticCounts.get(summary.sectionId) || 0;
      return {
        sectionId: summary.sectionId,
        sectionName: summary.sectionName,
        sectionType: sectionData?.sectionType || '',
        currentCount: summary.currentMembers.length,
        incomingCount: optimisticIncoming,
        totalProjectedCount: summary.currentMembers.length + optimisticIncoming,
        maxCapacity: null,
      };
    });
    
    return sections;
  }, [sectionSummaries, sectionsData, optimisticCounts]);

  const availableTerms = useMemo(() => {
    return [
      { type: 'Spring', year: term.year },
      { type: 'Summer', year: term.year },
      { type: 'Autumn', year: term.year },
      { type: 'Spring', year: term.year + 1 },
    ];
  }, [term.year]);

  const handleAssignmentChange = (memberId, assignment) => {
    setAssignments(prev => {
      const updated = new Map(prev);
      const previousAssignment = prev.get(memberId);
      
      // Update optimistic counts
      setOptimisticCounts(countsPrev => {
        const updatedCounts = new Map(countsPrev);
        
        // Remove previous assignment count
        if (previousAssignment?.sectionId) {
          const prevCount = updatedCounts.get(previousAssignment.sectionId) || 0;
          updatedCounts.set(previousAssignment.sectionId, Math.max(0, prevCount - 1));
        }
        
        // Add new assignment count
        if (assignment.sectionId) {
          const newCount = updatedCounts.get(assignment.sectionId) || 0;
          updatedCounts.set(assignment.sectionId, newCount + 1);
          updated.set(memberId, assignment);
        } else {
          updated.delete(memberId);
        }
        
        return updatedCounts;
      });
      
      return updated;
    });
  };

  const handleTermOverrideChange = (memberId, termOverride) => {
    setAssignments(prev => {
      const updated = new Map(prev);
      const existing = updated.get(memberId);
      if (existing) {
        updated.set(memberId, { ...existing, term: termOverride });
      }
      return updated;
    });
  };

  const handleSaveAssignments = async () => {
    const assignmentsList = Array.from(assignments.values());
    console.log('Saving assignments (local state only):', assignmentsList);
    
    // TODO: Task 6.6 - Implement FlexiRecord API persistence
    // Will use proper termId format from fetchMostRecentTermId()
    // Will use multiUpdateFlexiRecord with correct field mapping
  };

  const handleResetAssignments = () => {
    setAssignments(new Map());
    setOptimisticCounts(new Map());
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {term.displayName}
        </h2>
        <div className="text-sm text-gray-500">
          Term starts: {new Date(term.startDate).toLocaleDateString()}
        </div>
      </div>
      
      {sectionTypeGroups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No sections with members found for this term
        </div>
      ) : (
        <div className="space-y-6">
          {sectionTypeGroups.map(([sectionType, group]) => (
            <SectionTypeGroup
              key={sectionType}
              sectionType={sectionType}
              group={group}
              movers={movers}
              showAssignmentInterface={true}
              allSections={availableSections}
              availableTerms={availableTerms}
              assignments={assignments}
              onAssignmentChange={handleAssignmentChange}
              onTermOverrideChange={handleTermOverrideChange}
              onSaveAssignments={handleSaveAssignments}
              onResetAssignments={handleResetAssignments}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TermMovementCard;