import { differenceInYears, differenceInMonths, parseISO, isValid } from 'date-fns';

export const SECTION_AGE_THRESHOLDS = {
  SQUIRRELS_TO_BEAVERS: 6,
  BEAVERS_TO_CUBS: 8,
  CUBS_TO_SCOUTS: 10.5,
  SCOUTS_TO_EXPLORERS: 14,
};

export const SECTION_TYPES = {
  SQUIRRELS: 'Squirrels',
  BEAVERS: 'Beavers',
  CUBS: 'Cubs',
  SCOUTS: 'Scouts',
  EXPLORERS: 'Explorers',
};

export const MOVEMENT_TRANSITIONS = [
  {
    from: SECTION_TYPES.SQUIRRELS,
    to: SECTION_TYPES.BEAVERS,
    ageThreshold: SECTION_AGE_THRESHOLDS.SQUIRRELS_TO_BEAVERS,
  },
  {
    from: SECTION_TYPES.BEAVERS,
    to: SECTION_TYPES.CUBS,
    ageThreshold: SECTION_AGE_THRESHOLDS.BEAVERS_TO_CUBS,
  },
  {
    from: SECTION_TYPES.CUBS,
    to: SECTION_TYPES.SCOUTS,
    ageThreshold: SECTION_AGE_THRESHOLDS.CUBS_TO_SCOUTS,
  },
  {
    from: SECTION_TYPES.SCOUTS,
    to: SECTION_TYPES.EXPLORERS,
    ageThreshold: SECTION_AGE_THRESHOLDS.SCOUTS_TO_EXPLORERS,
  },
];

/**
 * Calculates age in years (with decimal precision) at a specific date.
 * 
 * @param {string|Date} birthdate - Birth date as ISO string or Date object
 * @param {string|Date} targetDate - Target date for age calculation
 * @returns {number|null} Age in years with decimal precision, or null if invalid
 */
export function calculateAgeAtDate(birthdate, targetDate) {
  if (!birthdate || !targetDate) {
    throw new Error('Both birthdate and targetDate are required');
  }

  let birthdateObj;
  let targetDateObj;

  try {
    birthdateObj = typeof birthdate === 'string' ? parseISO(birthdate) : birthdate;
    targetDateObj = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;

    if (!isValid(birthdateObj) || !isValid(targetDateObj)) {
      return null;
    }
  } catch (error) {
    return null;
  }

  if (birthdateObj > targetDateObj) {
    return 0;
  }

  const years = differenceInYears(targetDateObj, birthdateObj);
  const months = differenceInMonths(targetDateObj, birthdateObj) % 12;
  
  return years + (months / 12);
}

/**
 * Determines if member will move up to next section based on age at term start.
 * 
 * @param {object} member - Member object with birth date and section information
 * @param {string|Date} termStartDate - Date when term starts
 * @returns {boolean} True if member should move to next section
 */
export function willMemberMoveUp(member, termStartDate) {
  const birthdate = member.date_of_birth || member.dob;
  if (!birthdate) {
    return false;
  }

  const ageAtTermStart = calculateAgeAtDate(birthdate, termStartDate);
  
  if (ageAtTermStart === null) {
    return false;
  }
  
  const sectionName = member.sectionname || member.currentSection;
  const currentSectionType = getSectionTypeFromName(sectionName);
  
  if (!currentSectionType) {
    return false;
  }

  const transition = MOVEMENT_TRANSITIONS.find(t => t.from === currentSectionType);
  
  if (!transition) {
    return false;
  }

  const shouldMove = ageAtTermStart >= transition.ageThreshold;

  return shouldMove;
}

/**
 * Determines section type from section name string.
 * 
 * @param {string} sectionName - Name of Scout section
 * @returns {string|null} Section type constant or null if not recognized
 */
function getSectionTypeFromName(sectionName) {
  if (!sectionName) return null;
  
  const normalized = sectionName.toLowerCase();
  
  if (normalized.includes('squirrel')) return SECTION_TYPES.SQUIRRELS;
  if (normalized.includes('beaver')) return SECTION_TYPES.BEAVERS;
  if (normalized.includes('cub')) return SECTION_TYPES.CUBS;
  if (normalized.includes('scout')) return SECTION_TYPES.SCOUTS;
  if (normalized.includes('explorer')) return SECTION_TYPES.EXPLORERS;
  
  return null;
}