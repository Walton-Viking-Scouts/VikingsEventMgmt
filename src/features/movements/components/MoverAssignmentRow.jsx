import React from 'react';

/**
 * Mover assignment row component for managing individual mover assignments
 * @param {object} props - Component props
 * @param {object} props.mover - Mover data object
 * @param {Array} props.availableSections - Available sections for assignment
 * @param {Array} props.availableTerms - Available terms for assignment
 * @param {Function} props.onAssignmentChange - Assignment change handler
 * @param {Function} props.onTermOverrideChange - Term override change handler
 * @returns {JSX.Element} Mover assignment row component
 */
function MoverAssignmentRow({
  mover,
  availableSections,
  availableTerms,
  onAssignmentChange,
  onTermOverrideChange,
}) {
  const currentAssignment = mover.assignedSectionId || '';
  const currentTermOverride = mover.assignedTerm || '';

  const handleSectionChange = (e) => {
    const sectionId = e.target.value;
    const targetSection = availableSections.find(s => s.sectionId === sectionId);
    
    if (onAssignmentChange) {
      onAssignmentChange(mover.memberId, {
        memberId: mover.memberId,
        currentSectionId: mover.currentSectionId,
        sectionId: sectionId || null,
        sectionName: targetSection?.sectionName || null,
      });
    }
  };

  const handleTermChange = (e) => {
    const termValue = e.target.value;
    
    if (onTermOverrideChange) {
      onTermOverrideChange(mover.memberId, termValue || null);
    }
  };

  return (
    <div className="p-2 bg-white rounded border border-gray-200 hover:border-gray-300">
      {/* Mobile Layout */}
      <div className="md:hidden space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-medium text-sm text-gray-900">
              {mover.name} <span className="text-xs text-gray-500 font-normal">
                ({mover.birthdate ? new Date(mover.birthdate).toLocaleDateString() : 'Unknown'})
              </span>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 min-w-[60px]">Section:</span>
            <select
              value={currentAssignment}
              onChange={handleSectionChange}
              className="text-xs border border-gray-300 rounded px-2 py-1 flex-1"
            >
              <option value="">Select section...</option>
              {availableSections.map(section => (
                <option key={section.sectionId} value={section.sectionId}>
                  {section.sectionName}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 min-w-[60px]">Term:</span>
            <select
              value={currentTermOverride}
              onChange={handleTermChange}
              className="text-xs border border-gray-300 rounded px-2 py-1 flex-1"
              title="Override term assignment"
            >
              {availableTerms.map(term => (
                <option key={`${term.type}-${term.year}`} value={`${term.type}-${term.year}`}>
                  {term.type} {term.year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Desktop Layout */}
      <div className="hidden md:grid grid-cols-[130px_8px_140px_100px] gap-2 items-center">
        <div className="min-w-0">
          <div className="font-medium text-xs text-gray-900 leading-tight" title={mover.name}>
            {mover.name} <span className="text-xs text-gray-500 font-normal">
              ({mover.birthdate ? new Date(mover.birthdate).toLocaleDateString() : 'Unknown'})
            </span>
          </div>
        </div>
        
        <div className="text-xs text-gray-600 text-center flex-shrink-0">→</div>
        
        <select
          value={currentAssignment}
          onChange={handleSectionChange}
          className="text-xs border border-gray-300 rounded px-1 py-1 w-full min-w-[120px]"
        >
          <option value="">Select section...</option>
          {availableSections.map(section => (
            <option key={section.sectionId} value={section.sectionId}>
              {section.sectionName}
            </option>
          ))}
        </select>
        
        <select
          value={currentTermOverride}
          onChange={handleTermChange}
          className="text-xs border border-gray-300 rounded px-1 py-1 w-full min-w-[90px]"
          title="Override term assignment"
        >
          {availableTerms.map(term => (
            <option key={`${term.type}-${term.year}`} value={`${term.type}-${term.year}`}>
              {term.type} {term.year}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default MoverAssignmentRow;