// Term utility functions

/**
 * Find the most recent term from a list of terms
 * @param {Array} terms - Array of term objects with enddate property
 * @returns {Object|null} Most recent term object or null if no terms
 */
export function findMostRecentTerm(terms) {
  if (!terms || terms.length === 0) {
    return null;
  }

  return terms.reduce((latest, term) => {
    const termEndDate = new Date(term.enddate);
    const latestEndDate = latest ? new Date(latest.enddate) : new Date(0);
    return termEndDate > latestEndDate ? term : latest;
  }, null);
}

/**
 * Get the most recent term ID for a specific section
 * @param {number} sectionId - Section ID to find terms for
 * @param {Object} allTerms - Terms object keyed by section ID
 * @returns {string|null} Most recent term ID or null if not found
 */
export function getMostRecentTermId(sectionId, allTerms) {
  if (!allTerms || !allTerms[sectionId]) {
    console.warn(`No terms found for section ${sectionId}`);
    return null;
  }

  const mostRecentTerm = findMostRecentTerm(allTerms[sectionId]);
  
  if (!mostRecentTerm) {
    console.warn(`No valid term found for section ${sectionId}`);
    return null;
  }

  return mostRecentTerm.termid;
}