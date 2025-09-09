import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { groupSectionsByType } from '../../../shared/utils/sectionMovements/sectionGrouping.js';

function getSectionTypeFromName(sectionName) {
  if (!sectionName) return null;
  
  const normalized = sectionName.toLowerCase();
  
  if (normalized.includes('squirrel')) return 'Squirrels';
  if (normalized.includes('beaver')) return 'Beavers';
  if (normalized.includes('cub')) return 'Cubs';
  if (normalized.includes('scout') && !normalized.includes('cub')) return 'Scouts';
  if (normalized.includes('explorer')) return 'Explorers';
  
  return null;
}

function renderSectionTypeRows(sectionType, termCalculations, sectionsData, assignments, unassignedCounts) {
  const firstTermGrouped = groupSectionsByType(termCalculations[0]?.sectionSummaries, sectionsData || []);
  const firstTermGroup = firstTermGrouped.get(sectionType);
  if (!firstTermGroup) return null;
  
  const rows = [];
  
  firstTermGroup.sections.forEach(section => {
    rows.push(
      <tr key={`${section.sectionId}`} className="border-b">
        <td className="py-2 px-4 pl-8 text-gray-700">
          {section.sectionName}
        </td>
        {termCalculations.map((termData, termIndex) => {
          const sectionSummary = termData.sectionSummaries.get(section.sectionId);
            
          if (!sectionSummary) {
            return (
              <td key={termIndex} className="py-2 px-4 text-center text-gray-500">
                  -
              </td>
            );
          }
            
          const currentCount = sectionSummary.cumulativeCurrentCount || sectionSummary.currentMembers.length;
          const outgoingCount = sectionSummary.outgoingMovers.length;
            
          const sectionAssignments = assignments ? termData.movers.filter(mover => {
            const assignment = assignments.get(mover.memberId);
            return assignment && String(assignment.sectionId) === String(section.sectionId);
          }).length : 0;
            
          const plannedCount = currentCount + sectionAssignments - outgoingCount;
            
          return (
            <td key={termIndex} className="py-2 px-4 text-center">
              <div className="text-xs flex items-center justify-center space-x-1">
                <span className="text-gray-600">Current: {currentCount}</span>
                <span className={sectionAssignments > 0 ? 'text-green-500' : 'text-gray-400'}>↑{sectionAssignments}</span>
                <span className={outgoingCount > 0 ? 'text-orange-500' : 'text-gray-400'}>↓{outgoingCount}</span>
                <span className="font-medium text-gray-800">Planned: {plannedCount}</span>
              </div>
            </td>
          );
        })}
      </tr>,
    );
  });
    
  rows.push(
    <tr key={`unassigned-${sectionType}`} className="border-b bg-amber-50">
      <td className="py-2 px-4 pl-8 text-amber-800 italic">
          Unassigned
      </td>
      {termCalculations.map((termData, termIndex) => {
        const unassignedCount = unassignedCounts.get(`${sectionType}-${termIndex}`) || 0;
          
        return (
          <td key={termIndex} className="py-2 px-4 text-center">
            <div className="text-xs flex items-center justify-center">
              {unassignedCount > 0 ? (
                <span className="text-amber-600">↑{unassignedCount} incoming</span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          </td>
        );
      })}
    </tr>,
  );
    
  return rows;
}

function MovementSummaryTable({ termCalculations, assignments, sectionsData }) {
  const allSectionTypes = useMemo(() => ['Squirrels', 'Beavers', 'Cubs', 'Scouts', 'Explorers'], []);
  
  // Pre-calculate unassigned counts for performance (avoid repeated filtering in render)
  const unassignedCounts = useMemo(() => {
    if (!termCalculations || termCalculations.length === 0 || !assignments) return new Map();
    
    const counts = new Map();
    
    termCalculations.forEach((termData, termIndex) => {
      allSectionTypes.forEach(sectionType => {
        // Calculate unassigned movers for this section type
        const incomingMovers = termData.movers.filter(mover => {
          const targetSectionType = mover.targetSection?.toLowerCase();
          return targetSectionType === sectionType.toLowerCase();
        });
        
        // Count how many are assigned to specific sections of this type
        const assignedCount = incomingMovers.filter(mover => {
          const assignment = assignments.get(mover.memberId);
          if (!assignment) return false;
          
          // Check if the assignment is for a section of this type
          const assignedSection = sectionsData?.find(s => 
            String(s.sectionId || s.sectionid) === String(assignment.sectionId),
          );
          if (!assignedSection) return false;
          
          // Get the section type from the assigned section
          const assignedSectionName = assignedSection.sectionname || assignedSection.name || '';
          const assignedSectionType = getSectionTypeFromName(assignedSectionName);
          return assignedSectionType?.toLowerCase() === sectionType.toLowerCase();
        }).length;
        
        const unassignedCount = Math.max(0, incomingMovers.length - assignedCount);
        counts.set(`${sectionType}-${termIndex}`, unassignedCount);
      });
    });
    
    return counts;
  }, [termCalculations, assignments, sectionsData, allSectionTypes]);

  if (!termCalculations || termCalculations.length === 0) {
    return null;
  }
  
  // Calculate section type totals across all terms to handle cascading
  const sectionTypeTotals = new Map();
  
  // Initialize starting counts for first term
  termCalculations.forEach((termData, termIndex) => {
    const groupedSections = groupSectionsByType(termData.sectionSummaries, sectionsData || []);
    
    allSectionTypes.forEach(sectionType => {
      const group = groupedSections.get(sectionType);
      if (!group) return;
      
      let startingCount;
      if (termIndex === 0) {
        // First term: use actual current members count
        startingCount = group.sections.reduce((total, section) => {
          return total + (section.cumulativeCurrentCount || section.currentMembers.length);
        }, 0);
      } else {
        // Subsequent terms: use planned count from previous term
        const prevTermKey = `${sectionType}-${termIndex - 1}`;
        startingCount = sectionTypeTotals.get(prevTermKey)?.plannedCount || 0;
      }
      
      const incomingCount = termData.movers.filter(mover => {
        const targetSectionType = mover.targetSection?.toLowerCase();
        return targetSectionType === sectionType.toLowerCase();
      }).length;
      
      const outgoingCount = group.totalOutgoing;
      const plannedCount = startingCount + incomingCount - outgoingCount;
      
      // Store the calculated totals for this term
      const termKey = `${sectionType}-${termIndex}`;
      sectionTypeTotals.set(termKey, {
        startingCount,
        incomingCount,
        outgoingCount,
        plannedCount,
      });
    });
  });

  return (
    <div className="mb-6">
      <div className="bg-gray-100 p-3 rounded-t-lg border-b">
        <h2 className="text-lg font-semibold text-gray-800">
          Movement Summary by Term
        </h2>
      </div>
      
      <div className="bg-white rounded-b-lg border border-t-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-900">
                Section
              </th>
              {termCalculations.map(termData => (
                <th key={`${termData.term.type}-${termData.term.year}`} className="text-center py-3 px-4 font-medium text-gray-900 min-w-40">
                  {termData.term.displayName || `${termData.term.type} ${termData.term.year}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allSectionTypes.map(sectionType => {
              // Check if this section type has any data across terms
              const hasData = termCalculations.some((termData) => {
                const groupedSections = groupSectionsByType(termData.sectionSummaries, sectionsData || []);
                return groupedSections.has(sectionType);
              });
              
              if (!hasData) return null;
              
              return (
                <React.Fragment key={sectionType}>
                  {/* Section Type Header Row */}
                  <tr className="border-b bg-blue-50">
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {sectionType}
                    </td>
                    {termCalculations.map((termData, termIndex) => {
                      const termKey = `${sectionType}-${termIndex}`;
                      const totals = sectionTypeTotals.get(termKey);
                      
                      if (!totals) {
                        return (
                          <td key={termIndex} className="py-3 px-4 text-center text-gray-500">
                            -
                          </td>
                        );
                      }
                      
                      const { startingCount, incomingCount, outgoingCount, plannedCount } = totals;
                      
                      return (
                        <td key={termIndex} className="py-2 px-4 text-center">
                          <div className="text-xs flex items-center justify-center space-x-1">
                            <span className="text-gray-700">Current: {startingCount}</span>
                            <span className={incomingCount > 0 ? 'text-green-600' : 'text-gray-400'}>↑{incomingCount}</span>
                            <span className={outgoingCount > 0 ? 'text-orange-600' : 'text-gray-400'}>↓{outgoingCount}</span>
                            <span className="font-medium text-blue-700">Planned: {plannedCount}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  
                  {/* Individual Section Rows */}
                  {renderSectionTypeRows(sectionType, termCalculations, sectionsData, assignments, unassignedCounts)}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

MovementSummaryTable.propTypes = {
  termCalculations: PropTypes.arrayOf(PropTypes.shape({
    term: PropTypes.shape({
      type: PropTypes.string.isRequired,
      year: PropTypes.number.isRequired,
      displayName: PropTypes.string,
    }).isRequired,
    sectionSummaries: PropTypes.instanceOf(Map).isRequired,
    movers: PropTypes.arrayOf(PropTypes.object).isRequired,
  })).isRequired,
  assignments: PropTypes.instanceOf(Map),
  sectionsData: PropTypes.arrayOf(PropTypes.shape({
    sectionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sectionid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sectionName: PropTypes.string,
    sectionname: PropTypes.string,
    name: PropTypes.string,
  })),
};

export default MovementSummaryTable;