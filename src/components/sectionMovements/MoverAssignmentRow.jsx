import React from 'react';

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
    <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200 hover:border-gray-300">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm text-gray-900">
          {mover.name}
        </div>
        <div className="text-xs text-gray-500">
          DOB: {mover.birthdate ? new Date(mover.birthdate).toLocaleDateString() : 'Unknown'}
        </div>
      </div>
      
      <div className="flex items-center space-x-3 ml-4">
        <div className="text-xs text-gray-600">→</div>
        
        <div className="flex flex-col space-y-1">
          <select
            value={currentAssignment}
            onChange={handleSectionChange}
            className="text-xs border border-gray-300 rounded px-2 py-1 min-w-[120px]"
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
            className="text-xs border border-gray-300 rounded px-2 py-1 min-w-[120px]"
            title="Override term assignment"
          >
            <option value="">Auto term</option>
            {availableTerms.map(term => (
              <option key={`${term.type}-${term.year}`} value={`${term.type}-${term.year}`}>
                {term.type} {term.year}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default MoverAssignmentRow;