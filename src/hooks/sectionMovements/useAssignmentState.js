import { useState, useCallback } from 'react';

export default function useAssignmentState() {
  const [assignments, setAssignments] = useState(new Map());
  const [isDraft, setIsDraft] = useState(false);

  const assignMember = useCallback((memberId, sectionId, sectionName) => {
    setAssignments(prev => {
      const newAssignments = new Map(prev);
      newAssignments.set(memberId, {
        sectionId,
        sectionName,
        assignedAt: new Date().toISOString(),
      });
      return newAssignments;
    });
    setIsDraft(true);
  }, []);

  const unassignMember = useCallback((memberId) => {
    setAssignments(prev => {
      const newAssignments = new Map(prev);
      newAssignments.delete(memberId);
      return newAssignments;
    });
    setIsDraft(true);
  }, []);

  const resetAssignments = useCallback(() => {
    setAssignments(new Map());
    setIsDraft(false);
  }, []);

  const getAssignment = useCallback((memberId) => {
    return assignments.get(memberId) || null;
  }, [assignments]);

  const getAllAssignments = useCallback(() => {
    return Array.from(assignments.entries()).map(([memberId, assignment]) => ({
      memberId,
      ...assignment,
    }));
  }, [assignments]);

  const getAssignmentsBySection = useCallback((sectionId) => {
    return Array.from(assignments.entries())
      .filter(([, assignment]) => assignment.sectionId === sectionId)
      .map(([memberId, assignment]) => ({
        memberId,
        ...assignment,
      }));
  }, [assignments]);

  const markAsSaved = useCallback(() => {
    setIsDraft(false);
  }, []);

  return {
    assignments,
    isDraft,
    assignMember,
    unassignMember,
    resetAssignments,
    getAssignment,
    getAllAssignments,
    getAssignmentsBySection,
    markAsSaved,
  };
}