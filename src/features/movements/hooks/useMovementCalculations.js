import { useState, useMemo, useCallback } from 'react';
import { calculateSectionMovements, groupMoversByTargetSection } from '../../services/sectionMovements/movementCalculator.js';

export default function useMovementCalculations(members, termStartDate, sections = []) {
  const [assignments, setAssignments] = useState(new Map());

  const movementData = useMemo(() => {
    if (!members || !termStartDate) {
      return {
        movers: [],
        sectionSummaries: new Map(),
        moversByTarget: new Map(),
      };
    }

    const calculations = calculateSectionMovements(members, termStartDate, sections);
    const moversByTarget = groupMoversByTargetSection(calculations.movers);

    return {
      movers: calculations.movers,
      sectionSummaries: calculations.sectionSummaries,
      moversByTarget,
    };
  }, [members, termStartDate, sections]);

  const assignMemberToSection = useCallback((memberId, targetSectionId, targetSectionName) => {
    if (!memberId) return;
    
    setAssignments(prev => {
      const newAssignments = new Map(prev);
      newAssignments.set(memberId, {
        sectionId: targetSectionId,
        sectionName: targetSectionName,
      });
      return newAssignments;
    });
  }, []);

  const unassignMember = useCallback((memberId) => {
    if (!memberId) return;
    
    setAssignments(prev => {
      const newAssignments = new Map(prev);
      newAssignments.delete(memberId);
      return newAssignments;
    });
  }, []);

  const resetAssignments = useCallback(() => {
    setAssignments(new Map());
  }, []);

  const getAssignedMovers = useCallback(() => {
    return movementData.movers.map(mover => ({
      ...mover,
      assignedSection: assignments.get(mover.memberId)?.sectionName || null,
      assignedSectionId: assignments.get(mover.memberId)?.sectionId || null,
    }));
  }, [movementData.movers, assignments]);

  const getUnassignedMovers = useCallback(() => {
    return movementData.movers.filter(mover => !assignments.has(mover.memberId));
  }, [movementData.movers, assignments]);

  return {
    movers: movementData.movers,
    sectionSummaries: movementData.sectionSummaries,
    moversByTarget: movementData.moversByTarget,
    assignments,
    assignMemberToSection,
    unassignMember,
    resetAssignments,
    getAssignedMovers,
    getUnassignedMovers,
  };
}