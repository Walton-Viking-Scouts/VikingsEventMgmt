import React, { useState, useCallback, useMemo } from 'react';
import DraggableMover from './DraggableMover.jsx';
import SectionDropZone from './SectionDropZone.jsx';
import { Button } from '../ui';

function AssignmentInterface({
  term,
  movers,
  availableSections,
  onAssignmentChange,
  onSaveAssignments,
  onResetAssignments,
}) {
  const [assignments, setAssignments] = useState(new Map());
  const [isDragInProgress, setIsDragInProgress] = useState(false);
  const [draggingMoverId, setDraggingMoverId] = useState(null);

  const unassignedMovers = useMemo(() => {
    return movers.filter(mover => !assignments.has(mover.memberId));
  }, [movers, assignments]);

  const getIncomingCountForSection = useCallback((sectionId) => {
    return Array.from(assignments.values()).filter(
      assignment => assignment.targetSectionId === sectionId
    ).length;
  }, [assignments]);

  const handleDragStart = useCallback((dragData) => {
    setIsDragInProgress(true);
    setDraggingMoverId(dragData.moverId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragInProgress(false);
    setDraggingMoverId(null);
  }, []);

  const handleMoverDrop = useCallback(async (dragData, targetSection) => {
    try {
      const newAssignment = {
        moverId: dragData.moverId,
        moverName: dragData.moverName,
        currentSectionId: dragData.currentSectionId,
        targetSectionId: targetSection.sectionId,
        targetSectionName: targetSection.sectionName,
        term: term.type,
        termYear: term.year,
        assignedAt: new Date().toISOString(),
      };

      setAssignments(prev => {
        const updated = new Map(prev);
        updated.set(dragData.moverId, newAssignment);
        return updated;
      });

      if (onAssignmentChange) {
        onAssignmentChange(newAssignment, 'add');
      }
    } catch (error) {
      console.error('Error handling mover drop:', error);
    }
  }, [term, onAssignmentChange]);

  const handleRemoveAssignment = useCallback((moverId) => {
    const assignment = assignments.get(moverId);
    if (assignment) {
      setAssignments(prev => {
        const updated = new Map(prev);
        updated.delete(moverId);
        return updated;
      });

      if (onAssignmentChange) {
        onAssignmentChange(assignment, 'remove');
      }
    }
  }, [assignments, onAssignmentChange]);

  const handleSave = () => {
    if (onSaveAssignments) {
      onSaveAssignments(Array.from(assignments.values()));
    }
  };

  const handleReset = () => {
    setAssignments(new Map());
    if (onResetAssignments) {
      onResetAssignments();
    }
  };

  const assignedMovers = useMemo(() => {
    return movers.filter(mover => assignments.has(mover.memberId))
      .map(mover => ({
        ...mover,
        assignment: assignments.get(mover.memberId),
      }));
  }, [movers, assignments]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Assign Movers for {term.type} {term.year}
        </h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReset}
            disabled={assignments.size === 0}
          >
            Reset
          </Button>
          <Button 
            variant="scout-blue" 
            size="sm" 
            onClick={handleSave}
            disabled={assignments.size === 0}
          >
            Save ({assignments.size})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h4 className="font-medium text-amber-900 mb-3">
              Unassigned Movers ({unassignedMovers.length})
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {unassignedMovers.map(mover => (
                <DraggableMover
                  key={mover.memberId}
                  mover={mover}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingMoverId === mover.memberId}
                />
              ))}
              {unassignedMovers.length === 0 && (
                <div className="text-center py-4 text-amber-700">
                  All movers have been assigned
                </div>
              )}
            </div>
          </div>

          {assignedMovers.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-900 mb-3">
                Assigned Movers ({assignedMovers.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {assignedMovers.map(mover => (
                  <div 
                    key={mover.memberId}
                    className="flex items-center justify-between p-2 bg-white rounded border border-green-300"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {mover.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {mover.currentSection} → {mover.assignment.targetSectionName}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAssignment(mover.memberId)}
                      className="text-red-600 hover:text-red-800 text-xs ml-2"
                      title="Remove assignment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">
            Available Sections
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableSections.map(section => (
              <SectionDropZone
                key={section.sectionId}
                sectionData={section}
                currentCount={section.currentCount || 0}
                incomingCount={getIncomingCountForSection(section.sectionId)}
                maxCapacity={section.maxCapacity}
                onMoverDrop={handleMoverDrop}
                isDragInProgress={isDragInProgress}
                canAcceptDrop={true}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssignmentInterface;