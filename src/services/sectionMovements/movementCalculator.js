import { calculateAgeAtDate, willMemberMoveUp } from '../../utils/sectionMovements/ageCalculations.js';

const ageCalculationCache = new Map();

function getCachedAge(birthdate, termStartDate) {
  const key = `${birthdate}-${termStartDate}`;
  if (ageCalculationCache.has(key)) {
    return ageCalculationCache.get(key);
  }
  
  const age = calculateAgeAtDate(birthdate, termStartDate);
  ageCalculationCache.set(key, age);
  return age;
}

export function calculateSectionMovements(members, termStartDate, sections = [], termObject = null) {
  if (!Array.isArray(members) || !termStartDate) {
    throw new Error('Members array and term start date are required');
  }

  ageCalculationCache.clear();

  const movementResults = {
    movers: [],
    sectionSummaries: new Map(),
  };

  const sectionLookup = new Map();
  sections.forEach(section => {
    sectionLookup.set(section.sectionid, section.sectionname);
  });

  const youngPeople = members.filter(member => {
    const sectionId = member.section_id || member.sectionid;
    const section = sections.find(s => s.sectionid === sectionId);
    if (!section) return true;
    
    return section.sectiontype !== 'adults' && section.sectiontype !== 'waiting';
  });

  // Use term object if provided, otherwise derive from date
  let termBeingDisplayed;
  if (termObject) {
    termBeingDisplayed = `${termObject.type}-${termObject.year}`;
  } else {
    const date = new Date(termStartDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    if (month >= 0 && month <= 3) termBeingDisplayed = `Spring-${year}`;
    else if (month >= 4 && month <= 7) termBeingDisplayed = `Summer-${year}`;
    else termBeingDisplayed = `Autumn-${year}`;
  }
  
  youngPeople.forEach(member => {
    const sectionId = member.section_id || member.sectionid;
    const sectionName = sectionLookup.get(sectionId) || member.sectionname || 'Unknown Section';
    
    const memberWithSection = {
      ...member,
      sectionname: sectionName,
      currentSection: sectionName,
    };
    
    const birthdate = member.date_of_birth || member.dob;
    const ageAtTermStart = birthdate 
      ? getCachedAge(birthdate, termStartDate)
      : null;

    // Check for FlexiRecord assignments
    const assignedTerm = member.AssignedTerm || member.assignedTerm;
    const assignedSection = member.AssignedSection || member.assignedSection;
    
    let shouldMove = false;
    let targetSection = null;
    
    if (assignedTerm) {
      // Member has FlexiRecord assignment - use it as source of truth
      if (assignedTerm === termBeingDisplayed) {
        // Member is assigned to move in this term
        shouldMove = true;
        // assignedSection is the specific section name (e.g., "Thursday Cubs")
        // If "Not Known", we know the section type but need to assign specific section
        // So we use the age-based target section type for filtering
        targetSection = getTargetSection(sectionName);
      }
      // If assignedTerm !== termBeingDisplayed, they don't move in this term
    } else {
      // No FlexiRecord assignment - fall back to age-based calculation
      shouldMove = willMemberMoveUp(memberWithSection, termStartDate);
      targetSection = shouldMove ? getTargetSection(sectionName) : null;
    }
    
    const memberMovement = {
      memberId: member.member_id || member.scoutid,
      name: `${member.first_name || member.firstname} ${member.last_name || member.lastname}`,
      birthdate: member.date_of_birth || member.dob,
      currentSection: sectionName,
      currentSectionId: sectionId,
      age: ageAtTermStart,
      ageAtTermStart,
      shouldMove,
      targetSection,
      assignedSection: null, // Only set by manual assignment interface
      assignedSectionId: null,
      // Include FlexiRecord data separately
      flexiRecordTerm: assignedTerm,
      flexiRecordSection: assignedSection,
    };

    // Add to movers list if they're actually moving sections
    if (shouldMove) {
      movementResults.movers.push(memberMovement);
    }

    if (!movementResults.sectionSummaries.has(sectionId)) {
      movementResults.sectionSummaries.set(sectionId, {
        sectionId,
        sectionName,
        currentMembers: [],
        outgoingMovers: [],
        incomingMovers: [],
        remainingCount: 0,
        projectedCount: 0,
      });
    }

    const sectionSummary = movementResults.sectionSummaries.get(sectionId);
    sectionSummary.currentMembers.push(memberMovement);
    
    if (shouldMove) {
      sectionSummary.outgoingMovers.push(memberMovement);
    }
  });

  movementResults.sectionSummaries.forEach(summary => {
    summary.remainingCount = summary.currentMembers.length - summary.outgoingMovers.length;
    summary.projectedCount = summary.remainingCount + summary.incomingMovers.length;
  });

  return movementResults;
}

function getTargetSection(currentSectionName) {
  if (!currentSectionName) return null;
  
  const normalized = currentSectionName.toLowerCase();
  
  if (normalized.includes('squirrel')) return 'Beavers';
  if (normalized.includes('beaver')) return 'Cubs';
  if (normalized.includes('cub')) return 'Scouts';
  if (normalized.includes('scout') && !normalized.includes('cub')) return 'Explorers';
  
  return null;
}

export function groupMoversByTargetSection(movers) {
  const grouped = new Map();
  
  movers.forEach(mover => {
    const target = mover.targetSection;
    if (!target) return;
    
    if (!grouped.has(target)) {
      grouped.set(target, []);
    }
    grouped.get(target).push(mover);
  });
  
  return grouped;
}

export { getTargetSection };