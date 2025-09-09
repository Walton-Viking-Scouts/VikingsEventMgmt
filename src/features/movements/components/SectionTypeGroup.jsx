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
  sectionTypeTotals,
  onAssignmentChange,
  onTermOverrideChange,
  onSaveAssignments,
  onResetAssignments,
  isSaving = false,
}) {
  const typeKey = mapSectionType(sectionType);
  const incomingMovers = movers.filter(mover => 
    mapSectionType(mover.targetSection) === typeKey,
  );

  const availableSectionsForType = allSections.filter(section => {
    const sectionTypeKey = mapSectionType(section.sectionType);
    const nameBasedTypeKey = mapSectionType(getSectionTypeFromName(section.sectionName));
    return sectionTypeKey === typeKey || nameBasedTypeKey === typeKey;
  });



  const assignmentsForThisType = incomingMovers.filter(mover => 
    assignments.has(mover.memberId),
  );

  // Use passed section type totals or fallback to calculation
  const sectionTotals = sectionTypeTotals?.get(sectionType) ?? sectionTypeTotals?.get(typeKey);
  const startingCount = sectionTotals?.startingCount ?? group.sections.reduce((total, section) => {
    return total + (section.cumulativeCurrentCount ?? (Array.isArray(section.currentMembers) ? section.currentMembers.length : 0));
  }, 0);
  const incomingCount = sectionTotals?.incomingCount ?? incomingMovers.length;
  const outgoingCount = sectionTotals?.outgoingCount ?? group.totalOutgoing;
  const plannedCount = sectionTotals?.plannedCount ?? (startingCount + incomingCount - outgoingCount);

  return (
    <div className="mb-6">
      <div className="bg-white p-3 rounded-t-lg border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {sectionType}
            </h3>
            <div className="text-sm text-gray-600 mt-1">
              <div className="flex flex-wrap gap-4">
                <span>
                  Starting: {startingCount}
                </span>
                {incomingCount > 0 && (
                  <span>
                    ↑ {incomingCount} incoming
                  </span>
                )}
                {outgoingCount > 0 && (
                  <span>
                    ↓ {outgoingCount} moving up
                  </span>
                )}
                <span className="font-medium">
                  Planned: {plannedCount}
                </span>
              </div>
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
        {/* Section cards with flexible layout */}
        <div className="flex flex-wrap gap-3 mb-4">
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
          
          {/* Assignment interface card */}
          {showAssignmentInterface && incomingMovers.length > 0 && (
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 min-w-[475px]">
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
    </div>
  );
}

export default SectionTypeGroup;