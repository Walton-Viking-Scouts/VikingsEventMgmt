import React, { useState, useCallback, useMemo, useEffect } from 'react';
import DraggableMover from './DraggableMover.jsx';
import SectionDropZone from './SectionDropZone.jsx';
import { safeGetItem, safeSetItem } from '../../../shared/utils/storageUtils.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

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
  const [draftSaved, setDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);

  const draftKey = useMemo(() => {
    return `viking_assignment_draft_${term.type}_${term.year}`;
  }, [term.type, term.year]);

  const unassignedMovers = useMemo(() => {
    return movers.filter(mover => !assignments.has(mover.memberId));
  }, [movers, assignments]);

  const getIncomingCountForSection = useCallback((sectionId) => {
    return Array.from(assignments.values()).filter(
      assignment => assignment.sectionId === sectionId,
    ).length;
  }, [assignments]);

  const saveDraftToStorage = useCallback(async () => {
    try {
      const draftData = {
        assignments: Array.from(assignments.entries()),
        lastSaved: new Date().toISOString(),
        term: {
          type: term.type,
          year: term.year,
        },
      };

      const success = safeSetItem(draftKey, draftData);
      
      if (success) {
        setDraftSaved(true);
        setLastSaveTime(draftData.lastSaved);
        
        logger.info('Assignment draft saved to localStorage', {
          draftKey,
          assignmentCount: assignments.size,
          termType: term.type,
          termYear: term.year,
        }, LOG_CATEGORIES.APP);
      } else {
        logger.warn('Failed to save assignment draft to localStorage', {
          draftKey,
          assignmentCount: assignments.size,
        }, LOG_CATEGORIES.ERROR);
      }
      
      return success;
    } catch (error) {
      logger.error('Error saving assignment draft', {
        error: error.message,
        draftKey,
        assignmentCount: assignments.size,
      }, LOG_CATEGORIES.ERROR);
      return false;
    }
  }, [assignments, draftKey, term]);

  const loadDraftFromStorage = useCallback(() => {
    try {
      const draftData = safeGetItem(draftKey, null);
      
      if (draftData && draftData.assignments) {
        if (draftData.term?.type === term.type && draftData.term?.year === term.year) {
          const loadedAssignments = new Map(draftData.assignments);
          setAssignments(loadedAssignments);
          setDraftSaved(true);
          setLastSaveTime(draftData.lastSaved);
          
          logger.info('Assignment draft loaded from localStorage', {
            draftKey,
            assignmentCount: loadedAssignments.size,
            lastSaved: draftData.lastSaved,
          }, LOG_CATEGORIES.APP);
          
          return loadedAssignments.size;
        } else {
          logger.info('Draft term mismatch, not loading', {
            draftTerm: draftData.term,
            currentTerm: { type: term.type, year: term.year },
          }, LOG_CATEGORIES.APP);
        }
      }
      return 0;
    } catch (error) {
      logger.error('Error loading assignment draft', {
        error: error.message,
        draftKey,
      }, LOG_CATEGORIES.ERROR);
      return 0;
    }
  }, [draftKey, term]);

  const clearDraftFromStorage = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
      setDraftSaved(false);
      setLastSaveTime(null);
      
      logger.info('Assignment draft cleared from localStorage', {
        draftKey,
      }, LOG_CATEGORIES.APP);
    } catch (error) {
      logger.error('Error clearing assignment draft', {
        error: error.message,
        draftKey,
      }, LOG_CATEGORIES.ERROR);
    }
  }, [draftKey]);

  useEffect(() => {
    loadDraftFromStorage();
  }, [loadDraftFromStorage]);

  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (assignments.size > 0) {
        saveDraftToStorage();
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [assignments.size, saveDraftToStorage]);

  useEffect(() => {
    if (assignments.size > 0) {
      setDraftSaved(false);
    }
  }, [assignments.size]);

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
        sectionId: targetSection.sectionId,
        sectionName: targetSection.sectionName,
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

  const handleSave = async () => {
    if (onSaveAssignments) {
      onSaveAssignments(Array.from(assignments.values()));
      clearDraftFromStorage();
    }
  };

  const handleReset = () => {
    setAssignments(new Map());
    clearDraftFromStorage();
    if (onResetAssignments) {
      onResetAssignments();
    }
  };

  const handleSaveDraft = async () => {
    await saveDraftToStorage();
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
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex space-x-2">
            <button
              className="inline-flex items-center justify-center rounded-md font-medium px-3 py-1.5 text-sm bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 active:bg-gray-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleReset}
              disabled={assignments.size === 0}
            >
              Reset
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md font-medium px-3 py-1.5 text-sm bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 active:bg-gray-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSaveDraft}
              disabled={assignments.size === 0}
            >
              Save Draft
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md font-medium px-3 py-1.5 text-sm bg-scout-blue text-white hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light active:bg-scout-blue-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSave}
              disabled={assignments.size === 0}
            >
              Save ({assignments.size})
            </button>
          </div>
          {(draftSaved || lastSaveTime) && (
            <div className="flex items-center text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              {draftSaved ? 'Draft saved' : `Last saved: ${new Date(lastSaveTime).toLocaleTimeString()}`}
            </div>
          )}
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
                        {mover.currentSection} → {mover.assignment.sectionName}
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