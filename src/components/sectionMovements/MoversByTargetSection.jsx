import React, { useMemo } from 'react';
import MoverAssignmentRow from './MoverAssignmentRow.jsx';
import { mapSectionType } from '../../utils/sectionMovements/sectionGrouping.js';

function MoversByTargetSection({
  movers,
  allSections,
  availableTerms,
  assignments,
  onAssignmentChange,
  onTermOverrideChange,
}) {
  const moversByTarget = useMemo(() => {
    const grouped = new Map();
    
    movers.forEach(mover => {
      const targetSectionType = mapSectionType(mover.targetSection?.toLowerCase());
      
      if (!grouped.has(targetSectionType)) {
        grouped.set(targetSectionType, {
          sectionType: targetSectionType,
          movers: [],
          totalMovers: 0,
          assignedCount: 0,
        });
      }
      
      const group = grouped.get(targetSectionType);
      group.movers.push({
        ...mover,
        assignedSectionId: assignments.get(mover.memberId)?.sectionId || null,
        assignedTerm: assignments.get(mover.memberId)?.term || null,
      });
      group.totalMovers++;
      
      if (assignments.has(mover.memberId)) {
        group.assignedCount++;
      }
    });
    
    return grouped;
  }, [movers, assignments]);

  const getAvailableSectionsForType = (sectionType) => {
    return allSections.filter(section => {
      const sectionSectionType = mapSectionType(section.sectionType?.toLowerCase() || '');
      return sectionSectionType === sectionType;
    });
  };

  const getIncomingCountForSection = (sectionId) => {
    return Array.from(assignments.values()).filter(
      assignment => assignment.sectionId === sectionId,
    ).length;
  };

  const sortedSectionTypes = ['Squirrels', 'Beavers', 'Cubs', 'Scouts', 'Explorers'];
  const orderedGroups = Array.from(moversByTarget.entries())
    .sort(([a], [b]) => sortedSectionTypes.indexOf(a) - sortedSectionTypes.indexOf(b));

  return (
    <div className="space-y-6">
      {orderedGroups.map(([sectionType, group]) => {
        const availableSectionsForType = getAvailableSectionsForType(sectionType);
        
        return (
          <div key={sectionType} className="bg-amber-50 rounded-lg border border-amber-200">
            <div className="bg-amber-100 p-3 rounded-t-lg border-b border-amber-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-amber-900">
                  Moving to {sectionType}
                </h3>
                <div className="text-sm text-amber-700">
                  {group.assignedCount}/{group.totalMovers} assigned
                </div>
              </div>
              
              {availableSectionsForType.length > 0 && (
                <div className="mt-2 text-sm text-amber-700">
                  Available: {availableSectionsForType.map(section => (
                    <span key={section.sectionId} className="mr-3">
                      {section.sectionName} 
                      ({section.currentCount + getIncomingCountForSection(section.sectionId)})
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 space-y-2">
              {group.movers.map(mover => (
                <MoverAssignmentRow
                  key={mover.memberId}
                  mover={mover}
                  availableSections={availableSectionsForType}
                  availableTerms={availableTerms}
                  onAssignmentChange={onAssignmentChange}
                  onTermOverrideChange={onTermOverrideChange}
                />
              ))}
              
              {group.movers.length === 0 && (
                <div className="text-center py-4 text-amber-600">
                  No movers to {sectionType} this term
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MoversByTargetSection;