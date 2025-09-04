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
  if (!Array.isArray(members)) {
    throw new Error('Members must be an array');
  }
  if (!termStartDate || typeof termStartDate !== 'string') {
    throw new Error('Valid termStartDate (string) is required');
  }
  if (!Array.isArray(sections)) {
    sections = [];
  }

  ageCalculationCache.clear();

  const movementResults = {
    movers: [],
    sectionSummaries: new Map(),
  };

  const sectionLookup = new Map();
  sections.forEach(section => {
    if (section?.sectionid && section?.sectionname) {
      sectionLookup.set(section.sectionid, section.sectionname);
    }
  });

  // FlexiRecords only contain young people, so no filtering needed
  const youngPeople = members;

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
    if (!member) return;
    
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
      memberId: member.member_id || member.scoutid || null,
      name: `${member.first_name || member.firstname || ''} ${member.last_name || member.lastname || ''}`.trim() || 'Unknown Member',
      birthdate: member.date_of_birth || member.dob || null,
      currentSection: sectionName,
      currentSectionId: sectionId || null,
      age: ageAtTermStart,
      ageAtTermStart,
      shouldMove,
      targetSection,
      assignedSection: null, // Only set by manual assignment interface
      assignedSectionId: null,
      // Include FlexiRecord data separately
      flexiRecordTerm: assignedTerm || null,
      flexiRecordSection: assignedSection || null,
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
  if (!currentSectionName || typeof currentSectionName !== 'string') {
    return null;
  }
  
  const normalized = currentSectionName.toLowerCase().trim();
  
  if (normalized.includes('squirrel')) return 'Beavers';
  if (normalized.includes('beaver')) return 'Cubs';
  if (normalized.includes('cub')) return 'Scouts';
  if (normalized.includes('scout') && !normalized.includes('cub')) return 'Explorers';
  
  return null;
}

export function groupMoversByTargetSection(movers) {
  if (!Array.isArray(movers)) {
    return new Map();
  }
  
  const grouped = new Map();
  
  movers.forEach(mover => {
    if (!mover) return;
    
    const target = mover.targetSection;
    if (!target || typeof target !== 'string') return;
    
    if (!grouped.has(target)) {
      grouped.set(target, []);
    }
    grouped.get(target).push(mover);
  });
  
  return grouped;
}

export { getTargetSection };