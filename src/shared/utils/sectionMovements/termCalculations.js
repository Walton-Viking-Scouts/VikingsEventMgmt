import { format, isAfter } from 'date-fns';

export const TERM_TYPES = {
  AUTUMN: 'Autumn',
  SPRING: 'Spring', 
  SUMMER: 'Summer',
};

export const TERM_START_DATES = {
  AUTUMN: { month: 9, day: 1 },    // September 1st
  SPRING: { month: 1, day: 1 },    // January 1st
  SUMMER: { month: 4, day: 15 },   // April 15th
};

export function getCurrentTerm(currentDate = new Date()) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();
  
  const autumnStart = new Date(year, 8, 1); // September 1st
  const springStart = new Date(year, 0, 1); // January 1st  
  const summerStart = new Date(year, 3, 15); // April 15th
  
  if (isAfter(currentDate, autumnStart) || month === 9 && day >= 1) {
    return {
      type: TERM_TYPES.AUTUMN,
      year: year,
      startDate: format(autumnStart, 'yyyy-MM-dd'),
    };
  } else if (isAfter(currentDate, summerStart) || (month === 4 && day >= 15)) {
    return {
      type: TERM_TYPES.SUMMER,
      year: year,
      startDate: format(summerStart, 'yyyy-MM-dd'),
    };
  } else {
    return {
      type: TERM_TYPES.SPRING,
      year: year,
      startDate: format(springStart, 'yyyy-MM-dd'),
    };
  }
}

export function getNextTerm(currentTerm) {
  const { type, year } = currentTerm;
  
  switch (type) {
  case TERM_TYPES.AUTUMN:
    return {
      type: TERM_TYPES.SPRING,
      year: year + 1,
      startDate: `${year + 1}-01-01`,
    };
  case TERM_TYPES.SPRING:
    return {
      type: TERM_TYPES.SUMMER,
      year: year,
      startDate: `${year}-04-15`,
    };
  case TERM_TYPES.SUMMER:
    return {
      type: TERM_TYPES.AUTUMN,
      year: year,
      startDate: `${year}-09-01`,
    };
  default:
    throw new Error(`Unknown term type: ${type}`);
  }
}

export function getFutureTerms(numberOfTerms = 2, currentDate = new Date()) {
  const terms = [];
  let currentTerm = getCurrentTerm(currentDate);
  
  for (let i = 0; i < numberOfTerms; i++) {
    currentTerm = getNextTerm(currentTerm);
    terms.push({
      ...currentTerm,
      displayName: `${currentTerm.type} ${currentTerm.year}`,
    });
  }
  
  return terms;
}

export function getTermDisplayName(term) {
  return `${term.type} ${term.year}`;
}