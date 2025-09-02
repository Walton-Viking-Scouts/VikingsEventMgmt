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

export function calculateSectionMovements(members, termStartDate, sections = []) {
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
    if (member.person_type !== 'Young People') return false;
    
    const sectionId = member.section_id || member.sectionid;
    const section = sections.find(s => s.sectionid === sectionId);
    if (!section) return true;
    
    return section.sectiontype !== 'adults' && section.sectiontype !== 'waiting';
  });

  console.log('Total members received:', members.length);
  console.log('Sections received:', sections.length);
  console.log('Filtered young people:', youngPeople.length);
  console.log('Sections lookup:', sectionLookup);
  if (members.length > 0) {
    console.log('First member structure:', members[0]);
  }
  
  youngPeople.forEach(member => {
    if (member === youngPeople[0]) {
      console.log('First filtered member data:', member);
    }
    
    const sectionId = member.section_id || member.sectionid;
    const sectionName = sectionLookup.get(sectionId) || member.sectionname || 'Unknown Section';
    
    const memberWithSection = {
      ...member,
      sectionname: sectionName,
      currentSection: sectionName
    };
    
    const shouldMove = willMemberMoveUp(memberWithSection, termStartDate);
    const birthdate = member.date_of_birth || member.dob;
    const ageAtTermStart = birthdate 
      ? getCachedAge(birthdate, termStartDate)
      : null;
    
    const memberMovement = {
      memberId: member.member_id || member.scoutid,
      name: `${member.first_name || member.firstname} ${member.last_name || member.lastname}`,
      birthdate: member.date_of_birth || member.dob,
      currentSection: sectionName,
      currentSectionId: sectionId,
      age: ageAtTermStart,
      ageAtTermStart,
      shouldMove,
      targetSection: shouldMove ? getTargetSection(sectionName) : null,
      assignedSection: null,
      assignedSectionId: null,
    };

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