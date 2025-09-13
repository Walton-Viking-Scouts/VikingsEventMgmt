/**
 * @file Section Movement Calculator
 * 
 * Calculates Scout section movements between terms based on age, FlexiRecord assignments,
 * and section progression rules. Provides comprehensive movement analysis including
 * member transfers, section summaries, and projected counts after movements.
 * 
 * Features:
 * - Age-based movement calculation with caching
 * - FlexiRecord assignment integration
 * - Section-to-section progression mapping
 * - Batch movement analysis with summaries
 * - Support for demo and production data
 * 
 * @module movementCalculator
 * @version 2.3.7
 * @since 2.3.7
 * @author Vikings Event Management Team
 */

import { calculateAgeAtDate, willMemberMoveUp } from '../../../shared/utils/sectionMovements/ageCalculations.js';

const ageCalculationCache = new Map();

/**
 * Get cached age calculation with memoization
 * 
 * Calculates member age at term start date with caching to improve performance
 * when processing large member lists. Uses birthdate and term date as cache key.
 * 
 * @param {string} birthdate - Member's date of birth in ISO format (YYYY-MM-DD)
 * @param {string} termStartDate - Term start date in ISO format (YYYY-MM-DD)
 * @returns {number|null} Age in years at term start date, null if calculation fails
 * 
 * @example
 * // Calculate age for movement analysis
 * const age = getCachedAge('2010-05-15', '2024-09-01');
 * console.log(`Member will be ${age} years old at term start`);
 * 
 * @example
 * // Cached calculation for performance
 * const ages = members.map(member => 
 *   getCachedAge(member.birthdate, termDate)
 * );
 * 
 * @private
 * @since 2.3.7
 */
function getCachedAge(birthdate, termStartDate) {
  const key = `${birthdate}-${termStartDate}`;
  if (ageCalculationCache.has(key)) {
    return ageCalculationCache.get(key);
  }
  
  const age = calculateAgeAtDate(birthdate, termStartDate);
  ageCalculationCache.set(key, age);
  return age;
}

/**
 * Calculate comprehensive section movements for a term
 * 
 * Analyzes member data to determine who should move between sections based on
 * age progression and FlexiRecord assignments. Generates movement lists, section
 * summaries, and projected member counts after movements are completed.
 * 
 * @param {Array<object>} members - Array of member objects with personal and section data
 * @param {string} termStartDate - Term start date in ISO format (YYYY-MM-DD)
 * @param {Array<object>} [sections=[]] - Array of section objects with sectionid and sectionname
 * @param {object | null} [termObject=null] - Term object with type and year properties
 * @returns {object} Movement results with movers array and sectionSummaries Map
 * 
 * @example
 * // Calculate movements for autumn term
 * const movements = calculateSectionMovements(
 *   membersList,
 *   '2024-09-01',
 *   sectionsData,
 *   { type: 'Autumn', year: 2024 }
 * );
 * 
 * console.log(`${movements.movers.length} members will move sections`);
 * movements.sectionSummaries.forEach(summary => {
 *   console.log(`${summary.sectionName}: ${summary.outgoingMovers.length} leaving`);
 * });
 * 
 * @example
 * // Process movements with FlexiRecord assignments
 * const flexiMembers = await getFlexiRecordData();
 * const movements = calculateSectionMovements(flexiMembers, termDate, sections);
 * 
 * // FlexiRecord assignments override age-based calculations
 * const assignedMovers = movements.movers.filter(m => m.flexiRecordTerm);
 * const ageBasedMovers = movements.movers.filter(m => !m.flexiRecordTerm);
 * 
 * @example
 * // Generate section reports
 * const movements = calculateSectionMovements(members, termDate, sections);
 * movements.sectionSummaries.forEach((summary, sectionId) => {
 *   const report = {
 *     section: summary.sectionName,
 *     current: summary.currentMembers.length,
 *     leaving: summary.outgoingMovers.length,
 *     projected: summary.projectedCount
 *   };
 *   console.log(report);
 * });
 * 
 * @throws {Error} When members is not an array
 * @throws {Error} When termStartDate is invalid or missing
 * 
 * @since 2.3.7
 */
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

/**
 * Determine target section based on current section progression
 * 
 * Maps current section to next section in Scout progression hierarchy.
 * Uses section name pattern matching to handle various naming conventions
 * (e.g., "Monday Cubs", "Thursday Squirrels", etc.).
 * 
 * @param {string} currentSectionName - Current section name to map from
 * @returns {string|null} Target section name or null if no progression available
 * 
 * @example
 * // Standard progression mapping
 * console.log(getTargetSection('Monday Squirrels')); // "Beavers"
 * console.log(getTargetSection('Tuesday Beavers')); // "Cubs"
 * console.log(getTargetSection('Thursday Cubs')); // "Scouts"
 * console.log(getTargetSection('Friday Scouts')); // "Explorers"
 * 
 * @example
 * // Handle various naming patterns
 * const sections = ['1st Squirrels', 'Beaver Colony', 'Cub Pack', 'Scout Troop'];
 * const targets = sections.map(getTargetSection);
 * // ["Beavers", "Cubs", "Scouts", "Explorers"]
 * 
 * @example
 * // Unknown sections return null
 * console.log(getTargetSection('Network')); // null
 * console.log(getTargetSection('')); // null
 * console.log(getTargetSection(null)); // null
 * 
 * @private
 * @since 2.3.7
 */
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

/**
 * Group movement candidates by their target section
 * 
 * Organizes an array of movers into groups based on their destination section.
 * Useful for generating section-specific movement reports and managing
 * intake processes for receiving sections.
 * 
 * @param {Array<object>} movers - Array of mover objects with targetSection property
 * @returns {Map<string, Array<object>>} Map with target section names as keys and mover arrays as values
 * 
 * @example
 * // Group movers for intake processing
 * const movements = calculateSectionMovements(members, termDate, sections);
 * const grouped = groupMoversByTargetSection(movements.movers);
 * 
 * grouped.forEach((memberList, targetSection) => {
 *   console.log(`${targetSection} will receive ${memberList.length} new members:`);
 *   memberList.forEach(member => {
 *     console.log(`- ${member.name} from ${member.currentSection}`);
 *   });
 * });
 * 
 * @example
 * // Generate intake reports by section
 * const grouped = groupMoversByTargetSection(movers);
 * const intakeReport = Array.from(grouped.entries()).map(([section, members]) => ({
 *   targetSection: section,
 *   incomingCount: members.length,
 *   members: members.map(m => ({ name: m.name, currentSection: m.currentSection }))
 * }));
 * 
 * @example
 * // Handle empty or invalid input
 * const emptyGroups = groupMoversByTargetSection([]);
 * console.log(emptyGroups.size); // 0
 * 
 * const nullGroups = groupMoversByTargetSection(null);
 * console.log(nullGroups.size); // 0
 * 
 * @since 2.3.7
 */
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