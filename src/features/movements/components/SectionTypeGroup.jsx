import React from 'react';
import SectionMovementCard from './SectionMovementCard.jsx';
import MoverAssignmentRow from './MoverAssignmentRow.jsx';
import { mapSectionType } from '../../../shared/utils/sectionMovements/sectionGrouping.js';
import { Button } from '../../../shared/components/ui';

function getSectionTypeFromName(sectionName) {
  if (!sectionName) return null;
  
  const normalized = sectionName.toLowerCase();
  
  if (normalized.includes('squirrel') || normalized.includes('early')) return 'squirrels';
  if (normalized.includes('beaver')) return 'beavers';
  if (normalized.includes('cub')) return 'cubs';
  if (normalized.includes('scout')) return 'scouts';
  if (normalized.includes('explorer')) return 'explorers';
  
  return null;
}

function SectionTypeGroup({ 
  sectionType, 
  group, 
  movers, 
  showAssignmentInterface = false,
  allSections = [],
  availableTerms = [],
  assignments = new Map(),
  currentTerm,
  onAssignmentChange,
  onTermOverrideChange,
  onSaveAssignments,
  onResetAssignments,
  isSaving = false,
}) {
  const incomingMovers = movers.filter(mover => {
    const targetSectionType = mapSectionType(mover.targetSection?.toLowerCase());
    return targetSectionType === sectionType;
  });

  const availableSectionsForType = allSections.filter(section => {
    const sectionSectionType = mapSectionType(section.sectionType?.toLowerCase() || '');
    const nameBasedTypeRaw = getSectionTypeFromName(section.sectionName);
    const nameBasedType = mapSectionType(nameBasedTypeRaw);
    return sectionSectionType === sectionType || nameBasedType === sectionType;
  });



  const assignmentsForThisType = incomingMovers.filter(mover => 
    assignments.has(mover.memberId),
  );


  return (
    <div className="mb-6">
      <div className="bg-gray-100 p-3 rounded-t-lg border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {sectionType}
            </h3>
            <div className="text-sm text-gray-600 mt-1">
              {incomingMovers.length > 0 && (
                <span className="mr-4">
                  ↑ {incomingMovers.length} incoming
                </span>
              )}
              {group.totalOutgoing > 0 && (
                <span>
                  ↓ {group.totalOutgoing} moving up
                </span>
              )}
            </div>
          </div>
          
          {incomingMovers.length > 0 && (
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onResetAssignments}
                disabled={assignmentsForThisType.length === 0}
              >
                Reset
              </Button>
              <Button 
                variant="scout-blue" 
                size="sm" 
                onClick={onSaveAssignments}
                disabled={assignmentsForThisType.length === 0 || isSaving}
              >
                {isSaving ? 'Saving...' : `Save (${assignmentsForThisType.length})`}
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white rounded-b-lg border border-t-0 p-4">
        {/* Section cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {group.sections.map(summary => {
            const sectionData = allSections.find(s => s.sectionId === summary.sectionId);
            const incomingCount = sectionData?.incomingCount || 0;
            return (
              <SectionMovementCard
                key={summary.sectionId}
                sectionName={summary.sectionName}
                currentCount={summary.cumulativeCurrentCount || summary.currentMembers.length}
                outgoingMovers={summary.outgoingMovers}
                remainingCount={summary.remainingCount}
                incomingCount={incomingCount}
              />
            );
          })}
        </div>
        
        {/* Assignment interface - separate from grid to allow natural sizing */}
        {showAssignmentInterface && incomingMovers.length > 0 && (
          <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 w-fit max-w-4xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-amber-900">
                Moving to {sectionType}
              </h4>
              <div className="text-sm text-amber-700">
                {incomingMovers.filter(m => assignments.has(m.memberId)).length}/{incomingMovers.length} assigned
              </div>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {incomingMovers.map(mover => (
                <MoverAssignmentRow
                  key={mover.memberId}
                  mover={{
                    ...mover,
                    assignedSectionId: assignments.get(mover.memberId)?.sectionId || null,
                    assignedTerm: assignments.get(mover.memberId)?.term || mover.flexiRecordTerm || `${currentTerm?.type}-${currentTerm?.year}`,
                  }}
                  availableSections={availableSectionsForType}
                  availableTerms={availableTerms}
                  onAssignmentChange={onAssignmentChange}
                  onTermOverrideChange={onTermOverrideChange}
                />
              ))}
              
              {incomingMovers.length === 0 && (
                <div className="text-center py-4 text-amber-600">
                  No movers to {sectionType} this term
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SectionTypeGroup;